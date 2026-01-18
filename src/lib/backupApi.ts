import { supabase } from '@/integrations/supabase/client';

export interface BackupConfig {
  id: string;
  userId: string;
  name: string;
  description?: string;
  backupType: 'policy' | 'full' | 'selective';
  scheduleCron: string;
  scheduleDescription?: string;
  resourceIds: string[];
  formats: string[];
  targetType: 'all' | 'customer' | 'group' | 'selected';
  targetCustomerId?: string;
  targetGroupId?: string;
  targetTenantIds: string[];
  retentionDays: number;
  maxBackups: number;
  autoCleanup: boolean;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunSuccess?: boolean;
  nextRunAt?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupRun {
  id: string;
  userId: string;
  configId: string;
  configName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  totalTenants: number;
  completedTenants: number;
  failedTenants: number;
  totalResources: number;
  exportJobIds: string[];
  errorMessage?: string;
  results: any[];
  expiresAt?: Date;
  createdAt: Date;
}

export const SCHEDULE_PRESETS = [
  { label: 'Every night at 2 AM', cron: '0 2 * * *', description: 'Daily at 2:00 AM' },
  { label: 'Every night at midnight', cron: '0 0 * * *', description: 'Daily at midnight' },
  { label: 'Every 6 hours', cron: '0 */6 * * *', description: 'Every 6 hours' },
  { label: 'Every 12 hours', cron: '0 */12 * * *', description: 'Twice daily' },
  { label: 'Weekly (Sunday 2 AM)', cron: '0 2 * * 0', description: 'Weekly on Sunday at 2:00 AM' },
  { label: 'Weekly (Monday 2 AM)', cron: '0 2 * * 1', description: 'Weekly on Monday at 2:00 AM' },
  { label: 'Monthly (1st at 2 AM)', cron: '0 2 1 * *', description: 'Monthly on the 1st at 2:00 AM' },
];

export const BACKUP_TYPES = [
  { id: 'policy', label: 'Policy Backup', description: 'Backup configuration policies only' },
  { id: 'full', label: 'Full Backup', description: 'Backup all supported resources' },
  { id: 'selective', label: 'Selective Backup', description: 'Choose specific resources to backup' },
];

// Fetch all backup configurations
export async function getBackupConfigs(): Promise<BackupConfig[]> {
  const { data, error } = await supabase
    .from('automated_backup_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching backup configs:', error);
    throw new Error('Failed to fetch backup configurations');
  }

  return (data || []).map(mapBackupConfigFromDb);
}

// Create a new backup configuration
export async function createBackupConfig(config: {
  name: string;
  description?: string;
  backupType: string;
  scheduleCron: string;
  scheduleDescription?: string;
  resourceIds: string[];
  formats: string[];
  targetType: string;
  targetCustomerId?: string;
  targetGroupId?: string;
  targetTenantIds?: string[];
  retentionDays: number;
  maxBackups: number;
  autoCleanup: boolean;
}): Promise<BackupConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('automated_backup_configs')
    .insert({
      user_id: user.id,
      name: config.name,
      description: config.description,
      backup_type: config.backupType,
      schedule_cron: config.scheduleCron,
      schedule_description: config.scheduleDescription,
      resource_ids: config.resourceIds,
      formats: config.formats,
      target_type: config.targetType,
      target_customer_id: config.targetCustomerId,
      target_group_id: config.targetGroupId,
      target_tenant_ids: config.targetTenantIds || [],
      retention_days: config.retentionDays,
      max_backups: config.maxBackups,
      auto_cleanup: config.autoCleanup,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating backup config:', error);
    throw new Error('Failed to create backup configuration');
  }

  return mapBackupConfigFromDb(data);
}

