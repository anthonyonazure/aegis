import { supabase } from '@/integrations/supabase/client';

export interface GovernanceMetricsHistory {
  id: string;
  user_id: string;
  tenant_connection_id?: string;
  customer_id?: string;
  secure_score: number;
  max_secure_score: number;
  risky_sign_ins: number;
  conditional_access_policies: number;
  total_users: number;
  admin_users: number;
  guest_users: number;
  mfa_enabled_users: number;
  risky_users: number;
  stale_accounts: number;
  total_licenses: number;
  assigned_licenses: number;
  unused_licenses: number;
  license_utilization: number;
  license_cost_monthly: number;
  compliance_score: number;
  critical_actions: number;
  high_actions: number;
  medium_actions: number;
  low_actions: number;
  recorded_at: string;
  created_at: string;
}

export interface GovernanceMetricsInput {
  tenant_connection_id?: string;
  customer_id?: string;
  secure_score: number;
  max_secure_score: number;
  risky_sign_ins: number;
  conditional_access_policies: number;
  total_users: number;
  admin_users: number;
  guest_users: number;
  mfa_enabled_users: number;
  risky_users: number;
  stale_accounts: number;
  total_licenses: number;
  assigned_licenses: number;
  unused_licenses: number;
  license_utilization: number;
  license_cost_monthly: number;
  compliance_score: number;
  critical_actions: number;
  high_actions: number;
  medium_actions: number;
  low_actions: number;
}

export async function saveGovernanceMetrics(metrics: GovernanceMetricsInput): Promise<GovernanceMetricsHistory | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('governance_metrics_history')
    .insert({
      user_id: user.id,
      ...metrics,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save governance metrics:', error);
    return null;
  }

  return data as GovernanceMetricsHistory;
}

export async function getGovernanceHistory(options?: {
  tenantConnectionId?: string;
  customerId?: string;
  days?: number;
  limit?: number;
}): Promise<GovernanceMetricsHistory[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const days = options?.days || 30;
  const limit = options?.limit || 100;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('governance_metrics_history')
    .select('*')
    .eq('user_id', user.id)
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true })
    .limit(limit);

  if (options?.tenantConnectionId) {
    query = query.eq('tenant_connection_id', options.tenantConnectionId);
  }

  if (options?.customerId) {
    query = query.eq('customer_id', options.customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch governance history:', error);
    return [];
  }

  return (data || []) as GovernanceMetricsHistory[];
}

export async function getLatestGovernanceMetrics(tenantConnectionId?: string): Promise<GovernanceMetricsHistory | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from('governance_metrics_history')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })
    .limit(1);

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch latest governance metrics:', error);
    return null;
  }

  return data?.[0] as GovernanceMetricsHistory || null;
}

export async function deleteOldGovernanceHistory(daysToKeep: number = 90): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { data, error } = await supabase
    .from('governance_metrics_history')
    .delete()
    .eq('user_id', user.id)
    .lt('recorded_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to delete old governance history:', error);
    return 0;
  }

  return data?.length || 0;
}
