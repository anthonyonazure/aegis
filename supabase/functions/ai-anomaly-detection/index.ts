import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (in-memory per instance)
const _rl = new Map<string, { count: number; resetAt: number }>();
function _checkRate(key: string, max = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const e = _rl.get(key);
  if (!e || now > e.resetAt) { _rl.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

async function getGraphAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to acquire Graph token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchGraph(accessToken: string, endpoint: string): Promise<any> {
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Graph API error for ${endpoint}:`, response.status, errorText);
    if (response.status === 403 || response.status === 401) {
      throw new Error(`PERMISSION_ERROR:${endpoint}`);
    }
    return null;
  }

  return await response.json();
}

interface AuditData {
  signInLogs: any[];
  configChanges: any[];
  riskyUsers: any[];
}

async function fetchAuditData(accessToken: string): Promise<{ data: AuditData; missingPermissions: string[] }> {
  const missingPermissions: string[] = [];
  const data: AuditData = { signInLogs: [], configChanges: [], riskyUsers: [] };

  // Fetch sign-in logs (requires AuditLog.Read.All)
  try {
    const signIns = await fetchGraph(accessToken, '/auditLogs/signIns?$top=50&$orderby=createdDateTime desc');
    if (signIns?.value) {
      data.signInLogs = signIns.value.map((s: any) => ({
        user: s.userDisplayName || s.userPrincipalName || 'Unknown',
        location: s.location?.city ? `${s.location.city}, ${s.location.countryOrRegion}` : 'Unknown',
        ip: s.ipAddress || 'Unknown',
        timestamp: s.createdDateTime,
        status: s.status?.errorCode === 0 ? 'Success' : 'Failed',
        riskLevel: s.riskLevelDuringSignIn || 'none',
        appDisplayName: s.appDisplayName,
        clientAppUsed: s.clientAppUsed,
        conditionalAccessStatus: s.conditionalAccessStatus,
      }));
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('PERMISSION_ERROR')) {
      missingPermissions.push('AuditLog.Read.All');
    }
  }

  // Fetch directory audit logs (requires AuditLog.Read.All)
  try {
    const audits = await fetchGraph(accessToken, '/auditLogs/directoryAudits?$top=50&$orderby=activityDateTime desc');
    if (audits?.value) {
      data.configChanges = audits.value.map((a: any) => ({
        resource: a.targetResources?.[0]?.displayName || 'Unknown',
        action: a.activityDisplayName || a.operationType || 'Unknown',
        actor: a.initiatedBy?.user?.displayName || a.initiatedBy?.app?.displayName || 'System',
        timestamp: a.activityDateTime,
        details: a.result || '',
        category: a.category,
      }));
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('PERMISSION_ERROR')) {
      if (!missingPermissions.includes('AuditLog.Read.All')) {
        missingPermissions.push('AuditLog.Read.All');
      }
    }
  }

  // Fetch risky users (requires IdentityRiskyUser.Read.All)
  try {
    const risky = await fetchGraph(accessToken, '/identityProtection/riskyUsers?$top=20');
    if (risky?.value) {
      data.riskyUsers = risky.value.map((r: any) => ({
        user: r.userDisplayName || r.userPrincipalName || 'Unknown',
        riskLevel: r.riskLevel,
        riskState: r.riskState,
        riskDetail: r.riskDetail,
        lastUpdated: r.riskLastUpdatedDateTime,
      }));
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('PERMISSION_ERROR')) {
      missingPermissions.push('IdentityRiskyUser.Read.All');
    }
  }

  return { data, missingPermissions };
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
    const { tenantConnectionId }: { tenantConnectionId?: string } = await req.json();

    if (!tenantConnectionId) {
      return new Response(JSON.stringify({ error: 'No tenant connection selected. Please connect and select a tenant first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authenticate caller
    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get tenant credentials
    const { data: creds, error: credError } = await supabase.rpc('get_decrypted_credential', {
      p_tenant_connection_id: tenantConnectionId,
      p_user_id: user.id,
    });

    if (credError || !creds || creds.length === 0) {
      // Try sibling fallback
      const { data: conn } = await supabase
        .from('tenant_connections')
        .select('tenant_id')
        .eq('id', tenantConnectionId)
        .single();

      if (!conn) {
        return new Response(JSON.stringify({ error: 'No credentials found for this tenant. Please configure service principal credentials first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: siblings } = await supabase
        .from('tenant_connections')
        .select('id')
        .eq('tenant_id', conn.tenant_id)
        .eq('user_id', user.id);

      let foundCreds = null;
      for (const sib of siblings || []) {
        const { data: sibCreds } = await supabase.rpc('get_decrypted_credential', {
          p_tenant_connection_id: sib.id,
          p_user_id: user.id,
        });
        if (sibCreds && sibCreds.length > 0) {
          foundCreds = sibCreds[0];
          break;
        }
      }

      if (!foundCreds) {
        return new Response(JSON.stringify({ error: 'No credentials found for this tenant. Please configure service principal credentials first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      var clientId = foundCreds.client_id;
      var clientSecret = foundCreds.client_secret;
      var tenantId = foundCreds.tenant_id;
    } else {
      var clientId = creds[0].client_id;
      var clientSecret = creds[0].client_secret;
      var tenantId = creds[0].tenant_id;
    }

    // Acquire Graph token
    console.log('Acquiring Graph token for anomaly detection, tenant:', tenantId);
    const accessToken = await getGraphAccessToken(clientId, clientSecret, tenantId);

    // Fetch real audit data
    const { data: auditData, missingPermissions } = await fetchAuditData(accessToken);

    const totalEvents = auditData.signInLogs.length + auditData.configChanges.length + auditData.riskyUsers.length;

    if (totalEvents === 0 && missingPermissions.length > 0) {
      return new Response(JSON.stringify({
        error: `Missing required permissions: ${missingPermissions.join(', ')}. Please grant these permissions to the service principal in Azure AD and reconnect.`,
        missingPermissions,
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send real data to AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a security analyst AI specialized in Microsoft 365 and Azure AD security monitoring.

Analyze the provided REAL audit data from a Microsoft 365 tenant and identify potential security anomalies. Look for:

1. **Sign-in Anomalies:**
   - Impossible travel (logins from distant locations in short time)
   - Unusual login times
   - Failed login attempts followed by success (brute force indicators)
   - Logins from high-risk countries or Tor exit nodes
   - New device or browser patterns

2. **Configuration Anomalies:**
   - Conditional Access policy modifications
   - MFA setting changes
   - Security defaults being disabled
   - New admin role assignments
   - Unusual bulk operations

3. **Permission Anomalies:**
   - Excessive permission grants
   - Sensitive API permissions (Mail.ReadWrite, Directory.ReadWrite.All)
   - Service principal permissions without justification
   - Delegated permissions to external apps

4. **Risky Users:**
   - Users flagged by Azure AD Identity Protection
   - Users with elevated risk levels

For each anomaly found, provide:
- Severity: critical, high, medium, low
- Category: sign-in, configuration, permission
- Description of the anomaly
- Potential impact
- Recommended investigation steps

IMPORTANT: Only report anomalies you actually detect in the provided data. If no anomalies are found, return an empty anomalies array. Do NOT fabricate or invent sample data.

Output as JSON:
{
  "anomalies": [
    {
      "id": "unique-id",
      "severity": "critical|high|medium|low",
      "category": "sign-in|configuration|permission",
      "title": "Brief title",
      "description": "Detailed description",
      "affectedEntity": "User/Resource affected",
      "timestamp": "When it occurred",
      "impact": "Potential security impact",
      "investigation": ["Step 1", "Step 2"],
      "relatedEvents": ["Event 1", "Event 2"]
    }
  ],
  "summary": {
    "totalAnomalies": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "overallRiskLevel": "critical|high|medium|low",
    "recommendations": ["Top priority actions"]
  }
}`;

    const userPrompt = `Analyze this real audit data from a Microsoft 365 tenant for security anomalies:

**Sign-in Logs (${auditData.signInLogs.length} entries):**
${JSON.stringify(auditData.signInLogs, null, 2)}

**Directory Audit Logs (${auditData.configChanges.length} entries):**
${JSON.stringify(auditData.configChanges, null, 2)}

**Risky Users (${auditData.riskyUsers.length} entries):**
${JSON.stringify(auditData.riskyUsers, null, 2)}

${missingPermissions.length > 0 ? `\nNote: Some data sources were unavailable due to missing permissions: ${missingPermissions.join(', ')}` : ''}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsedResponse;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedResponse = JSON.parse(jsonString);
    } catch {
      parsedResponse = {
        anomalies: [],
        summary: {
          totalAnomalies: 0, critical: 0, high: 0, medium: 0, low: 0,
          overallRiskLevel: "low",
          recommendations: ["Unable to parse AI response. Please try again."]
        },
      };
    }

    // Include metadata about data sources
    parsedResponse.dataSources = {
      signInLogs: auditData.signInLogs.length,
      directoryAudits: auditData.configChanges.length,
      riskyUsers: auditData.riskyUsers.length,
      missingPermissions,
    };

    console.log('Anomaly detection completed:', parsedResponse.summary);

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Anomaly detection error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
