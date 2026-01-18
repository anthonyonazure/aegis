import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledDeploymentConfig {
  id: string;
  user_id: string;
  name: string;
  policy_template_id: string;
  target_type: string;
  target_tenant_ids: string[];
  target_customer_id: string | null;
  target_group_id: string | null;
  schedule_cron: string;
  is_active: boolean;
  dry_run: boolean;
  notify_on_completion: boolean;
  webhook_config_id: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
}

interface TenantConnection {
  id: string;
  tenant_id: string;
  display_name: string | null;
  tenant_name: string | null;
}

interface DeploymentResult {
  tenantId: string;
  tenantName: string;
  connectionId: string;
  status: "success" | "error" | "skipped";
  changesApplied: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Scheduled deployment runner started");

  try {
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
      .from("scheduled_deployment_configs")
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

    console.log(`Found ${schedules?.length || 0} schedules`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No schedules to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedSchedules: string[] = [];
    const results: Record<string, unknown> = {};

    for (const schedule of schedules as ScheduledDeploymentConfig[]) {
      const shouldRun = specificConfigId ? true : checkShouldRun(schedule);

      if (!shouldRun) {
        console.log(`Schedule ${schedule.name} not due to run yet`);
        continue;
      }

      console.log(`Processing deployment schedule: ${schedule.name}`);

      try {
        // Get policy template
        const { data: template, error: templateError } = await supabase
          .from("policy_templates")
          .select("*")
          .eq("id", schedule.policy_template_id)
          .single();

        if (templateError || !template) {
          console.error(`Template not found for schedule ${schedule.name}`);
          continue;
        }

        // Create a deployment run record
        const { data: deployRun, error: runError } = await supabase
          .from("scheduled_deployment_runs")
          .insert({
            scheduled_config_id: schedule.id,
            user_id: schedule.user_id,
            status: "running",
            started_at: now.toISOString(),
            total_tenants: 0,
          })
          .select()
          .single();

        if (runError) {
          console.error(`Error creating run for ${schedule.name}:`, runError);
          continue;
        }

        // Get target tenants
        const tenants = await getTargetTenants(supabase, schedule);

        await supabase
          .from("scheduled_deployment_runs")
          .update({ total_tenants: tenants.length })
          .eq("id", deployRun.id);

        // Process each tenant
        const tenantResults: DeploymentResult[] = [];
        let completedCount = 0;
        let failedCount = 0;

        for (const tenant of tenants) {
          try {
            const result = await deployToTenant(
              supabase,
              tenant,
              template,
              schedule.user_id,
              schedule.dry_run
            );

            tenantResults.push(result);
            if (result.status === "success") {
              completedCount++;
            } else {
              failedCount++;
            }
          } catch (err) {
            console.error(`Error deploying to tenant ${tenant.id}:`, err);
            tenantResults.push({
              tenantId: tenant.tenant_id,
              tenantName: tenant.display_name || tenant.tenant_name || tenant.tenant_id,
              connectionId: tenant.id,
              status: "error",
              changesApplied: 0,
              error: err instanceof Error ? err.message : "Unknown error",
            });
            failedCount++;
          }

          // Update progress
          await supabase
            .from("scheduled_deployment_runs")
            .update({
              completed_tenants: completedCount,
              failed_tenants: failedCount,
            })
            .eq("id", deployRun.id);
        }

        // Complete the run
        const success = failedCount === 0;

        await supabase
          .from("scheduled_deployment_runs")
          .update({
            status: success ? "completed" : "failed",
            completed_at: now.toISOString(),
            results: { tenants: tenantResults },
          })
          .eq("id", deployRun.id);

        // Update the schedule
        await supabase
          .from("scheduled_deployment_configs")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: calculateNextRun(schedule.schedule_cron),
            run_count: schedule.run_count + 1,
            last_run_success: success,
          })
          .eq("id", schedule.id);

        // Trigger webhook if configured
        if (schedule.notify_on_completion && schedule.webhook_config_id) {
          await triggerWebhook(supabase, schedule.user_id, "scheduled.deployment", {
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            run_id: deployRun.id,
            success,
            tenants_processed: tenants.length,
            completed: completedCount,
            failed: failedCount,
          });
        }

        processedSchedules.push(schedule.id);
        results[schedule.id] = {
          name: schedule.name,
          runId: deployRun.id,
          tenantsProcessed: tenants.length,
          completed: completedCount,
          failed: failedCount,
          success,
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
        message: "Scheduled deployments processed",
        processed: processedSchedules.length,
        schedule_ids: processedSchedules,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in scheduled deployment runner:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getTargetTenants(
  supabase: any,
  schedule: ScheduledDeploymentConfig
): Promise<TenantConnection[]> {
  let query = supabase
    .from("tenant_connections")
    .select("id, tenant_id, display_name, tenant_name")
    .eq("user_id", schedule.user_id)
    .eq("status", "connected");

  switch (schedule.target_type) {
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

async function deployToTenant(
  supabase: any,
  tenant: TenantConnection,
  template: Record<string, unknown>,
  userId: string,
  dryRun: boolean
): Promise<DeploymentResult> {
  const tenantName = tenant.display_name || tenant.tenant_name || tenant.tenant_id;

  // Get credentials
  const { data: credentials, error: credError } = await supabase.rpc("get_decrypted_credential", {
    p_tenant_connection_id: tenant.id,
    p_user_id: userId,
  });

  if (credError || !credentials || (credentials as any[]).length === 0) {
    return {
      tenantId: tenant.tenant_id,
      tenantName,
      connectionId: tenant.id,
      status: "error",
      changesApplied: 0,
      error: "No credentials found",
    };
  }

  const cred = (credentials as any[])[0];

  // Get access token
  const tokenResult = await getAccessToken(cred.tenant_id, cred.client_id, cred.client_secret);

  if ("error" in tokenResult) {
    return {
      tenantId: tenant.tenant_id,
      tenantName,
      connectionId: tenant.id,
      status: "error",
      changesApplied: 0,
      error: tokenResult.error,
    };
  }

  // Deploy policies
  const resourceTypes = (template.resource_types as string[]) || [];
  const policyData = template.policy_data as Record<string, unknown>;

  let changesApplied = 0;
  const errors: string[] = [];

  for (const resourceType of resourceTypes) {
    const endpoint = getEndpointForResourceType(resourceType);
    const policies = (policyData[resourceType] || []) as Record<string, unknown>[];

    for (const policy of policies) {
      if (dryRun) {
        changesApplied++;
        continue;
      }

      try {
        const result = await deployPolicy(tokenResult.token, endpoint, policy);
        if (result.success) {
          changesApplied++;
        } else if (result.error) {
          errors.push(result.error);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  return {
    tenantId: tenant.tenant_id,
    tenantName,
    connectionId: tenant.id,
    status: errors.length === 0 ? "success" : "error",
    changesApplied,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string } | { error: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error_description || data.error || "Token request failed" };
    }

    return { token: data.access_token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

function getEndpointForResourceType(resourceType: string): string {
  const endpoints: Record<string, string> = {
    conditionalAccessPolicy: "identity/conditionalAccess/policies",
    deviceCompliancePolicy: "deviceManagement/deviceCompliancePolicies",
    deviceConfigurationPolicy: "deviceManagement/deviceConfigurations",
    groupPolicy: "groups",
    namedLocation: "identity/conditionalAccess/namedLocations",
  };
  return endpoints[resourceType] || resourceType;
}

async function deployPolicy(
  accessToken: string,
  endpoint: string,
  policy: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const policyName = (policy.displayName || policy.name) as string;

  try {
    // Check if exists
    const checkUrl = `https://graph.microsoft.com/v1.0/${endpoint}?$filter=displayName eq '${encodeURIComponent(policyName)}'`;
    const checkResponse = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.value && checkData.value.length > 0) {
        // Update existing
        const existingId = checkData.value[0].id;
        const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}/${existingId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(policy),
        });

        if (!updateResponse.ok && updateResponse.status !== 204) {
          return { success: false, error: `Update failed: ${updateResponse.status}` };
        }
        return { success: true };
      }
    }

    // Create new
    const createResponse = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(policy),
    });

    if (!createResponse.ok) {
      return { success: false, error: `Create failed: ${createResponse.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function checkShouldRun(schedule: ScheduledDeploymentConfig): boolean {
  if (!schedule.last_run_at) return true;

  const lastRun = new Date(schedule.last_run_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);

  const cronParts = schedule.schedule_cron.split(" ");

  if (cronParts[0] === "*") return diffMinutes >= 1;
  if (cronParts[1] === "*") return diffMinutes >= 60;
  if (cronParts[2] === "*") return diffMinutes >= 1440;
  if (cronParts[4] === "*") return diffMinutes >= 10080;

  return diffMinutes >= 1440;
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

async function triggerWebhook(
  supabase: any,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  try {
    const { data: webhooks } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    for (const webhook of webhooks as any[]) {
      try {
        await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload,
          }),
        });
      } catch (err) {
        console.error("Webhook error:", err);
      }
    }
  } catch (err) {
    console.error("Error triggering webhooks:", err);
  }
}
