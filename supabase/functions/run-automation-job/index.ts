import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const StartJobSchema = z.object({
  action: z.literal('start-job'),
  automationConfigId: z.string().uuid(),
  tenantConnectionId: z.string().uuid(),
  resourceTypes: z.array(z.string()).min(1),
});

const StartImportJobSchema = z.object({
  action: z.literal('start-import-job'),
  automationConfigId: z.string().uuid(),
  tenantConnectionId: z.string().uuid(),
  importJobId: z.string().uuid(),
  resources: z.array(z.object({
    resourceType: z.string().min(1),
    resourceName: z.string().optional(),
    data: z.record(z.any()),
  })).min(1).max(50),
});

const GetJobStatusSchema = z.object({
  action: z.literal('get-job-status'),
  jobRunId: z.string().uuid(),
});

const GetJobOutputSchema = z.object({
  action: z.literal('get-job-output'),
  jobRunId: z.string().uuid(),
});

const TestConnectionSchema = z.object({
  action: z.literal('test-connection'),
  automationConfigId: z.string().uuid(),
  tenantConnectionId: z.string().uuid(),
});

// PowerShell resource type mappings
const POWERSHELL_RESOURCES: Record<string, { module: string; commands: string[] }> = {
  // Exchange Online
  'exchange/transport-rules': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-TransportRule | ConvertTo-Json -Depth 10'],
  },
  'exchange/connectors': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-InboundConnector | ConvertTo-Json -Depth 10',
      'Get-OutboundConnector | ConvertTo-Json -Depth 10',
    ],
  },
  'exchange/mailbox-policies': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-OwaMailboxPolicy | ConvertTo-Json -Depth 10',
      'Get-MobileDeviceMailboxPolicy | ConvertTo-Json -Depth 10',
    ],
  },
  'exchange/anti-spam': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-HostedContentFilterPolicy | ConvertTo-Json -Depth 10',
      'Get-HostedOutboundSpamFilterPolicy | ConvertTo-Json -Depth 10',
      'Get-HostedConnectionFilterPolicy | ConvertTo-Json -Depth 10',
    ],
  },
  'exchange/dlp-policies': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-DlpPolicy | ConvertTo-Json -Depth 10'],
  },
  'exchange/anti-phishing': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-AntiPhishPolicy | ConvertTo-Json -Depth 10'],
  },
  'exchange/org-config': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-OrganizationConfig | ConvertTo-Json -Depth 10'],
  },
  'exchange/owa-policies': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-OwaMailboxPolicy | ConvertTo-Json -Depth 10'],
  },
  'exchange/mobile-device-policies': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-MobileDeviceMailboxPolicy | ConvertTo-Json -Depth 10'],
  },

  // Purview / Compliance - DLP and Insider Risk
  'purview/dlp-policies': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-DlpCompliancePolicy | ConvertTo-Json -Depth 10',
      'Get-DlpComplianceRule | ConvertTo-Json -Depth 10',
    ],
  },
  'purview/insider-risk': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-InsiderRiskPolicy | ConvertTo-Json -Depth 10',
    ],
  },

  // Copilot - Semantic Index and Data Controls
  'copilot/semantic-index': {
    module: 'Microsoft.Graph',
    commands: [
      // Semantic Index status via Graph PowerShell
      'Get-MgSearchAcronym -All | ConvertTo-Json -Depth 10',
      'Get-MgSearchBookmark -All | ConvertTo-Json -Depth 10',
    ],
  },
  'copilot/copilot-data-controls': {
    module: 'ExchangeOnlineManagement',
    commands: [
      'Get-M365DataAtRestEncryptionPolicy | ConvertTo-Json -Depth 10',
      'Get-OrganizationConfig | Select-Object *Copilot* | ConvertTo-Json -Depth 10',
    ],
  },

  // Teams
  'teams/messaging-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsMessagingPolicy | ConvertTo-Json -Depth 10'],
  },
  'teams/meeting-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsMeetingPolicy | ConvertTo-Json -Depth 10'],
  },
  'teams/calling-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsCallingPolicy | ConvertTo-Json -Depth 10'],
  },
  'teams/live-event-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsMeetingBroadcastPolicy | ConvertTo-Json -Depth 10'],
  },
  'teams/guest-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsGuestMessagingConfiguration | ConvertTo-Json -Depth 10'],
  },
  'teams/external-access': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTenantFederationConfiguration | ConvertTo-Json -Depth 10'],
  },
  'teams/app-setup-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsAppSetupPolicy | ConvertTo-Json -Depth 10'],
  },
  'teams/channel-policies': {
    module: 'MicrosoftTeams',
    commands: ['Get-CsTeamsChannelsPolicy | ConvertTo-Json -Depth 10'],
  },

  // SharePoint
  'sharepoint/tenant-settings': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/sharing-policies': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | Select-Object *Sharing* | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/access-control': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | Select-Object *Access*, *Block*, *Allow* | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/storage-quota': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | Select-Object *Storage*, *Quota* | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/onedrive-settings': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | Select-Object *OneDrive* | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/site-scripts': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPSiteScript | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/site-designs': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPSiteDesign | ConvertTo-Json -Depth 10'],
  },

  // Defender
  'defender/safe-attachments': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-SafeAttachmentPolicy | ConvertTo-Json -Depth 10'],
  },
  'defender/safe-links': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-SafeLinksPolicy | ConvertTo-Json -Depth 10'],
  },
  'defender/anti-phishing': {
    module: 'ExchangeOnlineManagement',
    commands: ['Get-AntiPhishPolicy | ConvertTo-Json -Depth 10'],
  },
};

