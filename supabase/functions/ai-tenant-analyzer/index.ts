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
  if (!resp.ok) { const t = await resp.text(); throw new Error(`Token error: ${resp.status} ${t}`); }
  return (await resp.json()).access_token;
}

async function graphGet(token: string, endpoint: string, beta = false): Promise<any> {
  const base = beta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const r = await fetch(`${base}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.error(`Graph error ${endpoint}: ${r.status}`); return null; }
  return r.json();
}

async function fetchTenantTelemetry(token: string) {
  const [users, skus, secureScore, caPolicies, dirRoles, authMethods] = await Promise.all([
    graphGet(token, '/users?$select=id,displayName,userType,accountEnabled,signInActivity&$top=999'),
    graphGet(token, '/subscribedSkus'),
    graphGet(token, '/security/secureScores?$top=1', true),
    graphGet(token, '/identity/conditionalAccess/policies'),
    graphGet(token, '/directoryRoles?$expand=members'),
    graphGet(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true),
  ]);

  const usersData = users?.value || [];
  const guestUsers = usersData.filter((u: any) => u.userType === 'Guest').length;
  const totalUsers = usersData.length;

  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const staleAccounts = usersData.filter((u: any) => {
    const last = u.signInActivity?.lastSignInDateTime;
    return !last || new Date(last) < ninetyDaysAgo;
  }).length;

  const adminUserIds = new Set<string>();
  for (const role of (dirRoles?.value || [])) {
    for (const m of (role.members || [])) {
      if (m['@odata.type'] === '#microsoft.graph.user') adminUserIds.add(m.id);
    }
  }

  const authData = authMethods?.value || [];
  const mfaEnabled = authData.filter((u: any) => u.isMfaRegistered).length;

  const skusData = skus?.value || [];
  let totalLicenses = 0, assignedLicenses = 0;
  const licenseDetails = skusData.map((s: any) => {
    const total = s.prepaidUnits?.enabled || 0;
    const assigned = s.consumedUnits || 0;
    totalLicenses += total; assignedLicenses += assigned;
    return { name: s.skuPartNumber, total, assigned, available: total - assigned };
  }).filter((l: any) => l.total > 0);

  const ss = secureScore?.value?.[0];

  return {
    totalUsers, guestUsers, staleAccounts,
    adminUsers: adminUserIds.size,
    mfaEnabledUsers: mfaEnabled,
    mfaCoverage: totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0,
    secureScore: ss?.currentScore || 0,
    maxSecureScore: ss?.maxScore || 0,
    conditionalAccessPolicies: caPolicies?.value?.length || 0,
    caPolicyNames: (caPolicies?.value || []).map((p: any) => ({ name: p.displayName, state: p.state })),
    totalLicenses, assignedLicenses,
    unusedLicenses: totalLicenses - assignedLicenses,
    licenseUtilization: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0,
    licenseDetails,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  try {
    const { tenantConnectionIds, tenantNames, analysisType, tenantData: legacyData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let realTenantData: any = legacyData || {};

    // If tenantConnectionIds provided, fetch real data
    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const tenantsData: any[] = [];
      for (let i = 0; i < tenantConnectionIds.length; i++) {
        const connId = tenantConnectionIds[i];
        const tenantName = tenantNames?.[i] || 'Unknown';
        try {
          const { data: creds } = await supabase.rpc('get_decrypted_credential', { p_tenant_connection_id: connId, p_user_id: user.id });
          if (!creds?.[0]) { tenantsData.push({ tenantName, error: 'No credentials found' }); continue; }
          const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
          const telemetry = await fetchTenantTelemetry(token);
          tenantsData.push({ tenantName, tenantId: creds[0].tenant_id, ...telemetry });
        } catch (e) {
          console.error(`Error fetching tenant ${tenantName}:`, e);
          tenantsData.push({ tenantName, error: e instanceof Error ? e.message : 'Unknown error' });
        }
      }
      realTenantData = tenantsData.length === 1 ? tenantsData[0] : { tenants: tenantsData };
    }

    const systemPrompt = `You are an expert Microsoft 365 tenant configuration analyst. Analyze tenant data and provide comprehensive insights, optimization recommendations, and identify potential issues.

Your analysis should cover:
1. Overall tenant health and configuration quality
2. Security posture assessment
3. Licensing efficiency analysis
4. User and identity management evaluation
5. Application and service configuration
6. Collaboration and productivity settings
7. Compliance and governance gaps
8. Performance optimization opportunities
9. Cost reduction recommendations
10. Risk identification and mitigation

Provide actionable, prioritized recommendations based on best practices and industry standards.

IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Perform a ${analysisType || 'comprehensive'} analysis of this M365 tenant configuration:

Tenant Data:
${JSON.stringify(realTenantData, null, 2)}

Provide a detailed analysis in this JSON structure:
{
  "summary": { "overallHealthScore": 0, "healthGrade": "A", "executiveSummary": "", "keyFindings": [], "criticalIssues": 0, "warnings": 0, "optimizations": 0 },
  "securityAnalysis": { "score": 0, "findings": [{ "category": "", "finding": "", "severity": "high", "recommendation": "", "impact": "" }], "strengths": [], "gaps": [] },
  "licensingAnalysis": { "score": 0, "totalCost": 0, "potentialSavings": 0, "utilizationRate": 0, "findings": [{ "issue": "", "recommendation": "", "estimatedSavings": 0 }], "optimizations": [] },
  "identityAnalysis": { "score": 0, "userCount": 0, "adminCount": 0, "guestCount": 0, "mfaCoverage": 0, "findings": [{ "issue": "", "severity": "medium", "recommendation": "" }] },
  "collaborationAnalysis": { "score": 0, "teamsAdoption": 0, "sharePointUsage": 0, "exchangeHealth": 0, "findings": [], "recommendations": [] },
  "complianceAnalysis": { "score": 0, "frameworks": [], "gaps": [{ "framework": "", "requirement": "", "gap": "", "remediation": "" }], "strengths": [] },
  "performanceAnalysis": { "score": 0, "bottlenecks": [], "optimizations": [{ "area": "", "issue": "", "recommendation": "", "expectedImprovement": "" }] },
  "prioritizedActions": [{ "priority": 1, "action": "", "category": "", "effort": "low", "impact": "high", "timeline": "", "estimatedCost": "" }],
  "trendAnalysis": { "securityTrend": "stable", "costTrend": "stable", "adoptionTrend": "stable", "projections": [] },
  "benchmarks": { "industryComparison": "average", "percentile": 50, "comparisonNotes": [] }
}`;

    console.log("Calling AI for tenant analysis with real data...");
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
    catch { analysis = { summary: { overallHealthScore: 70, healthGrade: "B", executiveSummary: content, keyFindings: [], criticalIssues: 0, warnings: 0, optimizations: 0 } }; }

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in ai-tenant-analyzer:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze tenant" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
