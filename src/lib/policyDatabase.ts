import { supabase } from '@/integrations/supabase/client';
import {
  PolicyTemplate,
  PolicyDeployment,
  DeploymentResult,
  BaselineType,
  DeploymentStatus,
  TargetType,
  GOVERNANCE_ACTION_TEMPLATES,
} from '@/types/policy';

// Helper to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Sanitize database errors
function sanitizeDatabaseError(error: unknown, operation: string): Error {
  console.error(`Database error (${operation}):`, error);
  return new Error(`Failed to ${operation}. Please try again.`);
}

// ============= Policy Template Operations =============

export async function createPolicyTemplate(template: {
  name: string;
  description?: string;
  category: string;
  baselineType: BaselineType;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
  isDefault?: boolean;
}): Promise<PolicyTemplate> {
  const userId = await getCurrentUserId();

  // Check if a template with this name already exists for this user
  const { data: existing } = await supabase
    .from('policy_templates')
    .select('id')
    .eq('user_id', userId)
    .eq('name', template.name)
    .maybeSingle();

  if (existing) {
    throw new Error(`A template named "${template.name}" already exists`);
  }

  const { data, error } = await supabase
    .from('policy_templates')
    .insert([{
      user_id: userId,
      name: template.name,
      description: template.description,
      category: template.category,
      baseline_type: template.baselineType,
      policy_data: template.policyData as unknown as Record<string, never>,
      resource_types: template.resourceTypes,
      is_default: template.isDefault || false,
    }])
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create policy template');
  return mapPolicyTemplateFromDb(data);
}

export async function updatePolicyTemplate(
  id: string,
  updates: Partial<Omit<PolicyTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<PolicyTemplate> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.baselineType !== undefined) updateData.baseline_type = updates.baselineType;
  if (updates.policyData !== undefined) updateData.policy_data = updates.policyData;
  if (updates.resourceTypes !== undefined) updateData.resource_types = updates.resourceTypes;
  if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.version !== undefined) updateData.version = updates.version;

  // If renaming, check that the new name doesn't conflict with another template
  if (updates.name !== undefined) {
    const userId = await getCurrentUserId();
    const { data: existing } = await supabase
      .from('policy_templates')
      .select('id')
      .eq('user_id', userId)
      .eq('name', updates.name)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      throw new Error(`A template named "${updates.name}" already exists`);
    }
  }

  const { data, error } = await supabase
    .from('policy_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update policy template');
  return mapPolicyTemplateFromDb(data);
}

export async function deletePolicyTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('policy_templates')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete policy template');
}

export async function getPolicyTemplates(options?: {
  baselineType?: BaselineType;
  category?: string;
  activeOnly?: boolean;
}): Promise<PolicyTemplate[]> {
  let query = supabase
    .from('policy_templates')
    .select('*')
    .order('name', { ascending: true });

  if (options?.baselineType) {
    query = query.eq('baseline_type', options.baselineType);
  }
  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw sanitizeDatabaseError(error, 'fetch policy templates');
  return (data || []).map(mapPolicyTemplateFromDb);
}

export async function getPolicyTemplate(id: string): Promise<PolicyTemplate | null> {
  const { data, error } = await supabase
    .from('policy_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch policy template');
  return data ? mapPolicyTemplateFromDb(data) : null;
}

// ============= Policy Deployment Operations =============

export async function createPolicyDeployment(deployment: {
  policyTemplateId: string;
  name: string;
  description?: string;
  targetType: TargetType;
  targetCustomerId?: string;
  targetGroupId?: string;
  targetTenantIds: string[];
  dryRun: boolean;
  scheduledAt?: Date;
}): Promise<PolicyDeployment> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('policy_deployments')
    .insert({
      user_id: userId,
      policy_template_id: deployment.policyTemplateId,
      name: deployment.name,
      description: deployment.description,
      target_type: deployment.targetType,
      target_customer_id: deployment.targetCustomerId,
      target_group_id: deployment.targetGroupId,
      target_tenant_ids: deployment.targetTenantIds,
      dry_run: deployment.dryRun,
      total_tenants: deployment.targetTenantIds.length,
      scheduled_at: deployment.scheduledAt?.toISOString(),
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create policy deployment');
  return mapPolicyDeploymentFromDb(data);
}

export async function updatePolicyDeployment(
  id: string,
  updates: Partial<{
    status: DeploymentStatus;
    completedTenants: number;
    failedTenants: number;
    startedAt: Date;
    completedAt: Date;
  }>
): Promise<PolicyDeployment> {
  const updateData: Record<string, unknown> = {};

  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.completedTenants !== undefined) updateData.completed_tenants = updates.completedTenants;
  if (updates.failedTenants !== undefined) updateData.failed_tenants = updates.failedTenants;
  if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt.toISOString();
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt.toISOString();

  const { data, error } = await supabase
    .from('policy_deployments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update policy deployment');
  return mapPolicyDeploymentFromDb(data);
}

