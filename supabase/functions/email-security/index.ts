import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Token helpers ──────────────────────────────────────────────────────
async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  return getOAuthToken(clientId, clientSecret, tenantId, "https://graph.microsoft.com/.default");
}

async function getExoToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  return getOAuthToken(clientId, clientSecret, tenantId, "https://outlook.office365.com/.default");
}

async function getOAuthToken(clientId: string, clientSecret: string, tenantId: string, scope: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  console.log(`Token request: scope=${scope} tenant=${tenantId} clientId=${clientId}`);
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope, grant_type: "client_credentials" }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error(`Token error (${scope}): ${resp.status} ${t}`);
    throw new Error(`Token error (${scope}): ${resp.status} ${t}`);
  }
  const data = await resp.json();
  console.log(`Token acquired for ${scope}, expires_in=${data.expires_in}`);
  return data.access_token;
}

// ── Graph helpers ──────────────────────────────────────────────────────
async function graphGet(token: string, endpoint: string) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    console.error(`Graph error ${endpoint}: ${resp.status} ${await resp.text()}`);
    return null;
  }
  return resp.json();
}

// ── Exchange Online InvokeCommand helper ──────────────────────────────
async function exoInvokeCommand(token: string, tenantId: string, cmdletName: string) {
  const url = `https://outlook.office365.com/adminapi/beta/${tenantId}/InvokeCommand`;
  console.log(`EXO InvokeCommand: ${cmdletName}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-AnchorMailbox": `UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@${tenantId}`,
    },
    body: JSON.stringify({
      CmdletInput: {
        CmdletName: cmdletName,
      },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error(`EXO InvokeCommand error ${cmdletName}: ${resp.status} body=${t}`);
    return null;
  }
  const data = await resp.json();
  const items = data?.value || [];
  console.log(`EXO ${cmdletName}: got ${items.length} items`);
  return data;
}

// ── Domain auth parser ─────────────────────────────────────────────────
function parseDomainAuth(domains: any[]): any[] {
  return domains.map((d: any) => {
    const records = d.serviceConfigurationRecords || [];
    const spfRecord = records.find((r: any) => r.recordType === 'Txt' && r.text?.startsWith('v=spf1'));
    const dkimRecords = records.filter((r: any) => r.recordType === 'CName' && r.label?.includes('._domainkey'));
    return {
      domain: d.id,
      isVerified: d.isVerified || false,
      spf: { status: spfRecord ? 'pass' : 'missing', record: spfRecord?.text || null },
      dkim: {
        status: dkimRecords.length > 0 ? 'pass' : 'missing',
        selectors: dkimRecords.map((r: any) => r.label?.split('._domainkey')[0]).filter(Boolean),
      },
      dmarc: { status: 'unknown', record: null, policy: null },
    };
  });
}

// ── EXO policy mappers ─────────────────────────────────────────────────
function mapAntiPhishPolicies(raw: any): any[] {
  const items = raw?.value || [];
  return items.map((p: any) => ({
    id: p.Identity || p.Guid || p.Name,
    displayName: p.Name || 'Unnamed Policy',
    description: p.AdminDisplayName || null,
    isEnabled: p.Enabled ?? true,
    priority: p.Priority,
    impersonationProtectionEnabled: p.EnableTargetedUserProtection ?? false,
    mailboxIntelligenceEnabled: p.EnableMailboxIntelligence ?? false,
    spoofIntelligenceEnabled: p.EnableSpoofIntelligence ?? true,
    targetedUserProtection: p.TargetedUsersToProtect || [],
    targetedDomainProtection: p.TargetedDomainsToProtect || [],
    source: 'exchange-online-rest',
  }));
}

function mapAntiSpamPolicies(raw: any): any[] {
  const items = raw?.value || [];
  return items.map((p: any) => ({
    id: p.Identity || p.Guid || p.Name,
    displayName: p.Name || 'Unnamed Policy',
    description: p.AdminDisplayName || null,
    isEnabled: true,
    priority: p.Priority,
    spamAction: p.SpamAction || null,
    highConfidenceSpamAction: p.HighConfidenceSpamAction || null,
    bulkThreshold: p.BulkThreshold ?? 7,
    allowedSenders: p.AllowedSenders || [],
    blockedSenders: p.BlockedSenders || [],
    direction: 'inbound',
    source: 'exchange-online-rest',
  }));
}

function mapAntiMalwarePolicies(raw: any): any[] {
  const items = raw?.value || [];
  return items.map((p: any) => ({
    id: p.Identity || p.Guid || p.Name,
    displayName: p.Name || 'Unnamed Policy',
    description: p.AdminDisplayName || null,
    isEnabled: true,
    priority: p.Priority,
    zapEnabled: p.ZapEnabled ?? true,
    enableFileFilter: p.EnableFileFilter ?? false,
    fileFilterTypes: p.FileTypes || [],
    action: p.Action || 'DeleteMessage',
    source: 'exchange-online-rest',
  }));
}

function mapSafeLinksPolicies(raw: any): any[] {
  const items = raw?.value || [];
  return items.map((p: any) => ({
    id: p.Identity || p.Guid || p.Name,
    displayName: p.Name || 'Unnamed Policy',
    description: p.AdminDisplayName || null,
    isEnabled: p.EnableSafeLinksForEmail ?? true,
    priority: p.Priority,
    scanUrls: p.ScanUrls ?? true,
    deliverMessageAfterScan: p.DeliverMessageAfterScan ?? true,
    trackUserClicks: p.TrackClicks ?? true,
    allowClickThrough: p.AllowClickThrough ?? false,
    doNotRewriteUrls: p.DoNotRewriteUrls || [],
    source: 'exchange-online-rest',
  }));
}

function mapSafeAttachmentsPolicies(raw: any): any[] {
  const items = raw?.value || [];
  return items.map((p: any) => ({
    id: p.Identity || p.Guid || p.Name,
    displayName: p.Name || 'Unnamed Policy',
    description: p.AdminDisplayName || null,
    isEnabled: p.Enable ?? true,
    priority: p.Priority,
    action: p.Action || 'Block',
    redirect: p.Redirect ?? false,
    redirectAddress: p.RedirectAddress || null,
    actionOnError: p.ActionOnError ?? true,
    source: 'exchange-online-rest',
  }));
}

// ── Fallback for when EXO REST API is unavailable ──────────────────────
function exoFallback(action: string): any[] {
  const policyName = action.replace('fetch-', '').replace(/-/g, ' ');
  const isDefender = action === "fetch-safe-links" || action === "fetch-safe-attachments";
  return [{
    id: `default-${action}`,
    displayName: `Default ${policyName} policy`,
    description: isDefender
      ? "Safe Links/Attachments require Defender for Office 365. To read these policies via the Exchange REST API, ensure your service principal has the Exchange.ManageAsApp permission and Exchange Administrator role."
      : "To read EOP policies via the Exchange REST API, ensure your service principal has the Exchange.ManageAsApp permission and Exchange Administrator role assigned in Azure AD.",
    isEnabled: undefined,
    source: "exo-api-unavailable",
  }];
}

// ── Main handler ───────────────────────────────────────────────────────
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

    // Auth
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
      const { data: conn } = await supabase.from("tenant_connections").select("user_id").eq("id", tenantConnectionId).single();
      userId = conn?.user_id;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credentials
    const { data: creds, error: credErr } = await supabase.rpc("get_decrypted_credential", {
      p_tenant_connection_id: tenantConnectionId, p_user_id: userId,
    });
    if (credErr || !creds?.length) {
      return new Response(JSON.stringify({ error: "No credentials found for this tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, client_secret, tenant_id } = creds[0];

    let responseData: any = null;

    // ── EXO policy fetch actions ───────────────────────────────────────
    const exoPolicyActions: Record<string, { cmdlet: string; mapper: (raw: any) => any[] }> = {
      "fetch-anti-phishing": { cmdlet: "Get-AntiPhishPolicy", mapper: mapAntiPhishPolicies },
      "fetch-anti-spam": { cmdlet: "Get-HostedContentFilterPolicy", mapper: mapAntiSpamPolicies },
      "fetch-anti-malware": { cmdlet: "Get-MalwareFilterPolicy", mapper: mapAntiMalwarePolicies },
      "fetch-safe-links": { cmdlet: "Get-SafeLinksPolicy", mapper: mapSafeLinksPolicies },
      "fetch-safe-attachments": { cmdlet: "Get-SafeAttachmentPolicy", mapper: mapSafeAttachmentsPolicies },
    };

    if (exoPolicyActions[action]) {
      const { cmdlet, mapper } = exoPolicyActions[action];
      try {
        const exoToken = await getExoToken(client_id, client_secret, tenant_id);
        const raw = await exoInvokeCommand(exoToken, tenant_id, cmdlet);
        if (raw) {
          responseData = mapper(raw);
        } else {
          responseData = exoFallback(action);
        }
      } catch (err) {
        console.error(`EXO token/API error for ${action}:`, err);
        responseData = exoFallback(action);
      }
    } else {
      // Non-EXO actions
      const graphToken = await getGraphToken(client_id, client_secret, tenant_id);

      switch (action) {
        case "fetch-overview": {
          const domains = await graphGet(graphToken, "/domains");
          const domainList = domains?.value || [];
          const domainAuth = parseDomainAuth(domainList);
          const domainsWithFullAuth = domainAuth.filter((d: any) => d.spf.status === 'pass' && d.dkim.status === 'pass').length;
          const domainAuthScore = domainList.length > 0 ? Math.round((domainsWithFullAuth / domainList.length) * 100) : 0;

          // Try to get EXO policy counts
          let policyCounts: any = {
            antiPhishingCount: null, antiSpamCount: null, antiMalwareCount: null,
            safeLinksCount: null, safeAttachmentsCount: null, policyDataAvailable: false,
          };

          try {
            const exoToken = await getExoToken(client_id, client_secret, tenant_id);
            const [antiPhish, antiSpam, antiMalware, safeLinks, safeAttachments] = await Promise.all([
              exoInvokeCommand(exoToken, tenant_id, "Get-AntiPhishPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-HostedContentFilterPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-MalwareFilterPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-SafeLinksPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-SafeAttachmentPolicy"),
            ]);

            policyCounts = {
              antiPhishingCount: antiPhish?.value?.length ?? null,
              antiSpamCount: antiSpam?.value?.length ?? null,
              antiMalwareCount: antiMalware?.value?.length ?? null,
              safeLinksCount: safeLinks?.value?.length ?? null,
              safeAttachmentsCount: safeAttachments?.value?.length ?? null,
              policyDataAvailable: true,
            };
          } catch (err) {
            console.error("EXO overview counts unavailable:", err);
          }

          // Compute overall protection score including policy data if available
          let protectionScore = domainAuthScore;
          if (policyCounts.policyDataAvailable) {
            const hasAntiPhish = (policyCounts.antiPhishingCount ?? 0) > 0;
            const hasAntiSpam = (policyCounts.antiSpamCount ?? 0) > 0;
            const hasAntiMalware = (policyCounts.antiMalwareCount ?? 0) > 0;
            const hasSafeLinks = (policyCounts.safeLinksCount ?? 0) > 0;
            const hasSafeAttachments = (policyCounts.safeAttachmentsCount ?? 0) > 0;
            const policyScore = [hasAntiPhish, hasAntiSpam, hasAntiMalware, hasSafeLinks, hasSafeAttachments]
              .filter(Boolean).length;
            // Weighted: 50% domain auth, 50% policy coverage
            protectionScore = Math.round((domainAuthScore * 0.5) + (policyScore / 5 * 100 * 0.5));
          }

          responseData = {
            ...policyCounts,
            domainCount: domainList.length,
            domainsWithFullAuth,
            protectionScore,
            protectionScoreNote: policyCounts.policyDataAvailable
              ? "Based on domain authentication (SPF/DKIM) and EOP/Defender policy coverage."
              : "Based on domain authentication (SPF/DKIM) only. Add Exchange.ManageAsApp permission to also verify EOP/Defender policies.",
          };
          break;
        }

        case "fetch-domain-auth": {
          const domains = await graphGet(graphToken, "/domains");
          const domainList = domains?.value || [];
          const enriched = await Promise.all(
            domainList.map(async (d: any) => {
              const records = await graphGet(graphToken, `/domains/${d.id}/serviceConfigurationRecords`);
              return { ...d, serviceConfigurationRecords: records?.value || [] };
            })
          );
          responseData = parseDomainAuth(enriched);
          break;
        }

        case "ai-recommendations": {
          const [domains, securityAlerts] = await Promise.all([
            graphGet(graphToken, "/domains"),
            graphGet(graphToken, "/security/alerts_v2?$top=10"),
          ]);
          const domainList = domains?.value || [];
          const domainAuth = parseDomainAuth(domainList);
          const alerts = securityAlerts?.value || [];

          // Also try EXO data for richer AI analysis
          let exoPolicyData: any = null;
          try {
            const exoToken = await getExoToken(client_id, client_secret, tenant_id);
            const [antiPhish, antiSpam, antiMalware, safeLinks, safeAttachments] = await Promise.all([
              exoInvokeCommand(exoToken, tenant_id, "Get-AntiPhishPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-HostedContentFilterPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-MalwareFilterPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-SafeLinksPolicy"),
              exoInvokeCommand(exoToken, tenant_id, "Get-SafeAttachmentPolicy"),
            ]);
            exoPolicyData = {
              antiPhishing: mapAntiPhishPolicies(antiPhish),
              antiSpam: mapAntiSpamPolicies(antiSpam),
              antiMalware: mapAntiMalwarePolicies(antiMalware),
              safeLinks: mapSafeLinksPolicies(safeLinks),
              safeAttachments: mapSafeAttachmentsPolicies(safeAttachments),
            };
          } catch (err) {
            console.error("EXO data unavailable for AI analysis:", err);
          }

          const context = {
            domains: domainAuth,
            recentAlerts: alerts.slice(0, 5).map((a: any) => ({ title: a.title, severity: a.severity, category: a.category })),
            tenantId: tenant_id,
            exoPolicies: exoPolicyData,
          };

          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const hasExoData = exoPolicyData !== null;
          const systemPrompt = `You are an email security expert specializing in Microsoft 365 Exchange Online Protection and Defender for Office 365.

${hasExoData ? `IMPORTANT: You have FULL EXO policy data available via the Exchange Online REST API. You CAN verify EOP policy settings (anti-phishing, anti-spam, anti-malware) and Defender features (Safe Links, Safe Attachments).
For each recommendation, set confidence to "verified" since you have the actual policy data.` : `CRITICAL RULES:
- You can ONLY verify domain authentication (SPF, DKIM, DMARC) from the provided DNS data.
- You CANNOT verify EOP or Defender policies because Exchange.ManageAsApp permission is not configured.
- For unverifiable items, set confidence to "recommended" and frame as suggestions to CHECK/VERIFY.
- NEVER state a policy "is not configured" unless you have actual data proving it.`}`;

          const userPrompt = `Analyze this M365 tenant's email security.

VERIFIABLE DATA:
${JSON.stringify(context, null, 2)}

${hasExoData ? 'The exoPolicies field contains REAL policy data from Exchange Online REST API. Analyze it for misconfigurations, weak settings, and best practice gaps.' : 'EXO policy data is NOT available. Focus on domain authentication and provide best-practice recommendations for policies.'}

For each recommendation include a "confidence" field:
- "verified" = based on actual data
- "recommended" = best practice to verify manually

Focus on:
1. SPF/DKIM/DMARC gaps
2. EOP policy settings and gaps
3. Defender for Office 365 configuration`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              tools: [{
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
                            confidence: { type: "string", enum: ["verified", "recommended"] },
                          },
                          required: ["title", "severity", "description", "action", "confidence"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["recommendations"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "return_recommendations" } },
            }),
          });

          if (!aiResp.ok) {
            if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            const t = await aiResp.text();
            console.error("AI error:", aiResp.status, t);
            throw new Error("AI analysis failed");
          }

          const aiResult = await aiResp.json();
          const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
          let recommendations = [];
          if (toolCall?.function?.arguments) {
            try { recommendations = JSON.parse(toolCall.function.arguments).recommendations || []; } catch { console.error("Failed to parse AI response"); }
          }

          responseData = { recommendations };
          break;
        }

        default:
          return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
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
