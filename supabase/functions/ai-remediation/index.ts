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
    const { issue, context, scriptType } = await req.json();

    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AI_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!AI_GATEWAY_KEY) {
      throw new Error('AI_GATEWAY_API_KEY is not configured');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
    if (!AI_GATEWAY_URL) throw new Error('AI_GATEWAY_URL is not configured');
    }

    const systemPrompt = `You are an expert Microsoft 365 and Azure security remediation specialist. Generate production-ready scripts to fix security and compliance issues.

Your task is to analyze the described issue and generate remediation scripts.

ALWAYS respond with valid JSON in this exact format:
{
  "issueAnalysis": {
    "severity": "critical|high|medium|low",
    "category": "security|compliance|identity|configuration",
    "affectedResources": ["list of affected resource types"],
    "rootCause": "explanation of the root cause"
  },
  "scripts": {
    "powershell": {
      "code": "complete PowerShell script with proper error handling",
      "modules": ["required PowerShell modules"],
      "permissions": ["required permissions/roles"]
    },
    "graphApi": {
      "code": "Graph API HTTP requests or SDK code",
      "endpoints": ["list of Graph API endpoints used"],
      "permissions": ["required Graph API permissions"]
    },
    "cli": {
      "code": "Azure CLI or Microsoft 365 CLI commands",
      "tools": ["required CLI tools"]
    }
  },
  "implementation": {
    "prerequisites": ["list of prerequisites before running"],
    "steps": ["ordered implementation steps"],
    "validation": ["how to validate the fix worked"],
    "rollback": ["steps to rollback if needed"]
  },
  "risks": ["potential risks or side effects"],
  "estimatedTime": "time estimate to implement",
  "automationPossible": true/false,
  "scheduledTask": {
    "recommended": true/false,
    "frequency": "suggested frequency if recurring"
  }
}

Generate complete, production-ready scripts with:
- Proper error handling and logging
- Parameter validation
- Confirmation prompts for destructive actions
- Progress indicators for long operations
- Comments explaining each section`;

    const userPrompt = `Issue to remediate: ${issue}

${context ? `Additional context:\n${JSON.stringify(context, null, 2)}` : ''}

${scriptType ? `Preferred script type: ${scriptType}` : 'Generate all script types (PowerShell, Graph API, CLI)'}

Generate complete remediation scripts with implementation guidance.`;

    console.log('Generating remediation scripts for:', issue);

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

    // Parse JSON from response
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
        issueAnalysis: {
          severity: 'medium',
          category: 'configuration',
          affectedResources: ['Unknown'],
          rootCause: 'Unable to determine automatically'
        },
        scripts: {
          powershell: {
            code: '# AI response could not be parsed\n# Please describe the issue in more detail',
            modules: [],
            permissions: []
          },
          graphApi: {
            code: '// Graph API script generation failed',
            endpoints: [],
            permissions: []
          },
          cli: {
            code: '# CLI commands not generated',
            tools: []
          }
        },
        implementation: {
          prerequisites: ['Review the issue manually'],
          steps: ['Analyze the compliance gap', 'Determine appropriate remediation'],
          validation: ['Verify the issue is resolved'],
          rollback: ['Document current state before changes']
        },
        risks: ['Manual review recommended'],
        estimatedTime: 'Varies',
        automationPossible: false,
        rawResponse: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Remediation generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate remediation scripts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