// PowerShell import commands for Exchange/SharePoint restoration
const POWERSHELL_IMPORT_COMMANDS: Record<string, { module: string; createCommand: (data: Record<string, any>) => string }> = {
  // Exchange Online - Transport Rules
  'exchange/transport-rules': {
    module: 'ExchangeOnlineManagement',
    createCommand: (data) => {
      const name = data.Name || data.displayName || 'ImportedRule';
      const priority = data.Priority || 0;
      const conditions = data.Conditions ? `-Conditions (${JSON.stringify(data.Conditions)})` : '';
      const actions = data.Actions ? `-Actions (${JSON.stringify(data.Actions)})` : '';
      return `New-TransportRule -Name "${name}" -Priority ${priority} ${conditions} ${actions}`;
    },
  },
  'exchange/connectors': {
    module: 'ExchangeOnlineManagement',
    createCommand: (data) => {
      const type = data.ConnectorType || 'Inbound';
      const name = data.Name || data.displayName || 'ImportedConnector';
      if (type === 'Inbound') {
        const senderDomains = data.SenderDomains ? `-SenderDomains ${JSON.stringify(data.SenderDomains)}` : '';
        return `New-InboundConnector -Name "${name}" ${senderDomains}`;
      } else {
        const recipientDomains = data.RecipientDomains ? `-RecipientDomains ${JSON.stringify(data.RecipientDomains)}` : '';
        return `New-OutboundConnector -Name "${name}" ${recipientDomains}`;
      }
    },
  },
  'exchange/mailbox-policies': {
    module: 'ExchangeOnlineManagement',
    createCommand: (data) => {
      const name = data.Name || data.displayName || 'ImportedPolicy';
      return `New-OwaMailboxPolicy -Name "${name}"`;
    },
  },
  'exchange/anti-spam': {
    module: 'ExchangeOnlineManagement',
    createCommand: (data) => {
      const name = data.Name || data.displayName || 'ImportedSpamFilter';
      const action = data.HighConfidenceSpamAction || 'MoveToJmf';
      return `New-HostedContentFilterPolicy -Name "${name}" -HighConfidenceSpamAction ${action}`;
    },
  },
  'exchange/anti-phishing': {
    module: 'ExchangeOnlineManagement',
    createCommand: (data) => {
      const name = data.Name || data.displayName || 'ImportedAntiPhish';
      const enabled = data.Enabled !== false ? '$true' : '$false';
      return `New-AntiPhishPolicy -Name "${name}" -Enabled ${enabled}`;
    },
  },
  // SharePoint - Site Scripts
  'sharepoint/site-scripts': {
    module: 'PnP.PowerShell',
    createCommand: (data) => {
      const title = data.Title || data.displayName || 'ImportedScript';
      const content = JSON.stringify(data.Content || data);
      return `Add-PnPSiteScript -Title "${title}" -Content '${content}'`;
    },
  },
  'sharepoint/site-designs': {
    module: 'PnP.PowerShell',
    createCommand: (data) => {
      const title = data.Title || data.displayName || 'ImportedDesign';
      const webTemplate = data.WebTemplate || '64';
      const siteScripts = data.SiteScriptIds ? `-SiteScripts ${JSON.stringify(data.SiteScriptIds)}` : '';
      return `Add-PnPSiteDesign -Title "${title}" -WebTemplate ${webTemplate} ${siteScripts}`;
    },
  },
  // Teams
  'teams/messaging-policies': {
    module: 'MicrosoftTeams',
    createCommand: (data) => {
      const identity = data.Identity || data.displayName || 'ImportedMessagingPolicy';
      return `New-CsTeamsMessagingPolicy -Identity "${identity}"`;
    },
  },
  'teams/meeting-policies': {
    module: 'MicrosoftTeams',
    createCommand: (data) => {
      const identity = data.Identity || data.displayName || 'ImportedMeetingPolicy';
      return `New-CsTeamsMeetingPolicy -Identity "${identity}"`;
    },
  },
  'teams/app-setup-policies': {
    module: 'MicrosoftTeams',
    createCommand: (data) => {
      const identity = data.Identity || data.displayName || 'ImportedAppSetupPolicy';
      return `New-CsTeamsAppSetupPolicy -Identity "${identity}"`;
    },
  },
};

