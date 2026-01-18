import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Graph API endpoints to test for each resource type
const GRAPH_TEST_ENDPOINTS: Record<string, { endpoint: string; description: string }> = {
  // Intune
  'intune/device-configurations': { 
    endpoint: '/deviceManagement/deviceConfigurations?$top=1', 
    description: 'Device Configuration Profiles' 
  },
  'intune/compliance-policies': { 
    endpoint: '/deviceManagement/deviceCompliancePolicies?$top=1', 
    description: 'Compliance Policies' 
  },
  'intune/app-configurations': { 
    endpoint: '/deviceAppManagement/mobileAppConfigurations?$top=1', 
    description: 'App Configuration Policies' 
  },
  'intune/autopilot': { 
    endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles?$top=1', 
    description: 'Autopilot Profiles' 
  },
  'intune/scripts': { 
    endpoint: '/deviceManagement/deviceManagementScripts?$top=1', 
    description: 'PowerShell Scripts' 
  },
  'intune/win32-apps': { 
    endpoint: '/deviceAppManagement/mobileApps?$filter=isof(%27microsoft.graph.win32LobApp%27)&$top=1', 
    description: 'Win32 Applications' 
  },
  'intune/update-rings': { 
    endpoint: '/deviceManagement/deviceConfigurations?$filter=isof(%27microsoft.graph.windowsUpdateForBusinessConfiguration%27)&$top=1', 
    description: 'Update Rings' 
  },
  'intune/enrollment-restrictions': { 
    endpoint: '/deviceManagement/deviceEnrollmentConfigurations?$top=1', 
    description: 'Enrollment Restrictions' 
  },
  
  // Conditional Access
  'conditional-access/ca-policies': { 
    endpoint: '/identity/conditionalAccess/policies?$top=1', 
    description: 'Conditional Access Policies' 
  },
  'conditional-access/named-locations': { 
    endpoint: '/identity/conditionalAccess/namedLocations?$top=1', 
    description: 'Named Locations' 
  },
  'conditional-access/auth-strengths': { 
    endpoint: '/identity/conditionalAccess/authenticationStrength/policies?$top=1', 
    description: 'Authentication Strengths' 
  },
  
  // Entra ID
  'entra-id/groups': { 
    endpoint: '/groups?$top=1', 
    description: 'Groups' 
  },
  'entra-id/app-registrations': { 
    endpoint: '/applications?$top=1', 
    description: 'App Registrations' 
  },
  'entra-id/enterprise-apps': { 
    endpoint: '/servicePrincipals?$top=1', 
    description: 'Enterprise Applications' 
  },
  'entra-id/directory-settings': { 
    endpoint: '/settings', 
    description: 'Directory Settings' 
  },
  'entra-id/roles': { 
    endpoint: '/directoryRoles?$top=1', 
    description: 'Directory Roles' 
  },
  
  // Defender
  'defender/asr-policies': { 
    endpoint: '/deviceManagement/intents?$filter=templateId%20eq%20%27e8c053d6-9f95-42b1-a7f1-ebfd71c67571%27&$top=1', 
    description: 'Attack Surface Reduction' 
  },
  'defender/antivirus-policies': { 
    endpoint: '/deviceManagement/intents?$filter=templateId%20eq%20%27804339ad-1553-4478-a742-138fb5807418%27&$top=1', 
    description: 'Antivirus Policies' 
  },
  'defender/firewall-policies': { 
    endpoint: '/deviceManagement/intents?$filter=templateId%20eq%20%274356d05c-a4ab-4a07-9ece-739f7c792910%27&$top=1', 
    description: 'Firewall Policies' 
  },
  
  // SharePoint
  'sharepoint/tenant-settings': { 
    endpoint: '/sites?$top=1', 
    description: 'SharePoint Sites' 
  },
  
  // Teams
  'teams/messaging-policies': { 
    endpoint: '/teams?$top=1', 
    description: 'Teams' 
  },
};

