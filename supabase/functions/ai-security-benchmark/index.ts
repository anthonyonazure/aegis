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

async function fetchSecurityTelemetry(token: string) {
  const [users, secureScore, caPolicies, authMethods, riskyUsers, skus] = await Promise.all([
    graphGet(token, '/users?$select=id,userType,accountEnabled&$top=999'),
    graphGet(token, '/security/secureScores?$top=1', true),
    graphGet(token, '/identity/conditionalAccess/policies'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
    graphGet(token, '/identityProtection/riskyUsers?$top=50', true),
    graphGet(token, '/subscribedSkus'),
  ]);

  const usersData = users?.value || [];
  const authData = authMethods?.value || [];
  const mfaEnabled = authData.filter((u: any) => u.isMfaRegistered).length;
  const ss = secureScore?.value?.[0];
  const caData = caPolicies?.value || [];

  return {
    totalUsers: usersData.length,
    guestUsers: usersData.filter((u: any) => u.userType === 'Guest').length,
    mfaCoverage: usersData.length > 0 ? Math.round((mfaEnabled / usersData.length) * 100) : 0,
    secureScore: ss?.currentScore || 0,
    maxSecureScore: ss?.maxScore || 0,
    secureScorePercentage: ss ? Math.round((ss.currentScore / ss.maxScore) * 100) : 0,
    conditionalAccessPolicies: caData.length,
    enabledCAPolicies: caData.filter((p: any) => p.state === 'enabled').length,
    caPolicySummary: caData.map((p: any) => ({ name: p.displayName, state: p.state })),
    riskyUsersCount: riskyUsers?.value?.length || 0,
    highRiskUsers: (riskyUsers?.value || []).filter((u: any) => u.riskLevel === 'high').length,
    totalLicenses: (skus?.value || []).reduce((acc: number, s: any) => acc + (s.prepaidUnits?.enabled || 0), 0),
    hasE5: (skus?.value || []).some((s: any) => s.skuPartNumber?.includes('SPE_E5')),
    hasAadP2: (skus?.value || []).some((s: any) => s.skuPartNumber?.includes('AAD_PREMIUM_P2')),
  };
}

const BENCHMARK_PROMPT = `You are an expert Microsoft 365 security analyst. Analyze the provided REAL tenant security configuration and compare it against industry benchmarks, best practices, and peer organizations.

Return a JSON object with this structure:
{
  "summary": { "overallScore": 0, "industryPercentile": 0, "securityMaturityLevel": "initial", "trend": "stable", "riskExposure": "medium", "complianceReadiness": 0 },
  "categoryScores": {
    "identity": { "score": 0, "benchmark": 0, "percentile": 0, "gap": 0, "status": "at", "keyFindings": [] },
    "deviceSecurity": { "score": 0, "benchmark": 0, "percentile": 0, "gap": 0, "status": "at", "keyFindings": [] },
    "dataProtection": { "score": 0, "benchmark": 0, "percentile": 0, "gap": 0, "status": "at", "keyFindings": [] },
    "threatProtection": { "score": 0, "benchmark": 0, "percentile": 0, "gap": 0, "status": "at", "keyFindings": [] },
    "governance": { "score": 0, "benchmark": 0, "percentile": 0, "gap": 0, "status": "at", "keyFindings": [] }
  },
  "industryComparison": { "industry": "", "sampleSize": 0, "yourRank": "", "topPerformers": { "avgScore": 0, "characteristics": [] }, "industryAverage": { "avgScore": 0, "commonWeaknesses": [] }, "bottomPerformers": { "avgScore": 0, "risks": [] } },
  "controlsAnalysis": [{ "control": "", "category": "", "yourStatus": "implemented", "industryAdoption": 0, "criticality": "high", "recommendation": "", "effort": "low", "impact": 0 }],
  "maturityAssessment": { "currentLevel": 1, "targetLevel": 3, "dimensions": [{ "name": "", "current": 0, "target": 0, "gap": 0, "improvements": [] }] },
  "peerComparison": { "similarOrgs": { "criteria": [], "count": 0, "yourPosition": "" }, "strengthsVsPeers": [], "weaknessesVsPeers": [], "uniqueAdvantages": [] },
  "improvementRoadmap": [{ "phase": "", "duration": "", "objectives": [], "expectedScoreImprovement": 0, "investments": [], "milestones": [] }],
  "riskHeatmap": [{ "area": "", "likelihood": "medium", "impact": "medium", "currentMitigation": "", "recommendedAction": "" }],
  "quickWins": [{ "action": "", "scoreImpact": 0, "effort": "low", "timeframe": "" }]
}

Base your analysis on Microsoft Secure Score benchmarks, CIS Controls, and real-world security standards.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, tenantData: legacyData, industry, companySize } = await req.json();
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
          tenantsData.push({ tenantName: tenantNames?.[i] || 'Unknown', ...(await fetchSecurityTelemetry(token)) });
        } catch (e) {
          tenantsData.push({ tenantName: tenantNames?.[i], error: e instanceof Error ? e.message : 'Error' });
        }
      }
      realData = tenantsData.length === 1 ? tenantsData[0] : { tenants: tenantsData };
    }

    const contextData = { tenant: realData, industry: industry || 'Technology', companySize: companySize || 'medium', analysisDate: new Date().toISOString() };
    console.log('Running security benchmark with real data');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'system', content: BENCHMARK_PROMPT }, { role: 'user', content: `Analyze and benchmark this REAL tenant security data:\n\n${JSON.stringify(contextData, null, 2)}` }], temperature: 0.3, max_tokens: 8000 }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await response.text(); throw new Error(`AI error: ${response.status} ${t}`);
    }

    const aiResp = await response.json();
    const content = aiResp.choices?.[0]?.message?.content || '';
    let result;
    try { const m = content.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { error: 'No JSON' }; }
    catch { result = { error: 'Parse failed', raw: content }; }

    return new Response(JSON.stringify({ success: true, analysis: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Security benchmark error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
