import { supabase } from '@/integrations/supabase/client';
import { TenantHealthStatus } from '@/types/tenant';

export interface TenantHealthCheck {
  id: string;
  userId: string;
  tenantConnectionId: string;
  healthStatus: TenantHealthStatus;
  responseTimeMs?: number;
  checkType: 'manual' | 'scheduled' | 'realtime';
  details?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
}

export interface TenantHealthSummary {
  tenantId: string;
  tenantConnectionId: string;
  tenantName: string;
  displayName?: string;
  customerId?: string;
  customerName?: string;
  tenantGroupId?: string;
  tenantGroupName?: string;
  environment?: string;
  healthStatus: TenantHealthStatus;
  lastHealthCheck?: Date;
  responseTimeMs?: number;
  tags?: string[];
}

// Helper to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Sanitize database errors to prevent information leakage
function sanitizeDatabaseError(error: unknown, operation: string): Error {
  console.error(`Database error (${operation}):`, error);
  return new Error(`Failed to ${operation}. Please try again.`);
}

// Create a health check record
export async function createHealthCheck(check: {
  tenantConnectionId: string;
  healthStatus: TenantHealthStatus;
  responseTimeMs?: number;
  checkType?: 'manual' | 'scheduled' | 'realtime';
  details?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<TenantHealthCheck> {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('tenant_health_checks')
    .insert([{
      user_id: userId,
      tenant_connection_id: check.tenantConnectionId,
      health_status: check.healthStatus,
      response_time_ms: check.responseTimeMs ?? null,
      check_type: check.checkType || 'manual',
      details: JSON.parse(JSON.stringify(check.details || {})),
      error_message: check.errorMessage ?? null,
    }])
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create health check');
  return mapHealthCheckFromDb(data);
}

// Update tenant connection health status
export async function updateTenantHealth(
  connectionId: string, 
  healthStatus: TenantHealthStatus
): Promise<void> {
  const { error } = await supabase
    .from('tenant_connections')
    .update({
      health_status: healthStatus,
      last_health_check: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) throw sanitizeDatabaseError(error, 'update tenant health');
}

// Get health checks for a tenant
export async function getHealthChecks(
  tenantConnectionId: string,
  limit = 50
): Promise<TenantHealthCheck[]> {
  const { data, error } = await supabase
    .from('tenant_health_checks')
    .select('*')
    .eq('tenant_connection_id', tenantConnectionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw sanitizeDatabaseError(error, 'fetch health checks');
  return (data || []).map(mapHealthCheckFromDb);
}

// Get all tenant health summaries for the user
export async function getTenantHealthSummaries(): Promise<TenantHealthSummary[]> {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select(`
      id,
      tenant_id,
      tenant_name,
      display_name,
      customer_id,
      tenant_group_id,
      environment,
      health_status,
      last_health_check,
      tags,
      status,
      customers (
        id,
        name
      ),
      tenant_groups (
        id,
        name
      )
    `)
    .eq('status', 'connected')
    .order('tenant_name', { ascending: true });

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant health summaries');
  
  return (data || []).map((row: Record<string, unknown>) => ({
    tenantId: row.tenant_id as string,
    tenantConnectionId: row.id as string,
    tenantName: row.tenant_name as string,
    displayName: row.display_name as string | undefined,
    customerId: row.customer_id as string | undefined,
    customerName: (row.customers as { name?: string } | null)?.name,
    tenantGroupId: row.tenant_group_id as string | undefined,
    tenantGroupName: (row.tenant_groups as { name?: string } | null)?.name,
    environment: row.environment as string | undefined,
    healthStatus: (row.health_status as TenantHealthStatus) || 'unknown',
    lastHealthCheck: row.last_health_check ? new Date(row.last_health_check as string) : undefined,
    tags: row.tags as string[] | undefined,
  }));
}

// Get health stats by status
export async function getHealthStats(): Promise<{
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('health_status')
    .eq('status', 'connected');

  if (error) throw sanitizeDatabaseError(error, 'fetch health stats');
  
  const stats = {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    total: data?.length || 0,
  };

  (data || []).forEach((row) => {
    const status = row.health_status as TenantHealthStatus || 'unknown';
    if (status in stats) {
      stats[status as keyof typeof stats]++;
    }
  });

  return stats;
}

// Get recent health check history across all tenants
export async function getRecentHealthActivity(limit = 20): Promise<(TenantHealthCheck & { tenantName: string })[]> {
  const { data, error } = await supabase
    .from('tenant_health_checks')
    .select(`
      *,
      tenant_connections (
        tenant_name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw sanitizeDatabaseError(error, 'fetch recent health activity');
  
  return (data || []).map((row: Record<string, unknown>) => ({
    ...mapHealthCheckFromDb(row),
    tenantName: (row.tenant_connections as { tenant_name?: string } | null)?.tenant_name || 'Unknown',
  }));
}

// Subscribe to tenant health changes
export function subscribeToTenantHealth(callback: (payload: unknown) => void) {
  const channel = supabase
    .channel('tenant-health-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tenant_connections',
      },
      (payload) => {
        callback(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tenant_health_checks',
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function mapHealthCheckFromDb(row: Record<string, unknown>): TenantHealthCheck {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tenantConnectionId: row.tenant_connection_id as string,
    healthStatus: (row.health_status as TenantHealthStatus) || 'unknown',
    responseTimeMs: row.response_time_ms as number | undefined,
    checkType: (row.check_type as 'manual' | 'scheduled' | 'realtime') || 'manual',
    details: row.details as Record<string, unknown> | undefined,
    errorMessage: row.error_message as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}
