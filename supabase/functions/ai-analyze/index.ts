import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  analysisType: 'tenant-health' | 'compliance' | 'risk-score' | 'cost-forecast' | 'adoption-benchmark';
  tenantConnectionId?: string;
  customerId?: string;
  data?: Record<string, unknown>;
  provider?: string;
  model?: string;
}

const ANALYSIS_PROMPTS: Record<string, string> = {
  'tenant-health': `Analyze the following Microsoft 365 tenant data and provide a comprehensive health assessment.
Return a JSON object with:
{
  "overallScore": number (0-100),
  "categories": {
    "security": { "score": number, "issues": string[], "recommendations": string[] },
    "compliance": { "score": number, "issues": string[], "recommendations": string[] },
    "performance": { "score": number, "issues": string[], "recommendations": string[] },
    "licensing": { "score": number, "issues": string[], "recommendations": string[] }
  },
  "criticalIssues": string[],
  "quickWins": string[],
  "summary": string
}`,

  'compliance': `Analyze the tenant configuration against common compliance frameworks (CIS, NIST, ISO 27001).
Return a JSON object with:
{
  "overallCompliance": number (0-100),
  "frameworks": {
    "CIS": { "score": number, "gaps": string[], "passed": number, "failed": number },
    "NIST": { "score": number, "gaps": string[], "passed": number, "failed": number }
  },
  "criticalGaps": string[],
  "remediationPriority": [{ "issue": string, "framework": string, "severity": "high" | "medium" | "low", "steps": string[] }],
  "summary": string
}`,

  'risk-score': `Analyze the tenant security configuration and calculate risk scores.
Return a JSON object with:
{
  "overallRisk": number (0-100, higher = more risk),
  "riskLevel": "critical" | "high" | "medium" | "low",
  "categoryScores": {
    "identity": number,
    "dataProtection": number,
    "deviceManagement": number,
    "threatProtection": number,
    "governance": number
  },
  "riskFactors": [{ "factor": string, "severity": string, "impact": string, "likelihood": string }],
  "mitigations": [{ "action": string, "priority": number, "effort": "low" | "medium" | "high", "impact": string }],
  "summary": string
}`,

  'cost-forecast': `Analyze the licensing and usage data to provide cost insights and forecasts.
Return a JSON object with:
{
  "currentMonthlyCost": number,
  "projectedMonthlyCost": number,
  "potentialSavings": number,
  "licenseUtilization": {
    "overall": number,
    "byProduct": { [product: string]: { assigned: number, used: number, utilization: number } }
  },
  "recommendations": [{ "action": string, "savings": number, "effort": string }],
  "copilotROI": { "adoption": number, "estimatedValue": number, "recommendation": string },
  "summary": string
}`,

  'adoption-benchmark': `Compare the tenant's feature adoption against industry benchmarks.
Return a JSON object with:
{
  "overallAdoption": number (0-100),
  "percentile": number,
  "categories": {
    "copilot": { "adoption": number, "benchmark": number, "gap": number },
    "security": { "adoption": number, "benchmark": number, "gap": number },
    "collaboration": { "adoption": number, "benchmark": number, "gap": number },
    "compliance": { "adoption": number, "benchmark": number, "gap": number }
  },
  "topOpportunities": string[],
  "competitiveAdvantages": string[],
  "summary": string
}`,
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const body: AnalyzeRequest = await req.json();
    const { analysisType, tenantConnectionId, customerId, data, provider = 'gateway', model } = body;

    if (!ANALYSIS_PROMPTS[analysisType]) {
      return new Response(
        JSON.stringify({ error: 'Invalid analysis type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gather tenant data if tenantConnectionId provided
    let tenantData = data || {};
    
    if (tenantConnectionId) {
      // Fetch relevant data from database
      const [
        { data: tenantInfo },
        { data: complianceData },
        { data: driftData },
        { data: exportedResources }
      ] = await Promise.all([
        supabase.from('tenant_connections').select('*').eq('id', tenantConnectionId).single(),
        supabase.from('compliance_results').select('*').eq('tenant_connection_id', tenantConnectionId).order('created_at', { ascending: false }).limit(10),
        supabase.from('drift_detections').select('*').eq('tenant_connection_id', tenantConnectionId).order('created_at', { ascending: false }).limit(10),
        supabase.from('exported_resources').select('*').eq('tenant_connection_id', tenantConnectionId).order('created_at', { ascending: false }).limit(50)
      ]);

      tenantData = {
        ...tenantData,
        tenantInfo,
        recentCompliance: complianceData,
        recentDrift: driftData,
        resources: exportedResources?.map(r => ({ type: r.resource_type, name: r.resource_name })),
      };
    }

    // Get API key
    let apiKey = Deno.env.get('AI_GATEWAY_API_KEY');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL') ?? '';
    let endpoint = `${AI_GATEWAY_URL}/chat/completions`;
    let selectedModel = model || 'google/gemini-3-flash-preview';

    if (provider !== 'gateway') {
      const { data: keyData } = await supabase.rpc('get_ai_api_key', { p_provider: provider });
      if (keyData) {
        apiKey = keyData;
        // Set endpoint based on provider
        const endpoints: Record<string, string> = {
          openai: 'https://api.openai.com/v1/chat/completions',
          google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          anthropic: 'https://api.anthropic.com/v1/messages',
        };
        endpoint = endpoints[provider] || endpoint;
        selectedModel = model || 'gpt-4o';
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the analysis prompt
    const systemPrompt = `You are an expert Microsoft 365 analyst. Analyze the provided data and return ONLY valid JSON matching the specified schema. Do not include any markdown formatting or explanation outside the JSON.`;
    
    const userPrompt = `${ANALYSIS_PROMPTS[analysisType]}

Tenant Data to Analyze:
${JSON.stringify(tenantData, null, 2)}`;

    // Call AI
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let analysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysisResult = { raw: content, error: 'Failed to parse structured response' };
    }

    // Store the analysis result
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        user_id: userId,
        tenant_connection_id: tenantConnectionId,
        customer_id: customerId,
        analysis_type: analysisType,
        result: analysisResult,
        score: analysisResult.overallScore || analysisResult.overallRisk || analysisResult.overallCompliance || analysisResult.overallAdoption,
        recommendations: analysisResult.recommendations || analysisResult.quickWins || analysisResult.mitigations || [],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour cache
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save analysis:', saveError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisId: savedAnalysis?.id,
        result: analysisResult,
        provider,
        model: selectedModel,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
