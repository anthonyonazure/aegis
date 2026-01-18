import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { 
  isPowerShellResource, 
  getAutomationConfigs, 
  startAutomationJob, 
  pollJobUntilComplete,
  getJobOutput,
  type AutomationConfig 
} from './automationApi';
import { exportAzureResources, getAzureTokenFromStoredCredentials } from './azureApi';

const GRAPH_API_FUNCTION = 'graph-api';
const CONVERT_FUNCTION = 'convert-format';

// Helper to check if a resource is an Azure infrastructure resource
export function isAzureResource(resourceType: string): boolean {
  return resourceType.startsWith('azure-');
}

// Validation schemas for client-side validation
const UUIDSchema = z.string().uuid('Invalid UUID format');
const ClientSecretSchema = z.string().min(1, 'Client secret required').max(1000, 'Client secret too long');
const AccessTokenSchema = z.string().min(1, 'Access token required').max(10000, 'Access token too long');
const ResourceSchema = z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource format');
const FormatSchema = z.enum(['terraform', 'bicep', 'powershell']);
const ResourceTypeSchema = z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource type format');

export interface TestConnectionResult {
  success: boolean;
  tenantName?: string;
  tenantId?: string;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  results?: Array<{
    resource: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  completed?: number;
  total?: number;
  error?: string;
}

export interface ConvertResult {
  success: boolean;
  output?: string;
  format?: string;
  resourceType?: string;
  error?: string;
}

export async function testTenantConnection(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<TestConnectionResult> {
  try {
    // Client-side validation
    const tenantIdResult = UUIDSchema.safeParse(tenantId);
    if (!tenantIdResult.success) {
      return { success: false, error: 'Invalid Tenant ID format. Must be a valid UUID.' };
    }

    const clientIdResult = UUIDSchema.safeParse(clientId);
    if (!clientIdResult.success) {
      return { success: false, error: 'Invalid Client ID format. Must be a valid UUID.' };
    }

    const clientSecretResult = ClientSecretSchema.safeParse(clientSecret);
    if (!clientSecretResult.success) {
      return { success: false, error: clientSecretResult.error.errors[0]?.message || 'Invalid client secret' };
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'test-connection',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      console.error('Connection test error:', error);
      return { success: false, error: 'Connection test failed. Please check your credentials.' };
    }

    return data as TestConnectionResult;
  } catch (err) {
    console.error('Connection test exception:', err);
    return { success: false, error: 'Connection test failed. Please try again.' };
  }
}

export async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    // Client-side validation
    const tenantIdResult = UUIDSchema.safeParse(tenantId);
    if (!tenantIdResult.success) {
      return { error: 'Invalid Tenant ID format. Must be a valid UUID.' };
    }

    const clientIdResult = UUIDSchema.safeParse(clientId);
    if (!clientIdResult.success) {
      return { error: 'Invalid Client ID format. Must be a valid UUID.' };
    }

    const clientSecretResult = ClientSecretSchema.safeParse(clientSecret);
    if (!clientSecretResult.success) {
      return { error: clientSecretResult.error.errors[0]?.message || 'Invalid client secret' };
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'get-token',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      console.error('Token retrieval error:', error);
      return { error: 'Failed to retrieve access token. Please check your credentials.' };
    }

    return data;
  } catch (err) {
    console.error('Token retrieval exception:', err);
    return { error: 'Failed to retrieve access token. Please try again.' };
  }
}

// Refresh token using stored credentials (no secret transmitted)
export async function refreshTokenFromStoredCredentials(
  tenantConnectionId: string
): Promise<{ accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    // Client-side validation
    const connectionIdResult = UUIDSchema.safeParse(tenantConnectionId);
    if (!connectionIdResult.success) {
      return { error: 'Invalid connection ID format.' };
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'get-token-from-stored',
        tenantConnectionId,
      },
    });

    if (error) {
      console.error('Token refresh error:', error);
      return { error: 'Failed to refresh token. Please re-authenticate.' };
    }

    return data;
  } catch (err) {
    console.error('Token refresh exception:', err);
    return { error: 'Failed to refresh token. Please try again.' };
  }
}

export async function exportResources(
  accessToken: string,
  resources: string[],
  exportJobId: string
): Promise<ExportResult> {
  try {
    // Client-side validation
    const accessTokenResult = AccessTokenSchema.safeParse(accessToken);
    if (!accessTokenResult.success) {
      return { success: false, error: 'Invalid access token.' };
    }

    const exportJobIdResult = UUIDSchema.safeParse(exportJobId);
    if (!exportJobIdResult.success) {
      return { success: false, error: 'Invalid export job ID.' };
    }

    // Validate resources array
    if (!Array.isArray(resources) || resources.length === 0) {
      return { success: false, error: 'At least one resource must be selected.' };
    }

    if (resources.length > 100) {
      return { success: false, error: 'Too many resources selected. Maximum is 100.' };
    }

    for (const resource of resources) {
      const resourceResult = ResourceSchema.safeParse(resource);
      if (!resourceResult.success) {
        return { success: false, error: `Invalid resource format: ${resource}` };
      }
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'export',
        accessToken,
        resources,
        exportJobId,
      },
    });

    if (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Export failed. Please try again.' };
    }

    return data as ExportResult;
  } catch (err) {
    console.error('Export exception:', err);
    return { success: false, error: 'Export failed. Please try again.' };
  }
}