function sanitizeError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Automation API error:', errorMessage);
  
  if (errorMessage.includes('AADSTS')) {
    return 'Azure authentication failed. Please verify your credentials.';
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Check your Azure RBAC permissions for Azure Automation.';
  }
  if (errorMessage.includes('404')) {
    return 'Azure Automation resource not found. Verify your configuration.';
  }
  if (errorMessage.includes('429')) {
    return 'Rate limited. Please wait and try again.';
  }
  
  return 'An error occurred. Please try again.';
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

async function getAzureManagementToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string } | { error: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Azure token error:', JSON.stringify(data));
      return { error: sanitizeError(new Error(data.error_description || 'Token request failed')) };
    }

    return { token: data.access_token };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

function generateRunbookScript(resourceTypes: string[], tenantId: string, clientId: string): string {
  const modules = new Set<string>();
  const commands: string[] = [];
  
  for (const resourceType of resourceTypes) {
    const config = POWERSHELL_RESOURCES[resourceType];
    if (config) {
      modules.add(config.module);
      commands.push(`# ${resourceType}`);
      commands.push(...config.commands.map(cmd => `$results["${resourceType}"] = @(${cmd})`));
    }
  }

  return `
param(
  [Parameter(Mandatory=$true)]
  [string]$TenantId,
  
  [Parameter(Mandatory=$true)]
  [string]$ClientId,
  
  [Parameter(Mandatory=$true)]
  [string]$ClientSecret,
  
  [Parameter(Mandatory=$true)]
  [string[]]$ResourceTypes
)

$ErrorActionPreference = "Continue"
$results = @{}
$errors = @{}

# Create credential
$secureSecret = ConvertTo-SecureString $ClientSecret -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($ClientId, $secureSecret)

try {
  # Connect to Exchange Online if needed
  ${Array.from(modules).includes('ExchangeOnlineManagement') ? `
  Import-Module ExchangeOnlineManagement -ErrorAction Stop
  Connect-ExchangeOnline -AppId $ClientId -CertificateThumbprint $null -Organization "$TenantId" -CommandName @(${resourceTypes.filter(r => POWERSHELL_RESOURCES[r]?.module === 'ExchangeOnlineManagement').flatMap(r => POWERSHELL_RESOURCES[r].commands.map(c => `"${c.split(' ')[0]}"`)).join(',')}) -ShowBanner:$false
  ` : ''}
  
  # Connect to Teams if needed
  ${Array.from(modules).includes('MicrosoftTeams') ? `
  Import-Module MicrosoftTeams -ErrorAction Stop
  Connect-MicrosoftTeams -TenantId $TenantId -ApplicationId $ClientId -CertificateThumbprint $null
  ` : ''}
  
  # Connect to PnP if needed
  ${Array.from(modules).includes('PnP.PowerShell') ? `
  Import-Module PnP.PowerShell -ErrorAction Stop
  Connect-PnPOnline -Url "https://$($TenantId.Split('.')[0])-admin.sharepoint.com" -ClientId $ClientId -ClientSecret $ClientSecret
  ` : ''}
  
  # Execute commands
  ${commands.join('\n  ')}
  
} catch {
  $errors["general"] = $_.Exception.Message
}

# Output as JSON
$output = @{
  success = $errors.Count -eq 0
  results = $results
  errors = $errors
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
}

$output | ConvertTo-Json -Depth 20 -Compress
`;
}