export async function deletePolicyDeployment(id: string): Promise<void> {
  const { error } = await supabase
    .from('policy_deployments')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete policy deployment');
}

export async function getPolicyDeployments(options?: {
  status?: DeploymentStatus;
  templateId?: string;
}): Promise<PolicyDeployment[]> {
  let query = supabase
    .from('policy_deployments')
    .select(`
      *,
      policy_templates (*)
    `)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.templateId) {
    query = query.eq('policy_template_id', options.templateId);
  }

  const { data, error } = await query;

  if (error) throw sanitizeDatabaseError(error, 'fetch policy deployments');
  return (data || []).map((row) => ({
    ...mapPolicyDeploymentFromDb(row),
    template: row.policy_templates ? mapPolicyTemplateFromDb(row.policy_templates) : undefined,
  }));
}

export async function getPolicyDeployment(id: string): Promise<PolicyDeployment | null> {
  const { data, error } = await supabase
    .from('policy_deployments')
    .select(`
      *,
      policy_templates (*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch policy deployment');
  if (!data) return null;
  
  return {
    ...mapPolicyDeploymentFromDb(data),
    template: data.policy_templates ? mapPolicyTemplateFromDb(data.policy_templates) : undefined,
  };
}

// ============= Deployment Result Operations =============

export async function createDeploymentResults(
  deploymentId: string,
  tenantConnectionIds: string[]
): Promise<void> {
  const results = tenantConnectionIds.map((tenantConnectionId) => ({
    deployment_id: deploymentId,
    tenant_connection_id: tenantConnectionId,
    status: 'pending' as const,
  }));

  const { error } = await supabase
    .from('deployment_results')
    .insert(results);

  if (error) throw sanitizeDatabaseError(error, 'create deployment results');
}

export async function updateDeploymentResult(
  id: string,
  updates: Partial<{
    status: DeploymentStatus;
    dryRunResult: Record<string, unknown>;
    appliedChanges: Record<string, unknown>;
    errorMessage: string;
    rollbackData: Record<string, unknown>;
    startedAt: Date;
    completedAt: Date;
  }>
): Promise<DeploymentResult> {
  const updateData: Record<string, unknown> = {};

  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.dryRunResult !== undefined) updateData.dry_run_result = updates.dryRunResult;
  if (updates.appliedChanges !== undefined) updateData.applied_changes = updates.appliedChanges;
  if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
  if (updates.rollbackData !== undefined) updateData.rollback_data = updates.rollbackData;
  if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt.toISOString();
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt.toISOString();

  const { data, error } = await supabase
    .from('deployment_results')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update deployment result');
  return mapDeploymentResultFromDb(data);
}

export async function getDeploymentResults(deploymentId: string): Promise<DeploymentResult[]> {
  const { data, error } = await supabase
    .from('deployment_results')
    .select(`
      *,
      tenant_connections (tenant_id, tenant_name, display_name)
    `)
    .eq('deployment_id', deploymentId)
    .order('created_at', { ascending: true });

  if (error) throw sanitizeDatabaseError(error, 'fetch deployment results');
  
  return (data || []).map((row) => ({
    ...mapDeploymentResultFromDb(row),
    tenantName: row.tenant_connections?.display_name || row.tenant_connections?.tenant_name,
    tenantId: row.tenant_connections?.tenant_id,
  }));
}

// ============= Stats =============

export async function getPolicyStats(): Promise<{
  totalTemplates: number;
  totalDeployments: number;
  activeDeployments: number;
  successRate: number;
}> {
  const userId = await getCurrentUserId();

  const [templatesResult, deploymentsResult] = await Promise.all([
    supabase.from('policy_templates').select('id').eq('user_id', userId),
    supabase.from('policy_deployments').select('id, status').eq('user_id', userId),
  ]);

  const templates = templatesResult.data || [];
  const deployments = deploymentsResult.data || [];
  const completed = deployments.filter(d => d.status === 'completed').length;
  const failed = deployments.filter(d => d.status === 'failed').length;

  return {
    totalTemplates: templates.length,
    totalDeployments: deployments.length,
    activeDeployments: deployments.filter(d => d.status === 'running' || d.status === 'pending').length,
    successRate: completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 100,
  };
}

// ============= Mappers =============

function mapPolicyTemplateFromDb(row: Record<string, unknown>): PolicyTemplate {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    category: row.category as string,
    baselineType: row.baseline_type as BaselineType,
    policyData: row.policy_data as Record<string, unknown>,
    resourceTypes: row.resource_types as string[],
    isDefault: row.is_default as boolean,
    isActive: row.is_active as boolean,
    version: row.version as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapPolicyDeploymentFromDb(row: Record<string, unknown>): PolicyDeployment {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    policyTemplateId: row.policy_template_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    targetType: row.target_type as TargetType,
    targetCustomerId: row.target_customer_id as string | undefined,
    targetGroupId: row.target_group_id as string | undefined,
    targetTenantIds: row.target_tenant_ids as string[],
    dryRun: row.dry_run as boolean,
    status: row.status as DeploymentStatus,
    totalTenants: row.total_tenants as number,
    completedTenants: row.completed_tenants as number,
    failedTenants: row.failed_tenants as number,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapDeploymentResultFromDb(row: Record<string, unknown>): DeploymentResult {
  return {
    id: row.id as string,
    deploymentId: row.deployment_id as string,
    tenantConnectionId: row.tenant_connection_id as string,
    status: row.status as DeploymentStatus,
    dryRunResult: row.dry_run_result as Record<string, unknown> | undefined,
    appliedChanges: row.applied_changes as Record<string, unknown> | undefined,
    errorMessage: row.error_message as string | undefined,
    rollbackData: row.rollback_data as Record<string, unknown> | undefined,
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// ============= Governance Template Seeding =============

const GOVERNANCE_TEMPLATE_NAMES = GOVERNANCE_ACTION_TEMPLATES.map(t => t.name);

export async function seedGovernanceTemplates(): Promise<{ seeded: number; skipped: number }> {
  try {
    const userId = await getCurrentUserId();
    
    // Check which templates already exist
    const { data: existingTemplates } = await supabase
      .from('policy_templates')
      .select('name')
      .in('name', GOVERNANCE_TEMPLATE_NAMES);
    
    const existingNames = new Set((existingTemplates || []).map(t => t.name));
    
    // Filter templates that don't exist yet
    const templatesToCreate = GOVERNANCE_ACTION_TEMPLATES.filter(
      t => !existingNames.has(t.name)
    );
    
    if (templatesToCreate.length === 0) {
      return { seeded: 0, skipped: GOVERNANCE_TEMPLATE_NAMES.length };
    }
    
    // Insert missing templates
    const { error } = await supabase
      .from('policy_templates')
      .insert(
        templatesToCreate.map(t => ({
          user_id: userId,
          name: t.name,
          description: t.description,
          category: t.category,
          baseline_type: t.baselineType,
          policy_data: t.policyData as unknown as Record<string, never>,
          resource_types: t.resourceTypes,
          is_default: t.isDefault,
          is_active: t.isActive,
          version: t.version,
        }))
      );
    
    if (error) {
      console.error('Failed to seed governance templates:', error);
      return { seeded: 0, skipped: existingNames.size };
    }
    
    return { seeded: templatesToCreate.length, skipped: existingNames.size };
  } catch (error) {
    console.error('Error seeding governance templates:', error);
    return { seeded: 0, skipped: 0 };
  }
}

export async function getPolicyTemplateByName(name: string): Promise<PolicyTemplate | null> {
  const { data, error } = await supabase
    .from('policy_templates')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.error('Error fetching policy template by name:', error);
    return null;
  }
  return data ? mapPolicyTemplateFromDb(data) : null;
}
