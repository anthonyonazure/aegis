import { supabase } from '@/integrations/supabase/client';

export interface DeploymentChange {
  resourceType: string;
  action: 'create' | 'update' | 'delete' | 'skip' | 'rollback';
  resourceId?: string;
  resourceName?: string;
  currentValue?: unknown;
  newValue?: unknown;
  originalValue?: unknown;
  reason?: string;
}

export interface DeploymentExecutionResult {
  success: boolean;
  dryRun?: boolean;
  action?: 'deploy' | 'rollback';
  changes: DeploymentChange[];
  errors: string[];
}

export interface RollbackResult {
  success: boolean;
  changes: DeploymentChange[];
  errors: string[];
}

export async function executeDeployment(
  deploymentId: string,
  resultId: string,
  tenantConnectionId: string,
  dryRun: boolean,
  policyData: Record<string, unknown>,
  resourceTypes: string[]
): Promise<DeploymentExecutionResult> {
  const { data, error } = await supabase.functions.invoke('deploy-policy', {
    body: {
      deploymentId,
      resultId,
      tenantConnectionId,
      dryRun,
      policyData,
      resourceTypes,
    },
  });

  if (error) {
    throw new Error(`Deployment failed: ${error.message}`);
  }

  return data as DeploymentExecutionResult;
}

export async function rollbackDeploymentResult(
  resultId: string,
  tenantConnectionId: string
): Promise<RollbackResult> {
  const { data, error } = await supabase.functions.invoke('deploy-policy', {
    body: {
      action: 'rollback',
      resultId,
      tenantConnectionId,
    },
  });

  if (error) {
    throw new Error(`Rollback failed: ${error.message}`);
  }

  return data as RollbackResult;
}

export async function rollbackFullDeployment(
  deploymentId: string,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{
  success: boolean;
  completed: number;
  failed: number;
  results: Array<{ tenantId: string; success: boolean; changes?: DeploymentChange[]; error?: string }>;
}> {
  // Get all deployment results with rollback data
  const { data: results, error } = await supabase
    .from('deployment_results')
    .select(`
      id,
      tenant_connection_id,
      rollback_data,
      tenant_connections (tenant_id, display_name, tenant_name)
    `)
    .eq('deployment_id', deploymentId)
    .not('rollback_data', 'is', null);

  if (error || !results) {
    throw new Error('Failed to get deployment results for rollback');
  }

  if (results.length === 0) {
    throw new Error('No rollback data available for this deployment');
  }

  const rollbackResults: Array<{ tenantId: string; success: boolean; changes?: DeploymentChange[]; error?: string }> = [];
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const tenantInfo = result.tenant_connections as { tenant_id: string; display_name: string | null; tenant_name: string | null } | null;
    const tenantName = tenantInfo?.display_name || tenantInfo?.tenant_name || tenantInfo?.tenant_id || 'Unknown';

    onProgress?.(i, results.length, tenantName);

    try {
      const rollbackResult = await rollbackDeploymentResult(
        result.id,
        result.tenant_connection_id
      );

      if (rollbackResult.success) {
        completed++;
      } else {
        failed++;
      }

      rollbackResults.push({
        tenantId: tenantInfo?.tenant_id || 'unknown',
        success: rollbackResult.success,
        changes: rollbackResult.changes,
        error: rollbackResult.errors?.join('; '),
      });
    } catch (err) {
      failed++;
      rollbackResults.push({
        tenantId: tenantInfo?.tenant_id || 'unknown',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    success: failed === 0,
    completed,
    failed,
    results: rollbackResults,
  };
}

export async function executeFullDeployment(
  deploymentId: string,
  policyData: Record<string, unknown>,
  resourceTypes: string[],
  dryRun: boolean,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{
  success: boolean;
  completed: number;
  failed: number;
  results: Array<{ tenantId: string; success: boolean; changes?: DeploymentChange[]; error?: string }>;
}> {
  // Get all deployment results
  const { data: results, error } = await supabase
    .from('deployment_results')
    .select(`
      id,
      tenant_connection_id,
      tenant_connections (tenant_id, display_name, tenant_name)
    `)
    .eq('deployment_id', deploymentId);

  if (error || !results) {
    throw new Error('Failed to get deployment results');
  }

  // Update deployment to running
  await supabase
    .from('policy_deployments')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', deploymentId);

  const deploymentResults: Array<{ tenantId: string; success: boolean; changes?: DeploymentChange[]; error?: string }> = [];
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const tenantInfo = result.tenant_connections as { tenant_id: string; display_name: string | null; tenant_name: string | null } | null;
    const tenantName = tenantInfo?.display_name || tenantInfo?.tenant_name || tenantInfo?.tenant_id || 'Unknown';

    onProgress?.(i, results.length, tenantName);

    try {
      const execResult = await executeDeployment(
        deploymentId,
        result.id,
        result.tenant_connection_id,
        dryRun,
        policyData,
        resourceTypes
      );

      if (execResult.success) {
        completed++;
      } else {
        failed++;
      }

      deploymentResults.push({
        tenantId: tenantInfo?.tenant_id || 'unknown',
        success: execResult.success,
        changes: execResult.changes,
        error: execResult.errors?.join('; '),
      });
    } catch (err) {
      failed++;
      deploymentResults.push({
        tenantId: tenantInfo?.tenant_id || 'unknown',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    success: failed === 0,
    completed,
    failed,
    results: deploymentResults,
  };
}

export function formatChange(change: DeploymentChange): string {
  const actionMap = {
    create: '➕ Create',
    update: '🔄 Update',
    delete: '➖ Delete',
    skip: '⏭️ Skip',
  };
  
  return `${actionMap[change.action]} ${change.resourceType}: ${change.resourceName || change.resourceId || 'Unknown'}`;
}

export function getChangeActionColor(action: string): string {
  switch (action) {
    case 'create':
      return 'text-green-500';
    case 'update':
      return 'text-blue-500';
    case 'delete':
      return 'text-red-500';
    case 'skip':
      return 'text-muted-foreground';
    default:
      return 'text-foreground';
  }
}

export function getChangeActionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'create':
      return 'default';
    case 'update':
      return 'secondary';
    case 'delete':
      return 'destructive';
    default:
      return 'outline';
  }
}