// Generate PowerShell import script for restoring Exchange/SharePoint resources
function generateImportScript(resources: Array<{ resourceType: string; resourceName?: string; data: Record<string, any> }>): string {
  const modules = new Set<string>();
  const importCommands: string[] = [];
  
  for (const resource of resources) {
    const config = POWERSHELL_IMPORT_COMMANDS[resource.resourceType];
    if (config) {
      modules.add(config.module);
      const cmd = config.createCommand(resource.data);
      const safeName = (resource.resourceName || resource.resourceType).replace(/"/g, '\\"');
      importCommands.push(`
      # Import ${safeName}
      try {
        $result = ${cmd}
        $importResults += @{
          resourceType = "${resource.resourceType}"
          resourceName = "${safeName}"
          success = $true
          resourceId = $result.Identity ?? $result.Id ?? $result.Name ?? "unknown"
        }
      } catch {
        $importResults += @{
          resourceType = "${resource.resourceType}"
          resourceName = "${safeName}"
          success = $false
          error = $_.Exception.Message
        }
      }
      `);
    }
  }

  return `
param(
  [Parameter(Mandatory=$true)]
  [string]$TenantId,
  
  [Parameter(Mandatory=$true)]
  [string]$ClientId,
  
  [Parameter(Mandatory=$true)]
  [string]$ClientSecret,
  
  [Parameter(Mandatory=$true)]
  [string]$ResourcesJson
)

$ErrorActionPreference = "Continue"
$importResults = @()
$generalErrors = @()

# Parse resources
try {
  $resources = $ResourcesJson | ConvertFrom-Json
} catch {
  $output = @{
    success = $false
    action = "import"
    imported = 0
    failed = 0
    results = @()
    errors = @("Failed to parse resources JSON: " + $_.Exception.Message)
  }
  $output | ConvertTo-Json -Depth 20 -Compress
  return
}

try {
  # Connect to Exchange Online if needed
  ${Array.from(modules).includes('ExchangeOnlineManagement') ? `
  Import-Module ExchangeOnlineManagement -ErrorAction Stop
  Connect-ExchangeOnline -AppId $ClientId -Organization "$TenantId" -ShowBanner:$false
  ` : ''}
  
  # Connect to Teams if needed
  ${Array.from(modules).includes('MicrosoftTeams') ? `
  Import-Module MicrosoftTeams -ErrorAction Stop
  Connect-MicrosoftTeams -TenantId $TenantId -ApplicationId $ClientId
  ` : ''}
  
  # Connect to PnP if needed
  ${Array.from(modules).includes('PnP.PowerShell') ? `
  Import-Module PnP.PowerShell -ErrorAction Stop
  Connect-PnPOnline -Url "https://$($TenantId.Split('.')[0])-admin.sharepoint.com" -ClientId $ClientId -ClientSecret $ClientSecret
  ` : ''}
  
  # Execute import commands
  ${importCommands.join('\n')}
  
} catch {
  $generalErrors += $_.Exception.Message
}

# Calculate totals
$imported = ($importResults | Where-Object { $_.success -eq $true }).Count
$failed = ($importResults | Where-Object { $_.success -eq $false }).Count

# Output as JSON
$output = @{
  success = $generalErrors.Count -eq 0 -and $failed -eq 0
  action = "import"
  imported = $imported
  failed = $failed
  total = $importResults.Count
  results = $importResults
  errors = $generalErrors
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
}

$output | ConvertTo-Json -Depth 20 -Compress
`;
}
async function startAutomationJob(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  automationAccount: string,
  runbookName: string,
  parameters: Record<string, string>
): Promise<{ jobId: string } | { error: string }> {
  const apiVersion = '2023-11-01';
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Automation/automationAccounts/${automationAccount}/jobs/${crypto.randomUUID()}?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          runbook: { name: runbookName },
          parameters,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Start job error:', JSON.stringify(errorData));
      return { error: errorData.error?.message || `Failed to start job: ${response.status}` };
    }

    const data = await response.json();
    return { jobId: data.properties?.jobId || data.name };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

async function getAutomationJobStatus(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  automationAccount: string,
  jobId: string
): Promise<{ status: string; provisioningState?: string } | { error: string }> {
  const apiVersion = '2023-11-01';
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Automation/automationAccounts/${automationAccount}/jobs/${jobId}?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error?.message || `Failed to get job status: ${response.status}` };
    }

    const data = await response.json();
    return {
      status: data.properties?.status,
      provisioningState: data.properties?.provisioningState,
    };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

