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
  e.count++; return true;
}

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }).toString(),
  });
  if (!resp.ok) throw new Error(`Token error: ${resp.status}`);
  return (await resp.json()).access_token;
}

async function graphGet(token: string, ep: string, beta = false) {
  const r = await fetch(`${beta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0'}${ep}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.error(`Graph ${ep}: ${r.status}`); return null; }
  return r.json();
}

async function fetchSecurityData(token: string) {
  const [secureScores, riskyUsers, riskySignIns, caPolicies, authMethods, users] = await Promise.all([
    graphGet(token, '/security/secureScores?$top=7', true),
    graphGet(token, '/identityProtection/riskyUsers?$top=50', true),
    graphGet(token, '/identityProtection/riskySignInDetections?$top=100', true),
    graphGet(token, '/identity/conditionalAccess/policies'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
    graphGet(token, '/users?$select=id,userType,accountEnabled&$top=999'),
  ]);

  const scores = secureScores?.value || [];
  const usersData = users?.value || [];
  const authData = authMethods?.value || [];
  const mfaEnabled = authData.filter((u: any) => u.isMfaRegistered).length;
  const riskyUsersData = riskyUsers?.value || [];
  const riskySignInsData = riskySignIns?.value || [];

  return {
    secureScore: scores[0]?.currentScore || 0,
    maxSecureScore: scores[0]?.maxScore || 100,
    secureScoreTrend: scores.map((s: any) => s.currentScore).reverse(),
    mfaAdoption: usersData.length > 0 ? Math.round((mfaEnabled / usersData.length) * 100) : 0,
    conditionalAccessPolicies: caPolicies?.value?.length || 0,
    riskyUsers: riskyUsersData.filter((u: any) => u.riskState === 'atRisk').length,
    riskySignIns: riskySignInsData.length,
    riskySignInsHigh: riskySignInsData.filter((s: any) => s.riskLevel === 'high').length,
    staleAccounts: usersData.filter((u: any) => !u.accountEnabled).length,
    totalUsers: usersData.length,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, securityData: legacyData, historicalTrends: legacyTrends } = await req.json();
    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    let realSecurityData: any = legacyData || {};
    let realTrends: any = legacyTrends || {};

    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Fetch from first tenant connection
      const connId = tenantConnectionIds[0];
      const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: connId, p_user_id: user.id });
      if (creds?.[0]) {
        const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
        realSecurityData = await fetchSecurityData(token);
        realTrends = { secureScoreTrend: realSecurityData.secureScoreTrend, mfaAdoptionTrend: [realSecurityData.mfaAdoption] };

        // Also try to get historical data from DB
        const { data: history } = await supabase.from('governance_metrics_history').select('secure_score, mfa_enabled_users, total_users, risky_sign_ins, recorded_at').eq('tenant_connection_id', connId).order('recorded_at', { ascending: false }).limit(10);
        if (history?.length) {
          realTrends.secureScoreTrend = history.map((h: any) => h.secure_score).reverse();
          realTrends.mfaAdoptionTrend = history.map((h: any) => h.total_users > 0 ? Math.round((h.mfa_enabled_users / h.total_users) * 100) : 0).reverse();
          realTrends.riskySignInsTrend = history.map((h: any) => h.risky_sign_ins || 0).reverse();
        }
      }
    }

    const systemPrompt = `You are a cybersecurity AI analyst specializing in Microsoft 365 security. Analyze REAL security data and predict future risks based on current trends and patterns.

ALWAYS respond with valid JSON with: currentPosture, predictions, riskTrajectory, emergingThreats, vulnerabilityForecast, attackSurfaceAnalysis, complianceRiskForecast, prioritizedActions.`;

    const userPrompt = `Analyze this REAL security data and predict future security posture:

Current Security Data:
${JSON.stringify(realSecurityData, null, 2)}

Historical Trends:
${JSON.stringify(realTrends, null, 2)}

Provide detailed predictions with confidence levels and actionable recommendations.`;

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.4 }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'API credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await response.text(); throw new Error(`AI error: ${response.status} ${t}`);
    }

    const aiResp = await response.json();
    const content = aiResp.choices?.[0]?.message?.content;
    if (!content) throw new Error('No AI response');

    let result;
    try { const m = content.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { error: 'No JSON' }; }
    catch { result = { currentPosture: { overallScore: 70, riskLevel: 'medium', trend: 'stable', confidenceLevel: 75 }, predictions: [], rawResponse: content }; }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Prediction error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to predict' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
