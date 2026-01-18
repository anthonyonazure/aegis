import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft Graph API endpoints for different resource types
const GRAPH_ENDPOINTS: Record<string, { endpoint: string; useBeta?: boolean }> = {
  // Intune
  'intune/device-configurations': { endpoint: '/deviceManagement/deviceConfigurations' },
  'intune/compliance-policies': { endpoint: '/deviceManagement/deviceCompliancePolicies' },
  'intune/app-configurations': { endpoint: '/deviceAppManagement/mobileAppConfigurations', useBeta: true },
  'intune/autopilot': { endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles' },
  'intune/enrollment-restrictions': { endpoint: '/deviceManagement/deviceEnrollmentConfigurations' },
  'intune/scripts': { endpoint: '/deviceManagement/deviceManagementScripts' },
  
  // Conditional Access
  'conditional-access/ca-policies': { endpoint: '/identity/conditionalAccess/policies' },
  'conditional-access/named-locations': { endpoint: '/identity/conditionalAccess/namedLocations' },
  
  // Entra ID
  'entra-id/groups': { endpoint: '/groups' },
  'entra-id/app-registrations': { endpoint: '/applications' },
  'entra-id/admin-units': { endpoint: '/administrativeUnits' },
  
  // Defender
  'defender/asr-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true },
  'defender/antivirus-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true },
  'defender/firewall-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true },
};

interface ScheduledDriftConfig {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_type: string;
  target_tenant_ids: string[];
  target_customer_id: string | null;
  target_group_id: string | null;
  resource_ids: string[];
  baseline_export_id: string | null;
  service_principal_config_id: string | null;
  schedule_cron: string;
  is_active: boolean;
  notify_on_drift: boolean;
  webhook_config_id: string | null;
  drift_threshold_percent: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
}

interface TenantConnection {
  id: string;
  tenant_id: string;
  display_name: string | null;
  tenant_name: string | null;
  customer_id: string | null;
  tenant_group_id: string | null;
}

interface DriftResult {
  tenantId: string;
  tenantName: string;
  connectionId: string;
  status: "success" | "error" | "skipped";
  hasDrift: boolean;
  added: number;
  removed: number;
  modified: number;
  error?: string;
  details?: {
    resourcesChecked: number;
    hasBaseline: boolean;
    addedResources?: Array<{ type: string; name: string; id: string }>;
    removedResources?: Array<{ type: string; name: string; id: string }>;
    modifiedResources?: Array<{ type: string; name: string; id: string; changes: string[] }>;
  };
}

interface BaselineResource {
  id: string;
  resource_type: string;
  resource_name: string | null;
  resource_id: string | null;
  data: Record<string, unknown>;
}

interface CurrentResource {
  id: string;
  displayName?: string;
  name?: string;
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  // Use service role for cron-triggered requests
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Scheduled drift runner started");

  try {
    // Check if this is a manual trigger for a specific config
    let specificConfigId: string | null = null;
    try {
      const body = await req.json();
      specificConfigId = body?.configId || null;
    } catch {
      // No body - running all active schedules
    }

    const now = new Date();
    
    // Get schedules to process
    let query = supabase
      .from("scheduled_drift_configs")
      .select("*");
    
    if (specificConfigId) {
      query = query.eq("id", specificConfigId);
    } else {
      query = query.eq("is_active", true);
    }

    const { data: schedules, error: schedulesError } = await query;

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} ${specificConfigId ? 'specific' : 'active'} schedules`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No schedules to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedSchedules: string[] = [];
    const results: Record<string, any> = {};

    for (const schedule of schedules as ScheduledDriftConfig[]) {
      // Check if this schedule should run based on its cron expression
      const shouldRun = specificConfigId ? true : await checkShouldRun(supabase, schedule);
      
      if (!shouldRun) {
        console.log(`Schedule ${schedule.name} not due to run yet`);
        continue;
      }

      console.log(`Processing drift schedule: ${schedule.name}`);

      try {
        // Create a drift run record
        const { data: driftRun, error: runError } = await supabase
          .from("scheduled_drift_runs")
          .insert({
            scheduled_config_id: schedule.id,
            user_id: schedule.user_id,
            status: "running",
            started_at: now.toISOString(),
            total_tenants: 0,
            completed_tenants: 0,
            failed_tenants: 0,
            tenants_with_drift: 0,
          })
          .select()
          .single();

        if (runError) {
          console.error(`Error creating drift run for ${schedule.name}:`, runError);
          continue;
        }

        console.log(`Created drift run ${driftRun.id} for schedule ${schedule.name}`);

        // Get target tenants based on target_type
        const tenants = await getTargetTenants(supabase, schedule);
        
        // Update run with tenant count
        await supabase
          .from("scheduled_drift_runs")
          .update({ total_tenants: tenants.length })
          .eq("id", driftRun.id);

        // Get baseline export data if configured
        let baselineData: { resources: BaselineResource[]; exportId: string } | null = null;
        if (schedule.baseline_export_id) {
          const { data: baselineResources } = await supabase
            .from("exported_resources")
            .select("*")
            .eq("export_job_id", schedule.baseline_export_id);
          
          if (baselineResources && baselineResources.length > 0) {
            baselineData = {
              resources: baselineResources as BaselineResource[],
              exportId: schedule.baseline_export_id,
            };
          }
        }

        // Process each tenant
        const tenantResults: DriftResult[] = [];
        let completedCount = 0;
        let failedCount = 0;
        let driftCount = 0;

        for (const tenant of tenants) {
          try {
            // Real drift detection using Graph API
            const driftResult = await performRealDriftCheck(
              supabase,
              tenant,
              schedule.resource_ids,
              baselineData,
              schedule.user_id
            );

            tenantResults.push(driftResult);
            completedCount++;
            
            if (driftResult.hasDrift) {
              driftCount++;
            }
          } catch (err) {
            console.error(`Error checking drift for tenant ${tenant.id}:`, err);
            tenantResults.push({
              tenantId: tenant.tenant_id,
              tenantName: tenant.display_name || tenant.tenant_name || tenant.tenant_id,
              connectionId: tenant.id,
              status: "error",
              hasDrift: false,
              added: 0,
              removed: 0,
              modified: 0,
              error: err instanceof Error ? err.message : "Unknown error",
            });
            failedCount++;
          }

          // Update progress
          await supabase
            .from("scheduled_drift_runs")
            .update({
              completed_tenants: completedCount,
              failed_tenants: failedCount,
              tenants_with_drift: driftCount,
            })
            .eq("id", driftRun.id);
        }

        // Complete the run
        const runComplete = now.toISOString();
        const hasDrift = driftCount > 0;

        await supabase
          .from("scheduled_drift_runs")
          .update({
            status: failedCount === tenants.length ? "failed" : "completed",
            completed_at: runComplete,
            results: { tenants: tenantResults },
          })
          .eq("id", driftRun.id);

        // Update the schedule
        await supabase
          .from("scheduled_drift_configs")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: calculateNextRun(schedule.schedule_cron),
            run_count: schedule.run_count + 1,
            last_drift_detected: hasDrift,
          })
          .eq("id", schedule.id);

        // Log audit event
        await supabase.from("audit_logs").insert({
          user_id: schedule.user_id,
          action: "scheduled_drift_completed",
          resource_type: "scheduled_drift_config",
          resource_id: schedule.id,
          details: {
            drift_run_id: driftRun.id,
            schedule_name: schedule.name,
            tenants_checked: tenants.length,
            tenants_with_drift: driftCount,
            has_drift: hasDrift,
          },
        });

        // Trigger webhook notification if drift was detected and configured
        if (hasDrift && schedule.notify_on_drift) {
          await triggerWebhooks(supabase, schedule.user_id, "scheduled.drift", {
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            drift_run_id: driftRun.id,
            tenants_checked: tenants.length,
            tenants_with_drift: driftCount,
            summary: tenantResults.filter(t => t.hasDrift).map(t => ({
              tenant: t.tenantName,
              added: t.added,
              removed: t.removed,
              modified: t.modified,
            })),
          });
        }

        // Auto-create PSA tickets for tenants with drift
        if (hasDrift) {
          const tenantsWithDrift = tenantResults.filter(t => t.hasDrift);
          const ticketResults = await createAutoTickets(
            supabase,
            schedule.user_id,
            schedule.id,
            schedule.name,
            driftRun.id,
            tenantsWithDrift
          );
          
          if (ticketResults.ticketsCreated > 0) {
            console.log(`Created ${ticketResults.ticketsCreated} PSA tickets for drift detection`);
          }
        }

        processedSchedules.push(schedule.id);
        results[schedule.id] = {
          name: schedule.name,
          runId: driftRun.id,
          tenantsChecked: tenants.length,
          tenantsWithDrift: driftCount,
          failed: failedCount,
        };
      } catch (err) {
        console.error(`Error processing schedule ${schedule.name}:`, err);
        results[schedule.id] = {
          name: schedule.name,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    console.log(`Processed ${processedSchedules.length} schedules`);

    return new Response(
      JSON.stringify({
        message: "Scheduled drift detection processed",
        processed: processedSchedules.length,
        schedule_ids: processedSchedules,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in scheduled drift runner:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getTargetTenants(
  supabase: any,
  schedule: ScheduledDriftConfig
): Promise<TenantConnection[]> {
  let query = supabase
    .from("tenant_connections")
    .select("id, tenant_id, display_name, tenant_name, customer_id, tenant_group_id")
    .eq("user_id", schedule.user_id)
    .eq("status", "active");

  switch (schedule.target_type) {
    case "all":
      // No additional filter
      break;
    case "customer":
      if (schedule.target_customer_id) {
        query = query.eq("customer_id", schedule.target_customer_id);
      }
      break;
    case "group":
      if (schedule.target_group_id) {
        query = query.eq("tenant_group_id", schedule.target_group_id);
      }
      break;
    case "selected":
      if (schedule.target_tenant_ids && schedule.target_tenant_ids.length > 0) {
        query = query.in("id", schedule.target_tenant_ids);
      }
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching target tenants:", error);
    return [];
  }

  return data || [];
}

// Get access token using stored credentials
async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string } | { error: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error_description || data.error || 'Token request failed' };
    }

    return { token: data.access_token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Fetch resources from Graph API
async function fetchGraphResources(
  accessToken: string,
  endpoint: string,
  useBeta: boolean = false
): Promise<CurrentResource[]> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const graphUrl = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Graph API error for ${endpoint}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.value || [data];
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return [];
  }
}

// Get stored credentials for a tenant connection
async function getStoredCredentials(
  supabase: any,
  tenantConnectionId: string,
  userId: string
): Promise<{ clientId: string; clientSecret: string; tenantId: string } | null> {
  const { data, error } = await supabase.rpc('get_decrypted_credential', {
    p_tenant_connection_id: tenantConnectionId,
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    console.error('Failed to get credentials:', error);
    return null;
  }

  return {
    clientId: data[0].client_id,
    clientSecret: data[0].client_secret,
    tenantId: data[0].tenant_id,
  };
}

// Compare two objects and return the list of changed keys
function getChangedKeys(baseline: Record<string, unknown>, current: Record<string, unknown>): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  
  // Keys to ignore in comparison
  const ignoreKeys = ['createdDateTime', 'modifiedDateTime', 'lastModifiedDateTime', '@odata.context', '@odata.type'];
  
  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;
    
    const baseVal = JSON.stringify(baseline[key]);
    const currVal = JSON.stringify(current[key]);
    
    if (baseVal !== currVal) {
      changes.push(key);
    }
  }
  
  return changes;
}

// Perform real drift detection using Graph API
async function performRealDriftCheck(
  supabase: any,
  tenant: TenantConnection,
  resourceIds: string[],
  baselineData: { resources: BaselineResource[]; exportId: string } | null,
  userId: string
): Promise<DriftResult> {
  const tenantName = tenant.display_name || tenant.tenant_name || tenant.tenant_id;
  
  // Get credentials for this tenant
  const credentials = await getStoredCredentials(supabase, tenant.id, userId);
  
  if (!credentials) {
    return {
      tenantId: tenant.tenant_id,
      tenantName,
      connectionId: tenant.id,
      status: "error",
      hasDrift: false,
      added: 0,
      removed: 0,
      modified: 0,
      error: "No credentials stored for this tenant",
    };
  }

  // Get access token
  const tokenResult = await getAccessToken(
    credentials.tenantId,
    credentials.clientId,
    credentials.clientSecret
  );

  if ('error' in tokenResult) {
    return {
      tenantId: tenant.tenant_id,
      tenantName,
      connectionId: tenant.id,
      status: "error",
      hasDrift: false,
      added: 0,
      removed: 0,
      modified: 0,
      error: `Authentication failed: ${tokenResult.error}`,
    };
  }

  // If no baseline, we can't detect drift - just return success with no drift
  if (!baselineData || !baselineData.resources || baselineData.resources.length === 0) {
    return {
      tenantId: tenant.tenant_id,
      tenantName,
      connectionId: tenant.id,
      status: "success",
      hasDrift: false,
      added: 0,
      removed: 0,
      modified: 0,
      details: {
        resourcesChecked: 0,
        hasBaseline: false,
      },
    };
  }

  // Group baseline resources by type
  const baselineByType: Record<string, BaselineResource[]> = {};
  for (const resource of baselineData.resources) {
    const type = resource.resource_type;
    if (!baselineByType[type]) baselineByType[type] = [];
    baselineByType[type].push(resource);
  }

  // Track drift results
  const addedResources: Array<{ type: string; name: string; id: string }> = [];
  const removedResources: Array<{ type: string; name: string; id: string }> = [];
  const modifiedResources: Array<{ type: string; name: string; id: string; changes: string[] }> = [];

  // Check each resource type
  const resourceTypesToCheck = resourceIds.length > 0 
    ? resourceIds.filter(id => GRAPH_ENDPOINTS[id])
    : Object.keys(baselineByType).filter(type => GRAPH_ENDPOINTS[type]);

  for (const resourceType of resourceTypesToCheck) {
    const endpointConfig = GRAPH_ENDPOINTS[resourceType];
    if (!endpointConfig) continue;

    try {
      // Fetch current state from Graph API
      const currentResources = await fetchGraphResources(
        tokenResult.token,
        endpointConfig.endpoint,
        endpointConfig.useBeta
      );

      const baselineResources = baselineByType[resourceType] || [];
      
      // Create maps for comparison
      const baselineMap = new Map<string, BaselineResource>();
      for (const br of baselineResources) {
        const id = br.resource_id || (br.data as any)?.id;
        if (id) baselineMap.set(id, br);
      }

      const currentMap = new Map<string, CurrentResource>();
      for (const cr of currentResources) {
        if (cr.id) currentMap.set(cr.id, cr);
      }

      // Find added resources (in current but not in baseline)
      for (const [id, current] of currentMap) {
        if (!baselineMap.has(id)) {
          addedResources.push({
            type: resourceType,
            name: current.displayName || current.name || id,
            id,
          });
        }
      }

      // Find removed and modified resources
      for (const [id, baseline] of baselineMap) {
        const current = currentMap.get(id);
        
        if (!current) {
          // Resource was removed
          removedResources.push({
            type: resourceType,
            name: baseline.resource_name || (baseline.data as any)?.displayName || id,
            id,
          });
        } else {
          // Check for modifications
          const baselineData = baseline.data as Record<string, unknown>;
          const changes = getChangedKeys(baselineData, current as Record<string, unknown>);
          
          if (changes.length > 0) {
            modifiedResources.push({
              type: resourceType,
              name: current.displayName || current.name || id,
              id,
              changes,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error checking drift for ${resourceType}:`, err);
    }
  }

  const hasDrift = addedResources.length > 0 || removedResources.length > 0 || modifiedResources.length > 0;

  return {
    tenantId: tenant.tenant_id,
    tenantName,
    connectionId: tenant.id,
    status: "success",
    hasDrift,
    added: addedResources.length,
    removed: removedResources.length,
    modified: modifiedResources.length,
    details: {
      resourcesChecked: resourceTypesToCheck.length,
      hasBaseline: true,
      addedResources: addedResources.slice(0, 20), // Limit to first 20
      removedResources: removedResources.slice(0, 20),
      modifiedResources: modifiedResources.slice(0, 20),
    },
  };
}

