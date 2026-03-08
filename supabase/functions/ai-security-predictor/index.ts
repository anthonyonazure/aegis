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
    const { securityData, historicalTrends } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a cybersecurity AI analyst specializing in Microsoft 365 security. Analyze security data and predict future risks based on current trends and patterns.

Your task is to analyze the provided security data and make predictions about future security posture.

ALWAYS respond with valid JSON in this exact format:
{
  "currentPosture": {
    "overallScore": number (0-100),
    "riskLevel": "critical" | "high" | "medium" | "low",
    "trend": "improving" | "stable" | "declining",
    "confidenceLevel": number (0-100)
  },
  "predictions": [
    {
      "id": "string",
      "timeframe": "7-day" | "30-day" | "90-day",
      "category": "identity" | "data" | "device" | "infrastructure" | "application",
      "prediction": "What is predicted to happen",
      "probability": number (0-100),
      "potentialImpact": "critical" | "high" | "medium" | "low",
      "indicators": ["Current indicators supporting this prediction"],
      "preventiveActions": ["Actions to prevent or mitigate"],
      "monitoringPoints": ["What to monitor for early warning"]
    }
  ],
  "riskTrajectory": {
    "next7Days": { "predictedScore": number, "confidence": number, "mainFactors": ["string"] },
    "next30Days": { "predictedScore": number, "confidence": number, "mainFactors": ["string"] },
    "next90Days": { "predictedScore": number, "confidence": number, "mainFactors": ["string"] }
  },
  "emergingThreats": [
    {
      "threat": "Description of emerging threat",
      "relevance": "high" | "medium" | "low",
      "timeToImpact": "string",
      "preparationSteps": ["string"]
    }
  ],
  "vulnerabilityForecast": [
    {
      "area": "string",
      "currentExposure": "critical" | "high" | "medium" | "low" | "none",
      "predictedExposure": "critical" | "high" | "medium" | "low" | "none",
      "trendDirection": "increasing" | "stable" | "decreasing",
      "recommendation": "string"
    }
  ],
  "attackSurfaceAnalysis": {
    "currentSurface": "large" | "medium" | "small",
    "projectedChange": "expanding" | "stable" | "shrinking",
    "hotspots": ["Areas of concern"],
    "recommendations": ["How to reduce attack surface"]
  },
  "complianceRiskForecast": {
    "currentCompliance": number,
    "projectedCompliance": number,
    "atRiskFrameworks": ["string"],
    "upcomingDeadlines": [{"framework": "string", "deadline": "string", "risk": "string"}]
  },
  "prioritizedActions": [
    {
      "priority": 1,
      "action": "string",
      "impact": "How this reduces risk",
      "effort": "low" | "medium" | "high",
      "deadline": "string"
    }
  ]
}

Base predictions on:
- Historical security score trends
- Current vulnerability patterns
- Industry threat intelligence
- Configuration drift patterns
- User behavior anomalies`;

    const userPrompt = `Analyze this security data and predict future security posture:

Current Security Data:
${JSON.stringify(securityData || {
  secureScore: 68,
  maxSecureScore: 100,
  identityScore: 72,
  deviceScore: 65,
  dataScore: 70,
  mfaAdoption: 89,
  conditionalAccessPolicies: 8,
  riskyUsers: 12,
  riskySignIns: 45,
  staleAccounts: 34,
  externalSharing: 156,
  unprotectedDevices: 89,
  dlpPolicyViolations: 23,
  phishingAttempts: 78,
  malwareDetections: 5
}, null, 2)}

Historical Trends (last 90 days):
${JSON.stringify(historicalTrends || {
  secureScoreTrend: [62, 64, 65, 66, 65, 67, 68],
  riskySignInsTrend: [30, 35, 38, 42, 40, 43, 45],
  mfaAdoptionTrend: [82, 84, 85, 86, 87, 88, 89],
  phishingTrend: [45, 52, 58, 62, 68, 72, 78]
}, null, 2)}

Provide detailed predictions with confidence levels and actionable recommendations.`;

    console.log('Predicting security posture...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
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

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      result = {
        currentPosture: { overallScore: 70, riskLevel: 'medium', trend: 'stable', confidenceLevel: 75 },
        predictions: [],
        rawResponse: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Prediction error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to predict security posture' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
