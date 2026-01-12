import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface AuthRequest {
  action: 'get-token' | 'test-connection';
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface ExportRequest {
  action: 'export';
  accessToken: string;
  resources: string[];
  exportJobId: string;
}

type RequestBody = AuthRequest | ExportRequest;

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
      console.error('Token error:', data);
      return { error: data.error_description || data.error || 'Failed to get access token' };
    }

    return {
      token: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error: unknown) {
    console.error('Token fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Failed to connect: ${errorMessage}` };
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
        throw new Error(errorData.error?.message || `API error: ${betaResponse.status}`);
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

    const body: RequestBody = await req.json();

    if (body.action === 'get-token' || body.action === 'test-connection') {
      const authBody = body as AuthRequest;
      const { tenantId, clientId, clientSecret } = authBody;

      if (!tenantId || !clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: 'Missing required credentials' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResult = await getAccessToken(tenantId, clientId, clientSecret);
      
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ error: tokenResult.error }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If testing connection, also get tenant info
      if (body.action === 'test-connection') {
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
    }

    if (body.action === 'export') {
      const exportBody = body as ExportRequest;
      const { accessToken, resources, exportJobId } = exportBody;

      if (!accessToken || !resources || !exportJobId) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          JSON.stringify({ error: 'Unauthorized: Export job not found or access denied' }),
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
        data?: any;
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
            error: `Unknown resource type: ${resource}`,
          });
          completed++;
          continue;
        }

        try {
          const data = await fetchGraphData(accessToken, endpoint);
          results.push({
            resource,
            success: true,
            data: data.value || data,
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            resource,
            success: false,
            error: errorMessage,
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
          status: hasErrors ? 'completed' : 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          metadata: { results: results.map(r => ({ resource: r.resource, success: r.success, error: r.error })) },
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

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});