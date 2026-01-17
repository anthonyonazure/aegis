import { supabase } from '@/integrations/supabase/client';

export interface ScheduledDriftConfig {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_type: 'all' | 'customer' | 'group' | 'selected';
  target_customer_id: string | null;
  target_group_id: string | null;
  target_tenant_ids: string[];
  schedule_cron: string;
  schedule_description: string | null;
  is_active: boolean;
  baseline_export_id: string | null;
  resource_ids: string[];
  service_principal_config_id: string | null;
  notify_on_drift: boolean;
  drift_threshold_percent: number | null;
  webhook_config_id: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  last_drift_detected: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledDriftRun {
  id: string;
  scheduled_config_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  total_tenants: number;
  completed_tenants: number;
  failed_tenants: number;
  tenants_with_drift: number;
  results: DriftRunResult[];
  error_message: string | null;
  created_at: string;
}

export interface DriftRunResult {
  tenant_id: string;
  tenant_name: string;
  status: 'success' | 'failed' | 'skipped';
  drift_detected: boolean;
  added_count: number;
  modified_count: number;
  removed_count: number;
  error?: string;
}

export interface CreateScheduledDriftConfigInput {
  name: string;
  description?: string;
  target_type: 'all' | 'customer' | 'group' | 'selected';
  target_customer_id?: string;
  target_group_id?: string;
  target_tenant_ids?: string[];
  schedule_cron: string;
  schedule_description?: string;
  baseline_export_id?: string;
  resource_ids?: string[];
  service_principal_config_id?: string;
  notify_on_drift?: boolean;
  drift_threshold_percent?: number;
  webhook_config_id?: string;
}

// CRUD operations for scheduled drift configs
export async function createScheduledDriftConfig(input: CreateScheduledDriftConfigInput): Promise<ScheduledDriftConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const nextRun = calculateNextRun(input.schedule_cron);

  const { data, error } = await supabase
    .from('scheduled_drift_configs')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      target_type: input.target_type,
      target_customer_id: input.target_customer_id || null,
      target_group_id: input.target_group_id || null,
      target_tenant_ids: input.target_tenant_ids || [],
      schedule_cron: input.schedule_cron,
      schedule_description: input.schedule_description || null,
      baseline_export_id: input.baseline_export_id || null,
      resource_ids: input.resource_ids || [],
      service_principal_config_id: input.service_principal_config_id || null,
      notify_on_drift: input.notify_on_drift ?? true,
      drift_threshold_percent: input.drift_threshold_percent || 5,
      webhook_config_id: input.webhook_config_id || null,
      next_run_at: nextRun,
    })
    .select()
    .single();

  if (error) throw error;
  return mapScheduledDriftConfig(data);
}

export async function updateScheduledDriftConfig(
  id: string, 
  updates: Partial<CreateScheduledDriftConfigInput> & { is_active?: boolean }
): Promise<ScheduledDriftConfig> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.target_type !== undefined) updateData.target_type = updates.target_type;
  if (updates.target_customer_id !== undefined) updateData.target_customer_id = updates.target_customer_id;
  if (updates.target_group_id !== undefined) updateData.target_group_id = updates.target_group_id;
  if (updates.target_tenant_ids !== undefined) updateData.target_tenant_ids = updates.target_tenant_ids;
  if (updates.schedule_cron !== undefined) {
    updateData.schedule_cron = updates.schedule_cron;
    updateData.next_run_at = calculateNextRun(updates.schedule_cron);
  }
  if (updates.schedule_description !== undefined) updateData.schedule_description = updates.schedule_description;
  if (updates.baseline_export_id !== undefined) updateData.baseline_export_id = updates.baseline_export_id;
  if (updates.resource_ids !== undefined) updateData.resource_ids = updates.resource_ids;
  if (updates.service_principal_config_id !== undefined) updateData.service_principal_config_id = updates.service_principal_config_id;
  if (updates.notify_on_drift !== undefined) updateData.notify_on_drift = updates.notify_on_drift;
  if (updates.drift_threshold_percent !== undefined) updateData.drift_threshold_percent = updates.drift_threshold_percent;
  if (updates.webhook_config_id !== undefined) updateData.webhook_config_id = updates.webhook_config_id;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('scheduled_drift_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapScheduledDriftConfig(data);
}

