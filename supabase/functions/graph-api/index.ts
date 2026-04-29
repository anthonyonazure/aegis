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

// Schema for using stored credentials
const StoredCredentialRequestSchema = z.object({
  action: z.enum(['get-token-from-stored', 'refresh-token']),
  tenantConnectionId: z.string().uuid('Invalid connection ID format'),
});

const ExportRequestSchema = z.object({
  action: z.literal('export'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  resources: z.array(z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource format')).min(1, 'At least one resource required').max(100, 'Too many resources'),
  exportJobId: z.string().uuid('Invalid export job ID format'),
});

// Schema for proxy requests - raw Graph API endpoint passthrough
const ProxyRequestSchema = z.object({
  action: z.literal('proxy'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  endpoint: z.string().min(1, 'Endpoint required').max(2000, 'Endpoint too long').refine(
    (val) => val.startsWith('/'),
    'Endpoint must start with /'
  ),
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']).optional().default('GET'),
  body: z.any().optional(),
});

// Schema for fetching policies without storing (for Policy Browser)
const FetchRequestSchema = z.object({
  action: z.literal('fetch'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  resources: z.array(z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource format')).min(1, 'At least one resource required').max(100, 'Too many resources'),
});

// Schema for import requests
const ImportRequestSchema = z.object({
  action: z.literal('import'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  importJobId: z.string().uuid('Invalid import job ID format'),
  dryRun: z.boolean().optional().default(false),
  resources: z.array(z.object({
    resourceType: z.string().min(1),
    resourceName: z.string().optional(),
    data: z.record(z.any()),
  })).min(1, 'At least one resource required').max(100, 'Too many resources'),
});

// Schema for rollback requests
const RollbackRequestSchema = z.object({
  action: z.literal('rollback'),
  accessToken: z.string().min(1, 'Access token required').max(10000, 'Access token too long'),
  importJobId: z.string().uuid('Invalid import job ID format'),
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

  // API status codes (we throw errors like "API_ERROR_403")
  if (errorMessage.includes('API_ERROR_400') || errorMessage.includes('BadRequest')) {
    return 'Bad request. This resource may not be supported by the API or requires different parameters.';
  }
  if (errorMessage.includes('API_ERROR_401') || errorMessage.toLowerCase().includes('unauthorized')) {
    return 'Unauthorized. Please refresh your session and try again.';
  }
  if (errorMessage.includes('API_ERROR_403') || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Check your API permissions in Azure AD.';
  }
  if (errorMessage.includes('API_ERROR_404') || errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'Resource not found. The requested data may not exist.';
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return 'Request timed out. Please try again.';
  }
  if (errorMessage.includes('API_ERROR_429') || errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return 'Rate limited. Please wait and try again.';
  }

  // Generic fallback
  return 'An error occurred. Please try again or contact support.';
}

// Microsoft Graph API endpoints for different resource types
// Each includes endpoints for reading (GET) and creating (POST)
const GRAPH_ENDPOINTS: Record<string, { endpoint: string; useBeta?: boolean; createEndpoint?: string; method?: 'POST' | 'PUT' | 'PATCH'; supportsImport?: boolean }> = {
  // Intune
  'intune/device-configurations': { endpoint: '/deviceManagement/deviceConfigurations', createEndpoint: '/deviceManagement/deviceConfigurations', supportsImport: true },
  'intune/compliance-policies': { endpoint: '/deviceManagement/deviceCompliancePolicies', createEndpoint: '/deviceManagement/deviceCompliancePolicies', supportsImport: true },
  'intune/app-configurations': { endpoint: '/deviceAppManagement/mobileAppConfigurations', useBeta: true, supportsImport: false },
  'intune/autopilot': { endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles', createEndpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles', supportsImport: true },
  'intune/enrollment-restrictions': { endpoint: '/deviceManagement/deviceEnrollmentConfigurations', supportsImport: false },
  'intune/scripts': { endpoint: '/deviceManagement/deviceManagementScripts', createEndpoint: '/deviceManagement/deviceManagementScripts', supportsImport: true },
  'intune/win32-apps': { endpoint: '/deviceAppManagement/mobileApps', supportsImport: false },
  'intune/update-rings': { endpoint: '/deviceManagement/deviceConfigurations', supportsImport: false },

  // Conditional Access
  'conditional-access/ca-policies': { endpoint: '/identity/conditionalAccess/policies', createEndpoint: '/identity/conditionalAccess/policies', supportsImport: true },
  'conditional-access/named-locations': { endpoint: '/identity/conditionalAccess/namedLocations', createEndpoint: '/identity/conditionalAccess/namedLocations', supportsImport: true },
  'conditional-access/auth-contexts': { endpoint: '/identity/conditionalAccess/authenticationContextClassReferences', supportsImport: false },
  'conditional-access/auth-strengths': { endpoint: '/identity/conditionalAccess/authenticationStrengths/policies', supportsImport: false },

  // Entra ID
  'entra-id/groups': { endpoint: '/groups', createEndpoint: '/groups', supportsImport: true },
  'entra-id/app-registrations': { endpoint: '/applications', createEndpoint: '/applications', supportsImport: true },
  'entra-id/enterprise-apps': { endpoint: '/servicePrincipals', supportsImport: false },
  'entra-id/directory-settings': { endpoint: '/settings', supportsImport: false },
  'entra-id/admin-units': { endpoint: '/administrativeUnits', createEndpoint: '/administrativeUnits', supportsImport: true },
  'entra-id/roles': { endpoint: '/directoryRoles', supportsImport: false },
  'entra-id/auth-methods-policy': { endpoint: '/policies/authenticationMethodsPolicy', supportsImport: false },
  'entra-id/cross-tenant-access': { endpoint: '/policies/crossTenantAccessPolicy', supportsImport: false },
  'entra-id/permission-grant-policies': { endpoint: '/policies/permissionGrantPolicies', supportsImport: false },

  // Defender - Using configurationPolicies with $expand to get settings
  // These endpoints fetch actual deployed policies, not template definitions
  'defender/asr-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true, supportsImport: false },
  'defender/antivirus-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true, supportsImport: false },
  'defender/firewall-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true, supportsImport: false },
  'defender/edr-policies': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true, supportsImport: false },
  // Security baselines: fetch deployed policies based on security baseline templates (not the template catalog)
  'defender/security-baselines': { endpoint: '/deviceManagement/configurationPolicies?$expand=settings', useBeta: true, supportsImport: false },

  // Purview / Information Protection (requires E5 license)
  'purview/sensitivity-labels': { endpoint: '/security/informationProtection/sensitivityLabels', useBeta: true, supportsImport: false },
  'purview/retention-policies': { endpoint: '/security/labels/retentionLabels', useBeta: true, supportsImport: false },

  // Exchange Online - EXO-backed resources are handled by email-security edge function
  // Only keep Graph-backed exchange endpoints here
  'exchange/accepted-domains': { endpoint: '/domains', supportsImport: false },

  // SharePoint & OneDrive - Graph API supported endpoints
  'sharepoint/tenant-settings': { endpoint: '/sites/root', useBeta: false, supportsImport: false },
  'sharepoint/sharing-policies': { endpoint: '/sites/root/permissions', useBeta: false, supportsImport: false },
  'sharepoint/site-templates': { endpoint: '/sites?search=*&$select=id,displayName,webUrl', useBeta: false, supportsImport: false },
  'sharepoint/hub-sites': { endpoint: '/sites?$filter=isHubSite eq true&$select=id,displayName,webUrl', useBeta: false, supportsImport: false },
  // PowerShell-only SharePoint resources (require Azure Automation)
  'sharepoint/access-control': { endpoint: '/sites/root', useBeta: false, supportsImport: false }, // Limited via Graph
  'sharepoint/storage-quota': { endpoint: '/sites/root', useBeta: false, supportsImport: false }, // Limited via Graph
  'sharepoint/onedrive-settings': { endpoint: '/sites/root', useBeta: false, supportsImport: false }, // Limited via Graph

  // Teams - Graph API supported endpoints
  'teams/messaging-policies': { endpoint: '/teams', useBeta: false, supportsImport: false },
  'teams/meeting-policies': { endpoint: '/solutions/virtualEvents/webinars', useBeta: true, supportsImport: false },
  'teams/app-policies': { endpoint: '/appCatalogs/teamsApps', useBeta: false, supportsImport: false },
  'teams/calling-policies': { endpoint: '/communications/callRecords', useBeta: true, supportsImport: false },
  'teams/live-event-policies': { endpoint: '/solutions/virtualEvents/townhalls', useBeta: true, supportsImport: false },
  // Graph beta Teams settings endpoints (previously PowerShell-only)
  'teams/guest-policies': { endpoint: '/teamwork/teamSettings', useBeta: true, supportsImport: false },
  'teams/external-access': { endpoint: '/teamwork/teamSettings', useBeta: true, supportsImport: false },
  // PowerShell-only Teams resources (require Azure Automation)
  'teams/app-setup-policies': { endpoint: '/appCatalogs/teamsApps', useBeta: false, supportsImport: false }, // Limited via Graph
  'teams/channel-policies': { endpoint: '/teams', useBeta: false, supportsImport: false }, // Limited via Graph

  // Licensing - Graph API supported
  'licensing/subscribed-skus': { endpoint: '/subscribedSkus', useBeta: false, supportsImport: false },
  'licensing/user-licenses': { endpoint: '/users?$select=id,displayName,userPrincipalName,assignedLicenses&$top=999', useBeta: false, supportsImport: false },
  'licensing/group-licenses': { endpoint: '/groups?$select=id,displayName,assignedLicenses&$top=999', useBeta: false, supportsImport: false },
  'licensing/service-plans': { endpoint: '/subscribedSkus', useBeta: false, supportsImport: false }, // Service plans are part of SKUs
  'licensing/license-details': { endpoint: '/subscribedSkus', useBeta: false, supportsImport: false }, // Detailed license info

  // License Optimization - Graph API reports (beta)
  'license-optimization/inactive-users': { endpoint: '/reports/getOffice365ActiveUserDetail(period=\'D30\')', useBeta: true, supportsImport: false },
  'license-optimization/duplicate-licenses': { endpoint: '/users?$select=id,displayName,assignedLicenses&$top=999', useBeta: false, supportsImport: false },
  'license-optimization/unused-services': { endpoint: '/reports/getOffice365ServicesUserCounts(period=\'D30\')', useBeta: true, supportsImport: false },
  'license-optimization/license-utilization': { endpoint: '/reports/getOffice365ActiveUserCounts(period=\'D30\')', useBeta: true, supportsImport: false },
  'license-optimization/mailbox-usage': { endpoint: '/reports/getMailboxUsageDetail(period=\'D30\')', useBeta: true, supportsImport: false },
  'license-optimization/onedrive-usage': { endpoint: '/reports/getOneDriveUsageAccountDetail(period=\'D30\')', useBeta: true, supportsImport: false },
  'license-optimization/teams-usage': { endpoint: '/reports/getTeamsUserActivityUserDetail(period=\'D30\')', useBeta: true, supportsImport: false },

  // Copilot
  'copilot/copilot-licenses': { endpoint: '/subscribedSkus', useBeta: false, supportsImport: false }, // Filter for Copilot SKUs client-side
  'copilot/copilot-usage': { endpoint: '/reports/getMicrosoft365CopilotUsageUserDetail(period=\'D30\')', useBeta: true, supportsImport: false },
  'copilot/copilot-readiness': { endpoint: '/deviceManagement/userExperienceAnalyticsDeviceScopes', useBeta: true, supportsImport: false },
  'copilot/copilot-plugins': { endpoint: '/appCatalogs/teamsApps?$filter=distributionMethod eq \'organization\'', useBeta: false, supportsImport: false },
};

// Prepare resource data for import by removing read-only properties
function prepareResourceForImport(resourceType: string, data: Record<string, any>): Record<string, any> {
  // Common read-only properties to remove
  const readOnlyProps = [
    'id', 
    'createdDateTime', 
    'modifiedDateTime', 
    'lastModifiedDateTime',
    'createdBy',
    'lastModifiedBy',
    'version',
    '@odata.context',
    '@odata.type',
    '@odata.id',
  ];

  const cleaned: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip read-only properties
    if (readOnlyProps.includes(key)) continue;
    // Skip null values
    if (value === null) continue;
    // Keep the property
    cleaned[key] = value;
  }

  // Add @odata.type back for certain resource types that require it
  if (resourceType.includes('conditional-access') || resourceType.includes('intune')) {
    if (data['@odata.type']) {
      cleaned['@odata.type'] = data['@odata.type'];
    }
  }

  return cleaned;
}

// Create a resource via Graph API
async function createGraphResource(
  accessToken: string, 
  endpoint: string, 
  data: Record<string, any>,
  useBeta: boolean = false
): Promise<{ success: boolean; data?: any; error?: string }> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const graphUrl = `${baseUrl}${endpoint}`;

  try {
    console.log(`Creating resource at ${graphUrl}`);
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Graph API create error:', JSON.stringify(responseData));
      const errorMessage = responseData.error?.message || `API_ERROR_${response.status}`;
      return { success: false, error: errorMessage };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error(`Error creating resource at ${endpoint}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Delete a resource via Graph API
async function deleteGraphResource(
  accessToken: string, 
  endpoint: string, 
  resourceId: string,
  useBeta: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const graphUrl = `${baseUrl}${endpoint}/${resourceId}`;

  try {
    console.log(`Deleting resource at ${graphUrl}`);
    const response = await fetch(graphUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // 204 No Content is success for DELETE
    if (response.status === 204 || response.ok) {
      return { success: true };
    }

    const responseData = await response.json().catch(() => ({}));
    console.error('Graph API delete error:', JSON.stringify(responseData));
    const errorMessage = responseData.error?.message || `API_ERROR_${response.status}`;
    return { success: false, error: errorMessage };
  } catch (error) {
    console.error(`Error deleting resource at ${endpoint}/${resourceId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

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

async function fetchGraphData(accessToken: string, endpoint: string, useBeta: boolean = false): Promise<any> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const initialUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const fetchJson = async (url: string): Promise<any> => {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Graph API error (full details):', JSON.stringify(errorData));
      throw new Error(`API_ERROR_${response.status}`);
    }

    return await response.json();
  };

  const fetchAllPages = async (url: string): Promise<any> => {
    // Graph collections return { value: [], "@odata.nextLink": "..." }
    // If we don't follow nextLink, exports are incomplete -> false "removed" drift.
    const MAX_PAGES = 50;

    let nextUrl: string | undefined = url;
    let page = 0;

    let combined: any | null = null;
    const allValues: any[] = [];

    while (nextUrl && page < MAX_PAGES) {
      const data = await fetchJson(nextUrl);

      // Non-collection response: return directly
      if (!data || !Array.isArray(data.value)) {
        return data;
      }

      combined = combined ?? { ...data };
      allValues.push(...data.value);

      nextUrl = data['@odata.nextLink'];
      page++;
    }

    if (!combined) return { value: allValues };

    // Replace with combined list and remove nextLink so downstream doesn't treat it as state.
    const { ['@odata.nextLink']: _ignored, ...rest } = combined;
    return {
      ...rest,
      '@odata.count': allValues.length,
      value: allValues,
    };
  };

  try {
    return await fetchAllPages(initialUrl);
  } catch (error) {
    // Try beta endpoint if v1.0 fails and we didn't already try beta
    if (!useBeta) {
      const betaUrl = endpoint.startsWith('http')
        ? endpoint.replace('graph.microsoft.com/v1.0', 'graph.microsoft.com/beta')
        : `https://graph.microsoft.com/beta${endpoint}`;

      return await fetchAllPages(betaUrl);
    }

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
        // Check if job was cancelled before processing each resource
        const { data: jobStatus } = await supabase
          .from('export_jobs')
          .select('status')
          .eq('id', exportJobId)
          .single();
        
        if (jobStatus?.status === 'cancelled') {
          console.log('Export job cancelled by user');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Export cancelled by user',
              results 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const endpointConfig = GRAPH_ENDPOINTS[resource];
        
        if (!endpointConfig) {
          results.push({
            resource,
            success: false,
            error: 'Unknown resource type',
          });
          completed++;
          continue;
        }

        try {
          const data = await fetchGraphData(accessToken, endpointConfig.endpoint, endpointConfig.useBeta);
          results.push({
            resource,
            success: true,
          });

          // Store in database - extract resource details from response
          const resourceParts = resource.split('/');
          const resourceData = data.value || data;
          
          // Extract name and ID from the data (handles both single objects and arrays)
          let resourceName: string | null = null;
          let resourceId: string | null = null;
          
          if (Array.isArray(resourceData)) {
            // For arrays, store a summary
            resourceName = `${resourceData.length} ${resourceParts[1]} items`;
            resourceId = exportJobId; // Use job ID as reference
          } else if (typeof resourceData === 'object' && resourceData !== null) {
            // For single objects, extract name and ID
            resourceName = resourceData.displayName || resourceData.name || resourceData.title || resourceData.webUrl || null;
            resourceId = resourceData.id || null;
          }
          
          await supabase
            .from('exported_resources')
            .insert({
              export_job_id: exportJobId,
              category: resourceParts[0],
              resource_type: resourceParts[1],
              resource_name: resourceName,
              resource_id: resourceId,
              data: resourceData,
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
        
        // Update progress with current resource info
        await supabase
          .from('export_jobs')
          .update({ 
            progress,
            metadata: { 
              currentResource: resource,
              completed,
              total,
              lastUpdate: new Date().toISOString()
            }
          })
          .eq('id', exportJobId);
      }

      // Mark job as completed (status values must match DB constraint)
      const hasErrors = results.some(r => !r.success);

      const completionUpdate = {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          results,
          completed,
          total,
          currentResource: null,
          lastUpdate: new Date().toISOString(),
        },
        error: hasErrors ? 'Completed with errors. See results in metadata.' : null,
      };

      const { error: completionError } = await supabase
        .from('export_jobs')
        .update(completionUpdate)
        .eq('id', exportJobId);

      if (completionError) {
        console.error('Failed to finalize export job:', completionError);
        await supabase
          .from('export_jobs')
          .update({
            status: 'failed',
            error: 'Failed to finalize export job. Please try again.',
          })
          .eq('id', exportJobId);
      }

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

    // Handle proxy action - raw Graph API endpoint passthrough
    if (rawBody.action === 'proxy') {
      const parseResult = ProxyRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Proxy validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid proxy request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, endpoint, method, body: reqBody } = parseResult.data;

      // Determine base URL (beta vs v1.0 based on endpoint content)
      const useBeta = endpoint.includes('identityProtection') || endpoint.includes('security/alerts_v2');
      const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
      const graphUrl = `${baseUrl}${endpoint}`;

      console.log(`Proxy ${method} ${graphUrl}`);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (reqBody && method !== 'GET') {
        fetchOptions.body = JSON.stringify(reqBody);
      }

      const response = await fetch(graphUrl, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `API_ERROR_${response.status}`;
        console.error(`Proxy Graph API error:`, errorMessage);
        return new Response(
          JSON.stringify({ error: sanitizeError(errorMessage), value: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle fetch action - retrieve policies without storing (for Policy Browser)
    if (rawBody.action === 'fetch') {
      const parseResult = FetchRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, resources } = parseResult.data;

      console.log(`Fetch request for ${resources.length} resource types (no storage)`);

      const results: Array<{
        resource: string;
        success: boolean;
        data?: any;
        error?: string;
      }> = [];

      for (const resource of resources) {
        const endpointConfig = GRAPH_ENDPOINTS[resource];
        if (!endpointConfig) {
          results.push({ resource, success: false, error: `Unknown resource type: ${resource}` });
          continue;
        }

        try {
          const baseUrl = endpointConfig.useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
          const graphUrl = `${baseUrl}${endpointConfig.endpoint}`;

          console.log(`Fetching ${resource} from ${graphUrl}`);

          const response = await fetch(graphUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `API_ERROR_${response.status}`;
            console.error(`Graph API error for ${resource}:`, errorMessage);
            results.push({ resource, success: false, error: sanitizeError(errorMessage) });
            continue;
          }

          const data = await response.json();
          results.push({ resource, success: true, data });
        } catch (error) {
          console.error(`Error fetching ${resource}:`, error);
          results.push({ resource, success: false, error: sanitizeError(error) });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle import action - create/update resources via Graph API
    if (rawBody.action === 'import') {
      const parseResult = ImportRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, importJobId, resources, dryRun } = parseResult.data;

      console.log(`Import request: ${resources.length} resources, dryRun=${dryRun}`);

      // Create Supabase client to update job progress
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify the import job belongs to the authenticated user
      const { data: jobData, error: jobError } = await supabase
        .from('import_jobs')
        .select('user_id')
        .eq('id', importJobId)
        .single();

      if (jobError || !jobData || jobData.user_id !== userId) {
        console.error('Import job verification failed:', jobError);
        return new Response(
          JSON.stringify({ error: 'Import job not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: Array<{
        resource: string;
        resourceName: string;
        success: boolean;
        error?: string;
        createdId?: string;
        validationErrors?: string[];
        dryRun?: boolean;
      }> = [];

      const errors: Array<{ resource: string; error: string }> = [];
      let imported = 0;
      let validated = 0;
      const total = resources.length;

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const resourceKey = resource.resourceType;
        const resourceName = resource.resourceName || 'Unknown';
        const endpointConfig = GRAPH_ENDPOINTS[resourceKey];

        // Check if import is supported for this resource type
        if (!endpointConfig) {
          const errorMsg = `Unknown resource type: ${resourceKey}`;
          results.push({ resource: resourceKey, resourceName, success: false, error: errorMsg, dryRun });
          errors.push({ resource: `${resourceKey}/${resourceName}`, error: errorMsg });
          continue;
        }

        if (!endpointConfig.supportsImport || !endpointConfig.createEndpoint) {
          const errorMsg = `Import not supported for resource type: ${resourceKey}`;
          results.push({ resource: resourceKey, resourceName, success: false, error: errorMsg, dryRun });
          errors.push({ resource: `${resourceKey}/${resourceName}`, error: errorMsg });
          continue;
        }

        try {
          // Prepare the data by removing read-only properties
          const cleanedData = prepareResourceForImport(resourceKey, resource.data);
          
          // Validate the data structure
          const validationErrors: string[] = [];
          
          // Basic validation checks
          if (Object.keys(cleanedData).length === 0) {
            validationErrors.push('Resource data is empty after cleaning read-only properties');
          }
          
          // Check for required fields based on resource type
          if (resourceKey.includes('conditional-access/ca-policies')) {
            if (!cleanedData.displayName) validationErrors.push('displayName is required');
            if (!cleanedData.state) validationErrors.push('state is required (enabled/disabled/enabledForReportingButNotEnforced)');
            if (!cleanedData.conditions) validationErrors.push('conditions object is required');
          } else if (resourceKey.includes('entra-id/groups')) {
            if (!cleanedData.displayName) validationErrors.push('displayName is required');
            if (!cleanedData.mailNickname) validationErrors.push('mailNickname is required');
            if (cleanedData.mailEnabled === undefined) validationErrors.push('mailEnabled is required');
            if (cleanedData.securityEnabled === undefined) validationErrors.push('securityEnabled is required');
          } else if (resourceKey.includes('entra-id/app-registrations')) {
            if (!cleanedData.displayName) validationErrors.push('displayName is required');
          } else if (resourceKey.includes('intune/device-configurations') || resourceKey.includes('intune/compliance-policies')) {
            if (!cleanedData.displayName) validationErrors.push('displayName is required');
            if (!cleanedData['@odata.type']) validationErrors.push('@odata.type is required for Intune policies');
          }

          if (dryRun) {
            // Dry run mode - just validate, don't create
            if (validationErrors.length > 0) {
              results.push({
                resource: resourceKey,
                resourceName,
                success: false,
                error: 'Validation failed',
                validationErrors,
                dryRun: true,
              });
              errors.push({ resource: `${resourceKey}/${resourceName}`, error: validationErrors.join('; ') });
            } else {
              validated++;
              results.push({
                resource: resourceKey,
                resourceName,
                success: true,
                dryRun: true,
              });
              console.log(`[DRY RUN] Validated ${resourceKey}/${resourceName} - ready for import`);
            }
          } else {
            // Actual import mode
            if (validationErrors.length > 0) {
              // Still try to import but log the warnings
              console.warn(`Validation warnings for ${resourceKey}/${resourceName}:`, validationErrors);
            }
            
            console.log(`Importing ${resourceKey}/${resourceName}...`);
            
            // Create the resource via Graph API
            const createResult = await createGraphResource(
              accessToken,
              endpointConfig.createEndpoint,
              cleanedData,
              endpointConfig.useBeta
            );

            if (createResult.success) {
              imported++;
              results.push({
                resource: resourceKey,
                resourceName,
                success: true,
                createdId: createResult.data?.id,
                dryRun: false,
              });
              console.log(`Successfully created ${resourceKey}/${resourceName}, ID: ${createResult.data?.id}`);
            } else {
              const errorMsg = createResult.error || 'Unknown error';
              results.push({ resource: resourceKey, resourceName, success: false, error: errorMsg, dryRun: false });
              errors.push({ resource: `${resourceKey}/${resourceName}`, error: errorMsg });
              console.error(`Failed to create ${resourceKey}/${resourceName}: ${errorMsg}`);
            }
          }
        } catch (error: unknown) {
          const errorMsg = sanitizeError(error);
          results.push({ resource: resourceKey, resourceName, success: false, error: errorMsg, dryRun });
          errors.push({ resource: `${resourceKey}/${resourceName}`, error: errorMsg });
          console.error(`Exception ${dryRun ? 'validating' : 'importing'} ${resourceKey}/${resourceName}:`, error);
        }

        // Update progress every resource (only for actual imports)
        if (!dryRun) {
          await supabase
            .from('import_jobs')
            .update({ 
              resources_imported: imported,
              resources_failed: errors.length,
            })
            .eq('id', importJobId);
        }
      }

      // For dry run, don't update the job status permanently
      if (dryRun) {
        // Delete the dry-run job since it was just for validation
        await supabase
          .from('import_jobs')
          .delete()
          .eq('id', importJobId);

        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            results,
            validated,
            failed: errors.length,
            total,
            status: errors.length === 0 ? 'valid' : errors.length === total ? 'invalid' : 'partial',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine final status
      let status = 'completed';
      if (errors.length === total) {
        status = 'failed';
      } else if (errors.length > 0) {
        status = 'partial';
      }

      // Collect created resource IDs for potential rollback
      const createdResources = results
        .filter(r => r.success && r.createdId && !r.dryRun)
        .map(r => ({
          resourceType: r.resource,
          resourceId: r.createdId,
          resourceName: r.resourceName,
        }));

      // Update job with final status and store created resources for rollback
      const { error: updateError } = await supabase
        .from('import_jobs')
        .update({
          status,
          resources_imported: imported,
          resources_failed: errors.length,
          errors: errors,
          completed_at: new Date().toISOString(),
          metadata: { 
            createdResources,
            canRollback: createdResources.length > 0,
          },
        })
        .eq('id', importJobId);

      if (updateError) {
        console.error('Failed to update import job:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          dryRun: false,
          results,
          imported,
          failed: errors.length,
          total,
          status,
          canRollback: createdResources.length > 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle rollback action - delete resources created during import
    if (rawBody.action === 'rollback') {
      const parseResult = RollbackRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, importJobId } = parseResult.data;

      // Create Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get import job with metadata
      const { data: jobData, error: jobError } = await supabase
        .from('import_jobs')
        .select('user_id, metadata, status')
        .eq('id', importJobId)
        .single();

      if (jobError || !jobData) {
        console.error('Import job not found:', jobError);
        return new Response(
          JSON.stringify({ error: 'Import job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (jobData.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const metadata = jobData.metadata as { 
        createdResources?: Array<{ resourceType: string; resourceId: string; resourceName: string }>;
        canRollback?: boolean;
      } | null;

      if (!metadata?.createdResources || metadata.createdResources.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No resources to rollback', canRollback: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Rolling back ${metadata.createdResources.length} resources...`);

      const rollbackResults: Array<{
        resourceType: string;
        resourceId: string;
        resourceName: string;
        success: boolean;
        error?: string;
      }> = [];

      let deleted = 0;
      const total = metadata.createdResources.length;

      for (const resource of metadata.createdResources) {
        const endpointConfig = GRAPH_ENDPOINTS[resource.resourceType];
        
        if (!endpointConfig || !endpointConfig.createEndpoint) {
          rollbackResults.push({
            ...resource,
            success: false,
            error: 'Unknown resource type or no delete endpoint',
          });
          continue;
        }

        try {
          const deleteResult = await deleteGraphResource(
            accessToken,
            endpointConfig.createEndpoint,
            resource.resourceId,
            endpointConfig.useBeta
          );

          if (deleteResult.success) {
            deleted++;
            rollbackResults.push({
              ...resource,
              success: true,
            });
            console.log(`Deleted ${resource.resourceType}/${resource.resourceName} (${resource.resourceId})`);
          } else {
            rollbackResults.push({
              ...resource,
              success: false,
              error: deleteResult.error,
            });
            console.error(`Failed to delete ${resource.resourceType}/${resource.resourceName}: ${deleteResult.error}`);
          }
        } catch (error: unknown) {
          const errorMsg = sanitizeError(error);
          rollbackResults.push({
            ...resource,
            success: false,
            error: errorMsg,
          });
          console.error(`Exception deleting ${resource.resourceType}/${resource.resourceName}:`, error);
        }
      }

      // Update job status to rolled back
      const rollbackStatus = deleted === total ? 'rolled_back' : 'rollback_partial';
      await supabase
        .from('import_jobs')
        .update({
          status: rollbackStatus,
          metadata: {
            ...metadata,
            rollbackResults,
            rollbackCompletedAt: new Date().toISOString(),
            canRollback: false,
          },
        })
        .eq('id', importJobId);

      return new Response(
        JSON.stringify({
          success: true,
          deleted,
          failed: total - deleted,
          total,
          results: rollbackResults,
          status: rollbackStatus,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle deploy-health-script action — create a deviceHealthScript in Intune
    if (rawBody.action === 'deploy-health-script') {
      const accessToken = rawBody.accessToken;
      const scriptPayload = rawBody.scriptPayload;

      if (!accessToken || typeof accessToken !== 'string' || accessToken.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Invalid access token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!scriptPayload || !scriptPayload.displayName || !scriptPayload.detectionScriptContent) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: displayName, detectionScriptContent' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Base64 encode the scripts for the Graph API
      const encoder = new TextEncoder();
      const body: Record<string, any> = {
        displayName: scriptPayload.displayName,
        description: scriptPayload.description || '',
        publisher: scriptPayload.publisher || 'Aegis MSP Manager',
        runAsAccount: scriptPayload.runAs === 'System' ? 'system' : 'user',
        runAs32Bit: scriptPayload.runAs32Bit || false,
        enforceSignatureCheck: false,
        detectionScriptContent: btoa(scriptPayload.detectionScriptContent),
      };

      if (scriptPayload.remediationScriptContent) {
        body.remediationScriptContent = btoa(scriptPayload.remediationScriptContent);
      }

      console.log(`Deploying health script: ${body.displayName}`);

      const result = await createGraphResource(
        accessToken,
        '/deviceManagement/deviceHealthScripts',
        body,
        true // use beta endpoint
      );

      if (!result.success) {
        return new Response(
          JSON.stringify({ error: sanitizeError(result.error || 'Failed to create health script') }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          scriptId: result.data?.id,
          displayName: result.data?.displayName,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle token refresh using stored credentials (no secret in request)
    if (rawBody.action === 'get-token-from-stored' || rawBody.action === 'refresh-token') {
      const parseResult = StoredCredentialRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { tenantConnectionId } = parseResult.data;
      
      // Get decrypted credentials from database using service role
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: credentials, error: credError } = await adminClient
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenantConnectionId,
          p_user_id: userId,
        });

      if (credError || !credentials || credentials.length === 0) {
        console.error('Failed to retrieve credentials:', credError);
        return new Response(
          JSON.stringify({ error: 'Credentials not found. Please re-authenticate.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];
      
      const tokenResult = await getAccessToken(tenant_id, client_id, client_secret);
      
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ error: tokenResult.error }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          accessToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
          fromStoredCredentials: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle auth actions (get-token, test-connection) - initial auth with credentials
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
