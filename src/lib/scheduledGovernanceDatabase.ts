import { supabase } from "@/integrations/supabase/client";

export interface ScheduledGovernanceConfig {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  schedule_cron: string;
  schedule_description: string | null;
  is_active: boolean;
  target_type: string;
  target_tenant_ids: string[] | null;
  target_customer_id: string | null;
  target_group_id: string | null;
  secure_score_threshold: number | null;
  mfa_coverage_threshold: number | null;
  license_utilization_threshold: number | null;
  alert_on_risky_users: boolean | null;
  alert_on_risky_signins: boolean | null;
  notify_on_completion: boolean | null;
  notify_on_threshold_breach: boolean | null;
  webhook_config_id: string | null;
  run_count: number;
  last_run_at: string | null;
  last_run_success: boolean | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledGovernanceRun {
  id: string;
  scheduled_config_id: string;
  user_id: string;
  status: string;
  total_tenants: number;
  completed_tenants: number;
  failed_tenants: number;
  tenants_with_alerts: number;
  results: any | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateGovernanceConfigInput {
  name: string;
  description?: string;
  schedule_cron: string;
  schedule_description?: string;
  target_type: string;
  target_tenant_ids?: string[];
  target_customer_id?: string;
  target_group_id?: string;
  secure_score_threshold?: number;
  mfa_coverage_threshold?: number;
  license_utilization_threshold?: number;
  alert_on_risky_users?: boolean;
  alert_on_risky_signins?: boolean;
  notify_on_completion?: boolean;
  notify_on_threshold_breach?: boolean;
  webhook_config_id?: string;
}

export async function getScheduledGovernanceConfigs(): Promise<ScheduledGovernanceConfig[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('scheduled_governance_configs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createScheduledGovernanceConfig(input: CreateGovernanceConfigInput): Promise<ScheduledGovernanceConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('scheduled_governance_configs')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description,
      schedule_cron: input.schedule_cron,
      schedule_description: input.schedule_description,
      target_type: input.target_type,
      target_tenant_ids: input.target_tenant_ids,
      target_customer_id: input.target_customer_id,
      target_group_id: input.target_group_id,
      secure_score_threshold: input.secure_score_threshold ?? 50,
      mfa_coverage_threshold: input.mfa_coverage_threshold ?? 80,
      license_utilization_threshold: input.license_utilization_threshold ?? 70,
      alert_on_risky_users: input.alert_on_risky_users ?? true,
      alert_on_risky_signins: input.alert_on_risky_signins ?? true,
      notify_on_completion: input.notify_on_completion ?? false,
      notify_on_threshold_breach: input.notify_on_threshold_breach ?? true,
      webhook_config_id: input.webhook_config_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScheduledGovernanceConfig(
  id: string,
  updates: Partial<CreateGovernanceConfigInput> & { is_active?: boolean }
): Promise<ScheduledGovernanceConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('scheduled_governance_configs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteScheduledGovernanceConfig(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('scheduled_governance_configs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getScheduledGovernanceRuns(configId?: string): Promise<ScheduledGovernanceRun[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('scheduled_governance_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (configId) {
    query = query.eq('scheduled_config_id', configId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function runGovernanceScanManually(configId: string): Promise<{ success: boolean; runId?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('run-scheduled-governance', {
    body: { configId, manual: true },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}
