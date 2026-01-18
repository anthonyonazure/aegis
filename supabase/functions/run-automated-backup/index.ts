import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupConfig {
  id: string;
  user_id: string;
  name: string;
  backup_type: string;
  schedule_cron: string;
  resource_ids: string[];
  formats: string[];
  target_type: string;
  target_customer_id: string | null;
  target_group_id: string | null;
  target_tenant_ids: string[];
  retention_days: number;
  max_backups: number;
  auto_cleanup: boolean;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
}

interface TenantConnection {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  display_name: string | null;
  customer_id: string | null;
  tenant_group_id: string | null;
}

// Parse cron expression and check if it should run now
function shouldRunNow(cronExpression: string, lastRunAt: string | null): boolean {
  // Simple check: if never run, should run; otherwise check if enough time has passed
  if (!lastRunAt) return true;
  
  const lastRun = new Date(lastRunAt);
  const now = new Date();
  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
  
  // Parse cron to determine frequency
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return hoursSinceLastRun >= 24; // Default to daily
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // Check if current time matches cron pattern
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const currentDayOfMonth = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentDayOfWeek = now.getDay();
  
  const matchesMinute = minute === '*' || parseInt(minute) === currentMinute;
  const matchesHour = hour === '*' || parseInt(hour) === currentHour;
  const matchesDayOfMonth = dayOfMonth === '*' || parseInt(dayOfMonth) === currentDayOfMonth;
  const matchesMonth = month === '*' || parseInt(month) === currentMonth;
  const matchesDayOfWeek = dayOfWeek === '*' || parseInt(dayOfWeek) === currentDayOfWeek;
  
  // For hourly/minutely schedules, check time difference
  if (minute !== '*' && hour === '*') {
    return hoursSinceLastRun >= 1;
  }
  
  // For daily schedules
  if (hour !== '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return hoursSinceLastRun >= 23 && matchesHour;
  }
  
  // For weekly schedules
  if (dayOfWeek !== '*') {
    return hoursSinceLastRun >= 167 && matchesDayOfWeek && matchesHour;
  }
  
  return matchesMinute && matchesHour && matchesDayOfMonth && matchesMonth && matchesDayOfWeek;
}

async function getTargetTenants(
  supabase: any,
  config: BackupConfig
): Promise<TenantConnection[]> {
  let query = supabase
    .from('tenant_connections')
    .select('id, tenant_id, tenant_name, display_name, customer_id, tenant_group_id')
    .eq('user_id', config.user_id)
    .eq('status', 'connected');

  switch (config.target_type) {
    case 'customer':
      if (config.target_customer_id) {
        query = query.eq('customer_id', config.target_customer_id);
      }
      break;
    case 'group':
      if (config.target_group_id) {
        query = query.eq('tenant_group_id', config.target_group_id);
      }
      break;
    case 'selected':
      if (config.target_tenant_ids && config.target_tenant_ids.length > 0) {
        query = query.in('id', config.target_tenant_ids);
      }
      break;
    // 'all' - no additional filter
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching target tenants:', error);
    return [];
  }
  return data || [];
}

async function cleanupOldBackups(
  supabase: any,
  configId: string,
  retentionDays: number,
  maxBackups: number
): Promise<{ deleted: number }> {
  let deleted = 0;

  // Delete runs older than retention period
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - retentionDays);

  const { data: oldRuns, error: oldError } = await supabase
    .from('automated_backup_runs')
    .delete()
    .eq('config_id', configId)
    .lt('created_at', retentionDate.toISOString())
    .select('id');

  if (!oldError && oldRuns) {
    deleted += oldRuns.length;
  }

  // Keep only max_backups most recent runs
  const { data: allRuns } = await supabase
    .from('automated_backup_runs')
    .select('id, created_at')
    .eq('config_id', configId)
    .order('created_at', { ascending: false });

  if (allRuns && allRuns.length > maxBackups) {
    const runsToDelete = allRuns.slice(maxBackups).map((r: any) => r.id);
    const { data: deletedRuns } = await supabase
      .from('automated_backup_runs')
      .delete()
      .in('id', runsToDelete)
      .select('id');

    if (deletedRuns) {
      deleted += deletedRuns.length;
    }
  }

  return { deleted };
}

