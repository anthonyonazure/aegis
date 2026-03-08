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
    const { reportType, tenantData, dateRange, audience } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a Microsoft 365 governance expert creating executive reports. Generate comprehensive, professional reports tailored to the specified audience.

Your task is to create a detailed governance report based on the provided data.

ALWAYS respond with valid JSON in this exact format:
{
  "reportMetadata": {
    "title": "string",
    "generatedAt": "ISO date string",
    "reportingPeriod": "string",
    "preparedFor": "string",
    "confidentiality": "Internal" | "Confidential" | "Public"
  },
  "executiveSummary": {
    "overview": "2-3 paragraph executive overview",
    "keyFindings": ["list of 3-5 key findings"],
    "overallHealthScore": number (0-100),
    "trend": "improving" | "stable" | "declining",
    "criticalActions": ["immediate actions needed"]
  },
  "sections": [
    {
      "title": "string",
      "summary": "string",
      "metrics": [
        {
          "name": "string",
          "value": "string or number",
          "trend": "up" | "down" | "stable",
          "status": "good" | "warning" | "critical",
          "benchmark": "optional comparison"
        }
      ],
      "insights": ["key insights for this section"],
      "recommendations": ["actionable recommendations"]
    }
  ],
  "riskAssessment": {
    "overallRiskLevel": "low" | "medium" | "high" | "critical",
    "risks": [
      {
        "category": "string",
        "description": "string",
        "likelihood": "low" | "medium" | "high",
        "impact": "low" | "medium" | "high",
        "mitigation": "string"
      }
    ]
  },
  "complianceStatus": {
    "frameworks": [
      {
        "name": "string (e.g., SOC2, HIPAA, ISO27001)",
        "status": "compliant" | "partial" | "non-compliant",
        "score": number,
        "gaps": ["list of gaps if any"]
      }
    ]
  },
  "recommendations": {
    "immediate": ["actions for next 7 days"],
    "shortTerm": ["actions for next 30 days"],
    "longTerm": ["strategic recommendations for next quarter"]
  },
  "appendix": {
    "dataSourcesUsed": ["list of data sources"],
    "methodology": "brief methodology description",
    "glossary": [{"term": "string", "definition": "string"}]
  }
}

Tailor the language and detail level to the audience:
- "executive": High-level, business-focused, minimal jargon
- "technical": Detailed, includes technical specifics
- "board": Strategic focus, risk and compliance emphasis
- "compliance": Audit-ready, framework-specific details`;

    const userPrompt = `Generate a ${reportType || 'governance'} report with the following parameters:

Audience: ${audience || 'executive'}
Reporting Period: ${dateRange || 'Last 30 days'}

Tenant Data:
${JSON.stringify(tenantData || {
  tenantName: 'Contoso Corporation',
  totalUsers: 2500,
  licensedUsers: 2350,
  adminUsers: 45,
  guestUsers: 180,
  secureScore: 72,
  maxSecureScore: 100,
  mfaEnabledPercent: 94,
  conditionalAccessPolicies: 12,
  compliancePolicies: 8,
  staleAccounts: 23,
  riskySignIns: 5,
  unusedLicenses: 150,
  monthlyLicenseCost: 85000
}, null, 2)}

Create a comprehensive, professional report suitable for ${audience || 'executive'} stakeholders.`;

    console.log('Generating executive report...');

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
        reportMetadata: {
          title: 'Governance Report',
          generatedAt: new Date().toISOString(),
          reportingPeriod: dateRange || 'Last 30 days'
        },
        executiveSummary: {
          overview: content,
          keyFindings: [],
          overallHealthScore: 70,
          trend: 'stable'
        },
        sections: [],
        rawResponse: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
