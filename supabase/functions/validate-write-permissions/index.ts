import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeBase64Url(input: string): string {
  // base64url -> base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

function safeParseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Required write permissions for each resource type
const WRITE_PERMISSION_REQUIREMENTS: Record<string, {
  permission: string;
  endpoint: string;
  description: string;
  useBeta?: boolean;
}> = {
  // Intune
  'intune/device-configurations': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/deviceConfigurations',
    description: 'Device Configuration Profiles',
  },
  'intune/compliance-policies': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/deviceCompliancePolicies',
    description: 'Compliance Policies',
  },
  'intune/app-configurations': {
    permission: 'DeviceManagementApps.ReadWrite.All',
    endpoint: '/deviceAppManagement/mobileAppConfigurations',
    description: 'App Configuration Policies',
  },
  'intune/autopilot': {
    permission: 'DeviceManagementServiceConfig.ReadWrite.All',
    endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles',
    description: 'Autopilot Profiles',
    useBeta: true,
  },
  'intune/scripts': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/deviceManagementScripts',
    description: 'PowerShell Scripts',
    useBeta: true,
  },
  'intune/enrollment-restrictions': {
    permission: 'DeviceManagementServiceConfig.ReadWrite.All',
    endpoint: '/deviceManagement/deviceEnrollmentConfigurations',
    description: 'Enrollment Restrictions',
  },

  // Conditional Access
  'conditional-access/ca-policies': {
    permission: 'Policy.ReadWrite.ConditionalAccess',
    endpoint: '/identity/conditionalAccess/policies',
    description: 'Conditional Access Policies',
  },
  'conditional-access/named-locations': {
    permission: 'Policy.ReadWrite.ConditionalAccess',
    endpoint: '/identity/conditionalAccess/namedLocations',
    description: 'Named Locations',
  },
  'conditional-access/auth-strengths': {
    permission: 'Policy.ReadWrite.AuthenticationMethod',
    endpoint: '/identity/conditionalAccess/authenticationStrength/policies',
    description: 'Authentication Strengths',
    useBeta: true,
  },

  // Entra ID
  'entra-id/groups': {
    permission: 'Group.ReadWrite.All',
    endpoint: '/groups',
    description: 'Groups',
  },
  'entra-id/app-registrations': {
    permission: 'Application.ReadWrite.All',
    endpoint: '/applications',
    description: 'App Registrations',
  },
  'entra-id/admin-units': {
    permission: 'AdministrativeUnit.ReadWrite.All',
    endpoint: '/administrativeUnits',
    description: 'Administrative Units',
  },
  'entra-id/directory-settings': {
    permission: 'Directory.ReadWrite.All',
    endpoint: '/groupSettings',
    description: 'Directory Settings',
    useBeta: true,
  },

  // Defender
  'defender/asr-policies': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/intents',
    description: 'Attack Surface Reduction',
    useBeta: true,
  },
  'defender/antivirus-policies': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/intents',
    description: 'Antivirus Policies',
    useBeta: true,
  },
  'defender/firewall-policies': {
    permission: 'DeviceManagementConfiguration.ReadWrite.All',
    endpoint: '/deviceManagement/intents',
    description: 'Firewall Policies',
    useBeta: true,
  },
};

interface ValidationRequest {
  tenantConnectionId: string;
  resourceTypes: string[];
}

interface WritePermissionResult {
  resourceType: string;
  resourceName: string;
  requiredPermission: string;
  hasPermission: boolean;
  error?: string;
  statusCode?: number;
  useBeta?: boolean;
}

interface ValidationResponse {
  success: boolean;
  results: WritePermissionResult[];
  missingPermissions: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  debug?: {
    tenantConnectionId: string;
    credentialClientId?: string;
    tokenTenantId?: string;
    tokenAppId?: string;
    tokenRolesCount?: number;
    tokenRolesSample?: string[];
    allRoles?: string[];
  };
}