async function checkShouldRun(supabase: any, schedule: ScheduledDriftConfig): Promise<boolean> {
  if (!schedule.last_run_at) {
    return true;
  }

  const lastRun = new Date(schedule.last_run_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);

  // Parse cron to determine minimum interval
  const cronParts = schedule.schedule_cron.split(" ");
  
  // Simple interval detection based on cron pattern
  if (cronParts[0] === "*") {
    // Every minute - for testing
    return diffMinutes >= 1;
  } else if (cronParts[1] === "*") {
    // Every hour at minute X
    return diffMinutes >= 60;
  } else if (cronParts[2] === "*") {
    // Daily at specific time
    return diffMinutes >= 1440; // 24 hours
  } else if (cronParts[4] === "*") {
    // Weekly
    return diffMinutes >= 10080; // 7 days
  } else {
    // Monthly or custom - default to daily
    return diffMinutes >= 1440;
  }
}

function calculateNextRun(cronExpression: string): string {
  const now = new Date();
  const cronParts = cronExpression.split(" ");
  
  if (cronParts[0] === "*") {
    now.setMinutes(now.getMinutes() + 1);
  } else if (cronParts[1] === "*") {
    now.setHours(now.getHours() + 1);
    now.setMinutes(parseInt(cronParts[0]) || 0);
  } else if (cronParts[2] === "*") {
    now.setDate(now.getDate() + 1);
    now.setHours(parseInt(cronParts[1]) || 0);
    now.setMinutes(parseInt(cronParts[0]) || 0);
  } else if (cronParts[4] !== "*") {
    now.setDate(now.getDate() + 7);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  
  return now.toISOString();
}

async function triggerWebhooks(
  supabase: any,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  try {
    // Get active webhooks for this user and event type
    const { data: webhooks } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [eventType]);

    if (!webhooks || webhooks.length === 0) {
      // Check for drift.detected event as fallback
      const { data: driftWebhooks } = await supabase
        .from("webhook_configs")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .contains("events", ["drift.detected"]);
      
      if (!driftWebhooks || driftWebhooks.length === 0) {
        return;
      }
      
      // Use drift.detected webhooks
      for (const webhook of driftWebhooks) {
        await sendWebhook(supabase, webhook, "drift.detected", payload, userId);
      }
      return;
    }

    for (const webhook of webhooks) {
      await sendWebhook(supabase, webhook, eventType, payload, userId);
    }
  } catch (err) {
    console.error("Error triggering webhooks:", err);
  }
}

