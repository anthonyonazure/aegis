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

async function graphGet(token: string, ep: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${ep}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.error(`Graph ${ep}: ${r.status}`); return null; }
  return r.json();
}

async function fetchLicenseData(token: string) {
  const [skus, users] = await Promise.all([
    graphGet(token, '/subscribedSkus'),
    graphGet(token, '/users?$select=id&$top=999'),
  ]);

  const skusData = skus?.value || [];
  // Known M365 monthly per-user prices (approximate)
  const priceMap: Record<string, number> = {
    'SPE_E5': 57, 'SPE_E3': 36, 'SPE_E1': 10, 'ENTERPRISEPREMIUM': 57, 'ENTERPRISEPACK': 36, 'STANDARDPACK': 10,
    'POWER_BI_PRO': 10, 'PROJECTPREMIUM': 55, 'PROJECTPROFESSIONAL': 30, 'VISIOCLIENT': 15,
    'EMSPREMIUM': 16, 'EMS': 11, 'AAD_PREMIUM_P2': 9, 'AAD_PREMIUM': 6,
    'MICROSOFT_365_COPILOT': 30, 'Microsoft_365_Copilot': 30,
  };

  const licenses = skusData.map((s: any) => {
    const total = s.prepaidUnits?.enabled || 0;
    const assigned = s.consumedUnits || 0;
    const name = s.skuPartNumber || 'Unknown';
    const price = priceMap[name] || 0;
    return { name, total, assigned, unused: total - assigned, monthlyPerUserCost: price, totalMonthlyCost: total * price, unusedMonthlyCost: (total - assigned) * price };
  }).filter((l: any) => l.total > 0);

  return {
    totalUsers: users?.value?.length || 0,
    licenses,
    totalMonthlyCost: licenses.reduce((acc: number, l: any) => acc + l.totalMonthlyCost, 0),
    totalUnusedCost: licenses.reduce((acc: number, l: any) => acc + l.unusedMonthlyCost, 0),
    totalLicenses: licenses.reduce((acc: number, l: any) => acc + l.total, 0),
    assignedLicenses: licenses.reduce((acc: number, l: any) => acc + l.assigned, 0),
  };
}

const COST_PROMPT = `You are an expert Microsoft 365 licensing and cost optimization analyst. Analyze REAL license data and provide cost predictions, savings opportunities, and budget forecasting.

Return JSON with: summary, licenseAnalysis, savingsOpportunities, costForecast, copilotROI, budgetRecommendations, vendorComparison, actionPlan.

Provide realistic cost estimates based on current Microsoft 365 pricing.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, tenantData: legacyData, historicalCosts, growthRate } = await req.json();
    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    let realData: any = legacyData || {};

    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const connId = tenantConnectionIds[0];
      const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: connId, p_user_id: user.id });
      if (creds?.[0]) {
        const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
        realData = { tenantName: tenantNames?.[0] || 'Unknown', ...(await fetchLicenseData(token)) };
      }
    }

    const contextData = { tenant: realData, historicalCosts: historicalCosts || [], projectedGrowthRate: growthRate || 5, analysisDate: new Date().toISOString() };
    console.log('Analyzing costs with real data');

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'system', content: COST_PROMPT }, { role: 'user', content: `Analyze this REAL tenant license data:\n\n${JSON.stringify(contextData, null, 2)}` }], temperature: 0.3, max_tokens: 8000 }),
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
    console.error('Cost predictor error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
