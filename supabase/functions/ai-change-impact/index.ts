import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHANGE_IMPACT_PROMPT = `You are an expert Microsoft 365 configuration analyst. Analyze the proposed configuration changes and predict their impact on security, compliance, user experience, and operations.

Return a JSON object with this exact structure:
{
  "summary": {
    "overallRisk": "critical" | "high" | "medium" | "low",
    "confidenceLevel": number (0-100),
    "recommendedAction": "proceed" | "proceed_with_caution" | "review_required" | "do_not_proceed",
    "estimatedDowntime": string,
    "affectedUsersCount": number,
    "rollbackComplexity": "simple" | "moderate" | "complex"
  },
  "impactCategories": {
    "security": {
      "impact": "positive" | "neutral" | "negative",
      "severity": "critical" | "high" | "medium" | "low" | "none",
      "details": string[],
      "mitigations": string[]
    },
    "compliance": {
      "impact": "positive" | "neutral" | "negative",
      "severity": "critical" | "high" | "medium" | "low" | "none",
      "affectedFrameworks": string[],
      "details": string[],
      "mitigations": string[]
    },
    "userExperience": {
      "impact": "positive" | "neutral" | "negative",
      "severity": "critical" | "high" | "medium" | "low" | "none",
      "affectedWorkflows": string[],
      "details": string[],
      "mitigations": string[]
    },
    "operations": {
      "impact": "positive" | "neutral" | "negative",
      "severity": "critical" | "high" | "medium" | "low" | "none",
      "details": string[],
      "mitigations": string[]
    },
    "performance": {
      "impact": "positive" | "neutral" | "negative",
      "severity": "critical" | "high" | "medium" | "low" | "none",
      "details": string[],
      "mitigations": string[]
    }
  },
  "affectedResources": [
    {
      "resourceType": string,
      "resourceName": string,
      "changeType": "create" | "modify" | "delete",
      "riskLevel": "critical" | "high" | "medium" | "low",
      "dependencies": string[],
      "impactDescription": string
    }
  ],
  "userImpactAnalysis": {
    "directlyAffected": {
      "count": number,
      "groups": string[],
      "impactType": string
    },
    "indirectlyAffected": {
      "count": number,
      "groups": string[],
      "impactType": string
    },
    "requiredCommunication": string[],
    "trainingNeeded": boolean,
    "trainingTopics": string[]
  },
  "dependencyAnalysis": {
    "upstreamDependencies": [
      {
        "resource": string,
        "type": string,
        "risk": string
      }
    ],
    "downstreamEffects": [
      {
        "resource": string,
        "effect": string,
        "severity": string
      }
    ],
    "potentialConflicts": string[]
  },
  "testingRecommendations": {
    "preDeployment": [
      {
        "test": string,
        "priority": "required" | "recommended" | "optional",
        "description": string
      }
    ],
    "postDeployment": [
      {
        "test": string,
        "priority": "required" | "recommended" | "optional",
        "description": string
      }
    ],
    "pilotGroupSuggestion": string
  },
  "rollbackPlan": {
    "steps": string[],
    "estimatedTime": string,
    "dataLossRisk": "none" | "minimal" | "moderate" | "significant",
    "automationAvailable": boolean
  },
  "deploymentRecommendations": {
    "suggestedTiming": string,
    "phaseApproach": boolean,
    "phases": [
      {
        "name": string,
        "scope": string,
        "duration": string,
        "successCriteria": string[]
      }
    ],
    "monitoringRequirements": string[]
  },
  "risks": [
    {
      "risk": string,
      "probability": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "mitigation": string
    }
  ],
  "benefits": [
    {
      "benefit": string,
      "category": string,
      "quantifiableImpact": string
    }
  ]
}

Consider:
- Conditional Access policy interactions
- Group membership cascading effects
- License requirement changes
- Service dependencies
- Authentication flow impacts
- Data access implications`;

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
    const { proposedChanges, currentConfig, tenantData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextData = {
      proposedChanges: proposedChanges || {},
      currentConfiguration: currentConfig || {},
      tenantInfo: tenantData || {},
      analysisDate: new Date().toISOString(),
    };

    console.log('Analyzing change impact for:', Object.keys(proposedChanges || {}).length, 'changes');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: CHANGE_IMPACT_PROMPT },
          { role: 'user', content: `Analyze the impact of these proposed changes:\n\n${JSON.stringify(contextData, null, 2)}` }
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

    console.log('Change impact analysis completed');

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Change impact error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
