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
    const { configData, optimizationGoals, tenantContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an AI M365 configuration optimization expert. Analyze tenant configurations and provide specific, actionable recommendations to optimize for security, performance, cost, and user experience.

Focus areas:
- Conditional Access policy optimization
- License assignment efficiency
- Security feature enablement
- Redundant or conflicting policies
- Best practices alignment
- Performance improvements
- Cost reduction opportunities`;

    const userPrompt = `Analyze the following M365 configuration and provide optimization recommendations:

Configuration Data:
${JSON.stringify(configData, null, 2)}

Optimization Goals:
${JSON.stringify(optimizationGoals, null, 2)}

Tenant Context:
${JSON.stringify(tenantContext, null, 2)}

Provide a detailed JSON response with this structure:
{
  "summary": {
    "totalOptimizations": number,
    "estimatedSecurityImprovement": "string (percentage)",
    "estimatedCostSavings": "string (monthly amount)",
    "estimatedPerformanceGain": "string (percentage)",
    "overallHealthScore": number (0-100),
    "optimizedHealthScore": number (0-100 after applying recommendations)
  },
  "quickWins": [
    {
      "title": "string",
      "description": "string",
      "impact": "low" | "medium" | "high",
      "effort": "minimal" | "low" | "medium",
      "category": "security" | "performance" | "cost" | "compliance" | "usability",
      "implementation": "string (specific steps)"
    }
  ],
  "securityOptimizations": [
    {
      "title": "string",
      "currentState": "string",
      "recommendedState": "string",
      "riskReduction": "string",
      "priority": "critical" | "high" | "medium" | "low",
      "affectedPolicies": ["string"],
      "implementation": {
        "steps": ["string"],
        "prerequisites": ["string"],
        "estimatedTime": "string",
        "rollbackPlan": "string"
      }
    }
  ],
  "performanceOptimizations": [
    {
      "title": "string",
      "currentIssue": "string",
      "recommendation": "string",
      "expectedImprovement": "string",
      "affectedServices": ["string"],
      "implementation": "string"
    }
  ],
  "costOptimizations": [
    {
      "title": "string",
      "currentCost": "string",
      "optimizedCost": "string",
      "savings": "string",
      "recommendation": "string",
      "tradeoffs": ["string"],
      "implementation": "string"
    }
  ],
  "policyConflicts": [
    {
      "policies": ["string"],
      "conflictType": "string",
      "description": "string",
      "resolution": "string",
      "priority": "high" | "medium" | "low"
    }
  ],
  "redundantConfigs": [
    {
      "items": ["string"],
      "type": "string",
      "description": "string",
      "recommendation": "string",
      "safeToRemove": boolean
    }
  ],
  "bestPracticeGaps": [
    {
      "area": "string",
      "currentState": "string",
      "bestPractice": "string",
      "gap": "string",
      "recommendation": "string",
      "reference": "string"
    }
  ],
  "implementationRoadmap": [
    {
      "phase": number,
      "name": "string",
      "duration": "string",
      "items": ["string"],
      "dependencies": ["string"],
      "risks": ["string"]
    }
  ],
  "beforeAfterComparison": {
    "security": { "before": number, "after": number },
    "performance": { "before": number, "after": number },
    "cost": { "before": number, "after": number },
    "compliance": { "before": number, "after": number },
    "usability": { "before": number, "after": number }
  }
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-config-optimizer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
