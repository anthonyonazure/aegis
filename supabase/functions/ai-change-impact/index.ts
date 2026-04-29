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

async function fetchCurrentConfig(token: string) {
  const [users, caPolicies, groups, skus] = await Promise.all([
    fetchGraph(token, '/users?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/identity/conditionalAccess/policies'),
    fetchGraph(token, '/groups?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/subscribedSkus'),
  ]);

  return {
    totalUsers: users?.['@odata.count'] || 0,
    totalGroups: groups?.['@odata.count'] || 0,
    conditionalAccessPolicies: (caPolicies?.value || []).map((p: any) => ({
      name: p.displayName,
      state: p.state,
      conditions: p.conditions,
      grantControls: p.grantControls?.builtInControls || [],
    })),
    licenses: (skus?.value || []).map((s: any) => ({
      sku: s.skuPartNumber,
      consumed: s.consumedUnits,
      total: s.prepaidUnits?.enabled || 0,
    })),
  };
}

const CHANGE_IMPACT_PROMPT = `You are an expert Microsoft 365 configuration analyst. Analyze proposed configuration changes and predict their impact on security, compliance, user experience, and operations.

${/* Will be enriched per-request */ ''}
Return a JSON object:
{
  "summary": {
    "overallRisk": "critical" | "high" | "medium" | "low",
    "confidenceLevel": number (0-100),
    "recommendedAction": "proceed" | "proceed_with_caution" | "review_required" | "do_not_proceed",
    "estimatedDowntime": "string",
    "affectedUsersCount": number,
    "rollbackComplexity": "simple" | "moderate" | "complex"
  },
  "impactCategories": {
    "security": { "impact": "string", "severity": "string", "details": ["string"], "mitigations": ["string"] },
    "compliance": { "impact": "string", "severity": "string", "affectedFrameworks": ["string"], "details": ["string"], "mitigations": ["string"] },
    "userExperience": { "impact": "string", "severity": "string", "affectedWorkflows": ["string"], "details": ["string"], "mitigations": ["string"] },
    "operations": { "impact": "string", "severity": "string", "details": ["string"], "mitigations": ["string"] },
    "performance": { "impact": "string", "severity": "string", "details": ["string"], "mitigations": ["string"] }
  },
  "affectedResources": [{ "resourceType": "string", "resourceName": "string", "changeType": "string", "riskLevel": "string", "dependencies": ["string"], "impactDescription": "string" }],
  "userImpactAnalysis": { "directlyAffected": { "count": number, "groups": ["string"], "impactType": "string" }, "indirectlyAffected": { "count": number, "groups": ["string"], "impactType": "string" }, "requiredCommunication": ["string"], "trainingNeeded": boolean },
  "testingRecommendations": { "preDeployment": [{ "test": "string", "priority": "string", "description": "string" }], "postDeployment": [{ "test": "string", "priority": "string", "description": "string" }] },
  "rollbackPlan": { "steps": ["string"], "estimatedTime": "string", "dataLossRisk": "string", "automationAvailable": boolean },
  "deploymentRecommendations": { "suggestedTiming": "string", "phaseApproach": boolean, "phases": [{ "name": "string", "scope": "string", "duration": "string", "successCriteria": ["string"] }] },
  "risks": [{ "risk": "string", "probability": "string", "impact": "string", "mitigation": "string" }]
}

IMPORTANT: If live tenant configuration is provided, use the actual user counts, policy states, and license data to calculate realistic affected user counts and impact assessments.`;

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
    const { proposedChanges, currentConfig, tenantData, tenantConnectionIds } = await req.json();

    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    // Fetch real current config if available
    let liveConfig: any = null;
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
        const { data: creds } = await supabase.rpc('get_decrypted_credential', {
          p_tenant_connection_id: connIds[0],
          p_user_id: user.id,
        });
        if (creds?.length > 0) {
          try {
            const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
            liveConfig = await fetchCurrentConfig(token);
            console.log('Live config fetched for change impact:', {
              users: liveConfig.totalUsers,
              caPolicies: liveConfig.conditionalAccessPolicies.length,
            });
          } catch (e) {
            console.error('Failed to fetch live config:', e);
          }
        }
      }
    }

    const effectiveConfig = liveConfig || currentConfig || {};

    const contextData = {
      proposedChanges: proposedChanges || {},
      currentConfiguration: effectiveConfig,
      tenantInfo: tenantData || {},
      analysisDate: new Date().toISOString(),
      dataSource: liveConfig ? 'live-graph-api' : 'user-provided',
    };

    console.log('Analyzing change impact:', Object.keys(proposedChanges || {}).length, 'changes', liveConfig ? '(live data)' : '');

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CHANGE_IMPACT_PROMPT },
          { role: 'user', content: `Analyze the impact of these proposed changes:\n\n${JSON.stringify(contextData, null, 2)}` }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    let analysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0]);
      else throw new Error('No JSON found');
    } catch {
      analysisResult = { error: 'Failed to parse analysis', raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult, _dataSource: liveConfig ? 'live' : 'user-provided' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Change impact error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
