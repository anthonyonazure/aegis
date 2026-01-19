import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SECURITY_BENCHMARK_PROMPT = `You are an expert Microsoft 365 security analyst. Analyze the provided tenant security configuration and compare it against industry benchmarks, best practices, and peer organizations.

Return a JSON object with this exact structure:
{
  "summary": {
    "overallScore": number (0-100),
    "industryPercentile": number (1-100),
    "securityMaturityLevel": "initial" | "developing" | "defined" | "managed" | "optimized",
    "trend": "improving" | "stable" | "declining",
    "riskExposure": "critical" | "high" | "medium" | "low",
    "complianceReadiness": number (0-100)
  },
  "categoryScores": {
    "identity": {
      "score": number,
      "benchmark": number,
      "percentile": number,
      "gap": number,
      "status": "above" | "at" | "below",
      "keyFindings": string[]
    },
    "deviceSecurity": {
      "score": number,
      "benchmark": number,
      "percentile": number,
      "gap": number,
      "status": "above" | "at" | "below",
      "keyFindings": string[]
    },
    "dataProtection": {
      "score": number,
      "benchmark": number,
      "percentile": number,
      "gap": number,
      "status": "above" | "at" | "below",
      "keyFindings": string[]
    },
    "threatProtection": {
      "score": number,
      "benchmark": number,
      "percentile": number,
      "gap": number,
      "status": "above" | "at" | "below",
      "keyFindings": string[]
    },
    "governance": {
      "score": number,
      "benchmark": number,
      "percentile": number,
      "gap": number,
      "status": "above" | "at" | "below",
      "keyFindings": string[]
    }
  },
  "industryComparison": {
    "industry": string,
    "sampleSize": number,
    "yourRank": string,
    "topPerformers": {
      "avgScore": number,
      "characteristics": string[]
    },
    "industryAverage": {
      "avgScore": number,
      "commonWeaknesses": string[]
    },
    "bottomPerformers": {
      "avgScore": number,
      "risks": string[]
    }
  },
  "controlsAnalysis": [
    {
      "control": string,
      "category": string,
      "yourStatus": "implemented" | "partial" | "missing",
      "industryAdoption": number,
      "criticality": "critical" | "high" | "medium" | "low",
      "recommendation": string,
      "effort": "low" | "medium" | "high",
      "impact": number
    }
  ],
  "maturityAssessment": {
    "currentLevel": number (1-5),
    "targetLevel": number (1-5),
    "dimensions": [
      {
        "name": string,
        "current": number,
        "target": number,
        "gap": number,
        "improvements": string[]
      }
    ]
  },
  "peerComparison": {
    "similarOrgs": {
      "criteria": string[],
      "count": number,
      "yourPosition": string
    },
    "strengthsVsPeers": string[],
    "weaknessesVsPeers": string[],
    "uniqueAdvantages": string[]
  },
  "improvementRoadmap": [
    {
      "phase": string,
      "duration": string,
      "objectives": string[],
      "expectedScoreImprovement": number,
      "investments": string[],
      "milestones": string[]
    }
  ],
  "riskHeatmap": [
    {
      "area": string,
      "likelihood": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "currentMitigation": string,
      "recommendedAction": string
    }
  ],
  "quickWins": [
    {
      "action": string,
      "scoreImpact": number,
      "effort": "low" | "medium",
      "timeframe": string
    }
  ]
}

Base your analysis on:
- Microsoft Secure Score benchmarks
- CIS Controls adoption rates
- Industry-specific security standards
- Real-world breach statistics
- Provide actionable, specific recommendations`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantData, industry, companySize } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextData = {
      tenant: tenantData || {},
      industry: industry || 'Technology',
      companySize: companySize || 'medium',
      analysisDate: new Date().toISOString(),
    };

    console.log('Running security benchmark for:', industry || 'Technology');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SECURITY_BENCHMARK_PROMPT },
          { role: 'user', content: `Analyze and benchmark the following tenant security configuration:\n\n${JSON.stringify(contextData, null, 2)}` }
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

    console.log('Security benchmark completed successfully');

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Security benchmark error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
