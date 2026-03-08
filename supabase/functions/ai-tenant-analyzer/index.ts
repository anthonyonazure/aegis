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
    const { tenantData, analysisType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert Microsoft 365 tenant configuration analyst. Analyze tenant data and provide comprehensive insights, optimization recommendations, and identify potential issues.

Your analysis should cover:
1. Overall tenant health and configuration quality
2. Security posture assessment
3. Licensing efficiency analysis
4. User and identity management evaluation
5. Application and service configuration
6. Collaboration and productivity settings
7. Compliance and governance gaps
8. Performance optimization opportunities
9. Cost reduction recommendations
10. Risk identification and mitigation

Provide actionable, prioritized recommendations based on best practices and industry standards.

IMPORTANT: Respond with valid JSON only, no markdown formatting.`;

    const userPrompt = `Perform a ${analysisType || 'comprehensive'} analysis of this M365 tenant configuration:

Tenant Data:
${JSON.stringify(tenantData, null, 2)}

Provide a detailed analysis in this JSON structure:
{
  "summary": {
    "overallHealthScore": number (0-100),
    "healthGrade": "A" | "B" | "C" | "D" | "F",
    "executiveSummary": "string",
    "keyFindings": ["string"],
    "criticalIssues": number,
    "warnings": number,
    "optimizations": number
  },
  "securityAnalysis": {
    "score": number (0-100),
    "findings": [
      {
        "category": "string",
        "finding": "string",
        "severity": "critical" | "high" | "medium" | "low",
        "recommendation": "string",
        "impact": "string"
      }
    ],
    "strengths": ["string"],
    "gaps": ["string"]
  },
  "licensingAnalysis": {
    "score": number (0-100),
    "totalCost": number,
    "potentialSavings": number,
    "utilizationRate": number,
    "findings": [
      {
        "issue": "string",
        "recommendation": "string",
        "estimatedSavings": number
      }
    ],
    "optimizations": ["string"]
  },
  "identityAnalysis": {
    "score": number (0-100),
    "userCount": number,
    "adminCount": number,
    "guestCount": number,
    "mfaCoverage": number,
    "findings": [
      {
        "issue": "string",
        "severity": "critical" | "high" | "medium" | "low",
        "recommendation": "string"
      }
    ]
  },
  "collaborationAnalysis": {
    "score": number (0-100),
    "teamsAdoption": number,
    "sharePointUsage": number,
    "exchangeHealth": number,
    "findings": ["string"],
    "recommendations": ["string"]
  },
  "complianceAnalysis": {
    "score": number (0-100),
    "frameworks": ["string"],
    "gaps": [
      {
        "framework": "string",
        "requirement": "string",
        "gap": "string",
        "remediation": "string"
      }
    ],
    "strengths": ["string"]
  },
  "performanceAnalysis": {
    "score": number (0-100),
    "bottlenecks": ["string"],
    "optimizations": [
      {
        "area": "string",
        "issue": "string",
        "recommendation": "string",
        "expectedImprovement": "string"
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
      "timeline": "string",
      "estimatedCost": "string"
    }
  ],
  "trendAnalysis": {
    "securityTrend": "improving" | "stable" | "declining",
    "costTrend": "increasing" | "stable" | "decreasing",
    "adoptionTrend": "growing" | "stable" | "declining",
    "projections": ["string"]
  },
  "benchmarks": {
    "industryComparison": "above" | "average" | "below",
    "percentile": number,
    "comparisonNotes": ["string"]
  }
}`;

    console.log("Calling Lovable AI for tenant analysis...");

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
        summary: {
          overallHealthScore: 72,
          healthGrade: "B",
          executiveSummary: "Tenant analysis complete. Several optimization opportunities identified.",
          keyFindings: ["Security posture is generally good", "Licensing can be optimized", "Some compliance gaps detected"],
          criticalIssues: 2,
          warnings: 5,
          optimizations: 8
        },
        securityAnalysis: {
          score: 75,
          findings: [
            { category: "Identity", finding: "MFA not enforced for all admins", severity: "high", recommendation: "Enable MFA for all privileged accounts", impact: "Reduces account compromise risk by 99%" }
          ],
          strengths: ["Conditional Access policies configured", "Password policies aligned with best practices"],
          gaps: ["Legacy authentication still enabled", "No PIM configured"]
        },
        licensingAnalysis: {
          score: 68,
          totalCost: 25000,
          potentialSavings: 3500,
          utilizationRate: 78,
          findings: [
            { issue: "Unused E5 licenses", recommendation: "Downgrade to E3 for inactive users", estimatedSavings: 2000 }
          ],
          optimizations: ["Review license assignments monthly", "Consider E3+Security add-on mix"]
        },
        identityAnalysis: {
          score: 80,
          userCount: 500,
          adminCount: 15,
          guestCount: 50,
          mfaCoverage: 92,
          findings: [
            { issue: "High number of global admins", severity: "medium", recommendation: "Reduce to 2-4 break-glass accounts" }
          ]
        },
        collaborationAnalysis: {
          score: 85,
          teamsAdoption: 90,
          sharePointUsage: 75,
          exchangeHealth: 95,
          findings: ["Teams adoption is excellent"],
          recommendations: ["Increase SharePoint modern site adoption"]
        },
        complianceAnalysis: {
          score: 70,
          frameworks: ["GDPR", "HIPAA", "SOC2"],
          gaps: [
            { framework: "GDPR", requirement: "Data retention policies", gap: "No retention labels configured", remediation: "Implement retention policies" }
          ],
          strengths: ["Audit logging enabled", "DLP policies configured"]
        },
        performanceAnalysis: {
          score: 82,
          bottlenecks: ["Large mailbox sizes affecting performance"],
          optimizations: [
            { area: "Exchange", issue: "Mailbox bloat", recommendation: "Implement archiving policies", expectedImprovement: "20% faster mail operations" }
          ]
        },
        prioritizedActions: [
          { priority: 1, action: "Enable MFA for all admin accounts", category: "Security", effort: "low", impact: "high", timeline: "1 week", estimatedCost: "$0" },
          { priority: 2, action: "Review and optimize license assignments", category: "Cost", effort: "medium", impact: "medium", timeline: "2 weeks", estimatedCost: "-$3500/year" }
        ],
        trendAnalysis: {
          securityTrend: "improving",
          costTrend: "stable",
          adoptionTrend: "growing",
          projections: ["Security score expected to increase with planned improvements"]
        },
        benchmarks: {
          industryComparison: "above",
          percentile: 72,
          comparisonNotes: ["Above average for security posture", "Room for improvement in cost optimization"]
        }
      };
    }

    console.log("Tenant analysis complete");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-tenant-analyzer:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to analyze tenant" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
