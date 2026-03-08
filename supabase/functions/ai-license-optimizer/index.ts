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
    const { licenseData, userCount, goals } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a Microsoft 365 licensing optimization expert. Analyze license allocations and provide actionable cost-saving recommendations.

Your task is to analyze the provided license data and identify optimization opportunities.

ALWAYS respond with valid JSON in this exact format:
{
  "summary": {
    "totalMonthlySpend": number,
    "potentialSavings": number,
    "savingsPercentage": number,
    "optimizationScore": number (0-100),
    "urgency": "high" | "medium" | "low"
  },
  "currentState": {
    "totalLicenses": number,
    "assignedLicenses": number,
    "unassignedLicenses": number,
    "utilizationRate": number,
    "licensesByType": [
      {
        "name": "string",
        "total": number,
        "assigned": number,
        "monthlyPerUserCost": number,
        "totalMonthlyCost": number
      }
    ]
  },
  "recommendations": [
    {
      "id": "string",
      "priority": "critical" | "high" | "medium" | "low",
      "category": "downgrade" | "consolidate" | "remove" | "reassign" | "switch",
      "title": "string",
      "description": "string",
      "currentState": "string",
      "proposedAction": "string",
      "estimatedSavings": number,
      "affectedUsers": number,
      "implementationSteps": ["string"],
      "risks": ["string"],
      "timeToImplement": "string"
    }
  ],
  "quickWins": [
    {
      "action": "string",
      "savings": number,
      "effort": "low" | "medium" | "high"
    }
  ],
  "longTermStrategy": {
    "recommendations": ["string"],
    "projectedAnnualSavings": number,
    "timeline": "string"
  },
  "benchmarks": {
    "industryAvgUtilization": number,
    "yourUtilization": number,
    "industryAvgCostPerUser": number,
    "yourCostPerUser": number
  }
}

Consider these optimization strategies:
1. Remove unused/unassigned licenses
2. Downgrade over-licensed users (E5 → E3, E3 → E1, etc.)
3. Consolidate duplicate capabilities
4. Switch to annual billing for discounts
5. Identify users who don't need premium features
6. Recommend Microsoft 365 Business vs Enterprise where appropriate`;

    const userPrompt = `Analyze this Microsoft 365 license data and provide optimization recommendations:

License Data:
${JSON.stringify(licenseData || {
  licenses: [
    { name: 'Microsoft 365 E5', total: 150, assigned: 120, pricePerUser: 57 },
    { name: 'Microsoft 365 E3', total: 300, assigned: 250, pricePerUser: 36 },
    { name: 'Microsoft 365 E1', total: 100, assigned: 45, pricePerUser: 10 },
    { name: 'Power BI Pro', total: 80, assigned: 35, pricePerUser: 10 },
    { name: 'Project Plan 3', total: 50, assigned: 20, pricePerUser: 30 },
    { name: 'Visio Plan 2', total: 40, assigned: 15, pricePerUser: 15 }
  ]
}, null, 2)}

Total Users in Organization: ${userCount || 500}

${goals ? `Optimization Goals: ${goals}` : 'Focus on maximum cost savings while maintaining productivity.'}

Provide detailed, actionable recommendations to optimize license costs.`;

    console.log('Analyzing license data for optimization...');

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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response received, parsing...');

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      result = {
        summary: {
          totalMonthlySpend: 0,
          potentialSavings: 0,
          savingsPercentage: 0,
          optimizationScore: 50,
          urgency: 'medium'
        },
        recommendations: [],
        quickWins: [],
        error: 'Failed to parse optimization results',
        rawResponse: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('License optimization error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze licenses' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
