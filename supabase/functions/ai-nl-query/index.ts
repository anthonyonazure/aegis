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
    const { query, tenantId, context } = await req.json();
    
    console.log('Natural language query:', { query, tenantId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an intelligent Microsoft 365 data assistant. Users will ask questions in natural language about their tenant data.

Your job is to:
1. Understand the user's intent
2. Determine what Microsoft Graph API endpoints would be needed
3. Generate a structured response with:
   - The interpreted query
   - The Graph API calls that would retrieve this data
   - Sample/simulated results (since we don't have live data)
   - Insights and recommendations based on the query

Available data domains you can query:
- Users (properties: displayName, mail, department, jobTitle, accountEnabled, mfaRegistered, lastSignIn, createdDateTime, assignedLicenses)
- Groups (properties: displayName, members, owners, groupTypes, mailEnabled, securityEnabled)
- Devices (properties: displayName, operatingSystem, isCompliant, isManaged, lastSyncDateTime)
- Applications (properties: displayName, appId, publisherName, signInAudience, permissions)
- Conditional Access Policies (properties: displayName, state, conditions, grantControls)
- Sign-in Logs (properties: userPrincipalName, ipAddress, location, status, riskLevel)
- Audit Logs (properties: activityDisplayName, initiatedBy, targetResources, result)

When generating sample results:
- Create realistic-looking data that matches the query
- Include 5-10 sample records
- Format data appropriately for the query type
- Add relevant statistics (counts, percentages)

Output format:
{
  "interpretation": "What you understood the user is asking for",
  "graphQueries": [
    {
      "endpoint": "/users",
      "filter": "$filter=...",
      "select": "$select=...",
      "description": "Why this query"
    }
  ],
  "results": {
    "type": "table|list|stats|chart",
    "columns": ["Column1", "Column2"],
    "data": [
      { "Column1": "value", "Column2": "value" }
    ],
    "summary": {
      "total": 0,
      "matching": 0,
      "percentage": 0
    }
  },
  "insights": [
    "Key finding 1",
    "Key finding 2"
  ],
  "recommendations": [
    "Suggested action 1",
    "Suggested action 2"
  ],
  "relatedQueries": [
    "Follow-up question 1",
    "Follow-up question 2"
  ]
}`;

    const contextInfo = context ? `\n\nTenant context: ${JSON.stringify(context)}` : '';

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
          { role: "user", content: query + contextInfo }
        ],
        temperature: 0.3,
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
      console.log("Could not parse as JSON, returning text response");
      parsedResponse = {
        interpretation: query,
        graphQueries: [],
        results: {
          type: "text",
          content: content
        },
        insights: [],
        recommendations: [],
        relatedQueries: []
      };
    }

    console.log('Query processed successfully');

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("NL Query error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});