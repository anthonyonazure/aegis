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
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchCopilotReadinessData(token: string) {
  const [users, subscribedSkus, caPolicies, authMethods, domains] = await Promise.all([
    fetchGraph(token, '/users?$count=true&$top=1&$select=id'),
    fetchGraph(token, '/subscribedSkus'),
    fetchGraph(token, '/identity/conditionalAccess/policies'),
    fetchGraph(token, '/reports/authenticationMethods/userRegistrationDetails?$top=999'),
    fetchGraph(token, '/domains'),
  ]);

  const totalUsers = users?.['@odata.count'] || users?.value?.length || 0;
  const licenses = (subscribedSkus?.value || []).map((s: any) => ({
    skuPartNumber: s.skuPartNumber,
    skuId: s.skuId,
    consumedUnits: s.consumedUnits,
    prepaidUnits: s.prepaidUnits?.enabled || 0,
  }));

  const copilotSkus = licenses.filter((l: any) =>
    l.skuPartNumber?.toLowerCase().includes('copilot') ||
    l.skuPartNumber?.toLowerCase().includes('microsoft_365_copilot')
  );

  const mfaRegistered = (authMethods?.value || []).filter((u: any) =>
    u.methodsRegistered?.includes('microsoftAuthenticator') ||
    u.methodsRegistered?.includes('fido2') ||
    u.methodsRegistered?.includes('windowsHelloForBusiness') ||
    u.isMfaRegistered === true
  ).length;

  const policies = (caPolicies?.value || []).map((p: any) => ({
    name: p.displayName,
    state: p.state,
    grantControls: p.grantControls?.builtInControls || [],
  }));

  const mfaPolicies = policies.filter((p: any) =>
    p.state === 'enabled' && p.grantControls?.includes('mfa')
  );

  return {
    totalUsers,
    licenses,
    copilotLicenses: copilotSkus,
    copilotLicenseCount: copilotSkus.reduce((sum: number, s: any) => sum + (s.prepaidUnits || 0), 0),
    copilotAssigned: copilotSkus.reduce((sum: number, s: any) => sum + (s.consumedUnits || 0), 0),
    mfaRegisteredCount: mfaRegistered,
    mfaPercentage: totalUsers > 0 ? Math.round((mfaRegistered / totalUsers) * 100) : 0,
    conditionalAccessPolicies: policies,
    mfaEnforcingPolicies: mfaPolicies.length,
    totalCAPolicies: policies.length,
    domains: (domains?.value || []).map((d: any) => ({ id: d.id, isVerified: d.isVerified, isDefault: d.isDefault })),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  try {
    const { readinessData, tenantContext, tenantConnectionIds } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch real data if tenantConnectionIds provided
    let liveTelemetry: any = null;
    if (tenantConnectionIds?.length > 0) {
      const authHeader = req.headers.get('authorization');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const connId = tenantConnectionIds[0];
        const { data: creds } = await supabase.rpc('get_decrypted_credential', {
          p_tenant_connection_id: connId,
          p_user_id: user.id,
        });
        if (creds?.length > 0) {
          try {
            const token = await getGraphToken(creds[0].client_id, creds[0].client_secret, creds[0].tenant_id);
            liveTelemetry = await fetchCopilotReadinessData(token);
            console.log('Live Copilot readiness telemetry fetched:', {
              users: liveTelemetry.totalUsers,
              copilotLicenses: liveTelemetry.copilotLicenseCount,
              mfa: liveTelemetry.mfaPercentage + '%',
            });
          } catch (e) {
            console.error('Failed to fetch live data, using provided readinessData:', e);
          }
        }
      }
    }

    const effectiveData = liveTelemetry
      ? { ...readinessData, liveTelemetry }
      : readinessData;

    const systemPrompt = `You are an expert Microsoft 365 Copilot readiness advisor grounded in official Microsoft Learn documentation. Analyze tenant readiness data and provide comprehensive recommendations.

IMPORTANT — base your analysis on these Microsoft Learn requirements:

## Minimum Requirements (per Microsoft Learn)
- Entra ID accounts (cloud identity)
- Microsoft 365 Apps on Current Channel or Monthly Enterprise Channel (Semi-Annual Channel is NOT supported)
- Exchange Online mailbox (on-premises mailboxes are not supported)
- OneDrive for Business provisioned
- Network connectivity to *.cloud.microsoft, *.office.com, copilot.microsoft.com on port 443
- WebSocket (WSS) connections allowed through firewall/proxy

## Security & Identity
- MFA enabled for all Copilot users
- Conditional Access policies enforcing device compliance and MFA
- Audit logging enabled in Microsoft Purview

## Data Governance (critical for safe rollout)
- Microsoft Purview sensitivity labels published and applied
- DLP policies configured to prevent data leakage via Copilot
- SharePoint/OneDrive sharing reviewed — oversharing means Copilot surfaces content users shouldn't see
- Retention policies in place

## Scoring Categories (weighted)
1. Licensing (15%) — Copilot SKUs assigned
2. Identity & Access (15%) — MFA, Conditional Access, Entra ID
3. Exchange & Mailbox (10%) — Cloud mailboxes
4. Data Governance (15%) — Sensitivity labels, DLP, Purview
5. SharePoint & OneDrive (10%) — Provisioning, oversharing risk
6. Teams & Voice (10%) — Transcription, Teams Phone, PSTN
7. Apps & Update Channel (10%) — Current/Monthly channel, Connected Experiences, Loop
8. Network (15%) — WSS endpoints, firewall rules

${liveTelemetry ? 'IMPORTANT: The "liveTelemetry" field contains REAL data from the Microsoft Graph API. Use these actual numbers in your analysis — do NOT fabricate or replace them with estimates.' : ''}

CRITICAL RULES:
- Every recommendation MUST include an "explanation" field (2-3 sentences) and a "referenceUrl" field (Microsoft Learn URL).
- Every prioritized action MUST include a "goal" field.

Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Analyze Copilot readiness for this tenant and provide comprehensive deployment recommendations:

Tenant Context:
${JSON.stringify(tenantContext, null, 2)}

Current Readiness Data (8-category assessment):
${JSON.stringify(effectiveData, null, 2)}

Provide a detailed analysis in this JSON structure:
{
  "overallAssessment": {
    "readinessScore": number (0-100),
    "readinessLevel": "not-ready" | "needs-work" | "nearly-ready" | "ready",
    "summary": "string",
    "estimatedTimeToReady": "string"
  },
  "categoryScores": [
    {
      "category": "string",
      "score": number (0-100),
      "status": "pass" | "warning" | "fail",
      "findings": ["string"],
      "recommendations": ["string"]
    }
  ],
  "licensingAnalysis": {
    "currentState": "string",
    "requiredLicenses": number,
    "estimatedMonthlyCost": number,
    "optimizationOpportunities": [{ "title": "string", "explanation": "string", "referenceUrl": "string" }],
    "licensingRecommendations": [{ "title": "string", "explanation": "string", "referenceUrl": "string" }]
  },
  "dataGovernance": {
    "sensitivityLabelsStatus": "string",
    "dlpPoliciesStatus": "string",
    "retentionPoliciesStatus": "string",
    "oversharedContentRisk": "low" | "medium" | "high",
    "recommendations": [{ "title": "string", "explanation": "string", "referenceUrl": "string" }]
  },
  "securityRequirements": {
    "mfaStatus": "string",
    "conditionalAccessStatus": "string",
    "identityProtectionStatus": "string",
    "gaps": [{ "title": "string", "explanation": "string", "referenceUrl": "string" }],
    "recommendations": [{ "title": "string", "explanation": "string", "referenceUrl": "string" }]
  },
  "adoptionStrategy": {
    "targetUserGroups": [{ "group": "string", "priority": "high" | "medium" | "low", "estimatedImpact": "string", "rolloutPhase": number }],
    "changeManagementSteps": ["string"],
    "trainingRequirements": ["string"],
    "successMetrics": ["string"]
  },
  "rolloutPlan": {
    "phases": [{ "phase": number, "name": "string", "duration": "string", "userCount": number, "objectives": ["string"], "successCriteria": ["string"], "risks": ["string"] }],
    "totalDuration": "string",
    "keyMilestones": ["string"]
  },
  "riskAssessment": {
    "overallRisk": "low" | "medium" | "high",
    "risks": [{ "risk": "string", "likelihood": "low" | "medium" | "high", "impact": "low" | "medium" | "high", "mitigation": "string", "explanation": "string", "referenceUrl": "string" }]
  },
  "prioritizedActions": [{ "priority": number, "action": "string", "category": "string", "effort": "low" | "medium" | "high", "impact": "low" | "medium" | "high", "timeline": "string", "explanation": "string", "goal": "string", "referenceUrl": "string" }],
  "expectedBenefits": {
    "productivityGains": "string",
    "timesSavingsPerUser": "string",
    "estimatedROI": "string",
    "keyUseCases": ["string"]
  }
}`;

    console.log("Calling AI for Copilot readiness analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "API credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let analysis;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response, returning raw");
      analysis = { rawResponse: content, overallAssessment: { readinessScore: 0, readinessLevel: "needs-work", summary: "Analysis completed but response parsing failed. See raw data.", estimatedTimeToReady: "Unknown" } };
    }

    // Tag with data source info
    analysis._dataSource = liveTelemetry ? 'live' : 'user-provided';

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-copilot-advisor:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze Copilot readiness" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
