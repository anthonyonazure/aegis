import { supabase } from '@/integrations/supabase/client';

export interface PolicyItem {
  id: string;
  displayName: string;
  description?: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  state?: string;
  data: Record<string, unknown>;
}

export interface DeploymentTarget {
  tenantConnectionId: string;
  tenantName: string;
  customerName?: string;
  customerId?: string;
}

export interface DeploymentOptions {
  skipExisting: boolean;
  overwriteExisting: boolean;
  renameDuplicates: boolean;
  dryRun: boolean;
}

export interface PolicyChange {
  resourceType: string;
  action: 'create' | 'update' | 'delete' | 'skip' | 'rename';
  resourceId?: string;
  resourceName?: string;
  currentValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface DeploymentResult {
  success: boolean;
  created: number;
  skipped: number;
  updated: number;
  renamed: number;
  failed: number;
  errors: string[];
  changes: PolicyChange[];
}

export interface GroupedPolicy {
  categoryId: string;
  policyTypeId: string;
  policies: PolicyItem[];
}

/**
 * Map resource type to Graph API endpoint
 */
function getEndpointForResourceType(categoryId: string, policyTypeId: string): string {
  const endpoints: Record<string, string> = {
    // Conditional Access
    'conditional-access/ca-policies': 'identity/conditionalAccess/policies',
    'conditional-access/named-locations': 'identity/conditionalAccess/namedLocations',
    'conditional-access/auth-contexts': 'identity/conditionalAccess/authenticationContextClassReferences',
    'conditional-access/auth-strengths': 'identity/conditionalAccess/authenticationStrength/policies',
    // Intune
    'intune/device-configurations': 'deviceManagement/deviceConfigurations',
    'intune/compliance-policies': 'deviceManagement/deviceCompliancePolicies',
    'intune/app-configurations': 'deviceAppManagement/mobileAppConfigurations',
    'intune/autopilot': 'deviceManagement/windowsAutopilotDeploymentProfiles',
    'intune/enrollment-restrictions': 'deviceManagement/deviceEnrollmentConfigurations',
    'intune/scripts': 'deviceManagement/deviceManagementScripts',
    'intune/win32-apps': 'deviceAppManagement/mobileApps',
    'intune/update-rings': 'deviceManagement/deviceConfigurations',
    // Entra ID
    'entra-id/groups': 'groups',
    'entra-id/app-registrations': 'applications',
    'entra-id/enterprise-apps': 'servicePrincipals',
    'entra-id/admin-units': 'administrativeUnits',
    'entra-id/roles': 'directoryRoles',
    'entra-id/directory-settings': 'groupSettings',
    'entra-id/auth-methods-policy': 'policies/authenticationMethodsPolicy',
    'entra-id/cross-tenant-access': 'policies/crossTenantAccessPolicy',
    'entra-id/permission-grant-policies': 'policies/permissionGrantPolicies',
    // Defender
    'defender/asr-policies': 'deviceManagement/configurationPolicies',
    'defender/antivirus-policies': 'deviceManagement/configurationPolicies',
    'defender/firewall-policies': 'deviceManagement/configurationPolicies',
    'defender/edr-policies': 'deviceManagement/configurationPolicies',
    'defender/security-baselines': 'deviceManagement/configurationPolicies',
    // Exchange (Graph-backed)
    'exchange/accepted-domains': 'domains',
    // Purview
    'purview/sensitivity-labels': 'security/informationProtection/sensitivityLabels',
    'purview/retention-policies': 'security/labels/retentionLabels',
    // Teams
    'teams/app-policies': 'appCatalogs/teamsApps',
    'teams/guest-policies': 'teamwork/teamSettings',
    'teams/external-access': 'teamwork/teamSettings',
  };
  return endpoints[`${categoryId}/${policyTypeId}`] || `${categoryId}/${policyTypeId}`;
}

/**
 * Clean policy data for import - remove read-only and tenant-specific properties
 */
function cleanPolicyForImport(policy: Record<string, unknown>): Record<string, unknown> {
  const readOnlyProps = [
    'id',
    '@odata.context',
    '@odata.type',
    'createdDateTime',
    'modifiedDateTime',
    'lastModifiedDateTime',
    'version',
    'createdBy',
    'lastModifiedBy',
    'templateId',
    'templateReference',
  ];

  const cleaned: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(policy)) {
    if (!readOnlyProps.includes(key) && !key.startsWith('@')) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Deploy policies to a target tenant using the deploy-policy edge function
 */
export async function deployPoliciesToTenant(
  groupedPolicies: GroupedPolicy[],
  targetTenantConnectionId: string,
  options: DeploymentOptions,
  sourceTenantConnectionId?: string | null
): Promise<DeploymentResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      updated: 0,
      renamed: 0,
      failed: 0,
      errors: ['Not authenticated'],
      changes: [],
    };
  }

  // Prepare policy data for deployment
  const policyData: Record<string, unknown[]> = {};
  const resourceTypes: string[] = [];

  for (const group of groupedPolicies) {
    const key = `${group.categoryId}/${group.policyTypeId}`;
    resourceTypes.push(key);
    
    policyData[key] = group.policies.map(p => {
      const cleaned = cleanPolicyForImport(p.data);
      
      // Handle rename duplicates option
      if (options.renameDuplicates && cleaned.displayName) {
        cleaned.displayName = `${cleaned.displayName} (Imported)`;
      }
      
      return cleaned;
    });
  }

  // Invoke the edge function
  const response = await supabase.functions.invoke('deploy-policy', {
    body: {
      action: 'import-policies',
      tenantConnectionId: targetTenantConnectionId,
      sourceTenantConnectionId,
      dryRun: options.dryRun,
      policyData,
      resourceTypes,
      options: {
        skipExisting: options.skipExisting,
        overwriteExisting: options.overwriteExisting,
        renameDuplicates: options.renameDuplicates,
      },
    },
  });

  if (response.error) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      updated: 0,
      renamed: 0,
      failed: 1,
      errors: [response.error.message || 'Deployment failed'],
      changes: [],
    };
  }

  const result = response.data as {
    success: boolean;
    changes: PolicyChange[];
    errors: string[];
  };

  return {
    success: result.success,
    created: result.changes.filter(c => c.action === 'create').length,
    skipped: result.changes.filter(c => c.action === 'skip').length,
    updated: result.changes.filter(c => c.action === 'update').length,
    renamed: result.changes.filter(c => c.action === 'rename').length,
    failed: result.errors.length,
    errors: result.errors,
    changes: result.changes,
  };
}

/**
 * Get all available tenant connections for deployment targets
 */
export async function getDeploymentTargets(): Promise<DeploymentTarget[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data: connections, error } = await supabase
    .from('tenant_connections')
    .select(`
      id,
      display_name,
      tenant_name,
      customer_id,
      customers:customer_id (
        id,
        name
      )
    `)
    .eq('user_id', session.user.id)
    .order('display_name');

  if (error || !connections) {
    console.error('Failed to fetch tenant connections:', error);
    return [];
  }

  return connections.map(conn => ({
    tenantConnectionId: conn.id,
    tenantName: conn.display_name || conn.tenant_name || 'Unknown Tenant',
    customerName: (conn.customers as any)?.name,
    customerId: conn.customer_id || undefined,
  }));
}
