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
    const { driftData, resourceType } = await req.json();

    if (!driftData) {
      return new Response(
        JSON.stringify({ error: 'Drift data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) {
      throw new Error('AI_GATEWAY_API_KEY is not configured');
    }
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');

    const systemPrompt = `You are a Microsoft 365 configuration expert. Analyze configuration drift and explain changes in plain English that both technical and non-technical stakeholders can understand.

Your task is to analyze the provided drift data and explain:
1. What changed (in simple terms)
2. Why it might matter
3. What the security/compliance implications are
4. Whether action is needed

ALWAYS respond with valid JSON in this exact format:
{
  "summary": {
    "totalChanges": number,
    "criticalChanges": number,
    "warningChanges": number,
    "infoChanges": number,
    "overallRisk": "critical" | "high" | "medium" | "low" | "none",
    "tldr": "One sentence summary of the most important change"
  },
  "changes": [
    {
      "id": "string",
      "resourceType": "string",
      "resourceName": "string",
      "changeType": "added" | "modified" | "removed",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "technicalDescription": "What changed technically",
      "plainEnglish": "What this means in simple terms anyone can understand",
      "securityImpact": "How this affects security posture",
      "complianceImpact": "Any compliance frameworks affected (e.g., SOC2, HIPAA, ISO27001)",
      "affectedUsers": "Who is affected by this change",
      "recommendation": "What action to take, if any",
      "beforeValue": "Previous configuration (simplified)",
      "afterValue": "New configuration (simplified)"
    }
  ],
  "patterns": [
    {
      "pattern": "Description of detected pattern",
      "significance": "Why this pattern matters",
      "relatedChanges": ["change ids that form this pattern"]
    }
  ],
  "executiveSummary": "2-3 paragraph summary suitable for executives or non-technical stakeholders",
  "technicalSummary": "Detailed technical summary for IT admins",
  "actionItems": [
    {
      "priority": "immediate" | "soon" | "when-possible",
      "action": "Specific action to take",
      "reason": "Why this action is needed"
    }
  ],
  "riskScore": number (0-100),
  "complianceRisk": {
    "frameworks": ["list of potentially affected frameworks"],
    "concerns": ["specific compliance concerns"]
  }
}

Make explanations clear, actionable, and avoid jargon where possible. When technical terms are necessary, provide brief explanations.`;

    const userPrompt = `Analyze this configuration drift and explain what changed in plain English:

Resource Type: ${resourceType || 'Mixed'}

Drift Data:
${JSON.stringify(driftData, null, 2)}

Provide a comprehensive analysis with plain-English explanations that both technical and non-technical stakeholders can understand.`;

    console.log('Analyzing drift data...');

    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_GATEWAY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
          totalChanges: 0,
          criticalChanges: 0,
          warningChanges: 0,
          infoChanges: 0,
          overallRisk: 'medium',
          tldr: 'Unable to parse drift analysis'
        },
        changes: [],
        executiveSummary: content,
        technicalSummary: content,
        actionItems: [],
        riskScore: 50,
        rawResponse: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Drift explanation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to explain drift' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
