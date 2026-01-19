import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COST_PREDICTOR_PROMPT = `You are an expert Microsoft 365 licensing and cost optimization analyst. Analyze the provided tenant data and provide comprehensive cost predictions, savings opportunities, and budget forecasting.

Return a JSON object with this exact structure:
{
  "summary": {
    "currentMonthlyCost": number,
    "projectedMonthlyCost": number,
    "annualCost": number,
    "projectedAnnualCost": number,
    "potentialMonthlySavings": number,
    "potentialAnnualSavings": number,
    "savingsPercentage": number,
    "costTrend": "increasing" | "stable" | "decreasing",
    "riskLevel": "low" | "medium" | "high"
  },
  "licenseAnalysis": {
    "totalLicenses": number,
    "assignedLicenses": number,
    "unusedLicenses": number,
    "utilizationRate": number,
    "licenses": [
      {
        "name": string,
        "sku": string,
        "total": number,
        "assigned": number,
        "unused": number,
        "monthlyPerUserCost": number,
        "totalMonthlyCost": number,
        "unusedMonthlyCost": number,
        "recommendation": string
      }
    ]
  },
  "savingsOpportunities": [
    {
      "id": string,
      "category": "unused_licenses" | "license_optimization" | "feature_consolidation" | "tier_adjustment" | "term_optimization",
      "title": string,
      "description": string,
      "currentCost": number,
      "optimizedCost": number,
      "monthlySavings": number,
      "annualSavings": number,
      "effort": "low" | "medium" | "high",
      "risk": "low" | "medium" | "high",
      "implementationSteps": string[],
      "timeToImplement": string,
      "affectedUsers": number
    }
  ],
  "costForecast": {
    "monthlyProjections": [
      {
        "month": string,
        "baselineCost": number,
        "optimizedCost": number,
        "growthAdjustedCost": number
      }
    ],
    "scenarios": {
      "conservative": {
        "annualCost": number,
        "growthRate": number,
        "assumptions": string[]
      },
      "moderate": {
        "annualCost": number,
        "growthRate": number,
        "assumptions": string[]
      },
      "aggressive": {
        "annualCost": number,
        "growthRate": number,
        "assumptions": string[]
      }
    }
  },
  "copilotROI": {
    "currentCopilotSpend": number,
    "licensedUsers": number,
    "activeUsers": number,
    "adoptionRate": number,
    "estimatedProductivityGain": number,
    "estimatedValueGenerated": number,
    "roi": number,
    "recommendations": string[],
    "optimizationPotential": string
  },
  "budgetRecommendations": [
    {
      "category": string,
      "currentBudget": number,
      "recommendedBudget": number,
      "variance": number,
      "rationale": string,
      "priority": "high" | "medium" | "low"
    }
  ],
  "vendorComparison": {
    "currentVendorCost": number,
    "alternatives": [
      {
        "vendor": string,
        "estimatedCost": number,
        "savings": number,
        "tradeoffs": string[],
        "migrationComplexity": "low" | "medium" | "high"
      }
    ]
  },
  "actionPlan": {
    "immediate": [
      {
        "action": string,
        "savings": number,
        "deadline": string
      }
    ],
    "shortTerm": [
      {
        "action": string,
        "savings": number,
        "deadline": string
      }
    ],
    "longTerm": [
      {
        "action": string,
        "savings": number,
        "deadline": string
      }
    ]
  }
}

Provide realistic cost estimates based on current Microsoft 365 pricing. Consider:
- License tier optimization (E5 to E3 where features aren't used)
- Unused license reclamation
- Annual vs monthly billing savings
- Bundle opportunities
- Copilot adoption and ROI
- Growth projections based on historical data`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantData, historicalCosts, growthRate } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextData = {
      tenant: tenantData || {},
      historicalCosts: historicalCosts || [],
      projectedGrowthRate: growthRate || 5,
      analysisDate: new Date().toISOString(),
    };

    console.log('Analyzing costs for tenant:', tenantData?.tenantId || 'unknown');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: COST_PREDICTOR_PROMPT },
          { role: 'user', content: `Analyze the following tenant data for cost optimization and predictions:\n\n${JSON.stringify(contextData, null, 2)}` }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    let analysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysisResult = { error: 'Failed to parse analysis', raw: content };
    }

    console.log('Cost prediction completed successfully');

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cost predictor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
