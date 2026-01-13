import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event: string;
  user_id?: string;
  data: Record<string, unknown>;
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
    const { event, user_id, data } = payload;

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
      const result = await sendWebhook(supabase, webhook, event, data, userId);
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

async function sendWebhook(
  supabase: any,
  webhook: WebhookConfig,
  event: string,
  data: Record<string, unknown>,
  userId: string
): Promise<{ webhook_id: string; success: boolean; status?: number; error?: string }> {
  const webhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    webhook_id: webhook.id,
    data,
  };

  try {
    console.log(`Sending webhook to ${webhook.name}: ${webhook.url}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "M365-Export-Webhook/1.0",
      "X-Webhook-Event": event,
      "X-Webhook-Timestamp": webhookPayload.timestamp,
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

    // Log the delivery attempt
    await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: event,
      payload: webhookPayload,
      response_status: response.status,
      response_body: responseText.slice(0, 1000), // Limit response body size
      success: response.ok,
    });

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
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to send webhook to ${webhook.name}:`, errorMessage);

    // Log the failed delivery
    await supabase.from("webhook_logs").insert({
      webhook_config_id: webhook.id,
      user_id: userId,
      event_type: event,
      payload: webhookPayload,
      success: false,
      response_body: errorMessage,
    });

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