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
  // SharePoint
  'sharepoint/tenant-settings': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenant | ConvertTo-Json -Depth 10'],
  },
  'sharepoint/sharing-policies': {
    module: 'PnP.PowerShell',
    commands: ['Get-PnPTenantSharingSettings | ConvertTo-Json -Depth 10'],
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
