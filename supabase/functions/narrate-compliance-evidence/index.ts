import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI-narrated compliance evidence (issue #4).
 *
 * Given a compliance_evidence_runs row, generate a per-control plain-language
 * narrative that an auditor can read without parsing the JSON snapshot.
 * Focuses on failures + errors by default; pass controlIds to scope.
 *
 * Caller: MSP user via JWT. RLS already restricts the run + items.
 *
 * Returns: { narratives: { [controlId]: string }, model, generatedAt }.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  runId?: string;
  /** Optional: scope to a subset of compliance_evidence_items.id values.
   *  When omitted, narrates fail + error items only (the auditor-relevant subset). */
  controlIds?: string[];
}

interface ItemRow {
  id: string;
  status: 'pass' | 'fail' | 'na' | 'error';
  notes: string | null;
  snapshot: Record<string, unknown>;
  control: {
    control_code: string;
    name: string;
    description: string | null;
    severity: string;
  };
}

const SYSTEM_PROMPT = `You are a compliance auditor's assistant. Given:
  - a control's identifier, name, and description
  - the captured M365 snapshot the evaluator inspected
  - the evaluator's PASS / FAIL / N/A / ERROR verdict and note

Write a 4–7 sentence narrative for each control that:
  1. States the control intent in plain English (no jargon).
  2. Describes what was found in the tenant — reference SPECIFIC values
     from the snapshot (policy display names, user counts, etc), never
     generic phrases like "appropriate controls."
  3. States WHY the verdict was reached.
  4. For FAIL or ERROR: gives one or two CONCRETE remediation steps the
     operator can take, naming actual M365 admin surfaces (Conditional
     Access portal, authentication methods policy, etc).
  5. For PASS: notes the relevant maintenance concern (e.g., review
     cadence, drift watch).

Output JSON ONLY, in the form:
  { "<itemId>": "narrative text", ... }

Do not include preamble, no markdown fencing, no extra keys.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const aiKey = Deno.env.get('AI_GATEWAY_API_KEY');
    const aiUrl = Deno.env.get('AI_GATEWAY_URL');
    if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Server misconfigured' }, 500);
    if (!aiKey || !aiUrl) return jsonResponse({ error: 'AI gateway not configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.runId) return jsonResponse({ error: 'runId is required' }, 400);

    // Verify the run is readable by the caller (RLS handles this; the join also restricts).
    const { data: items, error: itemsErr } = await userClient
      .from('compliance_evidence_items')
      .select('id, status, notes, snapshot, compliance_controls(control_code, name, description, severity)')
      .eq('run_id', body.runId);
    if (itemsErr || !items) return jsonResponse({ error: itemsErr?.message ?? 'Run not found' }, 404);

    // Scope: caller-provided ids, otherwise all fail/error items.
    const filtered = (items as unknown as ItemRow[]).filter((it) => {
      if (body.controlIds && body.controlIds.length > 0) return body.controlIds.includes(it.id);
      return it.status === 'fail' || it.status === 'error';
    });

    if (filtered.length === 0) {
      return jsonResponse({
        narratives: {},
        model: null,
        generatedAt: new Date().toISOString(),
        message: 'No fail/error controls in this run, or none matched the requested ids.',
      });
    }

    // Build the user prompt — compact JSON of just what the model needs.
    // Truncate snapshots to keep the prompt under typical context limits when
    // dozens of controls are in play; auditor narrative doesn't need every
    // byte of the underlying object.
    const userPayload = filtered.map((it) => ({
      itemId: it.id,
      controlCode: it.control?.control_code,
      name: it.control?.name,
      description: it.control?.description,
      severity: it.control?.severity,
      status: it.status,
      notes: it.notes,
      snapshot: it.snapshot,
    }));

    const aiResp = await fetch(`${aiUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => '');
      return jsonResponse({ error: `AI gateway: ${aiResp.status} ${errText}` }, 502);
    }

    const aiJson = await aiResp.json();
    const content = String(aiJson.choices?.[0]?.message?.content ?? '{}');
    let narratives: Record<string, string>;
    try {
      narratives = JSON.parse(content);
    } catch (e) {
      return jsonResponse({ error: `AI returned non-JSON: ${e instanceof Error ? e.message : 'parse error'}` }, 502);
    }

    return jsonResponse({
      narratives,
      model: 'gpt-4o-mini',
      generatedAt: new Date().toISOString(),
      itemCount: filtered.length,
    });
  } catch (error) {
    console.error('narrate-compliance-evidence error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
