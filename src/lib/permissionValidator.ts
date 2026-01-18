import { supabase } from '@/integrations/supabase/client';

export interface LiveValidationResult {
  resourceId: string;
  resourceName: string;
  provider: 'graph' | 'azure';
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime: number;
}

export interface LiveValidationResponse {
  success: boolean;
  results: LiveValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgResponseTime: number;
  };
}

/**
 * Perform live validation of permissions by making actual API calls
 */
export async function validatePermissionsLive(
  graphToken: string | null,
  azureToken: string | null,
  resourceIds: string[],
  subscriptionIds: string[] = []
): Promise<LiveValidationResponse> {
  const { data, error } = await supabase.functions.invoke('validate-permissions', {
    body: {
      graphToken,
      azureToken,
      resourceIds,
      subscriptionIds,
    },
  });

  if (error) {
    throw new Error(`Validation failed: ${error.message}`);
  }

  return data as LiveValidationResponse;
}

/**
 * Get a user-friendly error message from a validation result
 */
export function getErrorGuidance(result: LiveValidationResult): string {
  if (result.success) return '';
  
  const statusCode = result.statusCode;
  
  if (statusCode === 401) {
    return 'Token expired or invalid. Try reconnecting.';
  }
  
  if (statusCode === 403) {
    if (result.provider === 'graph') {
      return 'Permission not granted or admin consent missing. Add the permission in Azure Portal → App Registrations → API Permissions, then click "Grant admin consent".';
    } else {
      return 'Role not assigned. Assign Reader or Contributor role in Azure Portal → Subscriptions → Access Control (IAM).';
    }
  }
  
  if (statusCode === 404) {
    return 'Endpoint not found. This resource type may not be available in your tenant.';
  }
  
  if (statusCode && statusCode >= 500) {
    return 'Microsoft service temporarily unavailable. Try again later.';
  }
  
  if (result.error?.includes('Network error')) {
    return 'Network error. Check your connection and try again.';
  }
  
  return result.error || 'Unknown error';
}

/**
 * Group validation failures by their likely cause
 */
export function groupValidationFailures(results: LiveValidationResult[]): {
  authIssues: LiveValidationResult[];
  permissionIssues: LiveValidationResult[];
  otherIssues: LiveValidationResult[];
} {
  const failures = results.filter(r => !r.success);
  
  return {
    authIssues: failures.filter(r => r.statusCode === 401),
    permissionIssues: failures.filter(r => r.statusCode === 403),
    otherIssues: failures.filter(r => r.statusCode !== 401 && r.statusCode !== 403),
  };
}