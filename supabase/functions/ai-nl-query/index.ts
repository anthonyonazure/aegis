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
    headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
  });
  if (!resp.ok) return null;
  return resp.json();
}

// Map of safe, read-only Graph endpoints the AI can request
const ALLOWED_ENDPOINTS: Record<string, string> = {
  'users': '/users?$top=50&$select=displayName,mail,department,jobTitle,accountEnabled,createdDateTime,assignedLicenses&$count=true',
  'users_mfa': '/reports/authenticationMethods/userRegistrationDetails?$top=50',
  'groups': '/groups?$top=50&$select=displayName,groupTypes,mailEnabled,securityEnabled,membershipRule',
  'devices': '/deviceManagement/managedDevices?$top=50&$select=deviceName,operatingSystem,complianceState,isEncrypted,lastSyncDateTime',
  'applications': '/applications?$top=50&$select=displayName,appId,publisherDomain,signInAudience',
  'conditionalAccess': '/identity/conditionalAccess/policies?$select=displayName,state,conditions,grantControls',
  'subscribedSkus': '/subscribedSkus',
  'secureScores': '/security/secureScores?$top=1',
  'domains': '/domains',
  'directoryAudits': '/auditLogs/directoryAudits?$top=25&$orderby=activityDateTime desc',
  'signIns': '/auditLogs/signIns?$top=25&$orderby=createdDateTime desc',
  'riskyUsers': '/identityProtection/riskyUsers?$top=25',
  'servicePrincipals': '/servicePrincipals?$top=50&$select=displayName,appId,servicePrincipalType',
};

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
    const { query, tenantId, context, tenantConnectionIds } = await req.json();
    console.log('Natural language query:', { query, tenantId });

    const AI_GATEWAY_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_KEY) throw new Error("AI_GATEWAY_API_KEY is not configured");
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    // Step 1: Ask AI to determine which endpoints to query
    const planPrompt = `You are a Microsoft 365 data assistant. Given the user's question, determine which Graph API data sources are needed.

Available data sources (return ONLY keys from this list):
${Object.keys(ALLOWED_ENDPOINTS).map(k => `- "${k}"`).join('\n')}

User question: "${query}"

Return JSON only:
{ "endpoints": ["key1", "key2"], "interpretation": "What data the user wants" }`;

    const planResp = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: planPrompt }],
        temperature: 0.1,
      }),
    });

    let endpointsToFetch: string[] = [];
    let interpretation = query;
    if (planResp.ok) {
      const planData = await planResp.json();
      const planContent = planData.choices?.[0]?.message?.content || '';
      try {
        const cleaned = planContent.replace(/```json\n?|\n?```/g, '').trim();
        const plan = JSON.parse(cleaned);
        endpointsToFetch = (plan.endpoints || []).filter((k: string) => ALLOWED_ENDPOINTS[k]);
        interpretation = plan.interpretation || query;
      } catch { /* fall through */ }
    }

    // Step 2: Fetch real data if we have credentials
    let liveData: Record<string, any> = {};
    let dataSource = 'simulated';
    const connIds = tenantConnectionIds || [];

    if (connIds.length > 0 && endpointsToFetch.length > 0) {
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
            const results = await Promise.all(
              endpointsToFetch.map(async (key) => {
                const data = await fetchGraph(token, ALLOWED_ENDPOINTS[key]);
                return [key, data];
              })
            );
            liveData = Object.fromEntries(results.filter(([, v]) => v !== null));
            if (Object.keys(liveData).length > 0) {
              dataSource = 'live';
              console.log('Fetched live data for endpoints:', Object.keys(liveData));
            }
          } catch (e) {
            console.error('Failed to fetch live Graph data:', e);
          }
        }
      }
    }

    // Step 3: Ask AI to analyze the data and answer the question
    const contextInfo = context ? `\nTenant context: ${JSON.stringify(context)}` : '';
    const dataInfo = dataSource === 'live'
      ? `\n\nREAL DATA from Microsoft Graph API:\n${JSON.stringify(liveData, null, 2)}\n\nIMPORTANT: This is REAL tenant data. Use these actual values — do NOT fabricate or simulate results.`
      : '\n\nNo live data available. Generate realistic sample data to illustrate the query structure.';

    const systemPrompt = `You are an intelligent Microsoft 365 data assistant. Answer the user's question using the provided data.

Output JSON:
{
  "interpretation": "What you understood",
  "graphQueries": [{ "endpoint": "string", "filter": "string", "select": "string", "description": "string" }],
  "results": {
    "type": "table|list|stats|chart",
    "columns": ["Col1", "Col2"],
    "data": [{ "Col1": "val", "Col2": "val" }],
    "summary": { "total": 0, "matching": 0, "percentage": 0 }
  },
  "insights": ["Finding 1"],
  "recommendations": ["Action 1"],
  "relatedQueries": ["Follow-up 1"],
  "dataSource": "${dataSource}"
}`;

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query + contextInfo + dataInfo }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let parsedResponse;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedResponse = JSON.parse(jsonString);
    } catch {
      parsedResponse = { interpretation: query, results: { type: "text", content }, insights: [], recommendations: [], relatedQueries: [], dataSource };
    }

    parsedResponse.dataSource = dataSource;
    console.log('Query processed:', { dataSource, endpoints: endpointsToFetch });

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("NL Query error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
