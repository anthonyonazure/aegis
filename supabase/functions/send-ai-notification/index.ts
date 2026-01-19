import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  channel_type: 'slack' | 'teams' | 'email';
  config: {
    webhook_url?: string;
    email?: string;
  };
  subject: string;
  message: string;
  score?: number;
  recommendations?: string[];
}

async function sendSlackNotification(webhookUrl: string, subject: string, message: string, score?: number, recommendations?: string[]) {
  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 ${subject}`, emoji: true }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: message }
    }
  ];

  if (score !== undefined) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Score:* ${score}%` }
      ]
    });
  }

  if (recommendations && recommendations.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Top Recommendations:*\n" + recommendations.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join("\n") }
    });
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }
}

async function sendTeamsNotification(webhookUrl: string, subject: string, message: string, score?: number, recommendations?: string[]) {
  const facts: any[] = [];
  if (score !== undefined) {
    facts.push({ name: "Score", value: `${score}%` });
  }

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0076D7",
    summary: subject,
    sections: [
      {
        activityTitle: `📊 ${subject}`,
        facts,
        text: message,
        markdown: true
      }
    ]
  };

  if (recommendations && recommendations.length > 0) {
    card.sections.push({
      activityTitle: "Top Recommendations",
      facts: recommendations.slice(0, 3).map((r, i) => ({ name: `${i + 1}`, value: r })),
      text: "",
      markdown: true
    });
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook failed: ${response.status}`);
  }
}

async function sendEmailNotification(email: string, subject: string, message: string, score?: number, recommendations?: string[]) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured - email notifications unavailable');
  }

  let html = `<h2>${subject}</h2><p>${message}</p>`;
  if (score !== undefined) {
    html += `<p><strong>Score:</strong> ${score}%</p>`;
  }
  if (recommendations && recommendations.length > 0) {
    html += `<h3>Top Recommendations:</h3><ol>`;
    recommendations.slice(0, 5).forEach(r => {
      html += `<li>${r}</li>`;
    });
    html += `</ol>`;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'M365 Export <notifications@resend.dev>',
      to: [email],
      subject: `[M365 Export] ${subject}`,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email send failed: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { channel_type, config, subject, message, score, recommendations } = payload;

    console.log(`Sending ${channel_type} notification: ${subject}`);

    switch (channel_type) {
      case 'slack':
        if (!config.webhook_url) throw new Error('Slack webhook URL required');
        await sendSlackNotification(config.webhook_url, subject, message, score, recommendations);
        break;
      
      case 'teams':
        if (!config.webhook_url) throw new Error('Teams webhook URL required');
        await sendTeamsNotification(config.webhook_url, subject, message, score, recommendations);
        break;
      
      case 'email':
        if (!config.email) throw new Error('Email address required');
        await sendEmailNotification(config.email, subject, message, score, recommendations);
        break;
      
      default:
        throw new Error(`Unknown channel type: ${channel_type}`);
    }

    console.log(`Successfully sent ${channel_type} notification`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
