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
    const { sourceConfig, targetConfig, migrationType, requirements } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a Microsoft 365 migration expert. Create comprehensive migration plans for tenant-to-tenant migrations, consolidations, or configuration transfers.

Your task is to analyze source and target configurations and create a detailed migration plan.

ALWAYS respond with valid JSON in this exact format:
{
  "planOverview": {
    "migrationType": "string",
    "complexity": "simple" | "moderate" | "complex" | "enterprise",
    "estimatedDuration": "string",
    "estimatedCost": "string",
    "riskLevel": "low" | "medium" | "high",
    "readinessScore": number (0-100)
  },
  "preRequisites": [
    {
      "category": "licensing" | "permissions" | "infrastructure" | "data" | "users",
      "requirement": "string",
      "status": "ready" | "action-needed" | "blocker",
      "actionRequired": "string or null"
    }
  ],
  "phases": [
    {
      "phaseNumber": number,
      "name": "string",
      "duration": "string",
      "description": "string",
      "tasks": [
        {
          "id": "string",
          "task": "string",
          "owner": "string",
          "duration": "string",
          "dependencies": ["task ids"],
          "automatable": boolean,
          "script": "PowerShell/Graph command if automatable"
        }
      ],
      "milestones": ["string"],
      "rollbackPlan": "string"
    }
  ],
  "resourceMapping": [
    {
      "resourceType": "string",
      "sourceCount": number,
      "targetAction": "migrate" | "recreate" | "skip" | "merge",
      "complexity": "low" | "medium" | "high",
      "notes": "string"
    }
  ],
  "riskAssessment": [
    {
      "risk": "string",
      "likelihood": "low" | "medium" | "high",
      "impact": "low" | "medium" | "high",
      "mitigation": "string",
      "contingency": "string"
    }
  ],
  "communicationPlan": {
    "stakeholders": ["string"],
    "keyMessages": ["string"],
    "timeline": [{"date": "string", "communication": "string"}]
  },
  "testingPlan": {
    "testPhases": [
      {
        "phase": "string",
        "tests": ["string"],
        "successCriteria": ["string"]
      }
    ],
    "pilotGroupSize": number,
    "pilotDuration": "string"
  },
  "postMigrationTasks": [
    {
      "task": "string",
      "timing": "string",
      "responsible": "string"
    }
  ],
  "toolsRecommended": [
    {
      "tool": "string",
      "purpose": "string",
      "cost": "string"
    }
  ],
  "estimatedTimeline": {
    "planning": "string",
    "preparation": "string",
    "pilotMigration": "string",
    "fullMigration": "string",
    "validation": "string",
    "total": "string"
  }
}

Consider:
- User impact and change management
- Downtime requirements
- Data integrity and validation
- Licensing implications
- Security and compliance continuity`;

    const userPrompt = `Create a migration plan with the following details:

Migration Type: ${migrationType || 'Tenant-to-Tenant Configuration Migration'}

Source Configuration:
${JSON.stringify(sourceConfig || {
  tenantName: 'Source Corp',
  users: 500,
  licenses: ['M365 E3', 'M365 E5'],
  conditionalAccessPolicies: 15,
  intuneDevices: 450,
  groups: 120,
  apps: 35,
  sharePointSites: 80,
  mailboxes: 500
}, null, 2)}

Target Configuration:
${JSON.stringify(targetConfig || {
  tenantName: 'Target Corp',
  existingUsers: 200,
  existingPolicies: 5,
  existingApps: 10
}, null, 2)}

Requirements:
${requirements || 'Minimize downtime, maintain security posture, preserve all configurations'}

Create a comprehensive, phased migration plan with automation opportunities.`;

    console.log('Creating migration plan...');

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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) throw new Error('No response from AI');

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      result = {
        planOverview: { migrationType: 'Configuration Migration', complexity: 'moderate', estimatedDuration: 'TBD', riskLevel: 'medium', readinessScore: 70 },
        phases: [],
        rawResponse: content
      };
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Migration planner error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create migration plan' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