async function getAutomationJobOutput(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  automationAccount: string,
  jobId: string
): Promise<{ output: string } | { error: string }> {
  const apiVersion = '2023-11-01';
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Automation/automationAccounts/${automationAccount}/jobs/${jobId}/output?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Get output error:', errorText);
      return { error: `Failed to get job output: ${response.status}` };
    }

    const output = await response.text();
    return { output };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authResult.userId;
    const rawBody = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle test-connection action
    if (rawBody.action === 'test-connection') {
      const parseResult = TestConnectionSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { automationConfigId, tenantConnectionId } = parseResult.data;

      // Get automation config
      const { data: config, error: configError } = await supabase
        .from('azure_automation_configs')
        .select('*')
        .eq('id', automationConfigId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        return new Response(
          JSON.stringify({ error: 'Automation config not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials
      const { data: credentials, error: credError } = await supabase
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenantConnectionId,
          p_user_id: userId,
        });

      if (credError || !credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Could not retrieve credentials' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];

      // Get Azure token
      const tokenResult = await getAzureManagementToken(tenant_id, client_id, client_secret);
      if ('error' in tokenResult) {
        await supabase
          .from('azure_automation_configs')
          .update({ connection_status: 'failed', last_tested_at: new Date().toISOString() })
          .eq('id', automationConfigId);

        return new Response(
          JSON.stringify({ success: false, error: tokenResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Test access to automation account
      const testUrl = `https://management.azure.com/subscriptions/${config.subscription_id}/resourceGroups/${config.resource_group}/providers/Microsoft.Automation/automationAccounts/${config.automation_account_name}?api-version=2023-11-01`;
      
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!testResponse.ok) {
        await supabase
          .from('azure_automation_configs')
          .update({ connection_status: 'failed', last_tested_at: new Date().toISOString() })
          .eq('id', automationConfigId);

        return new Response(
          JSON.stringify({ success: false, error: `Cannot access Automation Account: ${testResponse.status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if runbook exists
      const runbookUrl = `https://management.azure.com/subscriptions/${config.subscription_id}/resourceGroups/${config.resource_group}/providers/Microsoft.Automation/automationAccounts/${config.automation_account_name}/runbooks/${config.runbook_name}?api-version=2023-11-01`;
      
      const runbookResponse = await fetch(runbookUrl, {
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      const runbookExists = runbookResponse.ok;

      await supabase
        .from('azure_automation_configs')
        .update({ 
          connection_status: runbookExists ? 'connected' : 'runbook_missing', 
          last_tested_at: new Date().toISOString() 
        })
        .eq('id', automationConfigId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          automationAccountFound: true,
          runbookExists,
          message: runbookExists 
            ? 'Successfully connected to Azure Automation' 
            : 'Automation Account found but runbook is missing. Please import the runbook.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle start-job action
    if (rawBody.action === 'start-job') {
      const parseResult = StartJobSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { automationConfigId, tenantConnectionId, resourceTypes } = parseResult.data;

      // Get automation config
      const { data: config, error: configError } = await supabase
        .from('azure_automation_configs')
        .select('*')
        .eq('id', automationConfigId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        return new Response(
          JSON.stringify({ error: 'Automation config not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials
      const { data: credentials, error: credError } = await supabase
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenantConnectionId,
          p_user_id: userId,
        });

      if (credError || !credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Could not retrieve credentials' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];

      // Get Azure token
      const tokenResult = await getAzureManagementToken(tenant_id, client_id, client_secret);
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ success: false, error: tokenResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job run record
      const { data: jobRun, error: jobRunError } = await supabase
        .from('automation_job_runs')
        .insert({
          user_id: userId,
          automation_config_id: automationConfigId,
          tenant_connection_id: tenantConnectionId,
          resource_types: resourceTypes,
          status: 'starting',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobRunError || !jobRun) {
        return new Response(
          JSON.stringify({ error: 'Failed to create job run record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Start the Azure Automation job
      const jobResult = await startAutomationJob(
        tokenResult.token,
        config.subscription_id,
        config.resource_group,
        config.automation_account_name,
        config.runbook_name,
        {
          TenantId: tenant_id,
          ClientId: client_id,
          ClientSecret: client_secret,
          ResourceTypes: JSON.stringify(resourceTypes),
        }
      );

      if ('error' in jobResult) {
        await supabase
          .from('automation_job_runs')
          .update({ status: 'failed', error_message: jobResult.error })
          .eq('id', jobRun.id);

        return new Response(
          JSON.stringify({ success: false, error: jobResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update with Azure job ID
      await supabase
        .from('automation_job_runs')
        .update({ azure_job_id: jobResult.jobId, status: 'running' })
        .eq('id', jobRun.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          jobRunId: jobRun.id,
          azureJobId: jobResult.jobId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle start-import-job action for Exchange/SharePoint imports via PowerShell
    if (rawBody.action === 'start-import-job') {
      const parseResult = StartImportJobSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters', details: parseResult.error.issues }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { automationConfigId, tenantConnectionId, importJobId, resources } = parseResult.data;

      // Validate that all resources support PowerShell import
      const supportedResources = resources.filter(r => POWERSHELL_IMPORT_COMMANDS[r.resourceType]);
      const unsupportedResources = resources.filter(r => !POWERSHELL_IMPORT_COMMANDS[r.resourceType]);

      if (supportedResources.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'None of the provided resources support PowerShell import. Supported types: ' + 
              Object.keys(POWERSHELL_IMPORT_COMMANDS).join(', ')
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get automation config
      const { data: config, error: configError } = await supabase
        .from('azure_automation_configs')
        .select('*')
        .eq('id', automationConfigId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        return new Response(
          JSON.stringify({ error: 'Automation config not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials
      const { data: credentials, error: credError } = await supabase
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenantConnectionId,
          p_user_id: userId,
        });

      if (credError || !credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Could not retrieve credentials' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];

      // Get Azure token
      const tokenResult = await getAzureManagementToken(tenant_id, client_id, client_secret);
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ success: false, error: tokenResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate the import script
      const importScript = generateImportScript(supportedResources);
      console.log('Generated import script for', supportedResources.length, 'resources');

      // Create automation job run record
      const { data: jobRun, error: jobRunError } = await supabase
        .from('automation_job_runs')
        .insert({
          user_id: userId,
          automation_config_id: automationConfigId,
          tenant_connection_id: tenantConnectionId,
          resource_types: supportedResources.map(r => r.resourceType),
          status: 'starting',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobRunError || !jobRun) {
        return new Response(
          JSON.stringify({ error: 'Failed to create job run record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Start the Azure Automation job with import parameters
      const jobResult = await startAutomationJob(
        tokenResult.token,
        config.subscription_id,
        config.resource_group,
        config.automation_account_name,
        'Import-M365Config', // Use a dedicated import runbook
        {
          TenantId: tenant_id,
          ClientId: client_id,
          ClientSecret: client_secret,
          ResourcesJson: JSON.stringify(supportedResources),
        }
      );

      if ('error' in jobResult) {
        // Update job run as failed
        await supabase
          .from('automation_job_runs')
          .update({ status: 'failed', error_message: jobResult.error })
          .eq('id', jobRun.id);

        // Also update import job
        await supabase
          .from('import_jobs')
          .update({ 
            status: 'failed', 
            errors: [{ resource: 'automation', error: jobResult.error }],
            completed_at: new Date().toISOString(),
          })
          .eq('id', importJobId);

        return new Response(
          JSON.stringify({ success: false, error: jobResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update with Azure job ID
      await supabase
        .from('automation_job_runs')
        .update({ azure_job_id: jobResult.jobId, status: 'running' })
        .eq('id', jobRun.id);

      // Update import job with automation job reference
      await supabase
        .from('import_jobs')
        .update({ 
          status: 'running',
          metadata: { 
            automationJobRunId: jobRun.id,
            azureJobId: jobResult.jobId,
            unsupportedResources: unsupportedResources.map(r => r.resourceType),
          },
        })
        .eq('id', importJobId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          jobRunId: jobRun.id,
          azureJobId: jobResult.jobId,
          supportedCount: supportedResources.length,
          unsupportedCount: unsupportedResources.length,
          message: unsupportedResources.length > 0 
            ? `Started import for ${supportedResources.length} resources. ${unsupportedResources.length} resource(s) not supported for PowerShell import.`
            : `Started import for ${supportedResources.length} resources.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get-job-status action
    if (rawBody.action === 'get-job-status') {
      const parseResult = GetJobStatusSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { jobRunId } = parseResult.data;

      // Get job run with config
      const { data: jobRun, error: jobRunError } = await supabase
        .from('automation_job_runs')
        .select(`
          *,
          azure_automation_configs(*),
          tenant_connections(tenant_id)
        `)
        .eq('id', jobRunId)
        .eq('user_id', userId)
        .single();

      if (jobRunError || !jobRun) {
        return new Response(
          JSON.stringify({ error: 'Job run not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If already completed/failed, return cached status
      if (['completed', 'failed'].includes(jobRun.status)) {
        return new Response(
          JSON.stringify({ 
            success: true,
            status: jobRun.status,
            output: jobRun.output,
            error: jobRun.error_message,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials to check Azure status
      const { data: credentials } = await supabase
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: jobRun.tenant_connection_id,
          p_user_id: userId,
        });

      if (!credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ success: true, status: jobRun.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];
      const config = jobRun.azure_automation_configs;

      // Get Azure token
      const tokenResult = await getAzureManagementToken(tenant_id, client_id, client_secret);
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ success: true, status: jobRun.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get Azure job status
      const statusResult = await getAutomationJobStatus(
        tokenResult.token,
        config.subscription_id,
        config.resource_group,
        config.automation_account_name,
        jobRun.azure_job_id
      );

      if ('error' in statusResult) {
        return new Response(
          JSON.stringify({ success: true, status: jobRun.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map Azure status to our status
      let newStatus = jobRun.status;
      if (statusResult.status === 'Completed') {
        newStatus = 'completed';
        
        // Get output
        const outputResult = await getAutomationJobOutput(
          tokenResult.token,
          config.subscription_id,
          config.resource_group,
          config.automation_account_name,
          jobRun.azure_job_id
        );

        if (!('error' in outputResult)) {
          try {
            const parsedOutput = JSON.parse(outputResult.output);
            await supabase
              .from('automation_job_runs')
              .update({ 
                status: 'completed', 
                output: parsedOutput,
                completed_at: new Date().toISOString(),
              })
              .eq('id', jobRunId);

            return new Response(
              JSON.stringify({ success: true, status: 'completed', output: parsedOutput }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } catch {
            await supabase
              .from('automation_job_runs')
              .update({ 
                status: 'completed', 
                output: { raw: outputResult.output },
                completed_at: new Date().toISOString(),
              })
              .eq('id', jobRunId);
          }
        }
      } else if (statusResult.status === 'Failed' || statusResult.status === 'Stopped') {
        newStatus = 'failed';
        await supabase
          .from('automation_job_runs')
          .update({ 
            status: 'failed', 
            error_message: `Azure job ${statusResult.status}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobRunId);
      } else if (['Running', 'Queued', 'Starting'].includes(statusResult.status || '')) {
        newStatus = 'running';
        await supabase
          .from('automation_job_runs')
          .update({ status: 'running' })
          .eq('id', jobRunId);
      }

      return new Response(
        JSON.stringify({ success: true, status: newStatus, azureStatus: statusResult.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get-job-output action
    if (rawBody.action === 'get-job-output') {
      const parseResult = GetJobOutputSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { jobRunId } = parseResult.data;

      const { data: jobRun, error: jobRunError } = await supabase
        .from('automation_job_runs')
        .select('output, status, error_message')
        .eq('id', jobRunId)
        .eq('user_id', userId)
        .single();

      if (jobRunError || !jobRun) {
        return new Response(
          JSON.stringify({ error: 'Job run not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: jobRun.status,
          output: jobRun.output,
          error: jobRun.error_message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get-runbook-script action (provides script for user to import)
    if (rawBody.action === 'get-runbook-script') {
      const resourceTypes = Object.keys(POWERSHELL_RESOURCES);
      const script = generateRunbookScript(resourceTypes, '', '');

      return new Response(
        JSON.stringify({ 
          success: true, 
          script,
          supportedResources: Object.entries(POWERSHELL_RESOURCES).map(([id, config]) => ({
            id,
            module: config.module,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Automation job error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
