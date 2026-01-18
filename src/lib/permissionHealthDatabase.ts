import { supabase } from '@/integrations/supabase/client';
import { LiveValidationResult } from './permissionValidator';

export interface PermissionHealthCheck {
  id: string;
  user_id: string;
  tenant_connection_id: string | null;
  created_at: string;
  total_resources: number;
  passed_count: number;
  failed_count: number;
  avg_response_time_ms: number | null;
  results: LiveValidationResult[];
  graph_passed: number;
  graph_failed: number;
  azure_passed: number;
  azure_failed: number;
  test_type: 'manual' | 'scheduled' | 'pre-export';
  notes: string | null;
}

export interface PermissionChange {
  id: string;
  user_id: string;
  tenant_connection_id: string | null;
  created_at: string;
  resource_id: string;
  resource_name: string;
  provider: 'graph' | 'azure';
  change_type: 'gained' | 'lost' | 'recovered';
  previous_status: boolean | null;
  current_status: boolean;
  health_check_id: string | null;
  error_message: string | null;
}

export interface HealthTrend {
  date: string;
  passed: number;
  failed: number;
  total: number;
  successRate: number;
}

/**
 * Save a permission health check result
 */
export async function savePermissionHealthCheck(
  results: LiveValidationResult[],
  tenantConnectionId: string | null,
  testType: 'manual' | 'scheduled' | 'pre-export' = 'manual',
  notes?: string
): Promise<PermissionHealthCheck | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const graphResults = results.filter(r => r.provider === 'graph');
  const azureResults = results.filter(r => r.provider === 'azure');

  const insertData = {
    user_id: userData.user.id,
    tenant_connection_id: tenantConnectionId,
    total_resources: results.length,
    passed_count: results.filter(r => r.success).length,
    failed_count: results.filter(r => !r.success).length,
    avg_response_time_ms: results.length > 0 
      ? Math.round(results.reduce((acc, r) => acc + r.responseTime, 0) / results.length)
      : null,
    results: JSON.parse(JSON.stringify(results)),
    graph_passed: graphResults.filter(r => r.success).length,
    graph_failed: graphResults.filter(r => !r.success).length,
    azure_passed: azureResults.filter(r => r.success).length,
    azure_failed: azureResults.filter(r => !r.success).length,
    test_type: testType,
    notes: notes || null,
  };

  const { data, error } = await supabase
    .from('permission_health_checks')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Failed to save health check:', error);
    return null;
  }

  // Detect and save permission changes
  await detectAndSaveChanges(
    userData.user.id,
    tenantConnectionId,
    results,
    data.id
  );

  return {
    ...data,
    results: data.results as unknown as LiveValidationResult[],
    test_type: data.test_type as 'manual' | 'scheduled' | 'pre-export',
  };
}

/**
 * Detect permission changes compared to the last health check
 */
async function detectAndSaveChanges(
  userId: string,
  tenantConnectionId: string | null,
  currentResults: LiveValidationResult[],
  healthCheckId: string
): Promise<void> {
  // Get the previous health check
  const { data: previousCheck } = await supabase
    .from('permission_health_checks')
    .select('results')
    .eq('user_id', userId)
    .eq('tenant_connection_id', tenantConnectionId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (!previousCheck || previousCheck.length < 2) {
    // No previous check to compare against
    return;
  }

  const previousResults = previousCheck[1].results as unknown as LiveValidationResult[];
  const previousMap = new Map(previousResults.map(r => [r.resourceId, r.success]));

  const changes: Omit<PermissionChange, 'id' | 'created_at'>[] = [];

  for (const current of currentResults) {
    const previousStatus = previousMap.get(current.resourceId);
    
    if (previousStatus === undefined) {
      // New resource being tested
      continue;
    }

    if (previousStatus !== current.success) {
      changes.push({
        user_id: userId,
        tenant_connection_id: tenantConnectionId,
        resource_id: current.resourceId,
        resource_name: current.resourceName,
        provider: current.provider,
        change_type: current.success 
          ? (previousStatus === false ? 'recovered' : 'gained')
          : 'lost',
        previous_status: previousStatus,
        current_status: current.success,
        health_check_id: healthCheckId,
        error_message: current.error || null,
      });
    }
  }

  if (changes.length > 0) {
    await supabase.from('permission_changes').insert(changes);
  }
}

/**
 * Get recent health checks
 */
export async function getRecentHealthChecks(
  limit: number = 20,
  tenantConnectionId?: string
): Promise<PermissionHealthCheck[]> {
  let query = supabase
    .from('permission_health_checks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch health checks:', error);
    return [];
  }

  return data.map(d => ({
    ...d,
    results: d.results as unknown as LiveValidationResult[],
    test_type: d.test_type as 'manual' | 'scheduled' | 'pre-export',
  }));
}