async function sendWebhook(
  supabase: any,
  webhook: any,
  eventType: string,
  payload: Record<string, unknown>,
  userId: string
) {
  try {
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhook.secret && {
          "X-Webhook-Signature": await generateSignature(
            JSON.stringify(webhookPayload),
            webhook.secret
          ),
        }),
      },
      body: JSON.stringify(webhookPayload),
    });

    // Log the webhook delivery
    await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: eventType,
      payload: webhookPayload,
      response_status: response.status,
      success: response.ok,
    });

    // Update webhook last triggered
    await supabase
      .from("webhook_configs")
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: response.ok ? 0 : webhook.failure_count + 1,
      })
      .eq("id", webhook.id);

    console.log(`Webhook ${webhook.name} triggered: ${response.status}`);
  } catch (err: unknown) {
    console.error(`Failed to trigger webhook ${webhook.name}:`, err);
    const errMessage = err instanceof Error ? err.message : "Unknown error";
    
    await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: eventType,
      payload: { event: eventType, data: payload },
      success: false,
      response_body: errMessage,
    });
  }
}

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Auto-ticketing for PSA integrations
async function createAutoTickets(
  supabase: any,
  userId: string,
  scheduleId: string,
  scheduleName: string,
  driftRunId: string,
  tenantsWithDrift: DriftResult[]
): Promise<{ ticketsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let ticketsCreated = 0;

  try {
    // Get active PSA integrations that have auto-ticketing enabled for drift
    const { data: integrations, error: intError } = await supabase
      .from("psa_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("auto_create_tickets", true)
      .eq("ticket_on_drift", true);

    if (intError || !integrations || integrations.length === 0) {
      return { ticketsCreated: 0, errors: [] };
    }

    console.log(`Found ${integrations.length} active PSA integrations for auto-ticketing`);

    // Create tickets for each tenant with drift
    for (const tenant of tenantsWithDrift) {
      for (const integration of integrations) {
        try {
          const title = `Scheduled Drift Detected - ${tenant.tenantName}`;
          const description = `Scheduled drift detection "${scheduleName}" has found configuration changes.

Tenant: ${tenant.tenantName}

Summary:
- Added resources: ${tenant.added}
- Removed resources: ${tenant.removed}
- Modified resources: ${tenant.modified}

Schedule ID: ${scheduleId}
Run ID: ${driftRunId}

Please review the changes and take appropriate action.`;

          // Get PSA credentials
          const { data: credentials, error: credError } = await supabase
            .rpc("get_psa_credential", { p_integration_id: integration.id });

          if (credError || !credentials || credentials.length === 0) {
            console.error(`No credentials found for PSA integration ${integration.name}`);
            errors.push(`${integration.name}: No credentials found`);
            continue;
          }

          const cred = credentials[0];
          
          // Create ticket based on provider
          let externalTicketId: string | null = null;
          
          switch (integration.provider) {
            case "halopsa":
              externalTicketId = await createHaloPSATicket(
                integration.api_url,
                cred.api_key,
                cred.api_secret,
                {
                  title,
                  description,
                  priority: integration.default_priority || "medium",
                  ticketType: integration.default_ticket_type || "incident",
                }
              );
              break;
            case "autotask":
              externalTicketId = await createAutotaskTicket(
                integration.api_url,
                cred.api_key,
                cred.api_secret,
                {
                  title,
                  description,
                  priority: integration.default_priority || "medium",
                  ticketType: integration.default_ticket_type || "incident",
                }
              );
              break;
            case "connectwise":
              externalTicketId = await createConnectWiseTicket(
                integration.api_url,
                cred.api_key,
                cred.api_secret,
                {
                  title,
                  description,
                  priority: integration.default_priority || "medium",
                  ticketType: integration.default_ticket_type || "incident",
                }
              );
              break;
            default:
              errors.push(`${integration.name}: Unsupported provider ${integration.provider}`);
              continue;
          }

          if (externalTicketId) {
            // Store ticket in database
            await supabase.from("psa_tickets").insert({
              user_id: userId,
              psa_integration_id: integration.id,
              title,
              description,
              priority: integration.default_priority || "medium",
              ticket_type: integration.default_ticket_type || "incident",
              source_type: "scheduled_drift",
              source_id: driftRunId,
              external_ticket_id: externalTicketId,
              status: "open",
            });

            ticketsCreated++;
            console.log(`Created ticket in ${integration.name}: ${externalTicketId}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${integration.name} (${tenant.tenantName}): ${errorMsg}`);
        }
      }
    }
  } catch (err) {
    console.error("Error in auto-ticketing:", err);
  }

  return { ticketsCreated, errors };
}

// PSA ticket creation helpers
async function createHaloPSATicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<string | null> {
  try {
    // Get OAuth token first
    const tokenResponse = await fetch(`${apiUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: apiKey,
        client_secret: apiSecret,
        scope: "all",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("HaloPSA token error:", await tokenResponse.text());
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    // Map priority
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    // Create ticket
    const response = await fetch(`${apiUrl}/api/Tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          summary: ticket.title,
          details: ticket.description,
          priority_id: priorityMap[ticket.priority] || 3,
          tickettype_id: ticket.ticketType === "service_request" ? 2 : 1,
        },
      ]),
    });

    if (!response.ok) {
      console.error("HaloPSA ticket error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data[0]?.id?.toString() || null;
  } catch (err) {
    console.error("HaloPSA ticket creation error:", err);
    return null;
  }
}