export async function convertToFormat(
  data: any,
  resourceType: string,
  format: 'terraform' | 'bicep' | 'powershell'
): Promise<ConvertResult> {
  try {
    // Client-side validation
    const resourceTypeResult = ResourceTypeSchema.safeParse(resourceType);
    if (!resourceTypeResult.success) {
      return { success: false, error: 'Invalid resource type format.' };
    }

    const formatResult = FormatSchema.safeParse(format);
    if (!formatResult.success) {
      return { success: false, error: 'Invalid format. Must be terraform, bicep, or powershell.' };
    }

    // Check data size (rough estimate)
    try {
      const dataStr = JSON.stringify(data);
      if (dataStr.length > 5 * 1024 * 1024) {
        return { success: false, error: 'Data payload is too large to process.' };
      }
    } catch {
      return { success: false, error: 'Invalid data format.' };
    }

    const { data: result, error } = await supabase.functions.invoke(CONVERT_FUNCTION, {
      body: {
        data,
        resourceType,
        format,
      },
    });

    if (error) {
      console.error('Conversion error:', error);
      return { success: false, error: 'Conversion failed. Please try again.' };
    }

    return result as ConvertResult;
  } catch (err) {
    console.error('Conversion exception:', err);
    return { success: false, error: 'Conversion failed. Please try again.' };
  }
}

// Check if an automation config is available for PowerShell exports
export async function getAvailableAutomationConfig(): Promise<AutomationConfig | null> {
  try {
    const configs = await getAutomationConfigs();
    // Return the first active, connected config
    const activeConfig = configs.find(c => c.is_active && c.connection_status === 'connected');
    return activeConfig || null;
  } catch {
    return null;
  }
}

// Split resources into Graph API, PowerShell, and Azure categories
export function categorizeResources(resources: string[]): {
  graphResources: string[];
  powerShellResources: string[];
  azureResources: string[];
} {
  const graphResources: string[] = [];
  const powerShellResources: string[] = [];
  const azureResources: string[] = [];

  for (const resource of resources) {
    if (isAzureResource(resource)) {
      azureResources.push(resource);
    } else if (isPowerShellResource(resource)) {
      powerShellResources.push(resource);
    } else {
      graphResources.push(resource);
    }
  }

  return { graphResources, powerShellResources, azureResources };
}

