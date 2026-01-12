import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const AuthRequestSchema = z.object({
  action: z.enum(['get-token', 'test-connection']),
  tenantId: z.string().uuid('Invalid tenant ID format'),
  clientId: z.string().uuid('Invalid client ID format'),
  clientSecret: z.string().min(1, 'Client secret required').max(1000, 'Client secret too long'),
});

const ExportRequestSchema = z.object({
  action: z.literal('export'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  resources: z.array(z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource format')).min(1, 'At least one resource required').max(100, 'Too many resources'),
  exportJobId: z.string().uuid('Invalid export job ID format'),
});

// Error sanitization function
function sanitizeError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log full error server-side for debugging
  console.error('Function error (sanitized for client):', errorMessage);
  
  // Map specific errors to user-friendly messages
  if (errorMessage.includes('invalid_client') || errorMessage.includes('AADSTS')) {
    return 'Authentication failed. Please verify your Microsoft 365 credentials.';
  }
  if (errorMessage.includes('invalid_grant')) {
    return 'Authentication expired. Please re-authenticate.';
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Check your API permissions in Azure AD.';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'Resource not found. The requested data may not exist.';
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return 'Request timed out. Please try again.';
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return 'Rate limited. Please wait and try again.';
  }
  
  // Generic fallback
  return 'An error occurred. Please try again or contact support.';
}

// Microsoft Graph API endpoints for different resource types
const GRAPH_ENDPOINTS: Record<string, string> = {
  // Intune
  'intune/device-configurations': '/deviceManagement/deviceConfigurations',
  'intune/compliance-policies': '/deviceManagement/deviceCompliancePolicies',
  'intune/app-configurations': '/deviceManagement/managedAppPolicies',
  'intune/autopilot': '/deviceManagement/windowsAutopilotDeploymentProfiles',
  'intune/enrollment-restrictions': '/deviceManagement/deviceEnrollmentConfigurations',
  'intune/scripts': '/deviceManagement/deviceManagementScripts',
  'intune/win32-apps': '/deviceAppManagement/mobileApps',
  'intune/update-rings': '/deviceManagement/deviceConfigurations',
  
  // Conditional Access
  'conditional-access/ca-policies': '/identity/conditionalAccess/policies',
  'conditional-access/named-locations': '/identity/conditionalAccess/namedLocations',
  'conditional-access/auth-contexts': '/identity/conditionalAccess/authenticationContextClassReferences',
  'conditional-access/auth-strengths': '/identity/conditionalAccess/authenticationStrengths/policies',
  
  // Entra ID
  'entra-id/groups': '/groups',
  'entra-id/app-registrations': '/applications',
  'entra-id/enterprise-apps': '/servicePrincipals',
  'entra-id/directory-settings': '/settings',
  'entra-id/admin-units': '/administrativeUnits',
  'entra-id/roles': '/directoryRoles',
  
  // Defender
  'defender/asr-policies': '/deviceManagement/intents',
  'defender/antivirus-policies': '/deviceManagement/intents',
  'defender/firewall-policies': '/deviceManagement/intents',
  'defender/edr-policies': '/deviceManagement/intents',
  'defender/security-baselines': '/deviceManagement/templates',
  
  // Purview
  'purview/sensitivity-labels': '/security/informationProtection/sensitivityLabels',
};

async function verifyAuth(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    console.error('Auth verification failed:', error);
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: data.claims.sub as string };
}

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<{ token: string; expiresIn: number } | { error: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Token error (full details):', JSON.stringify(data));
      // Return sanitized error
      return { error: sanitizeError(new Error(data.error_description || data.error || 'Token request failed')) };
    }

    return {
      token: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error: unknown) {
    console.error('Token fetch error:', error);
    return { error: sanitizeError(error) };
  }
}

async function fetchGraphData(accessToken: string, endpoint: string): Promise<any> {
  const graphUrl = `https://graph.microsoft.com/v1.0${endpoint}`;
  
  try {
    const response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Try beta endpoint if v1.0 fails
      const betaUrl = `https://graph.microsoft.com/beta${endpoint}`;
      const betaResponse = await fetch(betaUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!betaResponse.ok) {
        const errorData = await betaResponse.json().catch(() => ({}));
        console.error('Graph API error (full details):', JSON.stringify(errorData));
        throw new Error(`API_ERROR_${betaResponse.status}`);
      }

      return await betaResponse.json();
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

async function getTenantInfo(accessToken: string): Promise<{ displayName: string; tenantId: string } | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.value && data.value.length > 0) {
      return {
        displayName: data.value[0].displayName,
        tenantId: data.value[0].id,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting tenant info:', error);
    return null;
  }
}

// Maximum payload size: 10MB
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication first
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      console.log('Authentication failed:', authResult.error);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authResult.userId;
    console.log('Authenticated user:', userId);

    // Check payload size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request payload too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();

    // Validate based on action type
    if (rawBody.action === 'export') {
      const parseResult = ExportRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, resources, exportJobId } = parseResult.data;

      // Create Supabase client to update job progress
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify the export job belongs to the authenticated user
      const { data: jobData, error: jobError } = await supabase
        .from('export_jobs')
        .select('user_id')
        .eq('id', exportJobId)
        .single();

      if (jobError || !jobData || jobData.user_id !== userId) {
        console.error('Export job verification failed:', jobError);
        return new Response(
          JSON.stringify({ error: 'Export job not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update job status to running
      await supabase
        .from('export_jobs')
        .update({ status: 'running', progress: 0 })
        .eq('id', exportJobId);

      const results: Array<{
        resource: string;
        success: boolean;
        error?: string;
      }> = [];

      let completed = 0;
      const total = resources.length;

      for (const resource of resources) {
        const endpoint = GRAPH_ENDPOINTS[resource];
        
        if (!endpoint) {
          results.push({
            resource,
            success: false,
            error: 'Unknown resource type',
          });
          completed++;
          continue;
        }

        try {
          const data = await fetchGraphData(accessToken, endpoint);
          results.push({
            resource,
            success: true,
          });

          // Store in database
          const resourceParts = resource.split('/');
          await supabase
            .from('exported_resources')
            .insert({
              export_job_id: exportJobId,
              category: resourceParts[0],
              resource_type: resourceParts[1],
              data: data.value || data,
            });

        } catch (error: unknown) {
          results.push({
            resource,
            success: false,
            error: sanitizeError(error),
          });
        }

        completed++;
        const progress = Math.round((completed / total) * 100);
        
        // Update progress
        await supabase
          .from('export_jobs')
          .update({ progress })
          .eq('id', exportJobId);
      }

      // Mark job as completed
      const hasErrors = results.some(r => !r.success);
      await supabase
        .from('export_jobs')
        .update({
          status: hasErrors ? 'completed_with_errors' : 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          metadata: { results },
        })
        .eq('id', exportJobId);

      return new Response(
        JSON.stringify({
          success: true,
          results,
          completed,
          total,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle auth actions (get-token, test-connection)
    const parseResult = AuthRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, tenantId, clientId, clientSecret } = parseResult.data;

    const tokenResult = await getAccessToken(tenantId, clientId, clientSecret);
    
    if ('error' in tokenResult) {
      return new Response(
        JSON.stringify({ error: tokenResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If testing connection, also get tenant info
    if (action === 'test-connection') {
      const tenantInfo = await getTenantInfo(tokenResult.token);
      return new Response(
        JSON.stringify({
          success: true,
          tenantName: tenantInfo?.displayName || 'Unknown',
          tenantId: tenantInfo?.tenantId || tenantId,
          accessToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        accessToken: tokenResult.token,
        expiresIn: tokenResult.expiresIn,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
