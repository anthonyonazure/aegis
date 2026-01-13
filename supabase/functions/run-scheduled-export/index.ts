import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledExport {
  id: string;
  user_id: string;
  tenant_connection_id: string | null;
  name: string;
  resource_ids: string[];
  formats: string[];
  schedule_cron: string;
  is_active: boolean;
  run_count: number;
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

  console.log("Scheduled export runner started");

  try {
    // Get all active scheduled exports that should run now
    const now = new Date();
    
    const { data: schedules, error: schedulesError } = await supabase
      .from("scheduled_exports")
      .select("*")
      .eq("is_active", true);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} active schedules`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active schedules found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedSchedules: string[] = [];

    for (const schedule of schedules as ScheduledExport[]) {
      // Check if this schedule should run based on its cron expression
      // For simplicity, we'll check if it hasn't run in the appropriate interval
      const shouldRun = await checkShouldRun(supabase, schedule);
      
      if (!shouldRun) {
        console.log(`Schedule ${schedule.name} not due to run yet`);
        continue;
      }

      console.log(`Processing schedule: ${schedule.name}`);

      try {
        // Create an export job for this schedule
        const { data: exportJob, error: jobError } = await supabase
          .from("export_jobs")
          .insert({
            user_id: schedule.user_id,
            tenant_connection_id: schedule.tenant_connection_id,
            name: `Scheduled: ${schedule.name} - ${now.toISOString().split("T")[0]}`,
            status: "pending",
            categories: schedule.resource_ids,
            formats: schedule.formats,
            metadata: {
              scheduled_export_id: schedule.id,
              triggered_by: "cron",
              scheduled_at: now.toISOString(),
            },
          })
          .select()
          .single();

        if (jobError) {
          console.error(`Error creating export job for ${schedule.name}:`, jobError);
          continue;
        }

        console.log(`Created export job ${exportJob.id} for schedule ${schedule.name}`);

        // Update the schedule's last run time and increment run count
        const { error: updateError } = await supabase
          .from("scheduled_exports")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: calculateNextRun(schedule.schedule_cron),
            run_count: schedule.run_count + 1,
          })
          .eq("id", schedule.id);

        if (updateError) {
          console.error(`Error updating schedule ${schedule.name}:`, updateError);
        }

        // Log audit event
        await supabase.from("audit_logs").insert({
          user_id: schedule.user_id,
          action: "scheduled_export_triggered",
          resource_type: "scheduled_export",
          resource_id: schedule.id,
          details: {
            export_job_id: exportJob.id,
            schedule_name: schedule.name,
            cron: schedule.schedule_cron,
          },
        });

        // Trigger webhook notification if configured
        await triggerWebhooks(supabase, schedule.user_id, "schedule.run", {
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          export_job_id: exportJob.id,
        });

        processedSchedules.push(schedule.id);
      } catch (err) {
        console.error(`Error processing schedule ${schedule.name}:`, err);
      }
    }

    console.log(`Processed ${processedSchedules.length} schedules`);

    return new Response(
      JSON.stringify({
        message: "Scheduled exports processed",
        processed: processedSchedules.length,
        schedule_ids: processedSchedules,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in scheduled export runner:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkShouldRun(supabase: any, schedule: ScheduledExport): Promise<boolean> {
  // If never run before, should run
  const { data } = await supabase
    .from("scheduled_exports")
    .select("last_run_at")
    .eq("id", schedule.id)
    .single();

  if (!data?.last_run_at) {
    return true;
  }

  const lastRun = new Date(data.last_run_at);
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
  
  // Simple next run calculation based on cron pattern
  if (cronParts[0] === "*") {
    // Every minute
    now.setMinutes(now.getMinutes() + 1);
  } else if (cronParts[1] === "*") {
    // Hourly
    now.setHours(now.getHours() + 1);
    now.setMinutes(parseInt(cronParts[0]) || 0);
  } else if (cronParts[2] === "*") {
    // Daily
    now.setDate(now.getDate() + 1);
    now.setHours(parseInt(cronParts[1]) || 0);
    now.setMinutes(parseInt(cronParts[0]) || 0);
  } else if (cronParts[4] !== "*") {
    // Weekly
    now.setDate(now.getDate() + 7);
  } else {
    // Monthly
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
      return;
    }

    for (const webhook of webhooks) {
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
  } catch (err) {
    console.error("Error triggering webhooks:", err);
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