// Update a backup configuration
export async function updateBackupConfig(
  id: string,
  updates: Partial<Omit<BackupConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<BackupConfig> {
  const updateData: Record<string, any> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.backupType !== undefined) updateData.backup_type = updates.backupType;
  if (updates.scheduleCron !== undefined) updateData.schedule_cron = updates.scheduleCron;
  if (updates.scheduleDescription !== undefined) updateData.schedule_description = updates.scheduleDescription;
  if (updates.resourceIds !== undefined) updateData.resource_ids = updates.resourceIds;
  if (updates.formats !== undefined) updateData.formats = updates.formats;
  if (updates.targetType !== undefined) updateData.target_type = updates.targetType;
  if (updates.targetCustomerId !== undefined) updateData.target_customer_id = updates.targetCustomerId;
  if (updates.targetGroupId !== undefined) updateData.target_group_id = updates.targetGroupId;
  if (updates.targetTenantIds !== undefined) updateData.target_tenant_ids = updates.targetTenantIds;
  if (updates.retentionDays !== undefined) updateData.retention_days = updates.retentionDays;
  if (updates.maxBackups !== undefined) updateData.max_backups = updates.maxBackups;
  if (updates.autoCleanup !== undefined) updateData.auto_cleanup = updates.autoCleanup;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('automated_backup_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating backup config:', error);
    throw new Error('Failed to update backup configuration');
  }

  return mapBackupConfigFromDb(data);
}

// Delete a backup configuration
export async function deleteBackupConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from('automated_backup_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting backup config:', error);
    throw new Error('Failed to delete backup configuration');
  }
}

// Get backup runs for a configuration
export async function getBackupRuns(configId?: string): Promise<BackupRun[]> {
  let query = supabase
    .from('automated_backup_runs')
    .select(`
      *,
      automated_backup_configs (
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (configId) {
    query = query.eq('config_id', configId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching backup runs:', error);
    throw new Error('Failed to fetch backup runs');
  }

  return (data || []).map((run: any) => ({
    id: run.id,
    userId: run.user_id,
    configId: run.config_id,
    configName: run.automated_backup_configs?.name,
    status: run.status,
    startedAt: run.started_at ? new Date(run.started_at) : undefined,
    completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
    totalTenants: run.total_tenants,
    completedTenants: run.completed_tenants,
    failedTenants: run.failed_tenants,
    totalResources: run.total_resources,
    exportJobIds: run.export_job_ids || [],
    errorMessage: run.error_message,
    results: run.results || [],
    expiresAt: run.expires_at ? new Date(run.expires_at) : undefined,
    createdAt: new Date(run.created_at),
  }));
}

// Trigger a backup run manually
export async function triggerBackupRun(configId: string): Promise<{ success: boolean; runId?: string }> {
  const { data, error } = await supabase.functions.invoke('run-automated-backup', {
    body: { configId, runNow: true },
  });

  if (error) {
    console.error('Error triggering backup:', error);
    throw new Error('Failed to trigger backup');
  }

  return {
    success: data?.success || false,
    runId: data?.results?.[0]?.runId,
  };
}

// Delete a backup run
export async function deleteBackupRun(id: string): Promise<void> {
  const { error } = await supabase
    .from('automated_backup_runs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting backup run:', error);
    throw new Error('Failed to delete backup run');
  }
}

// Get backup statistics
export async function getBackupStats(): Promise<{
  totalConfigs: number;
  activeConfigs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalResourcesBackedUp: number;
}> {
  const [configsResult, runsResult] = await Promise.all([
    supabase.from('automated_backup_configs').select('id, is_active'),
    supabase.from('automated_backup_runs').select('id, status, total_resources'),
  ]);

  const configs = configsResult.data || [];
  const runs = runsResult.data || [];

  return {
    totalConfigs: configs.length,
    activeConfigs: configs.filter((c: any) => c.is_active).length,
    totalRuns: runs.length,
    successfulRuns: runs.filter((r: any) => r.status === 'completed').length,
    failedRuns: runs.filter((r: any) => r.status === 'failed').length,
    totalResourcesBackedUp: runs.reduce((sum: number, r: any) => sum + (r.total_resources || 0), 0),
  };
}

function mapBackupConfigFromDb(row: any): BackupConfig {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    backupType: row.backup_type,
    scheduleCron: row.schedule_cron,
    scheduleDescription: row.schedule_description,
    resourceIds: row.resource_ids || [],
    formats: row.formats || [],
    targetType: row.target_type,
    targetCustomerId: row.target_customer_id,
    targetGroupId: row.target_group_id,
    targetTenantIds: row.target_tenant_ids || [],
    retentionDays: row.retention_days,
    maxBackups: row.max_backups,
    autoCleanup: row.auto_cleanup,
    isActive: row.is_active,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
    lastRunSuccess: row.last_run_success,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
    runCount: row.run_count,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
