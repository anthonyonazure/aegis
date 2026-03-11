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

async function fetchReportData(token: string, tenantName: string) {
  const [users, skus, secureScore, caPolicies, authMethods, riskyUsers] = await Promise.all([
    graphGet(token, '/users?$select=id,userType,accountEnabled,signInActivity&$top=999'),
    graphGet(token, '/subscribedSkus'),
    graphGet(token, '/security/secureScores?$top=1', true),
    graphGet(token, '/identity/conditionalAccess/policies'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
    graphGet(token, '/identityProtection/riskyUsers?$top=20', true),
  ]);

  const usersData = users?.value || [];
  const mfaEnabled = (authMethods?.value || []).filter((u: any) => u.isMfaRegistered).length;
  const ss = secureScore?.value?.[0];
  const skusData = skus?.value || [];
  let totalLic = 0, assignedLic = 0;
  skusData.forEach((s: any) => { totalLic += s.prepaidUnits?.enabled || 0; assignedLic += s.consumedUnits || 0; });

  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const staleAccounts = usersData.filter((u: any) => { const last = u.signInActivity?.lastSignInDateTime; return !last || new Date(last) < ninetyDaysAgo; }).length;

  return {
    tenantName,
    totalUsers: usersData.length,
    licensedUsers: usersData.filter((u: any) => u.userType !== 'Guest').length,
    adminUsers: 0, // would need directoryRoles
    guestUsers: usersData.filter((u: any) => u.userType === 'Guest').length,
    secureScore: ss?.currentScore || 0,
    maxSecureScore: ss?.maxScore || 0,
    mfaEnabledPercent: usersData.length > 0 ? Math.round((mfaEnabled / usersData.length) * 100) : 0,
    conditionalAccessPolicies: caPolicies?.value?.length || 0,
    staleAccounts,
    riskySignIns: (riskyUsers?.value || []).length,
    unusedLicenses: totalLic - assignedLic,
    totalLicenses: totalLic,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, reportType, tenantData: legacyData, dateRange, audience } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    let realData: any = legacyData || {};

    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const tenantsData: any[] = [];
      for (let i = 0; i < tenantConnectionIds.length; i++) {
        try {
          const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: tenantConnectionIds[i], p_user_id: user.id });
          if (!creds?.[0]) { tenantsData.push({ tenantName: tenantNames?.[i], error: 'No credentials' }); continue; }
          const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
          tenantsData.push(await fetchReportData(token, tenantNames?.[i] || 'Unknown'));
        } catch (e) { tenantsData.push({ tenantName: tenantNames?.[i], error: e instanceof Error ? e.message : 'Error' }); }
      }
      realData = tenantsData.length === 1 ? tenantsData[0] : tenantsData;
    }

    const systemPrompt = `You are a Microsoft 365 governance expert creating executive reports. Generate comprehensive, professional reports with REAL data. Tailor language to audience: executive (high-level), technical (detailed), board (strategic), compliance (audit-ready).

Return JSON with: reportMetadata, executiveSummary, sections, riskAssessment, complianceStatus, recommendations, appendix.`;

    const userPrompt = `Generate a ${reportType || 'governance'} report:

Audience: ${audience || 'executive'}
Period: ${dateRange || 'Last 30 days'}

REAL Tenant Data:
${JSON.stringify(realData, null, 2)}

Create a comprehensive report suitable for ${audience || 'executive'} stakeholders.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
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
    try { const m = content.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { executiveSummary: { overview: content } }; }
    catch { result = { reportMetadata: { title: 'Report', generatedAt: new Date().toISOString() }, executiveSummary: { overview: content, overallHealthScore: 70, trend: 'stable' } }; }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Report error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate report' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
