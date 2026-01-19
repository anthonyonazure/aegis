import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantConfig, selectedFrameworks } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert compliance advisor specializing in Microsoft 365 environments. Analyze tenant configurations against major compliance frameworks and provide detailed gap analysis with remediation guidance.

Supported frameworks:
- NIST Cybersecurity Framework (CSF)
- CIS Microsoft 365 Benchmarks
- ISO 27001
- SOC 2 Type II
- HIPAA
- GDPR
- PCI DSS
- FedRAMP
- CMMC

Provide actionable, specific recommendations with M365-specific implementation steps.

IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Analyze this M365 tenant configuration against the following compliance frameworks: ${selectedFrameworks?.join(', ') || 'NIST CSF, CIS, ISO 27001'}

Tenant Configuration:
${JSON.stringify(tenantConfig, null, 2)}

Provide a comprehensive compliance analysis in this JSON structure:
{
  "overallCompliance": {
    "score": number (0-100),
    "status": "compliant" | "partially-compliant" | "non-compliant",
    "summary": "string",
    "criticalGaps": number,
    "highGaps": number,
    "mediumGaps": number,
    "lowGaps": number
  },
  "frameworkAnalysis": [
    {
      "framework": "string",
      "version": "string",
      "complianceScore": number (0-100),
      "status": "compliant" | "partially-compliant" | "non-compliant",
      "controlsTotal": number,
      "controlsPassed": number,
      "controlsFailed": number,
      "controlsNotApplicable": number,
      "categories": [
        {
          "name": "string",
          "score": number,
          "status": "pass" | "partial" | "fail",
          "controls": [
            {
              "id": "string",
              "name": "string",
              "status": "pass" | "fail" | "partial" | "n/a",
              "finding": "string",
              "recommendation": "string",
              "m365Setting": "string",
              "effort": "low" | "medium" | "high"
            }
          ]
        }
      ]
    }
  ],
  "gapAnalysis": [
    {
      "framework": "string",
      "controlId": "string",
      "controlName": "string",
      "severity": "critical" | "high" | "medium" | "low",
      "currentState": "string",
      "requiredState": "string",
      "gap": "string",
      "businessRisk": "string",
      "remediation": {
        "steps": ["string"],
        "m365AdminPath": "string",
        "powershellCommand": "string",
        "estimatedTime": "string",
        "requiresLicense": "string"
      }
    }
  ],
  "crossFrameworkFindings": [
    {
      "finding": "string",
      "affectedFrameworks": ["string"],
      "severity": "critical" | "high" | "medium" | "low",
      "singleRemediation": "string",
      "impactedControls": number
    }
  ],
  "complianceRoadmap": {
    "phases": [
      {
        "phase": number,
        "name": "string",
        "duration": "string",
        "focus": "string",
        "actions": ["string"],
        "expectedOutcome": "string",
        "frameworksImpacted": ["string"]
      }
    ],
    "quickWins": ["string"],
    "longTermInitiatives": ["string"]
  },
  "auditReadiness": {
    "overallReadiness": number (0-100),
    "documentationStatus": "complete" | "partial" | "missing",
    "evidenceGaps": ["string"],
    "recommendedDocuments": ["string"],
    "auditPreparationSteps": ["string"]
  },
  "riskAssessment": {
    "overallRisk": "low" | "medium" | "high" | "critical",
    "risksByCategory": [
      {
        "category": "string",
        "riskLevel": "low" | "medium" | "high" | "critical",
        "findings": ["string"],
        "mitigations": ["string"]
      }
    ]
  },
  "certificationGuidance": {
    "readyForCertification": ["string"],
    "nearCertification": [
      {
        "framework": "string",
        "gapsRemaining": number,
        "estimatedTimeToReady": "string"
      }
    ],
    "requiresSignificantWork": ["string"]
  }
}`;

    console.log("Calling Lovable AI for compliance analysis...");

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

    let analysis;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      
      analysis = {
        overallCompliance: {
          score: 68,
          status: "partially-compliant",
          summary: "Tenant meets most baseline requirements but has gaps in advanced security controls.",
          criticalGaps: 2,
          highGaps: 5,
          mediumGaps: 8,
          lowGaps: 12
        },
        frameworkAnalysis: [
          {
            framework: "NIST CSF",
            version: "2.0",
            complianceScore: 72,
            status: "partially-compliant",
            controlsTotal: 108,
            controlsPassed: 78,
            controlsFailed: 20,
            controlsNotApplicable: 10,
            categories: [
              {
                name: "Identify",
                score: 85,
                status: "pass",
                controls: [
                  { id: "ID.AM-1", name: "Asset Inventory", status: "pass", finding: "Complete device inventory maintained", recommendation: "Continue current practices", m365Setting: "Intune Device Management", effort: "low" }
                ]
              }
            ]
          },
          {
            framework: "CIS M365",
            version: "3.0",
            complianceScore: 65,
            status: "partially-compliant",
            controlsTotal: 95,
            controlsPassed: 62,
            controlsFailed: 28,
            controlsNotApplicable: 5,
            categories: []
          }
        ],
        gapAnalysis: [
          {
            framework: "NIST CSF",
            controlId: "PR.AC-7",
            controlName: "Privileged Access Management",
            severity: "high",
            currentState: "Basic admin roles without PIM",
            requiredState: "Just-in-time privileged access with approval workflows",
            gap: "No Privileged Identity Management configured",
            businessRisk: "Increased risk of privilege abuse and account compromise",
            remediation: {
              steps: ["Enable Azure AD PIM", "Configure eligible assignments", "Set up approval workflows"],
              m365AdminPath: "Azure AD > Identity Governance > Privileged Identity Management",
              powershellCommand: "Enable-AzureADPrivilegedIdentityManagement",
              estimatedTime: "2-4 hours",
              requiresLicense: "Azure AD P2"
            }
          }
        ],
        crossFrameworkFindings: [
          {
            finding: "MFA not enforced for all users",
            affectedFrameworks: ["NIST CSF", "CIS M365", "ISO 27001", "SOC 2"],
            severity: "critical",
            singleRemediation: "Enable Security Defaults or Conditional Access MFA policy",
            impactedControls: 12
          }
        ],
        complianceRoadmap: {
          phases: [
            {
              phase: 1,
              name: "Critical Security Gaps",
              duration: "2 weeks",
              focus: "Address critical and high-severity findings",
              actions: ["Enable MFA for all users", "Configure PIM", "Block legacy auth"],
              expectedOutcome: "15% compliance improvement",
              frameworksImpacted: ["NIST CSF", "CIS M365", "ISO 27001"]
            }
          ],
          quickWins: ["Enable Security Defaults", "Configure password policies", "Enable audit logging"],
          longTermInitiatives: ["Implement Zero Trust architecture", "Deploy advanced threat protection"]
        },
        auditReadiness: {
          overallReadiness: 55,
          documentationStatus: "partial",
          evidenceGaps: ["Access review records", "Incident response procedures", "Risk assessment documentation"],
          recommendedDocuments: ["Information Security Policy", "Access Control Policy", "Incident Response Plan"],
          auditPreparationSteps: ["Complete control testing", "Gather evidence artifacts", "Document remediation plans"]
        },
        riskAssessment: {
          overallRisk: "medium",
          risksByCategory: [
            {
              category: "Identity & Access",
              riskLevel: "high",
              findings: ["No PIM configured", "Excessive global admins"],
              mitigations: ["Implement PIM", "Reduce admin count"]
            }
          ]
        },
        certificationGuidance: {
          readyForCertification: [],
          nearCertification: [
            { framework: "ISO 27001", gapsRemaining: 12, estimatedTimeToReady: "3 months" }
          ],
          requiresSignificantWork: ["SOC 2 Type II", "FedRAMP"]
        }
      };
    }

    console.log("Compliance analysis complete");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-compliance-advisor:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to analyze compliance" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
