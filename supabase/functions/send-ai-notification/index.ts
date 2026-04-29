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
  /** Optional — when supplied, the email is white-label branded with the customer's brand_name, logo, and support contact. */
  customer_id?: string;
}

interface CustomerBrand {
  brand_name: string | null;
  logo_url: string | null;
  support_email: string | null;
  support_url: string | null;
  primary_color: string | null;
}

async function loadCustomerBrand(customerId: string): Promise<CustomerBrand | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return null;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('customers')
      .select('brand_name, logo_url, support_email, support_url, primary_color')
      .eq('id', customerId)
      .maybeSingle();
    return (data as CustomerBrand) ?? null;
  } catch (e) {
    console.error('loadCustomerBrand failed:', e);
    return null;
  }
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

async function sendEmailNotification(
  email: string,
  subject: string,
  message: string,
  score?: number,
  recommendations?: string[],
  brand?: CustomerBrand | null
) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured - email notifications unavailable');
  }

  const brandName = brand?.brand_name?.trim() || 'Aegis';
  const logoUrl = brand?.logo_url?.trim() || null;
  const primary = brand?.primary_color?.trim() || '210 100% 55%';
  const supportEmail = brand?.support_email?.trim() || null;
  const supportUrl = brand?.support_url?.trim() || null;

  const headerHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:48px;max-width:200px;display:block;margin:0 0 16px 0" />`
    : `<div style="font-weight:700;font-size:18px;color:hsl(${primary});margin-bottom:16px">${brandName}</div>`;

  const supportFooter = supportEmail || supportUrl
    ? `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
       <p style="font-size:12px;color:#6b7280">
         ${supportEmail ? `Need help? <a href="mailto:${supportEmail}">${supportEmail}</a>` : ''}
         ${supportEmail && supportUrl ? ' · ' : ''}
         ${supportUrl ? `<a href="${supportUrl}">Support center</a>` : ''}
       </p>`
    : '';

  let html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:600px">
    ${headerHtml}
    <h2 style="font-size:18px;margin:0 0 12px">${subject}</h2>
    <p style="margin:0 0 12px">${message}</p>`;
  if (score !== undefined) {
    html += `<p><strong>Score:</strong> ${score}%</p>`;
  }
  if (recommendations && recommendations.length > 0) {
    html += `<h3 style="font-size:14px;margin:16px 0 8px">Top recommendations</h3><ol style="margin:0;padding-left:20px">`;
    recommendations.slice(0, 5).forEach((r) => {
      html += `<li style="margin:4px 0">${r}</li>`;
    });
    html += `</ol>`;
  }
  html += supportFooter;
  html += `</div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${brandName} <notifications@resend.dev>`,
      to: [email],
      subject: `[${brandName}] ${subject}`,
      ...(supportEmail ? { reply_to: supportEmail } : {}),
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
    const { channel_type, config, subject, message, score, recommendations, customer_id } = payload;

    console.log(`Sending ${channel_type} notification: ${subject}${customer_id ? ` (customer ${customer_id})` : ''}`);

    // Load customer branding for white-label emails. Slack/Teams use their own
    // branding model so we only apply for email today.
    const brand = customer_id ? await loadCustomerBrand(customer_id) : null;

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
        await sendEmailNotification(config.email, subject, message, score, recommendations, brand);
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
