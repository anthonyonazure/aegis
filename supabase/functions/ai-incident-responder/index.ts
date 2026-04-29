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

async function fetchSecurityContext(token: string) {
  const [riskyUsers, signIns, caPolicies, secureScores] = await Promise.all([
    fetchGraph(token, '/identityProtection/riskyUsers?$top=10'),
    fetchGraph(token, '/auditLogs/signIns?$top=20&$orderby=createdDateTime desc'),
    fetchGraph(token, '/identity/conditionalAccess/policies?$select=displayName,state'),
    fetchGraph(token, '/security/secureScores?$top=1'),
  ]);

  return {
    riskyUsers: (riskyUsers?.value || []).map((u: any) => ({
      user: u.userDisplayName || u.userPrincipalName,
      riskLevel: u.riskLevel,
      riskState: u.riskState,
    })),
    recentSignIns: (signIns?.value || []).slice(0, 10).map((s: any) => ({
      user: s.userDisplayName || s.userPrincipalName,
      status: s.status?.errorCode === 0 ? 'Success' : 'Failed',
      location: s.location?.city || 'Unknown',
      ip: s.ipAddress,
      riskLevel: s.riskLevelDuringSignIn || 'none',
      app: s.appDisplayName,
    })),
    activeCAPolicies: (caPolicies?.value || []).filter((p: any) => p.state === 'enabled').length,
    totalCAPolicies: caPolicies?.value?.length || 0,
    secureScore: secureScores?.value?.[0]?.currentScore || null,
    maxSecureScore: secureScores?.value?.[0]?.maxScore || null,
  };
}

const INCIDENT_RESPONDER_PROMPT = `You are an expert Microsoft 365 security incident responder. Analyze the reported incident and provide comprehensive response guidance.

Return a JSON object with this structure:
{
  "incidentClassification": {
    "type": "string", "severity": "critical" | "high" | "medium" | "low",
    "category": "malware" | "phishing" | "data_breach" | "account_compromise" | "insider_threat" | "ransomware" | "unauthorized_access" | "policy_violation" | "other",
    "confidence": number, "threatActorType": "external" | "internal" | "unknown", "attackVector": "string"
  },
  "immediateActions": [{ "priority": number, "action": "string", "reason": "string", "automatable": boolean, "timeframe": "string", "owner": "string" }],
  "containmentSteps": {
    "shortTerm": [{ "step": "string", "commands": ["string"], "expectedOutcome": "string", "rollbackPossible": boolean }],
    "longTerm": [{ "step": "string", "implementation": "string", "timeline": "string" }]
  },
  "investigationGuidance": {
    "dataToCollect": [{ "source": "string", "data": "string", "priority": "string" }],
    "queries": [{ "name": "string", "description": "string", "query": "string", "platform": "string" }],
    "indicatorsOfCompromise": ["string"]
  },
  "remediationPlan": {
    "phases": [{ "name": "string", "duration": "string", "steps": ["string"], "successCriteria": ["string"] }],
    "passwordResets": boolean, "tokenRevocation": boolean, "mfaEnforcement": boolean
  },
  "preventionRecommendations": [{ "recommendation": "string", "category": "string", "priority": "string", "effort": "string" }],
  "recoveryTimeline": { "estimatedContainment": "string", "estimatedEradication": "string", "estimatedRecovery": "string" }
}

IMPORTANT: If live security context is provided, incorporate the actual tenant security posture (risky users, recent sign-ins, CA policies, secure score) into your analysis.`;

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
    const { incidentDescription, incidentType, affectedUsers, tenantData, tenantConnectionIds } = await req.json();

    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    // Fetch live security context if available
    let liveSecurityContext: any = null;
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
            liveSecurityContext = await fetchSecurityContext(token);
            console.log('Live security context fetched for incident response');
          } catch (e) {
            console.error('Failed to fetch security context:', e);
          }
        }
      }
    }

    const contextData = {
      incidentDescription: incidentDescription || '',
      incidentType: incidentType || 'unknown',
      affectedUsers: affectedUsers || [],
      tenantInfo: tenantData || {},
      reportedAt: new Date().toISOString(),
      ...(liveSecurityContext && { liveSecurityContext }),
    };

    console.log('Analyzing incident:', incidentType || 'unknown', liveSecurityContext ? '(with live context)' : '(no live data)');

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: INCIDENT_RESPONDER_PROMPT },
          { role: 'user', content: `Analyze and provide response guidance for this security incident:\n\n${JSON.stringify(contextData, null, 2)}` }
        ],
        temperature: 0.2,
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
      JSON.stringify({ success: true, analysis: analysisResult, _dataSource: liveSecurityContext ? 'live' : 'user-provided' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Incident responder error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