// Hybrid export that uses Graph API for standard resources, Azure API for Azure resources, and Azure Automation for PowerShell resources
export interface HybridExportResult {
  success: boolean;
  graphResults?: ExportResult['results'];
  azureResults?: Array<{
    resource: string;
    subscription: string;
    success: boolean;
    count?: number;
    error?: string;
  }>;
  automationResults?: Array<{
    resource: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
  automationJobId?: string;
  automationSkipped?: boolean;
  automationSkipReason?: string;
  azureSkipped?: boolean;
  azureSkipReason?: string;
  error?: string;
}

export async function exportResourcesHybrid(
  accessToken: string,
  resources: string[],
  exportJobId: string,
  tenantConnectionId?: string,
  onProgress?: (progress: number, message: string) => void,
  selectedSubscriptionIds?: string[]
): Promise<HybridExportResult> {
  const { graphResources, powerShellResources, azureResources } = categorizeResources(resources);
  
  let graphResults: ExportResult['results'] = [];
  let azureResults: HybridExportResult['azureResults'] = [];
  let automationResults: HybridExportResult['automationResults'] = [];
  let automationSkipped = false;
  let automationSkipReason: string | undefined;
  let automationJobId: string | undefined;
  let azureSkipped = false;
  let azureSkipReason: string | undefined;

  const totalResources = resources.length;
  let completedResources = 0;

  // Step 1: Export Graph API resources
  if (graphResources.length > 0) {
    onProgress?.(0, `Exporting ${graphResources.length} resources via Graph API...`);
    
    const graphResult = await exportResources(accessToken, graphResources, exportJobId);
    
    if (graphResult.success) {
      graphResults = graphResult.results || [];
      completedResources += graphResources.length;
    } else {
      return {
        success: false,
        error: graphResult.error || 'Graph API export failed',
      };
    }
  }

  // Step 2: Export Azure infrastructure resources via Azure Management API
  if (azureResources.length > 0) {
    onProgress?.(
      Math.round((completedResources / totalResources) * 100),
      `Exporting ${azureResources.length} Azure resources...`
    );

    if (!tenantConnectionId) {
      azureSkipped = true;
      azureSkipReason = 'Tenant connection required for Azure resource export.';
      azureResults = azureResources.map(resource => ({
        resource,
        subscription: '',
        success: false,
        error: 'Tenant connection required',
      }));
    } else if (!selectedSubscriptionIds || selectedSubscriptionIds.length === 0) {
      azureSkipped = true;
      azureSkipReason = 'No Azure subscriptions selected. Select subscriptions in the Auth view to export Azure resources.';
      azureResults = azureResources.map(resource => ({
        resource,
        subscription: '',
        success: false,
        error: 'No subscriptions selected',
      }));
    } else {
      // Get Azure Management token
      const tokenResult = await getAzureTokenFromStoredCredentials(tenantConnectionId);
      
      if (!tokenResult.success || !tokenResult.accessToken) {
        azureSkipped = true;
        azureSkipReason = tokenResult.error || 'Failed to get Azure Management token';
        azureResults = azureResources.map(resource => ({
          resource,
          subscription: '',
          success: false,
          error: 'Failed to authenticate with Azure',
        }));
      } else {
        const exportResult = await exportAzureResources(
          tokenResult.accessToken,
          selectedSubscriptionIds,
          azureResources,
          exportJobId
        );
        
        if (exportResult.success) {
          azureResults = exportResult.results || [];
          completedResources += azureResources.length;
        } else {
          azureResults = azureResources.map(resource => ({
            resource,
            subscription: '',
            success: false,
            error: exportResult.error || 'Azure export failed',
          }));
        }
      }
    }
  }

  // Step 3: Export PowerShell resources via Azure Automation
  if (powerShellResources.length > 0) {
    onProgress?.(
      Math.round((completedResources / totalResources) * 100),
      `Preparing ${powerShellResources.length} PowerShell resources via Azure Automation...`
    );

    // Check for automation config
    const automationConfig = await getAvailableAutomationConfig();
    
    if (!automationConfig) {
      automationSkipped = true;
      automationSkipReason = 'No Azure Automation account configured. Configure one in Settings > Azure Automation to export PowerShell-only resources.';
      
      // Mark PowerShell resources as skipped in results
      automationResults = powerShellResources.map(resource => ({
        resource,
        success: false,
        error: 'Requires Azure Automation (not configured)',
      }));
    } else if (!tenantConnectionId) {
      automationSkipped = true;
      automationSkipReason = 'No tenant connection ID provided for automation export.';
      
      automationResults = powerShellResources.map(resource => ({
        resource,
        success: false,
        error: 'Tenant connection required for automation',
      }));
    } else {
      // Start the automation job
      onProgress?.(
        Math.round((completedResources / totalResources) * 100),
        'Starting Azure Automation runbook...'
      );

      const startResult = await startAutomationJob(
        automationConfig.id,
        tenantConnectionId,
        powerShellResources
      );

      if (!startResult.success || !startResult.jobRunId) {
        automationSkipped = true;
        automationSkipReason = startResult.error || 'Failed to start automation job';
        
        automationResults = powerShellResources.map(resource => ({
          resource,
          success: false,
          error: startResult.error || 'Failed to start automation job',
        }));
      } else {
        automationJobId = startResult.jobRunId;

        // Poll for job completion
        const pollResult = await pollJobUntilComplete(
          startResult.jobRunId,
          (status) => {
            onProgress?.(
              Math.round((completedResources / totalResources) * 100),
              `Azure Automation: ${status}`
            );
          },
          120, // Max 10 minutes (120 * 5 seconds)
          5000
        );

        if (pollResult.success && pollResult.status === 'completed') {
          // Get the job output
          const outputResult = await getJobOutput(startResult.jobRunId);
          
          if (outputResult.success && outputResult.output) {
            // Parse output and store resources
            automationResults = powerShellResources.map(resource => ({
              resource,
              success: true,
              data: (outputResult.output as Record<string, unknown>)?.[resource],
            }));

            // Store automation results in exported_resources table
            const outputData = outputResult.output as Record<string, unknown>;
            for (const resource of powerShellResources) {
              const [category, resourceType] = resource.split('/');
              const resourceData = outputData[resource];
              
              if (resourceData) {
                const insertData = {
                  export_job_id: exportJobId,
                  category,
                  resource_type: resourceType,
                  resource_name: `PowerShell: ${resourceType}`,
                  resource_id: `automation/${resource}`,
                  data: JSON.parse(JSON.stringify({ value: resourceData, source: 'azure-automation' })),
                };
                await supabase.from('exported_resources').insert([insertData]);
              }
            }
            
            completedResources += powerShellResources.length;
          } else {
            automationResults = powerShellResources.map(resource => ({
              resource,
              success: false,
              error: 'Failed to retrieve automation output',
            }));
          }
        } else {
          automationResults = powerShellResources.map(resource => ({
            resource,
            success: false,
            error: pollResult.error || 'Automation job failed or timed out',
          }));
        }
      }
    }
  }

  onProgress?.(100, 'Export complete');

  return {
    success: true,
    graphResults,
    automationResults,
    automationJobId,
    automationSkipped,
    automationSkipReason,
  };
}