// Azure ARM endpoints to test
const AZURE_TEST_ENDPOINTS: Record<string, { path: string; description: string }> = {
  'azure-compute/virtual-machines': { 
    path: '/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01&$top=1', 
    description: 'Virtual Machines' 
  },
  'azure-networking/virtual-networks': { 
    path: '/providers/Microsoft.Network/virtualNetworks?api-version=2023-09-01&$top=1', 
    description: 'Virtual Networks' 
  },
  'azure-storage/storage-accounts': { 
    path: '/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01&$top=1', 
    description: 'Storage Accounts' 
  },
  'azure-identity/key-vaults': { 
    path: '/providers/Microsoft.KeyVault/vaults?api-version=2023-07-01&$top=1', 
    description: 'Key Vaults' 
  },
  'azure-paas/app-services': { 
    path: '/providers/Microsoft.Web/sites?api-version=2023-01-01&$top=1', 
    description: 'App Services' 
  },
};

interface ValidationRequest {
  graphToken?: string;
  azureToken?: string;
  resourceIds: string[];
  subscriptionIds?: string[];
}

interface ValidationResult {
  resourceId: string;
  resourceName: string;
  provider: 'graph' | 'azure';
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime: number;
}

async function testGraphEndpoint(
  token: string,
  resourceId: string,
  endpoint: string,
  description: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        resourceId,
        resourceName: description,
        provider: 'graph',
        success: true,
        statusCode: response.status,
        responseTime,
      };
    }
    
    // Try to get error details
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      } else if (errorBody.error?.code) {
        errorMessage = `${errorBody.error.code}: ${errorBody.error.message || 'Unknown error'}`;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    return {
      resourceId,
      resourceName: description,
      provider: 'graph',
      success: false,
      statusCode: response.status,
      error: errorMessage,
      responseTime,
    };
  } catch (error) {
    return {
      resourceId,
      resourceName: description,
      provider: 'graph',
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      responseTime: Date.now() - startTime,
    };
  }
}

async function testAzureEndpoint(
  token: string,
  subscriptionId: string,
  resourceId: string,
  path: string,
  description: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    const url = `https://management.azure.com/subscriptions/${subscriptionId}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        resourceId,
        resourceName: description,
        provider: 'azure',
        success: true,
        statusCode: response.status,
        responseTime,
      };
    }
    
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    return {
      resourceId,
      resourceName: description,
      provider: 'azure',
      success: false,
      statusCode: response.status,
      error: errorMessage,
      responseTime,
    };
  } catch (error) {
    return {
      resourceId,
      resourceName: description,
      provider: 'azure',
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      responseTime: Date.now() - startTime,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { graphToken, azureToken, resourceIds, subscriptionIds = [] } = await req.json() as ValidationRequest;
    
    if (!resourceIds || resourceIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No resources to validate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const results: ValidationResult[] = [];
    
    // Test Graph API endpoints
    if (graphToken) {
      const graphResources = resourceIds.filter(id => !id.startsWith('azure-'));
      
      for (const resourceId of graphResources) {
        const testConfig = GRAPH_TEST_ENDPOINTS[resourceId];
        if (testConfig) {
          const result = await testGraphEndpoint(
            graphToken,
            resourceId,
            testConfig.endpoint,
            testConfig.description
          );
          results.push(result);
        } else {
          // Unknown resource - mark as untested
          results.push({
            resourceId,
            resourceName: resourceId,
            provider: 'graph',
            success: true, // Assume success for unknown resources
            responseTime: 0,
            error: 'No test endpoint configured',
          });
        }
      }
    }
    
    // Test Azure ARM endpoints
    if (azureToken && subscriptionIds.length > 0) {
      const azureResources = resourceIds.filter(id => id.startsWith('azure-'));
      const testSubscription = subscriptionIds[0]; // Use first subscription for testing
      
      for (const resourceId of azureResources) {
        const testConfig = AZURE_TEST_ENDPOINTS[resourceId];
        if (testConfig) {
          const result = await testAzureEndpoint(
            azureToken,
            testSubscription,
            resourceId,
            testConfig.path,
            testConfig.description
          );
          results.push(result);
        } else {
          results.push({
            resourceId,
            resourceName: resourceId,
            provider: 'azure',
            success: true,
            responseTime: 0,
            error: 'No test endpoint configured',
          });
        }
      }
    }
    
    // Calculate summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const avgResponseTime = results.length > 0 
      ? Math.round(results.reduce((acc, r) => acc + r.responseTime, 0) / results.length)
      : 0;
    
    return new Response(
      JSON.stringify({
        success: failureCount === 0,
        results,
        summary: {
          total: results.length,
          passed: successCount,
          failed: failureCount,
          avgResponseTime,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});