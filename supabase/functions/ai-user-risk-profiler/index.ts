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
    const { userData, tenantContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an AI security analyst specializing in user behavior analysis and risk profiling for Microsoft 365 environments.
    
Analyze user data and behavior patterns to generate comprehensive risk profiles. Consider:
- Sign-in patterns and anomalies
- Device and location diversity
- Access to sensitive resources
- Privilege levels and admin activities
- Compliance violations
- Data handling behaviors
- External collaboration patterns

Provide actionable risk assessments with specific recommendations.`;

    const userPrompt = `Analyze the following user data and generate a comprehensive risk profile:

User Data:
${JSON.stringify(userData, null, 2)}

Tenant Context:
${JSON.stringify(tenantContext, null, 2)}

Provide a detailed JSON response with this structure:
{
  "userProfile": {
    "displayName": "string",
    "email": "string",
    "department": "string",
    "jobTitle": "string",
    "accountAge": "string",
    "lastActive": "string"
  },
  "overallRiskScore": number (0-100),
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskTrend": "improving" | "stable" | "worsening",
  "confidenceScore": number (0-100),
  "riskCategories": [
    {
      "category": "string (e.g., 'Authentication', 'Data Access', 'Privilege')",
      "score": number (0-100),
      "level": "low" | "medium" | "high" | "critical",
      "factors": ["string"],
      "weight": number
    }
  ],
  "behaviorAnalysis": {
    "signInPatterns": {
      "normalHours": "string",
      "unusualActivity": ["string"],
      "locationConsistency": "string",
      "deviceTrust": "string"
    },
    "dataAccess": {
      "sensitiveDataAccess": "string",
      "downloadPatterns": "string",
      "sharingBehavior": "string",
      "externalCollaboration": "string"
    },
    "privilegeUsage": {
      "adminActions": "string",
      "privilegeEscalation": "string",
      "delegatedAccess": "string"
    }
  },
  "riskIndicators": [
    {
      "indicator": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "firstDetected": "string",
      "frequency": "string",
      "evidence": ["string"]
    }
  ],
  "comparisonToPeers": {
    "riskPercentile": number,
    "departmentAverage": number,
    "organizationAverage": number,
    "peerGroupSize": number,
    "standoutFactors": ["string"]
  },
  "recommendations": [
    {
      "priority": "immediate" | "short-term" | "long-term",
      "action": "string",
      "rationale": "string",
      "expectedImpact": "string",
      "implementation": "string"
    }
  ],
  "monitoringPlan": {
    "focusAreas": ["string"],
    "alertThresholds": [
      {
        "metric": "string",
        "threshold": "string",
        "action": "string"
      }
    ],
    "reviewFrequency": "string"
  },
  "historicalTrend": [
    {
      "period": "string",
      "score": number,
      "keyEvents": ["string"]
    }
  ],
  "accessReview": {
    "unnecessaryAccess": ["string"],
    "excessivePermissions": ["string"],
    "recommendedRemovals": ["string"],
    "justificationNeeded": ["string"]
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

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-user-risk-profiler:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
