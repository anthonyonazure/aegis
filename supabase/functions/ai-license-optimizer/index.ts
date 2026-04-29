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

async function fetchLicenseData(token: string) {
  const [skus, users] = await Promise.all([
    fetch('https://graph.microsoft.com/v1.0/subscribedSkus', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    fetch('https://graph.microsoft.com/v1.0/users?$select=id&$top=999', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
  ]);

  const priceMap: Record<string, number> = {
    'SPE_E5': 57, 'SPE_E3': 36, 'SPE_E1': 10, 'ENTERPRISEPREMIUM': 57, 'ENTERPRISEPACK': 36, 'STANDARDPACK': 10,
    'POWER_BI_PRO': 10, 'PROJECTPREMIUM': 55, 'PROJECTPROFESSIONAL': 30, 'VISIOCLIENT': 15,
    'EMSPREMIUM': 16, 'EMS': 11, 'AAD_PREMIUM_P2': 9, 'AAD_PREMIUM': 6,
    'MICROSOFT_365_COPILOT': 30, 'Microsoft_365_Copilot': 30,
  };

  return {
    licenses: (skus?.value || []).map((s: any) => {
      const total = s.prepaidUnits?.enabled || 0, assigned = s.consumedUnits || 0;
      const name = s.skuPartNumber || 'Unknown';
      return { name, total, assigned, pricePerUser: priceMap[name] || 0 };
    }).filter((l: any) => l.total > 0),
    totalUsers: users?.value?.length || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, licenseData: legacyData, userCount: legacyUserCount, goals } = await req.json();
    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    let realLicenseData: any = legacyData || {};
    let realUserCount = legacyUserCount || 0;

    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const connId = tenantConnectionIds[0];
      const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: connId, p_user_id: user.id });
      if (creds?.[0]) {
        const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
        const data = await fetchLicenseData(token);
        realLicenseData = data;
        realUserCount = data.totalUsers;
      }
    }

    const systemPrompt = `You are a Microsoft 365 licensing optimization expert. Analyze REAL license data and provide actionable cost-saving recommendations.

Return JSON with: summary, currentState, recommendations, quickWins, longTermStrategy, benchmarks.

Strategies: remove unused licenses, downgrade over-licensed users, consolidate duplicates, annual billing discounts, right-size tiers.`;

    const userPrompt = `Analyze this REAL Microsoft 365 license data:

License Data:
${JSON.stringify(realLicenseData, null, 2)}

Total Users: ${realUserCount}
${goals ? `Goals: ${goals}` : 'Focus on maximum cost savings while maintaining productivity.'}

Provide detailed, actionable recommendations.`;

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3 }),
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
    catch { result = { summary: { totalMonthlySpend: 0, potentialSavings: 0, optimizationScore: 50, urgency: 'medium' }, recommendations: [], error: 'Parse failed' }; }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('License optimization error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