/**
 * Get recent permission changes
 */
export async function getRecentPermissionChanges(
  limit: number = 50,
  tenantConnectionId?: string
): Promise<PermissionChange[]> {
  let query = supabase
    .from('permission_changes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch permission changes:', error);
    return [];
  }

  return data.map(d => ({
    ...d,
    provider: d.provider as 'graph' | 'azure',
    change_type: d.change_type as 'gained' | 'lost' | 'recovered',
  }));
}

/**
 * Get health trend data for charts
 */
export async function getHealthTrend(
  days: number = 30,
  tenantConnectionId?: string
): Promise<HealthTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('permission_health_checks')
    .select('created_at, passed_count, failed_count, total_resources')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch health trend:', error);
    return [];
  }

  // Group by date
  const grouped = new Map<string, { passed: number; failed: number; total: number; count: number }>();

  for (const check of data) {
    const date = new Date(check.created_at).toISOString().split('T')[0];
    const existing = grouped.get(date) || { passed: 0, failed: 0, total: 0, count: 0 };
    grouped.set(date, {
      passed: existing.passed + check.passed_count,
      failed: existing.failed + check.failed_count,
      total: existing.total + check.total_resources,
      count: existing.count + 1,
    });
  }

  return Array.from(grouped.entries()).map(([date, stats]) => ({
    date,
    passed: Math.round(stats.passed / stats.count),
    failed: Math.round(stats.failed / stats.count),
    total: Math.round(stats.total / stats.count),
    successRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
  }));
}

/**
 * Get summary stats
 */
export async function getHealthSummary(tenantConnectionId?: string): Promise<{
  latestCheck: PermissionHealthCheck | null;
  checksLast7Days: number;
  changesLast7Days: number;
  currentSuccessRate: number;
  previousSuccessRate: number;
  trend: 'up' | 'down' | 'stable';
}> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get latest check
  let latestQuery = supabase
    .from('permission_health_checks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (tenantConnectionId) {
    latestQuery = latestQuery.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data: latestData } = await latestQuery;
  const latestCheck = latestData?.[0] ? {
    ...latestData[0],
    results: latestData[0].results as unknown as LiveValidationResult[],
    test_type: latestData[0].test_type as 'manual' | 'scheduled' | 'pre-export',
  } : null;

  // Count checks in last 7 days
  let checksQuery = supabase
    .from('permission_health_checks')
    .select('id', { count: 'exact' })
    .gte('created_at', oneWeekAgo.toISOString());

  if (tenantConnectionId) {
    checksQuery = checksQuery.eq('tenant_connection_id', tenantConnectionId);
  }

  const { count: checksCount } = await checksQuery;

  // Count changes in last 7 days
  let changesQuery = supabase
    .from('permission_changes')
    .select('id', { count: 'exact' })
    .gte('created_at', oneWeekAgo.toISOString());

  if (tenantConnectionId) {
    changesQuery = changesQuery.eq('tenant_connection_id', tenantConnectionId);
  }

  const { count: changesCount } = await changesQuery;

  // Get previous check for trend comparison
  let previousQuery = supabase
    .from('permission_health_checks')
    .select('passed_count, total_resources')
    .order('created_at', { ascending: false })
    .limit(2);

  if (tenantConnectionId) {
    previousQuery = previousQuery.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data: previousData } = await previousQuery;

  const currentSuccessRate = latestCheck && latestCheck.total_resources > 0
    ? Math.round((latestCheck.passed_count / latestCheck.total_resources) * 100)
    : 0;

  const previousSuccessRate = previousData?.[1] && previousData[1].total_resources > 0
    ? Math.round((previousData[1].passed_count / previousData[1].total_resources) * 100)
    : currentSuccessRate;

  const trend = currentSuccessRate > previousSuccessRate 
    ? 'up' 
    : currentSuccessRate < previousSuccessRate 
      ? 'down' 
      : 'stable';

  return {
    latestCheck,
    checksLast7Days: checksCount || 0,
    changesLast7Days: changesCount || 0,
    currentSuccessRate,
    previousSuccessRate,
    trend,
  };
}

/**
 * Delete old health checks (cleanup)
 */
export async function cleanupOldHealthChecks(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { data, error } = await supabase
    .from('permission_health_checks')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to cleanup old health checks:', error);
    return 0;
  }

  return data?.length || 0;
}