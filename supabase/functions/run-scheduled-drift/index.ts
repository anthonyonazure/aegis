import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  details?: Record<string, unknown>;
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
        let baselineData: Record<string, unknown> | null = null;
        if (schedule.baseline_export_id) {
          const { data: baselineResources } = await supabase
            .from("exported_resources")
            .select("*")
            .eq("export_job_id", schedule.baseline_export_id);
          
          if (baselineResources && baselineResources.length > 0) {
            baselineData = {
              resources: baselineResources,
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
            // For now, simulate drift detection
            // In a real implementation, this would:
            // 1. Get credentials from service_principal_config
            // 2. Fetch current state from Graph API
            // 3. Compare with baseline
            
            const driftResult = await simulateDriftCheck(
              tenant,
              schedule.resource_ids,
              baselineData
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

async function simulateDriftCheck(
  tenant: TenantConnection,
  resourceIds: string[],
  baselineData: Record<string, unknown> | null
): Promise<DriftResult> {
  // Simulate drift detection
  // In production, this would:
  // 1. Authenticate using service principal
  // 2. Fetch current resources via Graph API
  // 3. Compare with baseline
  
  // For now, return simulated results
  const hasDrift = Math.random() > 0.7; // 30% chance of drift
  const added = hasDrift ? Math.floor(Math.random() * 3) : 0;
  const removed = hasDrift ? Math.floor(Math.random() * 2) : 0;
  const modified = hasDrift ? Math.floor(Math.random() * 5) : 0;

  return {
    tenantId: tenant.tenant_id,
    tenantName: tenant.display_name || tenant.tenant_name || tenant.tenant_id,
    connectionId: tenant.id,
    status: "success",
    hasDrift: added > 0 || removed > 0 || modified > 0,
    added,
    removed,
    modified,
    details: {
      resourcesChecked: resourceIds.length,
      hasBaseline: !!baselineData,
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
