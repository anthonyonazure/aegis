import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INCIDENT_RESPONDER_PROMPT = `You are an expert Microsoft 365 security incident responder. Analyze the reported incident and provide comprehensive response guidance, containment steps, and remediation procedures.

Return a JSON object with this exact structure:
{
  "incidentClassification": {
    "type": string,
    "severity": "critical" | "high" | "medium" | "low",
    "category": "malware" | "phishing" | "data_breach" | "account_compromise" | "insider_threat" | "ransomware" | "ddos" | "unauthorized_access" | "policy_violation" | "other",
    "confidence": number (0-100),
    "threatActorType": "external" | "internal" | "unknown",
    "attackVector": string
  },
  "immediateActions": [
    {
      "priority": number,
      "action": string,
      "reason": string,
      "automatable": boolean,
      "timeframe": string,
      "owner": "security_team" | "it_admin" | "management" | "legal" | "hr"
    }
  ],
  "containmentSteps": {
    "shortTerm": [
      {
        "step": string,
        "commands": string[],
        "expectedOutcome": string,
        "rollbackPossible": boolean
      }
    ],
    "longTerm": [
      {
        "step": string,
        "implementation": string,
        "timeline": string
      }
    ]
  },
  "investigationGuidance": {
    "dataToCollect": [
      {
        "source": string,
        "data": string,
        "priority": "critical" | "high" | "medium",
        "retentionPeriod": string
      }
    ],
    "queries": [
      {
        "name": string,
        "description": string,
        "query": string,
        "platform": "Azure AD" | "Microsoft 365" | "Defender" | "Sentinel" | "Intune"
      }
    ],
    "indicatorsOfCompromise": string[],
    "timelineToReconstruct": string[]
  },
  "affectedAssets": {
    "users": {
      "confirmed": string[],
      "suspected": string[],
      "actionsRequired": string[]
    },
    "devices": {
      "confirmed": string[],
      "suspected": string[],
      "actionsRequired": string[]
    },
    "applications": {
      "confirmed": string[],
      "suspected": string[],
      "actionsRequired": string[]
    },
    "data": {
      "typesAtRisk": string[],
      "sensitivityLevel": string,
      "exfiltrationRisk": "confirmed" | "likely" | "possible" | "unlikely"
    }
  },
  "remediationPlan": {
    "phases": [
      {
        "name": string,
        "duration": string,
        "steps": string[],
        "successCriteria": string[],
        "resources": string[]
      }
    ],
    "passwordResets": boolean,
    "tokenRevocation": boolean,
    "mfaEnforcement": boolean,
    "policyChanges": string[]
  },
  "communicationPlan": {
    "internalNotifications": [
      {
        "audience": string,
        "timing": string,
        "channel": string,
        "keyMessages": string[]
      }
    ],
    "externalNotifications": [
      {
        "party": string,
        "requirement": "mandatory" | "recommended" | "optional",
        "deadline": string,
        "reason": string
      }
    ],
    "regulatoryReporting": {
      "required": boolean,
      "regulations": string[],
      "deadlines": string[],
      "reportingBodies": string[]
    }
  },
  "preventionRecommendations": [
    {
      "recommendation": string,
      "category": string,
      "priority": "immediate" | "short_term" | "long_term",
      "effort": "low" | "medium" | "high",
      "effectiveness": "high" | "medium" | "low"
    }
  ],
  "lessonsLearned": {
    "rootCause": string,
    "securityGaps": string[],
    "processImprovements": string[],
    "trainingNeeds": string[]
  },
  "escalationPath": [
    {
      "condition": string,
      "escalateTo": string,
      "contactMethod": string
    }
  ],
  "recoveryTimeline": {
    "estimatedContainment": string,
    "estimatedEradication": string,
    "estimatedRecovery": string,
    "estimatedPostIncident": string
  }
}

Provide specific, actionable guidance based on M365 security best practices and incident response frameworks (NIST, SANS).`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { incidentDescription, incidentType, affectedUsers, tenantData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextData = {
      incidentDescription: incidentDescription || '',
      incidentType: incidentType || 'unknown',
      affectedUsers: affectedUsers || [],
      tenantInfo: tenantData || {},
      reportedAt: new Date().toISOString(),
    };

    console.log('Analyzing incident:', incidentType || 'unknown');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: INCIDENT_RESPONDER_PROMPT },
          { role: 'user', content: `Analyze and provide response guidance for this security incident:\n\n${JSON.stringify(contextData, null, 2)}` }
        ],
        temperature: 0.2,
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

    console.log('Incident response guidance generated');

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Incident responder error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