async function getGraphAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token acquisition failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testWritePermission(
  accessToken: string,
  resourceType: string,
  config: typeof WRITE_PERMISSION_REQUIREMENTS[string]
): Promise<WritePermissionResult> {
  const apiVersion = config.useBeta ? 'beta' : 'v1.0';
  const url = `https://graph.microsoft.com/${apiVersion}${config.endpoint}?$top=1`;
  
  try {
    // First, test if we can read (which is a baseline)
    const readResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      let errorMessage = `HTTP ${readResponse.status}`;
      
      try {
        const errorBody = JSON.parse(errorText);
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // Keep the status code message
      }

      // Check if error indicates missing write permission
      const hasReadOnlyPermission = errorMessage.includes('ReadWrite') || 
        readResponse.status === 403;

      return {
        resourceType,
        resourceName: config.description,
        requiredPermission: config.permission,
        hasPermission: false,
        error: errorMessage,
        statusCode: readResponse.status,
        useBeta: config.useBeta,
      };
    }

    // If read succeeds, determine write permission by inspecting token roles.
    // (We avoid attempting writes in preflight.)
    const payload = safeParseJwtPayload(accessToken);
    const roles = (payload?.roles as string[] | undefined) || [];
    const hasWritePermission = roles.includes(config.permission);

    // Also check for broader write permissions
    const hasAnyWrite = roles.some((role: string) =>
      role.includes('ReadWrite') && (
        role.startsWith(config.permission.split('.')[0]) ||
        role === 'Directory.ReadWrite.All'
      )
    );

    await readResponse.text(); // Consume body

    const ok = hasWritePermission || hasAnyWrite;
    return {
      resourceType,
      resourceName: config.description,
      requiredPermission: config.permission,
      hasPermission: ok,
      error: ok
        ? undefined
        : payload
          ? `Missing ${config.permission} (token roles did not include it)`
          : 'Could not inspect token roles (check application permissions + admin consent)',
      statusCode: 200,
      useBeta: config.useBeta,
    };
  } catch (error) {
    return {
      resourceType,
      resourceName: config.description,
      requiredPermission: config.permission,
      hasPermission: false,
      error: error instanceof Error ? error.message : 'Network error',
      useBeta: config.useBeta,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantConnectionId, resourceTypes } = await req.json() as ValidationRequest;

    if (!tenantConnectionId || !resourceTypes || resourceTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantConnectionId or resourceTypes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating write permissions for ${resourceTypes.length} resource types on tenant ${tenantConnectionId}`);

    // Get credentials
    const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
      p_tenant_connection_id: tenantConnectionId,
      p_user_id: user.id,
    });

    if (credError || !credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No credentials found for tenant',
          results: [],
          missingPermissions: [],
          summary: { total: 0, passed: 0, failed: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

     const cred = credentials[0];
     const accessToken = await getGraphAccessToken(cred.client_id, cred.client_secret, cred.tenant_id);

     const tokenPayload = safeParseJwtPayload(accessToken);
     const tokenRoles = (tokenPayload?.roles as string[] | undefined) || [];
     const tokenAppId = (tokenPayload?.appid as string | undefined) || (tokenPayload?.azp as string | undefined);
     const tokenTenantId = tokenPayload?.tid as string | undefined;

     console.log(
       `Token diagnostics: tenantId=${tokenTenantId || 'unknown'} appId=${tokenAppId || 'unknown'} roles=${tokenRoles.length}`
     );

    const results: WritePermissionResult[] = [];
    const missingPermissions = new Set<string>();

    // Test each resource type
    for (const resourceType of resourceTypes) {
      const config = WRITE_PERMISSION_REQUIREMENTS[resourceType];
      
      if (!config) {
        // Unknown resource type, skip
        results.push({
          resourceType,
          resourceName: resourceType,
          requiredPermission: 'Unknown',
          hasPermission: true, // Assume OK for unknown types
        });
        continue;
      }

      const result = await testWritePermission(accessToken, resourceType, config);
      results.push(result);

      if (!result.hasPermission) {
        missingPermissions.add(config.permission);
      }
    }

    const passed = results.filter(r => r.hasPermission).length;
    const failed = results.filter(r => !r.hasPermission).length;

    console.log(`Write permission check complete: ${passed} passed, ${failed} failed`);

     const response: ValidationResponse = {
      success: failed === 0,
      results,
      missingPermissions: Array.from(missingPermissions),
      summary: {
        total: results.length,
        passed,
        failed,
      },
       debug: {
         tenantConnectionId,
         credentialClientId: cred.client_id,
         tokenTenantId,
         tokenAppId,
         tokenRolesCount: tokenRoles.length,
         tokenRolesSample: tokenRoles.slice(0, 50), // Show all roles
         allRoles: tokenRoles, // Full list for debugging
       },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Write permission validation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
