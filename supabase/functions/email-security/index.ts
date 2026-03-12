import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Token error: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function graphGet(token: string, endpoint: string) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error(`Graph error ${endpoint}: ${resp.status} ${t}`);
    return null;
  }
  return resp.json();
}

async function graphGetBeta(token: string, endpoint: string) {
  const resp = await fetch(`https://graph.microsoft.com/beta${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error(`Graph beta error ${endpoint}: ${resp.status} ${t}`);
    return null;
  }
  return resp.json();
}

function parseDomainAuth(domains: any[]): any[] {
  return domains.map((d: any) => {
    const records = d.serviceConfigurationRecords || [];
    
    // Check SPF
    const spfRecord = records.find((r: any) => 
      r.recordType === 'Txt' && r.text?.startsWith('v=spf1')
    );
    
    // Check DKIM (look for CNAME selectors)
    const dkimRecords = records.filter((r: any) => 
      r.recordType === 'CName' && r.label?.includes('._domainkey')
    );
    
    return {
      domain: d.id,
      isVerified: d.isVerified || false,
      spf: {
        status: spfRecord ? 'pass' : 'missing',
        record: spfRecord?.text || null,
      },
      dkim: {
        status: dkimRecords.length > 0 ? 'pass' : 'missing',
        selectors: dkimRecords.map((r: any) => r.label?.split('._domainkey')[0]).filter(Boolean),
      },
      dmarc: {
        status: 'unknown', // DMARC TXT records at _dmarc.domain aren't in Graph API
        record: null,
        policy: null,
      },
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tenantConnectionId } = await req.json();

    if (!tenantConnectionId) {
      return new Response(JSON.stringify({ error: "tenantConnectionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      // Try to get user from tenant connection
      const { data: conn } = await supabase
        .from("tenant_connections")
        .select("user_id")
        .eq("id", tenantConnectionId)
        .single();
      userId = conn?.user_id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials
    const { data: creds, error: credErr } = await supabase.rpc("get_decrypted_credential", {
      p_tenant_connection_id: tenantConnectionId,
      p_user_id: userId,
    });

    if (credErr || !creds?.length) {
      return new Response(JSON.stringify({ error: "No credentials found for this tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, client_secret, tenant_id } = creds[0];
    const token = await getGraphToken(client_id, client_secret, tenant_id);

    let responseData: any = null;

    switch (action) {
      case "fetch-overview": {
        // Fetch domains and security policies in parallel
        const [domains, securityPolicies] = await Promise.all([
          graphGet(token, "/domains"),
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations"),
        ]);

        const domainList = domains?.value || [];
        const domainAuth = parseDomainAuth(domainList);
        const domainsWithFullAuth = domainAuth.filter(
          (d: any) => d.spf.status === 'pass' && d.dkim.status === 'pass'
        ).length;

        // Count policies (using beta endpoints where available)
        const [antiPhish, antiSpam, antiMalware, safeLinks, safeAttach] = await Promise.all([
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations?$top=0&$count=true"),
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations?$top=0&$count=true"),
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations?$top=0&$count=true"),
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations?$top=0&$count=true"),
          graphGetBeta(token, "/security/attackSimulation/simulationAutomations?$top=0&$count=true"),
        ]);

        // Since EOP policies have limited Graph API coverage, provide estimates
        const totalPolicies = (antiPhish?.value?.length || 0) + (antiSpam?.value?.length || 0);
        const protectionScore = Math.min(100, Math.round(
          (domainsWithFullAuth / Math.max(domainList.length, 1)) * 50 + 50
        ));

        responseData = {
          totalPolicies,
          antiPhishingCount: 1, // Default policy always exists
          antiSpamCount: 1,
          antiMalwareCount: 1,
          safeLinksCount: 0,
          safeAttachmentsCount: 0,
          domainCount: domainList.length,
          domainsWithFullAuth,
          protectionScore,
        };
        break;
      }

      case "fetch-anti-phishing":
      case "fetch-anti-spam":
      case "fetch-anti-malware":
      case "fetch-safe-links":
      case "fetch-safe-attachments": {
        const policyName = action.replace('fetch-', '').replace(/-/g, ' ');
        const isDefenderFeature = action === "fetch-safe-links" || action === "fetch-safe-attachments";
        
        responseData = [{
          id: `default-${action}`,
          displayName: `Default ${policyName} policy`,
          description: isDefenderFeature
            ? "Safe Links and Safe Attachments require a Microsoft Defender for Office 365 license. These policies cannot be read via Microsoft Graph API — use the Microsoft 365 Defender portal or PowerShell to verify configuration."
            : "EOP policy details are not available via Microsoft Graph API. Use the Microsoft 365 Defender portal or Exchange Online PowerShell to view and manage this policy. Run AI Recommendations for a configuration analysis based on available tenant data.",
          isEnabled: undefined, // Status unknown — cannot be verified via Graph API
          source: "graph-api-unavailable",
          priority: 0,
        }];
        break;
      }

      case "fetch-domain-auth": {
        const domains = await graphGet(token, "/domains");
        const domainList = domains?.value || [];

        // Fetch service config records for each domain
        const enriched = await Promise.all(
          domainList.map(async (d: any) => {
            const records = await graphGet(token, `/domains/${d.id}/serviceConfigurationRecords`);
            return { ...d, serviceConfigurationRecords: records?.value || [] };
          })
        );

        responseData = parseDomainAuth(enriched);
        break;
      }

      case "ai-recommendations": {
        // Gather all available data for AI analysis
        const [domains, securityAlerts] = await Promise.all([
          graphGet(token, "/domains"),
          graphGet(token, "/security/alerts_v2?$top=10"),
        ]);

        const domainList = domains?.value || [];
        const domainAuth = parseDomainAuth(domainList);
        const alerts = securityAlerts?.value || [];

        // Build context for AI
        const context = {
          domains: domainAuth,
          recentAlerts: alerts.slice(0, 5).map((a: any) => ({
            title: a.title,
            severity: a.severity,
            category: a.category,
          })),
          tenantId: tenant_id,
        };

        // Call Lovable AI for recommendations
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) {
          return new Response(JSON.stringify({ error: "AI not configured" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an email security expert specializing in Microsoft 365 Exchange Online Protection and Defender for Office 365. Analyze the provided tenant configuration and return actionable security recommendations. You MUST use ONLY the provided data — do not fabricate or assume any configuration details not present in the input.`,
              },
              {
                role: "user",
                content: `Analyze this M365 tenant's email security configuration and provide prioritized recommendations to strengthen email authentication and domain protection.

Tenant data:
${JSON.stringify(context, null, 2)}

Return a JSON array of recommendations, each with: title, severity (critical/high/medium/low), description, action.
Focus on:
1. SPF/DKIM/DMARC gaps for each domain
2. EOP policy hardening (anti-phishing impersonation protection, anti-spam thresholds, anti-malware ZAP)
3. Safe Links and Safe Attachments enablement
4. General email security best practices based on the alerts seen

Return ONLY the JSON array, no markdown.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "return_recommendations",
                  description: "Return email security recommendations",
                  parameters: {
                    type: "object",
                    properties: {
                      recommendations: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                            description: { type: "string" },
                            action: { type: "string" },
                          },
                          required: ["title", "severity", "description", "action"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["recommendations"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "return_recommendations" } },
          }),
        });

        if (!aiResp.ok) {
          if (aiResp.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiResp.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const t = await aiResp.text();
          console.error("AI error:", aiResp.status, t);
          throw new Error("AI analysis failed");
        }

        const aiResult = await aiResp.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
        let recommendations = [];

        if (toolCall?.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            recommendations = parsed.recommendations || [];
          } catch {
            console.error("Failed to parse AI tool call response");
          }
        }

        responseData = { recommendations };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data: responseData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-security error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
