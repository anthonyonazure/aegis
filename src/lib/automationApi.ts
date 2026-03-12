import { supabase } from '@/integrations/supabase/client';

export interface AutomationConfig {
  id: string;
  user_id: string;
  name: string;
  subscription_id: string;
  resource_group: string;
  automation_account_name: string;
  runbook_name: string;
  is_active: boolean;
  connection_status: string | null;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationJobRun {
  id: string;
  user_id: string;
  automation_config_id: string;
  tenant_connection_id: string | null;
  azure_job_id: string | null;
  resource_types: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  output: unknown;
  error_message: string | null;
  created_at: string;
}

export interface TestConnectionResult {
  success: boolean;
  automationAccountFound?: boolean;
  runbookExists?: boolean;
  message?: string;
  error?: string;
}

export interface StartJobResult {
  success: boolean;
  jobRunId?: string;
  azureJobId?: string;
  error?: string;
}

export interface JobStatusResult {
  success: boolean;
  status?: string;
  azureStatus?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface StartImportJobResult {
  success: boolean;
  jobRunId?: string;
  azureJobId?: string;
  supportedCount?: number;
  unsupportedCount?: number;
  message?: string;
  error?: string;
}

// PowerShell resource types that require Azure Automation for EXPORT
// NOTE: Exchange resources previously here are now handled via EXO REST API (InvokeCommand)
export const POWERSHELL_RESOURCE_TYPES = [
  // Purview / Compliance - DLP and Insider Risk (require Security & Compliance PowerShell)
  'purview/dlp-policies',
  'purview/insider-risk',
  
  // Copilot resources - Semantic Index and Data Controls
  'copilot/semantic-index',
  'copilot/copilot-data-controls',
  
  // Teams resources that require MicrosoftTeams PowerShell module
  'teams/messaging-policies',
  'teams/meeting-policies',
  'teams/calling-policies',
  'teams/live-event-policies',
  'teams/guest-policies',
  'teams/external-access',
  'teams/app-setup-policies',
  'teams/channel-policies',
  
  // SharePoint resources that require PnP.PowerShell
  'sharepoint/tenant-settings',
  'sharepoint/sharing-policies',
  'sharepoint/access-control',
  'sharepoint/storage-quota',
  'sharepoint/onedrive-settings',
  'sharepoint/site-scripts',
  'sharepoint/site-designs',
  
  // License optimization reports that need Reports.Read.All or PowerShell
  'license-optimization/inactive-users',
  'license-optimization/unused-services',
  'license-optimization/license-utilization',
  'license-optimization/mailbox-usage',
  'license-optimization/onedrive-usage',
  'license-optimization/teams-usage',
];

// PowerShell resource types that support IMPORT via Azure Automation
export const POWERSHELL_IMPORT_RESOURCE_TYPES = [
  // Exchange Online
  'exchange/transport-rules',
  'exchange/connectors',
  'exchange/mailbox-policies',
  
  // SharePoint
  'sharepoint/site-scripts',
  'sharepoint/site-designs',
  
  // Teams
  'teams/messaging-policies',
  'teams/meeting-policies',
  'teams/app-setup-policies',
];

// EXO REST API resource types (fetched via email-security InvokeCommand)
export const EXO_RESOURCE_TYPES: Record<string, string> = {
  'exchange/anti-spam': 'fetch-anti-spam',
  'exchange/anti-phishing': 'fetch-anti-phishing',
  'exchange/anti-malware': 'fetch-anti-malware',
  'exchange/safe-links': 'fetch-safe-links',
  'exchange/safe-attachments': 'fetch-safe-attachments',
};

export function isPowerShellResource(resourceType: string): boolean {
  return POWERSHELL_RESOURCE_TYPES.includes(resourceType);
}

export function isExoResource(resourceType: string): boolean {
  return resourceType in EXO_RESOURCE_TYPES;
}

export function isPowerShellImportResource(resourceType: string): boolean {
  return POWERSHELL_IMPORT_RESOURCE_TYPES.includes(resourceType);
}

export async function getAutomationConfigs(): Promise<AutomationConfig[]> {
  const { data, error } = await supabase
    .from('azure_automation_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching automation configs:', error);
    return [];
  }

  return data || [];
}

export async function createAutomationConfig(config: {
  name: string;
  subscription_id: string;
  resource_group: string;
  automation_account_name: string;
  runbook_name?: string;
}): Promise<{ success: boolean; config?: AutomationConfig; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('azure_automation_configs')
    .insert({
      user_id: user.id,
      name: config.name,
      subscription_id: config.subscription_id,
      resource_group: config.resource_group,
      automation_account_name: config.automation_account_name,
      runbook_name: config.runbook_name || 'Export-M365Config',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating automation config:', error);
    return { success: false, error: error.message };
  }

  return { success: true, config: data };
}

export async function updateAutomationConfig(
  id: string,
  updates: Partial<AutomationConfig>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('azure_automation_configs')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating automation config:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteAutomationConfig(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('azure_automation_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting automation config:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function testAutomationConnection(
  automationConfigId: string,
  tenantConnectionId: string
): Promise<TestConnectionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: {
        action: 'test-connection',
        automationConfigId,
        tenantConnectionId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}

export async function startAutomationJob(
  automationConfigId: string,
  tenantConnectionId: string,
  resourceTypes: string[]
): Promise<StartJobResult> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: {
        action: 'start-job',
        automationConfigId,
        tenantConnectionId,
        resourceTypes,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start job',
    };
  }
}

// Start an import job via Azure Automation for Exchange/SharePoint resources
export async function startAutomationImportJob(
  automationConfigId: string,
  tenantConnectionId: string,
  importJobId: string,
  resources: Array<{ resourceType: string; resourceName?: string; data: Record<string, unknown> }>
): Promise<StartImportJobResult> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: {
        action: 'start-import-job',
        automationConfigId,
        tenantConnectionId,
        importJobId,
        resources,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start import job',
    };
  }
}

export async function getJobStatus(jobRunId: string): Promise<JobStatusResult> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: {
        action: 'get-job-status',
        jobRunId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status',
    };
  }
}

export async function getJobOutput(jobRunId: string): Promise<JobStatusResult> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: {
        action: 'get-job-output',
        jobRunId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job output',
    };
  }
}

export async function getJobRuns(automationConfigId?: string): Promise<AutomationJobRun[]> {
  let query = supabase
    .from('automation_job_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (automationConfigId) {
    query = query.eq('automation_config_id', automationConfigId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching job runs:', error);
    return [];
  }

  return data || [];
}

export async function getRunbookScript(): Promise<{ script: string; supportedResources: Array<{ id: string; module: string }> } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('run-automation-job', {
      body: { action: 'get-runbook-script' },
    });

    if (error || !data.success) {
      return null;
    }

    return {
      script: data.script,
      supportedResources: data.supportedResources,
    };
  } catch {
    return null;
  }
}

// Poll for job completion
export async function pollJobUntilComplete(
  jobRunId: string,
  onStatusUpdate?: (status: string) => void,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<JobStatusResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getJobStatus(jobRunId);

    if (!result.success) {
      return result;
    }

    if (onStatusUpdate) {
      onStatusUpdate(result.status || 'unknown');
    }

    if (result.status === 'completed' || result.status === 'failed') {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  return {
    success: false,
    error: 'Job polling timed out',
  };
}
