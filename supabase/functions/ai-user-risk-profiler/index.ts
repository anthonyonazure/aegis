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

async function fetchUserRiskData(token: string) {
  const [riskyUsers, signInLogs, directoryRoles, authMethods] = await Promise.all([
    graphGet(token, '/identityProtection/riskyUsers?$top=50', true),
    graphGet(token, '/auditLogs/signIns?$top=100&$orderby=createdDateTime desc', true),
    graphGet(token, '/directoryRoles?$expand=members'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
  ]);

  const adminUserIds = new Set<string>();
  for (const role of (directoryRoles?.value || [])) {
    for (const m of (role.members || [])) {
      if (m['@odata.type'] === '#microsoft.graph.user') adminUserIds.add(m.id);
    }
  }

  return {
    riskyUsers: (riskyUsers?.value || []).map((u: any) => ({
      displayName: u.userDisplayName, userPrincipalName: u.userPrincipalName,
      riskLevel: u.riskLevel, riskState: u.riskState, riskDetail: u.riskDetail,
      lastUpdated: u.riskLastUpdatedDateTime, isAdmin: adminUserIds.has(u.id),
    })),
    recentSignIns: (signInLogs?.value || []).slice(0, 50).map((s: any) => ({
      user: s.userDisplayName || s.userPrincipalName, location: s.location?.city ? `${s.location.city}, ${s.location.countryOrRegion}` : 'Unknown',
      ip: s.ipAddress, timestamp: s.createdDateTime, status: s.status?.errorCode === 0 ? 'Success' : 'Failed',
      riskLevel: s.riskLevelDuringSignIn || 'none', app: s.appDisplayName, clientApp: s.clientAppUsed,
    })),
    adminCount: adminUserIds.size,
    mfaRegistration: {
      total: (authMethods?.value || []).length,
      registered: (authMethods?.value || []).filter((u: any) => u.isMfaRegistered).length,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, userData: legacyData, tenantContext: legacyContext } = await req.json();
    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    let realUserData: any = legacyData || {};
    let realContext: any = legacyContext || {};

    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const connId = tenantConnectionIds[0];
      const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: connId, p_user_id: user.id });
      if (creds?.[0]) {
        const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
        realUserData = await fetchUserRiskData(token);
        realContext = { tenantName: tenantNames?.[0] || 'Unknown', tenantId: creds[0].tenant_id };
      }
    }

    const systemPrompt = `You are an AI security analyst specializing in user behavior analysis and risk profiling for Microsoft 365 environments.

Analyze REAL user data and behavior patterns to generate comprehensive risk profiles. Consider sign-in patterns, device/location diversity, access to sensitive resources, privilege levels, compliance violations, data handling, external collaboration.

Return JSON with: overallRiskScore, riskLevel, riskTrend, confidenceScore, riskCategories, behaviorAnalysis, riskIndicators, comparisonToPeers, recommendations, monitoringPlan, accessReview.`;

    const userPrompt = `Analyze this REAL user risk data:

User Data:
${JSON.stringify(realUserData, null, 2)}

Tenant Context:
${JSON.stringify(realContext, null, 2)}

Provide a comprehensive risk profile with actionable recommendations.`;

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, max_tokens: 4000 }),
    });

    if (!response.ok) { const t = await response.text(); throw new Error(`AI error: ${response.status} ${t}`); }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No AI response');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('User risk profiler error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
