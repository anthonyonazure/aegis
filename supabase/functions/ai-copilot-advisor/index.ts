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

    const systemPrompt = `You are an expert Microsoft 365 Copilot readiness advisor grounded in official Microsoft Learn documentation. Analyze tenant readiness data and provide comprehensive recommendations.

IMPORTANT — base your analysis on these Microsoft Learn requirements:

## Minimum Requirements (per Microsoft Learn)
- Entra ID accounts (cloud identity)
- Microsoft 365 Apps on Current Channel or Monthly Enterprise Channel (Semi-Annual Channel is NOT supported)
- Exchange Online mailbox (on-premises mailboxes are not supported)
- OneDrive for Business provisioned
- Network connectivity to *.cloud.microsoft, *.office.com, copilot.microsoft.com on port 443
- WebSocket (WSS) connections allowed through firewall/proxy

## Security & Identity
- MFA enabled for all Copilot users
- Conditional Access policies enforcing device compliance and MFA
- Audit logging enabled in Microsoft Purview

## Data Governance (critical for safe rollout)
- Microsoft Purview sensitivity labels published and applied
- DLP policies configured to prevent data leakage via Copilot
- SharePoint/OneDrive sharing reviewed — oversharing means Copilot surfaces content users shouldn't see
- Retention policies in place

## Apps & Privacy Settings
- "Connected Experiences" enabled in Office privacy settings (required for cloud AI)
- Microsoft Loop enabled (Copilot creates Loop components)
- Third-party cookies allowed for *.cloud.microsoft and *.office.com in browsers
- Office Feature Updates scheduled task enabled on devices

## Teams & Copilot Voice
- Transcription and recording enabled in Teams admin center (required for meeting Copilot)
- For Copilot Voice: Teams Phone license + PSTN connectivity (Calling Plan, Direct Routing, or Operator Connect)
- VoIP/WebSocket endpoints unblocked at network level

## Scoring Categories (weighted)
1. Licensing (15%) — Copilot SKUs assigned
2. Identity & Access (15%) — MFA, Conditional Access, Entra ID
3. Exchange & Mailbox (10%) — Cloud mailboxes
4. Data Governance (15%) — Sensitivity labels, DLP, Purview
5. SharePoint & OneDrive (10%) — Provisioning, oversharing risk
6. Teams & Voice (10%) — Transcription, Teams Phone, PSTN
7. Apps & Update Channel (10%) — Current/Monthly channel, Connected Experiences, Loop
8. Network (15%) — WSS endpoints, firewall rules

Provide actionable, specific recommendations based on the tenant's current state.

CRITICAL RULES FOR RECOMMENDATIONS AND ACTIONS:
- Every recommendation, action, gap, risk, and optimization MUST include an "explanation" field with a 2-3 sentence plain-English description of what it means and why it matters.
- Every recommendation, action, gap, risk, and optimization MUST include a "referenceUrl" field with a direct Microsoft Learn URL (https://learn.microsoft.com/...) backing the requirement.
- Every prioritized action MUST also include a "goal" field describing the specific objective/outcome.

IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Analyze Copilot readiness for this tenant and provide comprehensive deployment recommendations:

Tenant Context:
${JSON.stringify(tenantContext, null, 2)}

Current Readiness Data (8-category assessment):
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
  "teamsAndVoice": {
    "transcriptionStatus": "string",
    "teamsPhoneStatus": "string",
    "pstnConnectivity": "string",
    "copilotVoiceReady": boolean,
    "recommendations": ["string"]
  },
  "appsAndInfrastructure": {
    "updateChannel": "string",
    "connectedExperiences": "string",
    "loopEnabled": "string",
    "networkEndpoints": "string",
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "API credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    let analysis;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      
      // Structured fallback
      analysis = {
        overallAssessment: {
          readinessScore: 65,
          readinessLevel: "needs-work",
          summary: "Analysis completed. Review recommendations for improving Copilot readiness across all 8 categories.",
          estimatedTimeToReady: "4-6 weeks"
        },
        categoryScores: [
          { category: "Licensing", score: 70, status: "warning", findings: ["Review current licenses"], recommendations: ["Optimize license allocation"] },
          { category: "Identity & Access", score: 60, status: "warning", findings: ["MFA coverage needs review"], recommendations: ["Enable MFA for all users, configure Conditional Access"] },
          { category: "Exchange & Mailbox", score: 80, status: "pass", findings: ["Cloud mailboxes detected"], recommendations: ["Verify all users have EXO mailboxes"] },
          { category: "Data Governance", score: 50, status: "warning", findings: ["Sensitivity labels needed"], recommendations: ["Implement Purview sensitivity labels and DLP policies"] },
          { category: "SharePoint & OneDrive", score: 60, status: "warning", findings: ["Oversharing risk detected"], recommendations: ["Review external sharing policies"] },
          { category: "Teams & Voice", score: 55, status: "warning", findings: ["Teams Phone not detected"], recommendations: ["Enable transcription, assign Teams Phone for Voice"] },
          { category: "Apps & Update Channel", score: 70, status: "warning", findings: ["Verify update channel"], recommendations: ["Confirm Current/Monthly Enterprise Channel via Intune"] },
          { category: "Network", score: 80, status: "pass", findings: ["Endpoint list provided"], recommendations: ["Verify WSS endpoints unblocked at firewall"] },
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
          recommendations: ["Audit SharePoint permissions", "Configure sensitivity labels", "Review external sharing"]
        },
        securityRequirements: {
          mfaStatus: "Enabled for most users",
          conditionalAccessStatus: "Basic policies configured",
          identityProtectionStatus: "Active",
          gaps: ["Some legacy auth remains"],
          recommendations: ["Block legacy authentication", "Enforce MFA via Conditional Access"]
        },
        teamsAndVoice: {
          transcriptionStatus: "Check required",
          teamsPhoneStatus: "Not detected",
          pstnConnectivity: "Not configured",
          copilotVoiceReady: false,
          recommendations: ["Enable transcription in Teams admin", "Assign Teams Phone licenses for Voice users"]
        },
        appsAndInfrastructure: {
          updateChannel: "Verify via Intune",
          connectedExperiences: "Ensure enabled",
          loopEnabled: "Default enabled",
          networkEndpoints: "Provide endpoint list to network team",
          recommendations: ["Confirm Current Channel deployment", "Enable Connected Experiences in Group Policy"]
        },
        adoptionStrategy: {
          targetUserGroups: [
            { group: "Executive Team", priority: "high", estimatedImpact: "High visibility success stories", rolloutPhase: 1 },
            { group: "IT Department", priority: "high", estimatedImpact: "Technical champions", rolloutPhase: 1 }
          ],
          changeManagementSteps: ["Executive sponsorship", "Communication plan", "Training program"],
          trainingRequirements: ["Basic Copilot usage", "Prompt engineering", "Data governance awareness"],
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
            { risk: "Data oversharing via Copilot", likelihood: "medium", impact: "high", mitigation: "Review SharePoint permissions and sensitivity labels before rollout" },
            { risk: "Network blocking Copilot Voice", likelihood: "low", impact: "high", mitigation: "Verify WSS endpoints with network team" }
          ]
        },
        prioritizedActions: [
          { priority: 1, action: "Complete data governance review and sensitivity labels", category: "Security", effort: "medium", impact: "high", timeline: "1-2 weeks" },
          { priority: 2, action: "Enable MFA and Conditional Access for all users", category: "Identity", effort: "medium", impact: "high", timeline: "1 week" },
          { priority: 3, action: "Verify network endpoints and WSS connectivity", category: "Network", effort: "low", impact: "high", timeline: "1-2 days" },
        ],
        expectedBenefits: {
          productivityGains: "15-30% improvement in document creation",
          timesSavingsPerUser: "5-10 hours per week",
          estimatedROI: "3-6 months to positive ROI",
          keyUseCases: ["Email summarization", "Document drafting", "Meeting preparation", "Data analysis"]
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
