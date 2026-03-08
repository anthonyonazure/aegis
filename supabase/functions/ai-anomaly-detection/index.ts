import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnomalyData {
  signInLogs?: Array<{
    user: string;
    location: string;
    ip: string;
    timestamp: string;
    status: string;
    riskLevel?: string;
  }>;
  configChanges?: Array<{
    resource: string;
    action: string;
    actor: string;
    timestamp: string;
    details?: string;
  }>;
  permissionGrants?: Array<{
    principal: string;
    permission: string;
    resource: string;
    grantedBy: string;
    timestamp: string;
  }>;
}

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
    const { data, tenantId }: { data: AnomalyData; tenantId?: string } = await req.json();
    
    console.log('Anomaly detection request for tenant:', tenantId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a security analyst AI specialized in Microsoft 365 and Azure AD security monitoring.

Analyze the provided audit data and identify potential security anomalies. Look for:

1. **Sign-in Anomalies:**
   - Impossible travel (logins from distant locations in short time)
   - Unusual login times
   - Failed login attempts followed by success (brute force indicators)
   - Logins from high-risk countries or Tor exit nodes
   - New device or browser patterns

2. **Configuration Anomalies:**
   - Conditional Access policy modifications
   - MFA setting changes
   - Security defaults being disabled
   - New admin role assignments
   - Unusual bulk operations

3. **Permission Anomalies:**
   - Excessive permission grants
   - Sensitive API permissions (Mail.ReadWrite, Directory.ReadWrite.All)
   - Service principal permissions without justification
   - Delegated permissions to external apps

For each anomaly found, provide:
- Severity: critical, high, medium, low
- Category: sign-in, configuration, permission
- Description of the anomaly
- Potential impact
- Recommended investigation steps

Output as JSON:
{
  "anomalies": [
    {
      "id": "unique-id",
      "severity": "critical|high|medium|low",
      "category": "sign-in|configuration|permission",
      "title": "Brief title",
      "description": "Detailed description",
      "affectedEntity": "User/Resource affected",
      "timestamp": "When it occurred",
      "impact": "Potential security impact",
      "investigation": ["Step 1", "Step 2"],
      "relatedEvents": ["Event 1", "Event 2"]
    }
  ],
  "summary": {
    "totalAnomalies": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "overallRiskLevel": "critical|high|medium|low",
    "recommendations": ["Top priority actions"]
  }
}`;

    const userPrompt = `Analyze this audit data for security anomalies:

${JSON.stringify(data, null, 2)}

If no data is provided, generate sample anomalies that would typically be found in a Microsoft 365 environment for demonstration purposes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsedResponse;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedResponse = JSON.parse(jsonString);
    } catch (parseError) {
      console.log("Could not parse as JSON, returning structured error");
      parsedResponse = {
        anomalies: [],
        summary: {
          totalAnomalies: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          overallRiskLevel: "low",
          recommendations: ["Unable to parse AI response. Please try again."]
        },
        rawResponse: content
      };
    }

    console.log('Anomaly detection completed:', parsedResponse.summary);

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Anomaly detection error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});