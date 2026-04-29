import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Phase 2 #6 — execute a plugin against the AI gateway.
 *
 * Flow:
 *   1. Auth caller, load the plugin (RLS already restricts to mine + public).
 *   2. Validate inputs against the plugin's input_schema.
 *   3. (Optional) Fetch a small tenant context object via Graph if the
 *      plugin sets requires_tenant; expose as {{tenantContext}}.
 *   4. Substitute {{var}} placeholders in prompt_template.
 *   5. POST to AI_GATEWAY_URL/chat/completions with plugin's model + temp.
 *   6. Insert a plugin_runs row (running -> completed/failed).
 *   7. Return the AI text + run id.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InputField {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'number' | 'tenantId';
  required?: boolean;
  default?: string | number;
  helpText?: string;
}

interface PluginRow {
  id: string;
  user_id: string;
  name: string;
  prompt_template: string;
  input_schema: InputField[] | null;
  requires_tenant: boolean;
  default_model: string | null;
  default_temperature: number | null;
}

interface Body {
  pluginId?: string;
  inputs?: Record<string, unknown>;
  tenantConnectionId?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  // Simple {{name}} substitution — no expression evaluation, no logic.
  // Unknown placeholders are left intact so the AI can comment on them
  // rather than silently dropping them.
  return tpl.replace(/\{\{\s*([a-zA-Z_][\w-]*)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`
  );
}

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Graph token error: ${res.status}`);
  return (await res.json()).access_token as string;
}

async function fetchTenantContext(token: string): Promise<Record<string, unknown>> {
  const get = async (path: string) => {
    try {
      const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
      });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const [users, ca, skus] = await Promise.all([
    get('/users?$count=true&$top=1&$select=id'),
    get('/identity/conditionalAccess/policies'),
    get('/subscribedSkus'),
  ]);
  return {
    totalUsers: users?.['@odata.count'] ?? 0,
    conditionalAccessPolicies: (ca?.value ?? []).map((p: Record<string, unknown>) => ({
      name: p.displayName,
      state: p.state,
    })),
    licenses: (skus?.value ?? []).map((s: Record<string, unknown>) => ({
      sku: s.skuPartNumber,
      consumed: s.consumedUnits,
      total: (s.prepaidUnits as Record<string, unknown> | undefined)?.enabled,
    })),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const aiKey = Deno.env.get('AI_GATEWAY_API_KEY');
    const aiUrl = Deno.env.get('AI_GATEWAY_URL');
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500);
    if (!aiKey || !aiUrl) return jsonResponse({ error: 'AI gateway not configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.pluginId) return jsonResponse({ error: 'pluginId is required' }, 400);

    // Load plugin (RLS allows: mine OR public)
    const { data: plugin, error: pErr } = await userClient
      .from('plugins')
      .select('id, user_id, name, prompt_template, input_schema, requires_tenant, default_model, default_temperature')
      .eq('id', body.pluginId)
      .maybeSingle();
    if (pErr || !plugin) return jsonResponse({ error: 'Plugin not found or access denied' }, 404);
    const pluginRow = plugin as PluginRow;

    // Validate inputs against schema
    const schema = Array.isArray(pluginRow.input_schema) ? pluginRow.input_schema : [];
    const inputs: Record<string, unknown> = body.inputs ?? {};
    const finalVars: Record<string, string> = {};
    for (const field of schema) {
      const value = inputs[field.name] ?? field.default;
      if (field.required && (value === undefined || value === null || value === '')) {
        return jsonResponse({ error: `Missing required input: ${field.name}` }, 400);
      }
      if (value !== undefined && value !== null) {
        finalVars[field.name] = String(value);
      }
    }

    // Optional tenant context
    let tenantContextStr = '';
    if (pluginRow.requires_tenant) {
      if (!body.tenantConnectionId) {
        return jsonResponse({ error: 'This plugin requires tenantConnectionId' }, 400);
      }
      // Verify ownership of the tenant via the user-scoped client
      const { data: tenant } = await userClient
        .from('tenant_connections')
        .select('id')
        .eq('id', body.tenantConnectionId)
        .maybeSingle();
      if (!tenant) return jsonResponse({ error: 'Tenant not found or access denied' }, 404);

      const { data: credRows } = await userClient.rpc('get_decrypted_credential', {
        p_tenant_connection_id: body.tenantConnectionId,
        p_user_id: user.id,
      });
      if (credRows?.length) {
        const cred = credRows[0] as { tenant_id: string; client_id: string; client_secret: string };
        try {
          const token = await getGraphToken(cred.client_id, cred.client_secret, cred.tenant_id);
          const ctx = await fetchTenantContext(token);
          tenantContextStr = JSON.stringify(ctx, null, 2);
        } catch (e) {
          console.error('Tenant context fetch failed:', e);
        }
      }
    }
    finalVars.tenantContext = tenantContextStr;

    const filledPrompt = fillTemplate(pluginRow.prompt_template, finalVars);
    const model = pluginRow.default_model || 'gpt-4o-mini';
    const temperature = pluginRow.default_temperature ?? 0.3;

    // Insert a 'running' run row
    const adminClient = createClient(supabaseUrl, serviceKey);
    const startedAt = Date.now();
    const { data: runRow } = await adminClient
      .from('plugin_runs')
      .insert({
        user_id: user.id,
        plugin_id: pluginRow.id,
        tenant_connection_id: body.tenantConnectionId ?? null,
        inputs: inputs,
        status: 'running',
        model,
      })
      .select('id')
      .single();
    const runId = runRow?.id as string | undefined;

    // Call AI gateway
    let output = '';
    let runStatus: 'completed' | 'failed' = 'completed';
    let runError: string | null = null;
    try {
      const aiResp = await fetch(`${aiUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature,
          messages: [{ role: 'user', content: filledPrompt }],
        }),
      });
      if (!aiResp.ok) {
        runStatus = 'failed';
        runError = `AI gateway: ${aiResp.status}`;
      } else {
        const aiJson = await aiResp.json();
        output = String(aiJson.choices?.[0]?.message?.content ?? '');
      }
    } catch (e) {
      runStatus = 'failed';
      runError = e instanceof Error ? e.message : 'AI call failed';
    }

    // Update the run row with results
    if (runId) {
      await adminClient
        .from('plugin_runs')
        .update({
          status: runStatus,
          output: output || null,
          error: runError,
          duration_ms: Date.now() - startedAt,
        })
        .eq('id', runId);
    }

    if (runStatus === 'failed') {
      return jsonResponse({ success: false, runId, error: runError ?? 'Plugin run failed' }, 500);
    }

    return jsonResponse({
      success: true,
      runId,
      output,
      model,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('run-plugin error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