async function createAutotaskTicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<string | null> {
  try {
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const response = await fetch(`${apiUrl}/v1.0/Tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        APIIntegrationCode: apiKey,
        UserName: apiKey,
        Secret: apiSecret,
      },
      body: JSON.stringify({
        title: ticket.title,
        description: ticket.description,
        priority: priorityMap[ticket.priority] || 3,
        status: 1,
        ticketType: ticket.ticketType === "service_request" ? 2 : 1,
      }),
    });

    if (!response.ok) {
      console.error("Autotask ticket error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.itemId?.toString() || null;
  } catch (err) {
    console.error("Autotask ticket creation error:", err);
    return null;
  }
}

async function createConnectWiseTicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<string | null> {
  try {
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const auth = btoa(`${apiKey}:${apiSecret}`);
    
    const response = await fetch(`${apiUrl}/v4_6_release/apis/3.0/service/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        summary: ticket.title,
        initialDescription: ticket.description,
        priority: { id: priorityMap[ticket.priority] || 3 },
        board: { id: 1 },
        company: { id: 1 },
        type: { id: ticket.ticketType === "service_request" ? 2 : 1 },
      }),
    });

    if (!response.ok) {
      console.error("ConnectWise ticket error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.id?.toString() || null;
  } catch (err) {
    console.error("ConnectWise ticket creation error:", err);
    return null;
  }
}
