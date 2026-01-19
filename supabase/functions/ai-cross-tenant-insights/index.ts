import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantsData, analysisType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an AI analyst specializing in multi-tenant Microsoft 365 analysis for MSPs. Analyze cross-tenant data to identify patterns, anomalies, benchmarks, and optimization opportunities across the entire managed portfolio.

Focus on:
- Security posture comparisons
- Configuration consistency/drift
- License utilization patterns
- Compliance status across tenants
- Cost optimization opportunities
- Risk distribution
- Best practice adoption rates`;

    const userPrompt = `Analyze the following multi-tenant data and provide cross-tenant insights:

Tenants Data:
${JSON.stringify(tenantsData, null, 2)}

Analysis Type: ${analysisType}

Provide a detailed JSON response with this structure:
{
  "summary": {
    "totalTenants": number,
    "averageSecurityScore": number,
    "averageComplianceScore": number,
    "totalUsers": number,
    "totalMonthlyCost": "string",
    "criticalIssuesCount": number,
    "overallHealthGrade": "A" | "B" | "C" | "D" | "F"
  },
  "portfolioHealth": {
    "excellent": number,
    "good": number,
    "needsAttention": number,
    "critical": number
  },
  "securityComparison": [
    {
      "tenantName": "string",
      "securityScore": number,
      "mfaAdoption": number,
      "conditionalAccessPolicies": number,
      "riskLevel": "low" | "medium" | "high" | "critical",
      "topIssues": ["string"]
    }
  ],
  "commonIssues": [
    {
      "issue": "string",
      "affectedTenants": number,
      "percentageAffected": number,
      "severity": "low" | "medium" | "high" | "critical",
      "recommendation": "string",
      "estimatedEffort": "string"
    }
  ],
  "configurationDrift": [
    {
      "configArea": "string",
      "consistencyScore": number,
      "variations": number,
      "recommendedStandard": "string",
      "tenantsNeedingUpdate": ["string"]
    }
  ],
  "licenseInsights": {
    "totalLicenses": number,
    "totalAssigned": number,
    "utilizationRate": number,
    "estimatedWaste": "string",
    "optimizationOpportunities": [
      {
        "tenant": "string",
        "issue": "string",
        "potentialSavings": "string"
      }
    ]
  },
  "riskDistribution": {
    "byCategory": [
      {
        "category": "string",
        "highRiskTenants": number,
        "mediumRiskTenants": number,
        "lowRiskTenants": number
      }
    ],
    "topRisks": [
      {
        "risk": "string",
        "affectedTenants": ["string"],
        "mitigation": "string"
      }
    ]
  },
  "trends": [
    {
      "metric": "string",
      "trend": "improving" | "stable" | "declining",
      "change": "string",
      "insight": "string"
    }
  ],
  "bestPracticeAdoption": [
    {
      "practice": "string",
      "adoptionRate": number,
      "leaders": ["string"],
      "laggards": ["string"]
    }
  ],
  "recommendations": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "recommendation": "string",
      "impact": "string",
      "affectedTenants": number,
      "estimatedEffort": "string",
      "category": "security" | "compliance" | "cost" | "performance"
    }
  ],
  "actionPlan": [
    {
      "week": number,
      "focus": "string",
      "actions": ["string"],
      "expectedOutcome": "string"
    }
  ]
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
    console.error('Error in ai-cross-tenant-insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
