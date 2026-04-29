import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (in-memory per instance)
const _rl = new Map<string, { count: number; resetAt: number }>();
function _checkRate(key: string, max = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const e = _rl.get(key);
  if (!e || now > e.resetAt) { _rl.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const _rlKey = req.headers.get('authorization')?.slice(-20) || 'anon';
  if (!_checkRate(_rlKey)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  try {
    const { messages, tenantContext } = await req.json();
    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    
    if (!AI_GATEWAY_KEY) {
      throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');
    }

    let systemPrompt = `You are an expert Microsoft 365 management assistant for MSPs and IT administrators. You provide helpful, accurate, and actionable guidance on:

1. **Security Configuration**
   - Conditional Access policies
   - MFA enforcement strategies
   - Identity protection
   - Defender for Office 365
   - Security defaults and baselines

2. **Compliance & Governance**
   - Compliance frameworks (HIPAA, SOC2, GDPR, etc.)
   - Data Loss Prevention (DLP)
   - Information protection and sensitivity labels
   - Retention policies
   - eDiscovery

3. **Tenant Management**
   - User and group management
   - License optimization
   - Guest access policies
   - Administrative roles
   - Multi-tenant strategies for MSPs

4. **Best Practices**
   - Zero Trust architecture
   - Secure Score improvements
   - Audit logging and monitoring
   - Incident response
   - Backup and disaster recovery

Guidelines for responses:
- Be concise but thorough
- Provide specific, actionable recommendations
- Include relevant PowerShell commands or Graph API calls when helpful
- Reference Microsoft documentation when appropriate
- Consider MSP multi-tenant scenarios
- Highlight security implications
- Suggest automation opportunities

Format responses with clear structure using markdown when helpful.`;

    // Inject live tenant context if available
    if (tenantContext) {
      systemPrompt += `

---

## LIVE TENANT DATA (Real-time from connected Microsoft 365 tenant)

The following is real, live data from the user's connected tenant. Use this to provide specific, contextual advice rather than generic recommendations. Reference specific alerts, users, and sign-ins by name when relevant.

${tenantContext}

IMPORTANT: When the user asks about their security posture, risky users, alerts, or any tenant-specific question, always reference this live data. Do NOT make up or assume data — only use what is provided above. If data is missing or insufficient, let the user know what additional permissions or data would help.`;
    }

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_GATEWAY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in ai-chat-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
