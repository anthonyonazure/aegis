import { supabase } from '@/integrations/supabase/client';

export interface ReadinessAssessment {
  overallScore: number;
  licensing: { ready: boolean; details: any };
  permissions: { ready: boolean; details: any };
  semanticIndex: { ready: boolean; details: any };
  dataGovernance: { ready: boolean; details: any };
  network: { ready: boolean; details: any };
  recommendations: string[];
}

export interface UsageAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalQueries: number;
  avgQueriesPerUser: number;
  adoptionRate: number;
  topFeatures: Array<{ name: string; usage: number }>;
  usageByApp: Record<string, number>;
}

export interface LicensingStatus {
  totalCopilotLicenses: number;
  assignedLicenses: number;
  availableLicenses: number;
  utilizationRate: number;
  skuBreakdown: Array<{ name: string; total: number; assigned: number }>;
  licensedUsers: Array<{ id: string; displayName: string; email: string; lastActive?: string }>;
}

export interface CopilotPlugin {
  id: string;
  displayName: string;
  description?: string;
  publisher?: string;
  pluginType: string;
  status: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  promptText: string;
  category: string;
  tags: string[];
  targetApps: string[];
  isPublic: boolean;
  usageCount: number;
  avgRating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIGovernancePolicy {
  id: string;
  name: string;
  description?: string;
  policyType: string;
  isActive: boolean;
  settings: Record<string, any>;
  targetType: string;
  targetTenantIds: string[];
  targetGroupId?: string;
  enforcementLevel: string;
  lastEnforcedAt?: Date;
  violationsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Functions
export async function fetchReadinessAssessment(tenantConnectionId: string): Promise<ReadinessAssessment> {
  const { data, error } = await supabase.functions.invoke('fetch-copilot-data', {
    body: {
      action: 'readiness-check',
      tenantConnectionId,
    },
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Failed to fetch readiness assessment');
  
  return data.data;
}

export async function fetchUsageAnalytics(
  tenantConnectionId: string, 
  period: 'D7' | 'D30' | 'D90' = 'D30'
): Promise<UsageAnalytics> {
  const { data, error } = await supabase.functions.invoke('fetch-copilot-data', {
    body: {
      action: 'usage-analytics',
      tenantConnectionId,
      period,
    },
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Failed to fetch usage analytics');
  
  return data.data;
}

export async function fetchLicensingStatus(tenantConnectionId: string): Promise<LicensingStatus> {
  const { data, error } = await supabase.functions.invoke('fetch-copilot-data', {
    body: {
      action: 'licensing-status',
      tenantConnectionId,
    },
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Failed to fetch licensing status');
  
  return data.data;
}

export async function fetchCopilotPlugins(tenantConnectionId: string): Promise<CopilotPlugin[]> {
  const { data, error } = await supabase.functions.invoke('fetch-copilot-data', {
    body: {
      action: 'plugins',
      tenantConnectionId,
    },
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Failed to fetch plugins');
  
  return data.data;
}

// Database operations for Prompt Library
export async function getPromptLibrary(customerId?: string): Promise<PromptTemplate[]> {
  let query = supabase
    .from('prompt_library')
    .select('*')
    .order('usage_count', { ascending: false });

  if (customerId) {
    query = query.or(`customer_id.eq.${customerId},is_public.eq.true`);
  } else {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    promptText: p.prompt_text,
    category: p.category,
    tags: p.tags || [],
    targetApps: p.target_apps || [],
    isPublic: p.is_public,
    usageCount: p.usage_count,
    avgRating: Number(p.avg_rating),
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

export async function createPrompt(prompt: Omit<PromptTemplate, 'id' | 'usageCount' | 'avgRating' | 'createdAt' | 'updatedAt'>, customerId?: string): Promise<PromptTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('prompt_library')
    .insert({
      user_id: user.id,
      customer_id: customerId,
      name: prompt.name,
      description: prompt.description,
      prompt_text: prompt.promptText,
      category: prompt.category,
      tags: prompt.tags,
      target_apps: prompt.targetApps,
      is_public: prompt.isPublic,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    promptText: data.prompt_text,
    category: data.category,
    tags: data.tags || [],
    targetApps: data.target_apps || [],
    isPublic: data.is_public,
    usageCount: data.usage_count,
    avgRating: Number(data.avg_rating),
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function deletePrompt(promptId: string): Promise<void> {
  const { error } = await supabase
    .from('prompt_library')
    .delete()
    .eq('id', promptId);

  if (error) throw new Error(error.message);
}

// Database operations for AI Governance Policies
export async function getGovernancePolicies(customerId?: string): Promise<AIGovernancePolicy[]> {
  let query = supabase
    .from('ai_governance_policies')
    .select('*')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    policyType: p.policy_type,
    isActive: p.is_active,
    settings: (p.settings as Record<string, any>) || {},
    targetType: p.target_type,
    targetTenantIds: p.target_tenant_ids || [],
    targetGroupId: p.target_group_id,
    enforcementLevel: p.enforcement_level,
    lastEnforcedAt: p.last_enforced_at ? new Date(p.last_enforced_at) : undefined,
    violationsCount: p.violations_count,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

export async function createGovernancePolicy(
  policy: Omit<AIGovernancePolicy, 'id' | 'lastEnforcedAt' | 'violationsCount' | 'createdAt' | 'updatedAt'>,
  customerId?: string
): Promise<AIGovernancePolicy> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('ai_governance_policies')
    .insert({
      user_id: user.id,
      customer_id: customerId,
      name: policy.name,
      description: policy.description,
      policy_type: policy.policyType,
      is_active: policy.isActive,
      settings: policy.settings,
      target_type: policy.targetType,
      target_tenant_ids: policy.targetTenantIds,
      target_group_id: policy.targetGroupId,
      enforcement_level: policy.enforcementLevel,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    policyType: data.policy_type,
    isActive: data.is_active,
    settings: (data.settings as Record<string, any>) || {},
    targetType: data.target_type,
    targetTenantIds: data.target_tenant_ids || [],
    targetGroupId: data.target_group_id,
    enforcementLevel: data.enforcement_level,
    lastEnforcedAt: data.last_enforced_at ? new Date(data.last_enforced_at) : undefined,
    violationsCount: data.violations_count,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function updateGovernancePolicy(policyId: string, updates: Partial<AIGovernancePolicy>): Promise<void> {
  const { error } = await supabase
    .from('ai_governance_policies')
    .update({
      name: updates.name,
      description: updates.description,
      is_active: updates.isActive,
      settings: updates.settings,
      enforcement_level: updates.enforcementLevel,
    })
    .eq('id', policyId);

  if (error) throw new Error(error.message);
}

export async function deleteGovernancePolicy(policyId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_governance_policies')
    .delete()
    .eq('id', policyId);

  if (error) throw new Error(error.message);
}

// Save readiness assessment to database
export async function saveReadinessAssessment(
  tenantConnectionId: string,
  customerId: string | undefined,
  assessment: ReadinessAssessment
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('copilot_readiness_assessments')
    .insert({
      user_id: user.id,
      tenant_connection_id: tenantConnectionId,
      customer_id: customerId,
      overall_score: assessment.overallScore,
      licensing_ready: assessment.licensing.ready,
      licensing_details: assessment.licensing.details,
      permissions_ready: assessment.permissions.ready,
      permissions_details: assessment.permissions.details,
      semantic_index_ready: assessment.semanticIndex.ready,
      semantic_index_details: assessment.semanticIndex.details,
      data_governance_ready: assessment.dataGovernance.ready,
      data_governance_details: assessment.dataGovernance.details,
      network_ready: assessment.network.ready,
      network_details: assessment.network.details,
      recommendations: assessment.recommendations,
    });

  if (error) throw new Error(error.message);
}

// Save usage metrics to database
export async function saveUsageMetrics(
  tenantConnectionId: string,
  customerId: string | undefined,
  periodStart: Date,
  periodEnd: Date,
  metrics: UsageAnalytics
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('copilot_usage_metrics')
    .insert({
      user_id: user.id,
      tenant_connection_id: tenantConnectionId,
      customer_id: customerId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      total_users: metrics.totalUsers,
      active_users: metrics.activeUsers,
      total_queries: metrics.totalQueries,
      avg_queries_per_user: metrics.avgQueriesPerUser,
      top_features: metrics.topFeatures,
      adoption_rate: metrics.adoptionRate,
      usage_by_app: metrics.usageByApp,
    });

  if (error) throw new Error(error.message);
}
