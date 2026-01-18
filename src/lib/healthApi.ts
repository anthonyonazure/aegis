import { supabase } from '@/integrations/supabase/client';
import { TenantHealthStatus } from '@/types/tenant';

const HEALTH_CHECK_FUNCTION = 'health-check';

export interface HealthCheckDetails {
  tokenValid: boolean;
  graphApiReachable: boolean;
  licenseInfo?: { hasLicenses: boolean; totalLicenses: number };
  organizationInfo?: { displayName: string; verifiedDomains: number };
  errorCode?: string;
  errorMessage?: string;
}

export interface HealthCheckResult {
  tenantConnectionId: string;
  tenantName: string;
  healthStatus: TenantHealthStatus;
  responseTimeMs: number;
  details: HealthCheckDetails;
}

export interface SingleHealthCheckResponse {
  success: boolean;
  result?: HealthCheckResult;
  error?: string;
}

export interface BulkHealthCheckResponse {
  success: boolean;
  results?: HealthCheckResult[];
  checked?: number;
  total?: number;
  error?: string;
}

/**
 * Perform a health check on a single tenant connection.
 * This calls the Microsoft Graph API to verify connectivity.
 */
export async function checkTenantHealth(
  tenantConnectionId: string
): Promise<SingleHealthCheckResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(HEALTH_CHECK_FUNCTION, {
      body: {
        action: 'check-single',
        tenantConnectionId,
      },
    });

    if (error) {
      console.error('Health check error:', error);
      return { success: false, error: 'Health check failed. Please try again.' };
    }

    return data as SingleHealthCheckResponse;
  } catch (err) {
    console.error('Health check exception:', err);
    return { success: false, error: 'Health check failed. Please try again.' };
  }
}

/**
 * Perform health checks on multiple tenant connections.
 * Limited to 50 tenants per request.
 */
export async function checkBulkTenantHealth(
  tenantConnectionIds: string[]
): Promise<BulkHealthCheckResponse> {
  try {
    if (tenantConnectionIds.length === 0) {
      return { success: true, results: [], checked: 0, total: 0 };
    }

    const { data, error } = await supabase.functions.invoke(HEALTH_CHECK_FUNCTION, {
      body: {
        action: 'check-bulk',
        tenantConnectionIds,
      },
    });

    if (error) {
      console.error('Bulk health check error:', error);
      return { success: false, error: 'Bulk health check failed. Please try again.' };
    }

    return data as BulkHealthCheckResponse;
  } catch (err) {
    console.error('Bulk health check exception:', err);
    return { success: false, error: 'Bulk health check failed. Please try again.' };
  }
}

/**
 * Get health status color for UI display
 */
export function getHealthStatusColor(status: TenantHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    case 'critical':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get health status background color for UI display
 */
export function getHealthStatusBgColor(status: TenantHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-success/10';
    case 'warning':
      return 'bg-warning/10';
    case 'critical':
      return 'bg-destructive/10';
    default:
      return 'bg-muted/10';
  }
}

/**
 * Format health check details for display
 */
export function formatHealthDetails(details: HealthCheckDetails): string[] {
  const messages: string[] = [];

  if (details.tokenValid) {
    messages.push('✓ Authentication successful');
  } else {
    messages.push('✗ Authentication failed');
  }

  if (details.graphApiReachable) {
    messages.push('✓ Microsoft Graph API reachable');
  } else {
    messages.push('✗ Microsoft Graph API unreachable');
  }

  if (details.organizationInfo) {
    messages.push(`Organization: ${details.organizationInfo.displayName}`);
    messages.push(`Verified domains: ${details.organizationInfo.verifiedDomains}`);
  }

  if (details.licenseInfo) {
    if (details.licenseInfo.hasLicenses) {
      messages.push(`Total licenses: ${details.licenseInfo.totalLicenses.toLocaleString()}`);
    } else {
      messages.push('No licenses found');
    }
  }

  if (details.errorMessage) {
    messages.push(`Error: ${details.errorMessage}`);
  }

  return messages;
}