export async function deleteScheduledDriftConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_drift_configs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getScheduledDriftConfigs(): Promise<ScheduledDriftConfig[]> {
  const { data, error } = await supabase
    .from('scheduled_drift_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapScheduledDriftConfig);
}

export async function getScheduledDriftConfig(id: string): Promise<ScheduledDriftConfig | null> {
  const { data, error } = await supabase
    .from('scheduled_drift_configs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapScheduledDriftConfig(data);
}

// CRUD operations for scheduled drift runs
export async function getScheduledDriftRuns(configId?: string): Promise<ScheduledDriftRun[]> {
  let query = supabase
    .from('scheduled_drift_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (configId) {
    query = query.eq('scheduled_config_id', configId);
  }

  const { data, error } = await query.limit(100);

  if (error) throw error;
  return (data || []).map(mapScheduledDriftRun);
}

export async function getScheduledDriftRun(id: string): Promise<ScheduledDriftRun | null> {
  const { data, error } = await supabase
    .from('scheduled_drift_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapScheduledDriftRun(data);
}

export async function createScheduledDriftRun(configId: string): Promise<ScheduledDriftRun> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('scheduled_drift_runs')
    .insert({
      scheduled_config_id: configId,
      user_id: user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return mapScheduledDriftRun(data);
}

export async function updateScheduledDriftRun(
  id: string,
  updates: Partial<{
    status: string;
    started_at: string;
    completed_at: string;
    total_tenants: number;
    completed_tenants: number;
    failed_tenants: number;
    tenants_with_drift: number;
    results: unknown[];
    error_message: string;
  }>
): Promise<ScheduledDriftRun> {
  const { data, error } = await supabase
    .from('scheduled_drift_runs')
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapScheduledDriftRun(data);
}

// Helper to calculate next run from cron expression
function calculateNextRun(cronExpression: string): string {
  // Simple cron parsing for common patterns
  // In production, use a proper cron library
  const now = new Date();
  const parts = cronExpression.split(' ');
  
  if (parts.length !== 5) {
    // Default to 1 hour from now if invalid
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  // Very simplified - just add time based on pattern
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  if (minute === '0' && hour === '*') {
    // Every hour
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (minute === '0' && hour === '0') {
    // Daily at midnight
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.toISOString();
  } else if (dayOfWeek !== '*') {
    // Weekly
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    return next.toISOString();
  }
  
  // Default: 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

// Mappers
function mapScheduledDriftConfig(data: Record<string, unknown>): ScheduledDriftConfig {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    name: data.name as string,
    description: data.description as string | null,
    target_type: data.target_type as 'all' | 'customer' | 'group' | 'selected',
    target_customer_id: data.target_customer_id as string | null,
    target_group_id: data.target_group_id as string | null,
    target_tenant_ids: (data.target_tenant_ids as string[]) || [],
    schedule_cron: data.schedule_cron as string,
    schedule_description: data.schedule_description as string | null,
    is_active: data.is_active as boolean,
    baseline_export_id: data.baseline_export_id as string | null,
    resource_ids: (data.resource_ids as string[]) || [],
    service_principal_config_id: data.service_principal_config_id as string | null,
    notify_on_drift: data.notify_on_drift as boolean,
    drift_threshold_percent: data.drift_threshold_percent as number | null,
    webhook_config_id: data.webhook_config_id as string | null,
    last_run_at: data.last_run_at as string | null,
    next_run_at: data.next_run_at as string | null,
    run_count: data.run_count as number,
    last_drift_detected: data.last_drift_detected as boolean | null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

function mapScheduledDriftRun(data: Record<string, unknown>): ScheduledDriftRun {
  return {
    id: data.id as string,
    scheduled_config_id: data.scheduled_config_id as string,
    user_id: data.user_id as string,
    status: data.status as 'pending' | 'running' | 'completed' | 'failed',
    started_at: data.started_at as string | null,
    completed_at: data.completed_at as string | null,
    total_tenants: data.total_tenants as number,
    completed_tenants: data.completed_tenants as number,
    failed_tenants: data.failed_tenants as number,
    tenants_with_drift: data.tenants_with_drift as number,
    results: (data.results as DriftRunResult[]) || [],
    error_message: data.error_message as string | null,
    created_at: data.created_at as string,
  };
}

// Schedule presets for UI
export const SCHEDULE_PRESETS = [
  { id: 'hourly', label: 'Every Hour', cron: '0 * * * *', description: 'Runs at the start of every hour' },
  { id: 'daily', label: 'Daily', cron: '0 0 * * *', description: 'Runs daily at midnight UTC' },
  { id: 'daily-9am', label: 'Daily at 9 AM', cron: '0 9 * * *', description: 'Runs daily at 9 AM UTC' },
  { id: 'weekly', label: 'Weekly', cron: '0 0 * * 0', description: 'Runs every Sunday at midnight UTC' },
  { id: 'monthly', label: 'Monthly', cron: '0 0 1 * *', description: 'Runs on the 1st of every month' },
] as const;
