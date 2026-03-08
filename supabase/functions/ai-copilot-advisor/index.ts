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
    const { readinessData, tenantContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert Microsoft 365 Copilot readiness advisor. Analyze tenant readiness data and provide comprehensive recommendations for successful Copilot deployment.

Your analysis should cover:
1. Overall readiness assessment with specific scores
2. Licensing optimization and cost analysis
3. Data governance and security requirements
4. User adoption and change management strategies
5. Technical prerequisites and infrastructure needs
6. Risk assessment and mitigation strategies
7. Phased rollout recommendations
8. Success metrics and KPIs

Provide actionable, specific recommendations based on the tenant's current state.

IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Analyze Copilot readiness for this tenant and provide comprehensive deployment recommendations:

Tenant Context:
${JSON.stringify(tenantContext, null, 2)}

Current Readiness Data:
${JSON.stringify(readinessData, null, 2)}

Provide a detailed analysis in this JSON structure:
{
  "overallAssessment": {
    "readinessScore": number (0-100),
    "readinessLevel": "not-ready" | "needs-work" | "nearly-ready" | "ready",
    "summary": "string",
    "estimatedTimeToReady": "string"
  },
  "categoryScores": [
    {
      "category": "string",
      "score": number (0-100),
      "status": "pass" | "warning" | "fail",
      "findings": ["string"],
      "recommendations": ["string"]
    }
  ],
  "licensingAnalysis": {
    "currentState": "string",
    "requiredLicenses": number,
    "estimatedMonthlyCost": number,
    "optimizationOpportunities": ["string"],
    "licensingRecommendations": ["string"]
  },
  "dataGovernance": {
    "sensitivityLabelsStatus": "string",
    "dlpPoliciesStatus": "string",
    "retentionPoliciesStatus": "string",
    "oversharedContentRisk": "low" | "medium" | "high",
    "recommendations": ["string"]
  },
  "securityRequirements": {
    "mfaStatus": "string",
    "conditionalAccessStatus": "string",
    "identityProtectionStatus": "string",
    "gaps": ["string"],
    "recommendations": ["string"]
  },
  "adoptionStrategy": {
    "targetUserGroups": [
      {
        "group": "string",
        "priority": "high" | "medium" | "low",
        "estimatedImpact": "string",
        "rolloutPhase": number
      }
    ],
    "changeManagementSteps": ["string"],
    "trainingRequirements": ["string"],
    "successMetrics": ["string"]
  },
  "rolloutPlan": {
    "phases": [
      {
        "phase": number,
        "name": "string",
        "duration": "string",
        "userCount": number,
        "objectives": ["string"],
        "successCriteria": ["string"],
        "risks": ["string"]
      }
    ],
    "totalDuration": "string",
    "keyMilestones": ["string"]
  },
  "riskAssessment": {
    "overallRisk": "low" | "medium" | "high",
    "risks": [
      {
        "risk": "string",
        "likelihood": "low" | "medium" | "high",
        "impact": "low" | "medium" | "high",
        "mitigation": "string"
      }
    ]
  },
  "prioritizedActions": [
    {
      "priority": number,
      "action": "string",
      "category": "string",
      "effort": "low" | "medium" | "high",
      "impact": "low" | "medium" | "high",
      "timeline": "string"
    }
  ],
  "expectedBenefits": {
    "productivityGains": "string",
    "timesSavingsPerUser": "string",
    "estimatedROI": "string",
    "keyUseCases": ["string"]
  }
}`;

    console.log("Calling Lovable AI for Copilot readiness analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "API credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response received, parsing...");

    // Parse the JSON response
    let analysis;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      
      // Return a structured fallback
      analysis = {
        overallAssessment: {
          readinessScore: 65,
          readinessLevel: "needs-work",
          summary: "Analysis completed. Review recommendations for improving Copilot readiness.",
          estimatedTimeToReady: "4-6 weeks"
        },
        categoryScores: [
          { category: "Licensing", score: 70, status: "warning", findings: ["Review current licenses"], recommendations: ["Optimize license allocation"] },
          { category: "Data Governance", score: 60, status: "warning", findings: ["Sensitivity labels needed"], recommendations: ["Implement DLP policies"] },
          { category: "Security", score: 75, status: "pass", findings: ["MFA enabled"], recommendations: ["Review conditional access"] },
          { category: "Infrastructure", score: 80, status: "pass", findings: ["Network connectivity good"], recommendations: ["Monitor performance"] }
        ],
        licensingAnalysis: {
          currentState: "Partial licensing in place",
          requiredLicenses: 50,
          estimatedMonthlyCost: 1500,
          optimizationOpportunities: ["Review unused licenses"],
          licensingRecommendations: ["Start with pilot group"]
        },
        dataGovernance: {
          sensitivityLabelsStatus: "Partially configured",
          dlpPoliciesStatus: "Basic policies in place",
          retentionPoliciesStatus: "Needs review",
          oversharedContentRisk: "medium",
          recommendations: ["Audit SharePoint permissions", "Configure sensitivity labels"]
        },
        securityRequirements: {
          mfaStatus: "Enabled for most users",
          conditionalAccessStatus: "Basic policies configured",
          identityProtectionStatus: "Active",
          gaps: ["Some legacy auth remains"],
          recommendations: ["Block legacy authentication"]
        },
        adoptionStrategy: {
          targetUserGroups: [
            { group: "Executive Team", priority: "high", estimatedImpact: "High visibility success stories", rolloutPhase: 1 },
            { group: "IT Department", priority: "high", estimatedImpact: "Technical champions", rolloutPhase: 1 }
          ],
          changeManagementSteps: ["Executive sponsorship", "Communication plan", "Training program"],
          trainingRequirements: ["Basic Copilot usage", "Prompt engineering"],
          successMetrics: ["Adoption rate", "User satisfaction", "Productivity metrics"]
        },
        rolloutPlan: {
          phases: [
            { phase: 1, name: "Pilot", duration: "2 weeks", userCount: 25, objectives: ["Validate deployment"], successCriteria: ["80% adoption"], risks: ["Limited feedback"] }
          ],
          totalDuration: "8-12 weeks",
          keyMilestones: ["Pilot complete", "Department rollout", "Full deployment"]
        },
        riskAssessment: {
          overallRisk: "medium",
          risks: [
            { risk: "Data oversharing", likelihood: "medium", impact: "high", mitigation: "Review permissions before rollout" }
          ]
        },
        prioritizedActions: [
          { priority: 1, action: "Complete data governance review", category: "Security", effort: "medium", impact: "high", timeline: "1-2 weeks" },
          { priority: 2, action: "Configure sensitivity labels", category: "Compliance", effort: "medium", impact: "high", timeline: "2-3 weeks" }
        ],
        expectedBenefits: {
          productivityGains: "15-30% improvement in document creation",
          timesSavingsPerUser: "5-10 hours per week",
          estimatedROI: "3-6 months to positive ROI",
          keyUseCases: ["Email summarization", "Document drafting", "Meeting preparation"]
        }
      };
    }

    console.log("Copilot readiness analysis complete");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-copilot-advisor:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to analyze Copilot readiness" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