async function getGraphAccessToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<string> {
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
    throw new Error('Token acquisition failed');
  }

  const data = await response.json();
  return data.access_token;
}

const GRAPH_ENDPOINTS: Record<string, { endpoint: string; useBeta?: boolean }> = {
  'intune/device-configurations': { endpoint: 'deviceManagement/deviceConfigurations' },
  'intune/compliance-policies': { endpoint: 'deviceManagement/deviceCompliancePolicies' },
  'intune/configuration-policies': { endpoint: 'deviceManagement/configurationPolicies', useBeta: true },
  'intune/app-protection-policies': { endpoint: 'deviceAppManagement/managedAppPolicies' },
  'entra-id/conditional-access': { endpoint: 'identity/conditionalAccess/policies' },
  'entra-id/named-locations': { endpoint: 'identity/conditionalAccess/namedLocations' },
  'entra-id/groups': { endpoint: 'groups' },
  'security/defender-policies': { endpoint: 'deviceManagement/intents', useBeta: true },
};

async function fetchGraphData(
  accessToken: string,
  resourceId: string
): Promise<any[]> {
  const config = GRAPH_ENDPOINTS[resourceId];
  if (!config) return [];

  const baseUrl = config.useBeta
    ? 'https://graph.microsoft.com/beta'
    : 'https://graph.microsoft.com/v1.0';

  try {
    const response = await fetch(`${baseUrl}/${config.endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error(`Error fetching ${resourceId}:`, error);
    return [];
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

    const { configId, runNow } = await req.json().catch(() => ({}));
    const now = new Date();

    console.log(`Automated backup triggered at ${now.toISOString()}, configId: ${configId || 'all'}`);

    // Get backup configurations to run
    let query = supabase
      .from('automated_backup_configs')
      .select('*')
      .eq('is_active', true);

    if (configId) {
      query = query.eq('id', configId);
    }

    const { data: configs, error: configError } = await query;

    if (configError) {
      throw new Error(`Failed to fetch backup configs: ${configError.message}`);
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active backup configurations found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const config of configs as BackupConfig[]) {
      // Check if should run based on schedule
      const shouldRun = runNow || configId || shouldRunNow(config.schedule_cron, config.last_run_at);
      
      if (!shouldRun) {
        console.log(`Skipping backup config ${config.name} - not scheduled to run`);
        continue;
      }

      console.log(`Processing backup config: ${config.name}`);

      // Create backup run record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.retention_days);

      const { data: backupRun, error: runError } = await supabase
        .from('automated_backup_runs')
        .insert({
          user_id: config.user_id,
          config_id: config.id,
          status: 'running',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (runError) {
        console.error(`Failed to create backup run for ${config.name}:`, runError);
        continue;
      }

      try {
        // Get target tenants
        const tenants = await getTargetTenants(supabase, config);

        await supabase
          .from('automated_backup_runs')
          .update({ total_tenants: tenants.length })
          .eq('id', backupRun.id);

        const tenantResults: any[] = [];
        const exportJobIds: string[] = [];
        let completedCount = 0;
        let failedCount = 0;
        let totalResources = 0;

        // Process each tenant
        for (const tenant of tenants) {
          try {
            // Get credentials
            const { data: credentials } = await supabase.rpc('get_decrypted_credential', {
              p_tenant_connection_id: tenant.id,
              p_user_id: config.user_id,
            });

            if (!credentials || credentials.length === 0) {
              failedCount++;
              tenantResults.push({
                tenantId: tenant.id,
                tenantName: tenant.display_name || tenant.tenant_name,
                status: 'failed',
                error: 'No credentials found',
              });
              continue;
            }

            const cred = credentials[0];
            const accessToken = await getGraphAccessToken(
              cred.client_id,
              cred.client_secret,
              cred.tenant_id
            );

            // Create export job
            const { data: exportJob, error: exportError } = await supabase
              .from('export_jobs')
              .insert({
                user_id: config.user_id,
                name: `[Backup] ${config.name} - ${tenant.display_name || tenant.tenant_name}`,
                status: 'running',
                categories: config.resource_ids,
                formats: config.formats,
                tenant_connection_id: tenant.id,
                metadata: {
                  automated_backup: true,
                  backup_config_id: config.id,
                  backup_run_id: backupRun.id,
                },
              })
              .select()
              .single();

            if (exportError || !exportJob) {
              failedCount++;
              continue;
            }

            exportJobIds.push(exportJob.id);

            // Fetch and store resources
            let resourceCount = 0;
            for (const resourceId of config.resource_ids) {
              try {
                const resources = await fetchGraphData(accessToken, resourceId);
                
                for (const resource of resources) {
                  await supabase.from('exported_resources').insert({
                    export_job_id: exportJob.id,
                    category: resourceId.split('/')[0],
                    resource_type: resourceId,
                    resource_id: resource.id || resource['@odata.id'],
                    resource_name: resource.displayName || resource.name || 'Unnamed',
                    data: resource,
                  });
                  resourceCount++;
                }
              } catch (resError) {
                console.error(`Error exporting ${resourceId}:`, resError);
              }
            }

            // Complete export job
            await supabase
              .from('export_jobs')
              .update({
                status: 'completed',
                progress: 100,
                completed_at: new Date().toISOString(),
              })
              .eq('id', exportJob.id);

            totalResources += resourceCount;
            completedCount++;
            tenantResults.push({
              tenantId: tenant.id,
              tenantName: tenant.display_name || tenant.tenant_name,
              status: 'completed',
              resourceCount,
              exportJobId: exportJob.id,
            });

          } catch (tenantError) {
            failedCount++;
            tenantResults.push({
              tenantId: tenant.id,
              tenantName: tenant.display_name || tenant.tenant_name,
              status: 'failed',
              error: tenantError instanceof Error ? tenantError.message : 'Unknown error',
            });
          }

          // Update progress
          await supabase
            .from('automated_backup_runs')
            .update({
              completed_tenants: completedCount,
              failed_tenants: failedCount,
            })
            .eq('id', backupRun.id);
        }

        // Complete backup run
        await supabase
          .from('automated_backup_runs')
          .update({
            status: failedCount === tenants.length ? 'failed' : 'completed',
            completed_at: new Date().toISOString(),
            completed_tenants: completedCount,
            failed_tenants: failedCount,
            total_resources: totalResources,
            export_job_ids: exportJobIds,
            results: tenantResults,
          })
          .eq('id', backupRun.id);

        // Update config with last run info
        await supabase
          .from('automated_backup_configs')
          .update({
            last_run_at: now.toISOString(),
            last_run_success: failedCount < tenants.length,
            run_count: config.run_count + 1,
          })
          .eq('id', config.id);

        // Cleanup old backups if enabled
        if (config.auto_cleanup) {
          const cleanup = await cleanupOldBackups(
            supabase,
            config.id,
            config.retention_days,
            config.max_backups
          );
          console.log(`Cleaned up ${cleanup.deleted} old backup runs for ${config.name}`);
        }

        results.push({
          configId: config.id,
          configName: config.name,
          runId: backupRun.id,
          tenantsProcessed: tenants.length,
          completed: completedCount,
          failed: failedCount,
          totalResources,
        });

      } catch (configError) {
        console.error(`Error processing backup config ${config.name}:`, configError);
        
        await supabase
          .from('automated_backup_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: configError instanceof Error ? configError.message : 'Unknown error',
          })
          .eq('id', backupRun.id);

        results.push({
          configId: config.id,
          configName: config.name,
          runId: backupRun.id,
          error: configError instanceof Error ? configError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-automated-backup:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
