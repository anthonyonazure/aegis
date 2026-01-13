import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event: string;
  user_id?: string;
  data: Record<string, unknown>;
  retry_log_id?: string; // For retry requests
}

interface WebhookConfig {
  id: string;
  user_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  failure_count: number;
}

interface WebhookLog {
  id: string;
  webhook_config_id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  original_log_id: string | null;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second

// Calculate exponential backoff delay
function getBackoffDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  return BASE_DELAY_MS * Math.pow(2, retryCount);
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: WebhookPayload = await req.json();
    const { event, user_id, data, retry_log_id } = payload;

    // Handle retry request
    if (retry_log_id) {
      console.log(`Processing retry for log: ${retry_log_id}`);
      return await handleRetry(supabase, retry_log_id);
    }

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing webhook event: ${event}`);

    // If user_id not provided, try to get from auth header
    let userId = user_id;
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active webhooks for this user and event type
    const { data: webhooks, error: webhooksError } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      throw webhooksError;
    }

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = (webhooks as WebhookConfig[] || []).filter(
      (w) => w.events.includes(event)
    );

    console.log(`Found ${matchingWebhooks.length} webhooks for event ${event}`);

    if (matchingWebhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No webhooks configured for this event", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ webhook_id: string; success: boolean; status?: number; error?: string }> = [];

    for (const webhook of matchingWebhooks) {
      const result = await sendWebhookWithRetry(supabase, webhook, event, data, userId);
      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Webhook delivery complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: "Webhooks processed",
        sent: successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing webhooks:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleRetry(
  supabase: any,
  logId: string
): Promise<Response> {
  // Fetch the original log entry
  const { data: log, error: logError } = await supabase
    .from("webhook_logs")
    .select("*, webhook_configs(*)")
    .eq("id", logId)
    .single();

  if (logError || !log) {
    console.error("Error fetching log for retry:", logError);
    return new Response(
      JSON.stringify({ error: "Log entry not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const webhook = log.webhook_configs as WebhookConfig;
  if (!webhook) {
    return new Response(
      JSON.stringify({ error: "Webhook configuration not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const currentRetryCount = log.retry_count || 0;
  const maxRetries = log.max_retries || MAX_RETRIES;

  if (currentRetryCount >= maxRetries) {
    return new Response(
      JSON.stringify({ error: "Maximum retries exceeded", retry_count: currentRetryCount }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get original log ID (for tracking retry chain)
  const originalLogId = log.original_log_id || log.id;

  // Perform the retry with exponential backoff
  const result = await sendWebhookAttempt(
    supabase,
    webhook,
    log.event_type,
    log.payload.data || log.payload,
    log.user_id,
    currentRetryCount + 1,
    originalLogId
  );

  return new Response(
    JSON.stringify({
      message: result.success ? "Retry successful" : "Retry failed",
      ...result,
    }),
    { 
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

async function sendWebhookWithRetry(
  supabase: any,
  webhook: WebhookConfig,
  event: string,
  data: Record<string, unknown>,
  userId: string
): Promise<{ webhook_id: string; success: boolean; status?: number; error?: string; retries?: number }> {
  let lastResult = await sendWebhookAttempt(supabase, webhook, event, data, userId, 0, null);
  
  // If successful on first try, return immediately
  if (lastResult.success) {
    return { ...lastResult, retries: 0 };
  }

  // Store the original log ID for retry tracking
  const originalLogId = lastResult.log_id || null;

  // Attempt retries with exponential backoff
  for (let retry = 1; retry <= MAX_RETRIES; retry++) {
    const delay = getBackoffDelay(retry - 1);
    console.log(`Retry ${retry}/${MAX_RETRIES} for webhook ${webhook.name} after ${delay}ms`);
    
    await sleep(delay);
    
    lastResult = await sendWebhookAttempt(supabase, webhook, event, data, userId, retry, originalLogId);
    
    if (lastResult.success) {
      console.log(`Webhook ${webhook.name} succeeded on retry ${retry}`);
      return { ...lastResult, retries: retry };
    }
  }

  console.log(`Webhook ${webhook.name} failed after ${MAX_RETRIES} retries`);
  return { ...lastResult, retries: MAX_RETRIES };
}

async function sendWebhookAttempt(
  supabase: any,
  webhook: WebhookConfig,
  event: string,
  data: Record<string, unknown>,
  userId: string,
  retryCount: number,
  originalLogId: string | null
): Promise<{ webhook_id: string; success: boolean; status?: number; error?: string; log_id?: string }> {
  const webhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    webhook_id: webhook.id,
    retry_count: retryCount,
    data,
  };

  try {
    console.log(`Sending webhook to ${webhook.name}: ${webhook.url} (attempt ${retryCount + 1})`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "M365-Export-Webhook/1.0",
      "X-Webhook-Event": event,
      "X-Webhook-Timestamp": webhookPayload.timestamp,
      "X-Webhook-Retry-Count": String(retryCount),
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = await generateHmacSignature(
        JSON.stringify(webhookPayload),
        webhook.secret
      );
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(webhookPayload),
    });

    const responseText = await response.text().catch(() => "");

    console.log(`Webhook ${webhook.name} response: ${response.status}`);

    // Calculate next retry time if failed
    const nextRetryAt = !response.ok && retryCount < MAX_RETRIES
      ? new Date(Date.now() + getBackoffDelay(retryCount)).toISOString()
      : null;

    // Log the delivery attempt
    const { data: logEntry } = await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: event,
      payload: webhookPayload,
      response_status: response.status,
      response_body: responseText.slice(0, 1000),
      success: response.ok,
      retry_count: retryCount,
      max_retries: MAX_RETRIES,
      next_retry_at: nextRetryAt,
      original_log_id: originalLogId,
    }).select("id").single();

    // Update webhook stats
    await supabase
      .from("webhook_configs")
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: response.ok ? 0 : webhook.failure_count + 1,
      })
      .eq("id", webhook.id);

    return {
      webhook_id: webhook.id,
      success: response.ok,
      status: response.status,
      log_id: logEntry?.id,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to send webhook to ${webhook.name}:`, errorMessage);

    // Calculate next retry time
    const nextRetryAt = retryCount < MAX_RETRIES
      ? new Date(Date.now() + getBackoffDelay(retryCount)).toISOString()
      : null;

    // Log the failed delivery
    const { data: logEntry } = await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: event,
      payload: webhookPayload,
      success: false,
      response_body: errorMessage,
      retry_count: retryCount,
      max_retries: MAX_RETRIES,
      next_retry_at: nextRetryAt,
      original_log_id: originalLogId,
    }).select("id").single();

    // Increment failure count
    await supabase
      .from("webhook_configs")
      .update({
        failure_count: webhook.failure_count + 1,
      })
      .eq("id", webhook.id);

    return {
      webhook_id: webhook.id,
      success: false,
      error: errorMessage,
      log_id: logEntry?.id,
    };
  }
}

async function generateHmacSignature(payload: string, secret: string): Promise<string> {
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
