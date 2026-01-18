import { supabase } from '@/integrations/supabase/client';

export interface ScheduledDeploymentConfig {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  policy_template_id: string;
  target_type: 'all' | 'customer' | 'group' | 'selected';
  target_customer_id: string | null;
  target_group_id: string | null;
  target_tenant_ids: string[];
  schedule_cron: string;
  schedule_description: string | null;
  is_active: boolean;
  dry_run: boolean;
  notify_on_completion: boolean;
  webhook_config_id: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  last_run_success: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledDeploymentRun {
  id: string;
  scheduled_config_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  total_tenants: number;
  completed_tenants: number;
  failed_tenants: number;
  results: DeploymentRunResult[] | null;
  error_message: string | null;
  created_at: string;
}

export interface DeploymentRunResult {
  tenantId: string;
  tenantName: string;
  connectionId: string;
  status: 'success' | 'error' | 'skipped';
  changesApplied: number;
  error?: string;
}

export interface CreateScheduledDeploymentInput {
  name: string;
  description?: string;
  policy_template_id: string;
  target_type: 'all' | 'customer' | 'group' | 'selected';
  target_customer_id?: string;
  target_group_id?: string;
  target_tenant_ids?: string[];
  schedule_cron: string;
  schedule_description?: string;
  dry_run?: boolean;
  notify_on_completion?: boolean;
  webhook_config_id?: string;
}

export async function createScheduledDeployment(input: CreateScheduledDeploymentInput): Promise<ScheduledDeploymentConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const nextRun = calculateNextRun(input.schedule_cron);

  const { data, error } = await supabase
    .from('scheduled_deployment_configs')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      policy_template_id: input.policy_template_id,
      target_type: input.target_type,
      target_customer_id: input.target_customer_id || null,
      target_group_id: input.target_group_id || null,
      target_tenant_ids: input.target_tenant_ids || [],
      schedule_cron: input.schedule_cron,
      schedule_description: input.schedule_description || null,
      dry_run: input.dry_run ?? false,
      notify_on_completion: input.notify_on_completion ?? true,
      webhook_config_id: input.webhook_config_id || null,
      next_run_at: nextRun,
    })
    .select()
    .single();

  if (error) throw error;
  return mapConfig(data);
}

export async function updateScheduledDeployment(
  id: string,
  updates: Partial<CreateScheduledDeploymentInput> & { is_active?: boolean }
): Promise<ScheduledDeploymentConfig> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.policy_template_id !== undefined) updateData.policy_template_id = updates.policy_template_id;
  if (updates.target_type !== undefined) updateData.target_type = updates.target_type;
  if (updates.target_customer_id !== undefined) updateData.target_customer_id = updates.target_customer_id;
  if (updates.target_group_id !== undefined) updateData.target_group_id = updates.target_group_id;
  if (updates.target_tenant_ids !== undefined) updateData.target_tenant_ids = updates.target_tenant_ids;
  if (updates.schedule_cron !== undefined) {
    updateData.schedule_cron = updates.schedule_cron;
    updateData.next_run_at = calculateNextRun(updates.schedule_cron);
  }
  if (updates.schedule_description !== undefined) updateData.schedule_description = updates.schedule_description;
  if (updates.dry_run !== undefined) updateData.dry_run = updates.dry_run;
  if (updates.notify_on_completion !== undefined) updateData.notify_on_completion = updates.notify_on_completion;
  if (updates.webhook_config_id !== undefined) updateData.webhook_config_id = updates.webhook_config_id;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('scheduled_deployment_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapConfig(data);
}

export async function deleteScheduledDeployment(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_deployment_configs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getScheduledDeployments(): Promise<ScheduledDeploymentConfig[]> {
  const { data, error } = await supabase
    .from('scheduled_deployment_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapConfig);
}

export async function getScheduledDeployment(id: string): Promise<ScheduledDeploymentConfig | null> {
  const { data, error } = await supabase
    .from('scheduled_deployment_configs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapConfig(data);
}

export async function getScheduledDeploymentRuns(configId?: string): Promise<ScheduledDeploymentRun[]> {
  let query = supabase
    .from('scheduled_deployment_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (configId) {
    query = query.eq('scheduled_config_id', configId);
  }

  const { data, error } = await query.limit(100);

  if (error) throw error;
  return (data || []).map(mapRun);
}

export async function triggerScheduledDeployment(configId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('run-scheduled-deployment', {
    body: { configId },
  });

  if (error) throw error;
}

function calculateNextRun(cronExpression: string): string {
  const now = new Date();
  const parts = cronExpression.split(' ');

  if (parts.length !== 5) {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  const [minute, hour] = parts;

  if (minute === '0' && hour === '*') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (minute === '0' && hour === '0') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.toISOString();
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function mapConfig(data: Record<string, unknown>): ScheduledDeploymentConfig {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    name: data.name as string,
    description: data.description as string | null,
    policy_template_id: data.policy_template_id as string,
    target_type: data.target_type as 'all' | 'customer' | 'group' | 'selected',
    target_customer_id: data.target_customer_id as string | null,
    target_group_id: data.target_group_id as string | null,
    target_tenant_ids: (data.target_tenant_ids as string[]) || [],
    schedule_cron: data.schedule_cron as string,
    schedule_description: data.schedule_description as string | null,
    is_active: data.is_active as boolean,
    dry_run: data.dry_run as boolean,
    notify_on_completion: data.notify_on_completion as boolean,
    webhook_config_id: data.webhook_config_id as string | null,
    last_run_at: data.last_run_at as string | null,
    next_run_at: data.next_run_at as string | null,
    run_count: data.run_count as number,
    last_run_success: data.last_run_success as boolean | null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

function mapRun(data: Record<string, unknown>): ScheduledDeploymentRun {
  const results = data.results as { tenants?: DeploymentRunResult[] } | null;
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
    results: results?.tenants || null,
    error_message: data.error_message as string | null,
    created_at: data.created_at as string,
  };
}

export const DEPLOYMENT_SCHEDULE_PRESETS = [
  { id: 'hourly', label: 'Every Hour', cron: '0 * * * *', description: 'Runs at the start of every hour' },
  { id: 'daily', label: 'Daily at Midnight', cron: '0 0 * * *', description: 'Runs daily at midnight UTC' },
  { id: 'daily-9am', label: 'Daily at 9 AM', cron: '0 9 * * *', description: 'Runs daily at 9 AM UTC' },
  { id: 'weekly', label: 'Weekly (Sunday)', cron: '0 0 * * 0', description: 'Runs every Sunday at midnight UTC' },
  { id: 'monthly', label: 'Monthly (1st)', cron: '0 0 1 * *', description: 'Runs on the 1st of every month' },
] as const;
