import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Provider configurations
const PROVIDERS: Record<string, { endpoint: string; defaultModel: string }> = {
  lovable: {
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    defaultModel: 'google/gemini-3-flash-preview',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
  },
  google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.0-flash',
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  azure: {
    endpoint: '', // User must provide full endpoint
    defaultModel: 'gpt-4o',
  },
  perplexity: {
    endpoint: 'https://api.perplexity.ai/chat/completions',
    defaultModel: 'sonar',
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-large-latest',
  },
};

// System prompts for different features
const SYSTEM_PROMPTS: Record<string, string> = {
  'tenant-analyzer': `You are an expert Microsoft 365 tenant analyzer for MSPs. Analyze tenant configurations and provide:
- Security posture assessment
- Compliance gaps
- Optimization recommendations
- Best practice comparisons
Be specific, actionable, and prioritize by impact. Format responses with clear sections and bullet points.`,
  
  'compliance-advisor': `You are a compliance and governance advisor for Microsoft 365 environments. Help with:
- Policy recommendations based on industry standards (NIST, CIS, ISO 27001)
- Gap analysis against compliance frameworks
- Remediation steps with priority levels
- Risk assessment for non-compliance
Provide practical, implementable advice.`,
  
  'drift-explainer': `You are a configuration drift analyst. When given configuration changes:
- Explain what changed and potential impact
- Identify security implications
- Recommend whether to accept, remediate, or investigate
- Provide context on why the change might have occurred
Be concise but thorough.`,
  
  'cost-forecaster': `You are a Microsoft 365 licensing cost analyst. Help with:
- License optimization recommendations
- Cost projections based on usage trends
- ROI analysis for Copilot and premium features
- Consolidation opportunities
Use data-driven insights.`,
  
  'general-chat': `You are an AI assistant for MSPs managing Microsoft 365 tenants. Help with:
- Technical questions about M365 configuration
- Best practices for multi-tenant management
- Troubleshooting guidance
- Feature explanations
Be helpful, accurate, and practical.`,
  
  'risk-scorer': `You are a security risk assessment specialist. Analyze tenant data and:
- Calculate risk scores (0-100) for different categories
- Identify critical vulnerabilities
- Prioritize remediation actions
- Provide benchmark comparisons
Return structured risk assessments.`,
};

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  featureType?: string;
  provider?: string;
  model?: string;
  stream?: boolean;
  tenantContext?: Record<string, unknown>;
  conversationId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const body: ChatRequest = await req.json();
    const { 
      messages, 
      featureType = 'general-chat', 
      provider: requestedProvider,
      model: requestedModel,
      stream = true,
      tenantContext,
      conversationId
    } = body;

    // Determine which provider and API key to use
    let provider = requestedProvider || 'lovable';
    let apiKey: string | undefined = undefined;
    let endpoint: string;
    let model: string;

    if (provider === 'lovable') {
      // Use Lovable AI (default)
      apiKey = Deno.env.get('LOVABLE_API_KEY');
      endpoint = PROVIDERS.lovable.endpoint;
      model = requestedModel || PROVIDERS.lovable.defaultModel;
    } else {
      // Check for user's custom API key
      const { data: keyData } = await supabase.rpc('get_ai_api_key', { p_provider: provider });
      
      if (keyData) {
        apiKey = keyData as string;
      } else {
        // Fallback to environment variable
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        apiKey = Deno.env.get(envKey);
      }

      if (!apiKey) {
        // Fall back to Lovable AI
        console.log(`No API key for ${provider}, falling back to Lovable AI`);
        provider = 'lovable';
        apiKey = Deno.env.get('LOVABLE_API_KEY');
        endpoint = PROVIDERS.lovable.endpoint;
        model = PROVIDERS.lovable.defaultModel;
      } else {
        const providerConfig = PROVIDERS[provider];
        if (!providerConfig) {
          return new Response(
            JSON.stringify({ error: `Unknown provider: ${provider}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = providerConfig.endpoint;
        model = requestedModel || providerConfig.defaultModel;
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build messages with system prompt
    const systemPrompt = SYSTEM_PROMPTS[featureType] || SYSTEM_PROMPTS['general-chat'];
    let fullSystemPrompt = systemPrompt;
    
    // Add tenant context if provided
    if (tenantContext) {
      fullSystemPrompt += `\n\nCurrent tenant context:\n${JSON.stringify(tenantContext, null, 2)}`;
    }

    const fullMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...messages
    ];

    // Save user message to database if conversationId provided
    if (conversationId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: lastMessage.content,
        });
      }
    }

    // Retry helper for transient failures
    async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
      for (let i = 0; i <= retries; i++) {
        const res = await fetch(url, init);
        if (res.ok || ![429, 500, 502, 503, 504].includes(res.status) || i === retries) {
          return res;
        }
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        console.warn(`AI API retry ${i + 1}/${retries} after ${Math.round(delay)}ms (status ${res.status})`);
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Retry exhausted');
    }

    // Make API request based on provider
    let response: Response;

    if (provider === 'anthropic') {
      response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: fullSystemPrompt,
          messages: messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          stream,
        }),
      });
    } else {
      response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream,
          max_tokens: 4096,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider} API error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits or check your API key.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `AI provider error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      // Return streaming response
      return new Response(response.body, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      // Non-streaming response
      const data = await response.json();
      
      // Save assistant response to database
      if (conversationId) {
        let assistantContent = '';
        if (provider === 'anthropic') {
          assistantContent = data.content?.[0]?.text || '';
        } else {
          assistantContent = data.choices?.[0]?.message?.content || '';
        }
        
        if (assistantContent) {
          await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantContent,
            metadata: { provider, model },
          });
        }
      }
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
