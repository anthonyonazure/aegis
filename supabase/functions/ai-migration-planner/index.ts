import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const _rl = new Map<string, { count: number; resetAt: number }>();
function _checkRate(key: string, max = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const e = _rl.get(key);
  if (!e || now > e.resetAt) { _rl.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }).toString(),
  });
  if (!resp.ok) throw new Error(`Token error: ${resp.status}`);
  return (await resp.json()).access_token;
}

async function fetchGraph(token: string, endpoint: string): Promise<any> {
  const resp = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchTenantSnapshot(token: string) {
  const [users, groups, skus, caPolicies, apps, domains] = await Promise.all([
    fetchGraph(token, '/users?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/groups?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/subscribedSkus'),
    fetchGraph(token, '/identity/conditionalAccess/policies'),
    fetchGraph(token, '/applications?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/domains'),
  ]);

  return {
    totalUsers: users?.['@odata.count'] || users?.value?.length || 0,
    totalGroups: groups?.['@odata.count'] || groups?.value?.length || 0,
    totalApps: apps?.['@odata.count'] || apps?.value?.length || 0,
    licenses: (skus?.value || []).map((s: any) => s.skuPartNumber),
    conditionalAccessPolicies: caPolicies?.value?.length || 0,
    domains: (domains?.value || []).map((d: any) => d.id),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  try {
    const { sourceConfig, targetConfig, migrationType, requirements, tenantConnectionIds, tenantNames } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Fetch real tenant snapshots if connections provided
    let sourceSnapshot: any = null;
    let targetSnapshot: any = null;
    const connIds = tenantConnectionIds || [];

    if (connIds.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // First connection = source, second = target (if available)
        for (let i = 0; i < Math.min(connIds.length, 2); i++) {
          const { data: creds } = await supabase.rpc('get_decrypted_credential', {
            p_tenant_connection_id: connIds[i],
            p_user_id: user.id,
          });
          if (creds?.length > 0) {
            try {
              const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
              const snapshot = await fetchTenantSnapshot(token);
              const name = tenantNames?.[i] || `Tenant ${i + 1}`;
              if (i === 0) sourceSnapshot = { tenantName: name, ...snapshot };
              else targetSnapshot = { tenantName: name, ...snapshot };
              console.log(`Fetched snapshot for ${name}:`, snapshot);
            } catch (e) {
              console.error(`Failed to fetch tenant ${i} snapshot:`, e);
            }
          }
        }
      }
    }

    const effectiveSource = sourceSnapshot || sourceConfig || {};
    const effectiveTarget = targetSnapshot || targetConfig || {};

    const systemPrompt = `You are a Microsoft 365 migration expert. Create comprehensive migration plans for tenant-to-tenant migrations, consolidations, or configuration transfers.

${sourceSnapshot ? 'IMPORTANT: Source tenant data is REAL, fetched from Microsoft Graph API. Use actual counts and configurations.' : ''}
${targetSnapshot ? 'IMPORTANT: Target tenant data is REAL, fetched from Microsoft Graph API.' : ''}

ALWAYS respond with valid JSON in this exact format:
{
  "planOverview": {
    "migrationType": "string",
    "complexity": "simple" | "moderate" | "complex" | "enterprise",
    "estimatedDuration": "string",
    "estimatedCost": "string",
    "riskLevel": "low" | "medium" | "high",
    "readinessScore": number (0-100)
  },
  "preRequisites": [{ "category": "string", "requirement": "string", "status": "ready" | "action-needed" | "blocker", "actionRequired": "string or null" }],
  "phases": [{ "phaseNumber": number, "name": "string", "duration": "string", "description": "string", "tasks": [{ "id": "string", "task": "string", "owner": "string", "duration": "string", "dependencies": [], "automatable": boolean, "script": "string" }], "milestones": ["string"], "rollbackPlan": "string" }],
  "resourceMapping": [{ "resourceType": "string", "sourceCount": number, "targetAction": "migrate" | "recreate" | "skip" | "merge", "complexity": "low" | "medium" | "high", "notes": "string" }],
  "riskAssessment": [{ "risk": "string", "likelihood": "low" | "medium" | "high", "impact": "low" | "medium" | "high", "mitigation": "string", "contingency": "string" }],
  "estimatedTimeline": { "planning": "string", "preparation": "string", "pilotMigration": "string", "fullMigration": "string", "validation": "string", "total": "string" }
}`;

    const userPrompt = `Create a migration plan:

Migration Type: ${migrationType || 'Tenant-to-Tenant Configuration Migration'}

Source Tenant:
${JSON.stringify(effectiveSource, null, 2)}

Target Tenant:
${JSON.stringify(effectiveTarget, null, 2)}

Requirements: ${requirements || 'Minimize downtime, maintain security posture, preserve all configurations'}`;

    console.log('Creating migration plan...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'API credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('No JSON found');
    } catch {
      result = { planOverview: { migrationType: 'Configuration Migration', complexity: 'moderate', estimatedDuration: 'TBD', riskLevel: 'medium', readinessScore: 70 }, phases: [], rawResponse: content };
    }

    result._dataSource = sourceSnapshot ? 'live' : 'user-provided';
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Migration planner error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create migration plan' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
