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

async function fetchComplianceTelemetry(token: string) {
  const [users, caPolicies, authMethods, secureScore, skus] = await Promise.all([
    graphGet(token, '/users?$select=id,userType,accountEnabled&$top=999'),
    graphGet(token, '/identity/conditionalAccess/policies'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
    graphGet(token, '/security/secureScores?$top=1', true),
    graphGet(token, '/subscribedSkus'),
  ]);

  const usersData = users?.value || [];
  const authData = authMethods?.value || [];
  const mfaEnabled = authData.filter((u: any) => u.isMfaRegistered).length;
  const caData = caPolicies?.value || [];
  const ss = secureScore?.value?.[0];

  return {
    totalUsers: usersData.length,
    guestUsers: usersData.filter((u: any) => u.userType === 'Guest').length,
    mfaCoverage: usersData.length > 0 ? Math.round((mfaEnabled / usersData.length) * 100) : 0,
    conditionalAccessPolicies: caData.length,
    enabledCAPolicies: caData.filter((p: any) => p.state === 'enabled').length,
    caPolicySummary: caData.map((p: any) => ({ name: p.displayName, state: p.state, conditions: p.conditions })),
    secureScore: ss?.currentScore || 0,
    maxSecureScore: ss?.maxScore || 0,
    hasE5: (skus?.value || []).some((s: any) => s.skuPartNumber?.includes('SPE_E5')),
    hasAadP2: (skus?.value || []).some((s: any) => s.skuPartNumber?.includes('AAD_PREMIUM_P2')),
    hasDlp: (skus?.value || []).some((s: any) => s.skuPartNumber?.includes('INFORMATION_PROTECTION')),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

  try {
    const { tenantConnectionIds, tenantNames, tenantConfig: legacyConfig, selectedFrameworks } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let realConfig: any = legacyConfig || {};

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
          tenantsData.push({ tenantName: tenantNames?.[i] || 'Unknown', ...(await fetchComplianceTelemetry(token)) });
        } catch (e) { tenantsData.push({ tenantName: tenantNames?.[i], error: e instanceof Error ? e.message : 'Error' }); }
      }
      realConfig = tenantsData.length === 1 ? tenantsData[0] : { tenants: tenantsData };
    }

    const systemPrompt = `You are an expert compliance advisor specializing in Microsoft 365 environments. Analyze tenant configurations against major compliance frameworks and provide detailed gap analysis with remediation guidance.

Supported frameworks: NIST CSF, CIS M365, ISO 27001, SOC 2 Type II, HIPAA, GDPR, PCI DSS, FedRAMP, CMMC.
Provide actionable, specific recommendations with M365-specific implementation steps.
IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Analyze this REAL M365 tenant configuration against: ${selectedFrameworks?.join(', ') || 'NIST CSF, CIS, ISO 27001'}

Tenant Configuration:
${JSON.stringify(realConfig, null, 2)}

Provide a comprehensive compliance analysis as JSON with: overallCompliance, frameworkAnalysis, gapAnalysis, crossFrameworkFindings, complianceRoadmap, auditReadiness, riskAssessment, certificationGuidance.`;

    console.log("Calling AI for compliance analysis with real data...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.7, max_tokens: 4000 }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "API credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text(); throw new Error(`AI error: ${response.status} ${t}`);
    }

    const aiResp = await response.json();
    const content = aiResp.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let analysis;
    try { analysis = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim()); }
    catch { analysis = { overallCompliance: { score: 0, status: 'unknown', summary: content } }; }

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in ai-compliance-advisor:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze compliance" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
