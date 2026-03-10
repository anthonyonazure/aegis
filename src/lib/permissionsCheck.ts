// Microsoft Graph API permissions mapping
// Maps resource types to required Graph API permissions

export interface PermissionRequirement {
  resourceId: string;
  resourceName: string;
  requiredPermissions: string[];
  alternativePermissions?: string[]; // Any of these also work
}

export const PERMISSION_REQUIREMENTS: PermissionRequirement[] = [
  // Intune
  {
    resourceId: 'intune/device-configurations',
    resourceName: 'Device Configuration Profiles',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
    alternativePermissions: ['DeviceManagementConfiguration.ReadWrite.All'],
  },
  {
    resourceId: 'intune/compliance-policies',
    resourceName: 'Compliance Policies',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
    alternativePermissions: ['DeviceManagementConfiguration.ReadWrite.All'],
  },
  {
    resourceId: 'intune/app-configurations',
    resourceName: 'App Configuration Policies',
    requiredPermissions: ['DeviceManagementApps.Read.All'],
    alternativePermissions: ['DeviceManagementApps.ReadWrite.All'],
  },
  {
    resourceId: 'intune/autopilot',
    resourceName: 'Autopilot Profiles',
    requiredPermissions: ['DeviceManagementServiceConfig.Read.All'],
    alternativePermissions: ['DeviceManagementServiceConfiguration.Read.All', 'DeviceManagementServiceConfig.ReadWrite.All'],
  },
  {
    resourceId: 'intune/enrollment-restrictions',
    resourceName: 'Enrollment Restrictions',
    requiredPermissions: ['DeviceManagementServiceConfig.Read.All'],
    alternativePermissions: ['DeviceManagementServiceConfiguration.Read.All', 'DeviceManagementServiceConfig.ReadWrite.All'],
  },
  {
    resourceId: 'intune/scripts',
    resourceName: 'PowerShell Scripts',
    requiredPermissions: ['DeviceManagementScripts.Read.All'],
    alternativePermissions: ['DeviceManagementScripts.ReadWrite.All'],
  },
  {
    resourceId: 'intune/win32-apps',
    resourceName: 'Win32 Applications',
    requiredPermissions: ['DeviceManagementApps.Read.All'],
    alternativePermissions: ['DeviceManagementApps.ReadWrite.All'],
  },
  {
    resourceId: 'intune/update-rings',
    resourceName: 'Update Rings',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
    alternativePermissions: ['DeviceManagementConfiguration.ReadWrite.All'],
  },
  
  // Conditional Access
  {
    resourceId: 'conditional-access/ca-policies',
    resourceName: 'Conditional Access Policies',
    requiredPermissions: ['Policy.Read.All'],
    alternativePermissions: ['Policy.ReadWrite.ConditionalAccess'],
  },
  {
    resourceId: 'conditional-access/named-locations',
    resourceName: 'Named Locations',
    requiredPermissions: ['Policy.Read.All'],
  },
  {
    resourceId: 'conditional-access/auth-contexts',
    resourceName: 'Authentication Contexts',
    requiredPermissions: ['Policy.Read.All'],
  },
  {
    resourceId: 'conditional-access/auth-strengths',
    resourceName: 'Authentication Strengths',
    requiredPermissions: ['Policy.Read.All'],
  },
  
  // Entra ID
  {
    resourceId: 'entra-id/groups',
    resourceName: 'Groups & Dynamic Membership',
    requiredPermissions: ['Group.Read.All'],
    alternativePermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'entra-id/app-registrations',
    resourceName: 'App Registrations',
    requiredPermissions: ['Application.Read.All'],
    alternativePermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'entra-id/enterprise-apps',
    resourceName: 'Enterprise Applications',
    requiredPermissions: ['Application.Read.All'],
    alternativePermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'entra-id/directory-settings',
    resourceName: 'Directory Settings',
    requiredPermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'entra-id/admin-units',
    resourceName: 'Administrative Units',
    requiredPermissions: ['AdministrativeUnit.Read.All'],
    alternativePermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'entra-id/roles',
    resourceName: 'Directory Roles',
    requiredPermissions: ['RoleManagement.Read.Directory'],
    alternativePermissions: ['Directory.Read.All'],
  },
  
  // Defender
  {
    resourceId: 'defender/asr-policies',
    resourceName: 'Attack Surface Reduction',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
  },
  {
    resourceId: 'defender/antivirus-policies',
    resourceName: 'Antivirus Policies',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
  },
  {
    resourceId: 'defender/firewall-policies',
    resourceName: 'Firewall Policies',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
  },
  {
    resourceId: 'defender/edr-policies',
    resourceName: 'EDR Policies',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
  },
  {
    resourceId: 'defender/security-baselines',
    resourceName: 'Security Baselines',
    requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
  },
  
  // Purview
  {
    resourceId: 'purview/sensitivity-labels',
    resourceName: 'Sensitivity Labels',
    requiredPermissions: ['InformationProtectionPolicy.Read.All'],
    alternativePermissions: ['InformationProtectionPolicy.Read'],
  },
  
  // Exchange Online
  {
    resourceId: 'exchange/transport-rules',
    resourceName: 'Transport Rules',
    requiredPermissions: ['Mail.Read'],
    alternativePermissions: ['Mail.ReadWrite', 'MailboxSettings.Read'],
  },
  {
    resourceId: 'exchange/connectors',
    resourceName: 'Connectors',
    requiredPermissions: ['Mail.Read'],
    alternativePermissions: ['Mail.ReadWrite'],
  },
  {
    resourceId: 'exchange/accepted-domains',
    resourceName: 'Accepted Domains',
    requiredPermissions: ['Domain.Read.All'],
    alternativePermissions: ['Directory.Read.All'],
  },
  {
    resourceId: 'exchange/mailbox-policies',
    resourceName: 'Mailbox Policies',
    requiredPermissions: ['MailboxSettings.Read'],
    alternativePermissions: ['MailboxSettings.ReadWrite'],
  },
  {
    resourceId: 'exchange/anti-spam',
    resourceName: 'Anti-Spam Policies',
    requiredPermissions: ['SecurityEvents.Read.All'],
    alternativePermissions: ['SecurityEvents.ReadWrite.All'],
  },
  {
    resourceId: 'exchange/dlp-policies',
    resourceName: 'DLP Policies',
    requiredPermissions: ['InformationProtectionPolicy.Read.All'],
    alternativePermissions: ['InformationProtectionPolicy.Read'],
  },
  
  // SharePoint
  {
    resourceId: 'sharepoint/tenant-settings',
    resourceName: 'Tenant Settings',
    requiredPermissions: ['Sites.Read.All'],
    alternativePermissions: ['Sites.ReadWrite.All'],
  },
  {
    resourceId: 'sharepoint/sharing-policies',
    resourceName: 'Sharing Policies',
    requiredPermissions: ['Sites.Read.All'],
    alternativePermissions: ['Sites.ReadWrite.All'],
  },
  {
    resourceId: 'sharepoint/site-templates',
    resourceName: 'Site Templates',
    requiredPermissions: ['Sites.Read.All'],
    alternativePermissions: ['Sites.ReadWrite.All'],
  },
  {
    resourceId: 'sharepoint/hub-sites',
    resourceName: 'Hub Sites',
    requiredPermissions: ['Sites.Read.All'],
    alternativePermissions: ['Sites.ReadWrite.All'],
  },
  
  // Teams
  {
    resourceId: 'teams/messaging-policies',
    resourceName: 'Messaging Policies',
    requiredPermissions: ['TeamSettings.Read.All'],
    alternativePermissions: ['TeamSettings.ReadWrite.All'],
  },
  {
    resourceId: 'teams/meeting-policies',
    resourceName: 'Meeting Policies',
    requiredPermissions: ['TeamSettings.Read.All'],
    alternativePermissions: ['TeamSettings.ReadWrite.All'],
  },
  {
    resourceId: 'teams/app-policies',
    resourceName: 'App Permission Policies',
    requiredPermissions: ['AppCatalog.Read.All'],
    alternativePermissions: ['AppCatalog.ReadWrite.All'],
  },
  {
    resourceId: 'teams/calling-policies',
    resourceName: 'Calling Policies',
    requiredPermissions: ['CallRecords.Read.All'],
  },
  {
    resourceId: 'teams/live-event-policies',
    resourceName: 'Live Event Policies',
    requiredPermissions: ['TeamSettings.Read.All'],
    alternativePermissions: ['TeamSettings.ReadWrite.All'],
  },

  // Copilot Readiness
  {
    resourceId: 'copilot/licensing',
    resourceName: 'Copilot Licensing & SKUs',
    requiredPermissions: ['Organization.Read.All'],
  },
  {
    resourceId: 'copilot/organization-info',
    resourceName: 'Organization & Tenant Info',
    requiredPermissions: ['Organization.Read.All'],
  },
  {
    resourceId: 'copilot/mfa-registration',
    resourceName: 'MFA Registration Reports',
    requiredPermissions: ['AuditLog.Read.All'],
    alternativePermissions: ['Reports.Read.All'],
  },
  {
    resourceId: 'copilot/auth-methods',
    resourceName: 'Authentication Methods',
    requiredPermissions: ['UserAuthenticationMethod.Read.All'],
  },
  {
    resourceId: 'copilot/sensitivity-labels',
    resourceName: 'Purview Sensitivity Labels (Copilot)',
    requiredPermissions: ['InformationProtection.Read.All'],
    alternativePermissions: ['InformationProtectionPolicy.Read.All'],
  },
  {
    resourceId: 'copilot/sharepoint-sharing',
    resourceName: 'SharePoint Sharing Settings',
    requiredPermissions: ['Sites.Read.All'],
    alternativePermissions: ['Sites.ReadWrite.All'],
  },
  {
    resourceId: 'copilot/onedrive-provisioning',
    resourceName: 'OneDrive Provisioning Status',
    requiredPermissions: ['User.Read.All'],
  },
  {
    resourceId: 'copilot/exchange-mailbox',
    resourceName: 'Exchange Online Mailbox Status',
    requiredPermissions: ['User.Read.All'],
    alternativePermissions: ['MailboxSettings.Read'],
  },
  {
    resourceId: 'copilot/teams-settings',
    resourceName: 'Teams App Settings (Transcription)',
    requiredPermissions: ['TeamworkAppSettings.Read.All'],
  },
  {
    resourceId: 'copilot/conditional-access',
    resourceName: 'Conditional Access (Copilot)',
    requiredPermissions: ['Policy.Read.All'],
    alternativePermissions: ['Policy.ReadWrite.ConditionalAccess'],
  },
  {
    resourceId: 'copilot/usage-reports',
    resourceName: 'Copilot Usage Reports',
    requiredPermissions: ['Reports.Read.All'],
  },
];

// Azure ARM permission requirements
// Resource IDs MUST match the category/subcategory ids in tenant.ts
export const AZURE_PERMISSION_REQUIREMENTS: PermissionRequirement[] = [
  // Compute (azure-compute category)
  {
    resourceId: 'azure-compute/virtual-machines',
    resourceName: 'Virtual Machines',
    requiredPermissions: ['Microsoft.Compute/virtualMachines/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-compute/vm-scale-sets',
    resourceName: 'VM Scale Sets',
    requiredPermissions: ['Microsoft.Compute/virtualMachineScaleSets/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-compute/disks',
    resourceName: 'Managed Disks',
    requiredPermissions: ['Microsoft.Compute/disks/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-compute/availability-sets',
    resourceName: 'Availability Sets',
    requiredPermissions: ['Microsoft.Compute/availabilitySets/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-compute/images',
    resourceName: 'VM Images',
    requiredPermissions: ['Microsoft.Compute/images/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-compute/galleries',
    resourceName: 'Shared Image Galleries',
    requiredPermissions: ['Microsoft.Compute/galleries/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  
  // Networking (azure-networking category)
  {
    resourceId: 'azure-networking/virtual-networks',
    resourceName: 'Virtual Networks',
    requiredPermissions: ['Microsoft.Network/virtualNetworks/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/subnets',
    resourceName: 'Subnets',
    requiredPermissions: ['Microsoft.Network/virtualNetworks/subnets/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/network-security-groups',
    resourceName: 'Network Security Groups',
    requiredPermissions: ['Microsoft.Network/networkSecurityGroups/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/public-ip-addresses',
    resourceName: 'Public IP Addresses',
    requiredPermissions: ['Microsoft.Network/publicIPAddresses/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/load-balancers',
    resourceName: 'Load Balancers',
    requiredPermissions: ['Microsoft.Network/loadBalancers/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/application-gateways',
    resourceName: 'Application Gateways',
    requiredPermissions: ['Microsoft.Network/applicationGateways/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/vpn-gateways',
    resourceName: 'VPN Gateways',
    requiredPermissions: ['Microsoft.Network/vpnGateways/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/private-endpoints',
    resourceName: 'Private Endpoints',
    requiredPermissions: ['Microsoft.Network/privateEndpoints/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/dns-zones',
    resourceName: 'DNS Zones',
    requiredPermissions: ['Microsoft.Network/dnsZones/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-networking/virtual-networks',
    resourceName: 'Virtual Networks',
    requiredPermissions: ['Microsoft.Network/virtualNetworks/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/subnets',
    resourceName: 'Subnets',
    requiredPermissions: ['Microsoft.Network/virtualNetworks/subnets/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/network-security-groups',
    resourceName: 'Network Security Groups',
    requiredPermissions: ['Microsoft.Network/networkSecurityGroups/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/public-ip-addresses',
    resourceName: 'Public IP Addresses',
    requiredPermissions: ['Microsoft.Network/publicIPAddresses/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/load-balancers',
    resourceName: 'Load Balancers',
    requiredPermissions: ['Microsoft.Network/loadBalancers/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/application-gateways',
    resourceName: 'Application Gateways',
    requiredPermissions: ['Microsoft.Network/applicationGateways/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/vpn-gateways',
    resourceName: 'VPN Gateways',
    requiredPermissions: ['Microsoft.Network/vpnGateways/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/private-endpoints',
    resourceName: 'Private Endpoints',
    requiredPermissions: ['Microsoft.Network/privateEndpoints/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  {
    resourceId: 'azure-networking/dns-zones',
    resourceName: 'DNS Zones',
    requiredPermissions: ['Microsoft.Network/dnsZones/read'],
    alternativePermissions: ['*/read', 'Reader'],
  },
  
  // Storage (azure-storage category)
  {
    resourceId: 'azure-storage/storage-accounts',
    resourceName: 'Storage Accounts',
    requiredPermissions: ['Microsoft.Storage/storageAccounts/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-storage/blob-containers',
    resourceName: 'Blob Containers',
    requiredPermissions: ['Microsoft.Storage/storageAccounts/blobServices/containers/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-storage/file-shares',
    resourceName: 'File Shares',
    requiredPermissions: ['Microsoft.Storage/storageAccounts/fileServices/shares/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-storage/tables',
    resourceName: 'Storage Tables',
    requiredPermissions: ['Microsoft.Storage/storageAccounts/tableServices/tables/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-storage/queues',
    resourceName: 'Storage Queues',
    requiredPermissions: ['Microsoft.Storage/storageAccounts/queueServices/queues/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  
  // Identity & Security (azure-identity category)
  {
    resourceId: 'azure-identity/key-vaults',
    resourceName: 'Key Vaults',
    requiredPermissions: ['Microsoft.KeyVault/vaults/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-identity/managed-identities',
    resourceName: 'Managed Identities',
    requiredPermissions: ['Microsoft.ManagedIdentity/userAssignedIdentities/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-identity/role-assignments',
    resourceName: 'Role Assignments',
    requiredPermissions: ['Microsoft.Authorization/roleAssignments/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-identity/role-definitions',
    resourceName: 'Custom Role Definitions',
    requiredPermissions: ['Microsoft.Authorization/roleDefinitions/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-identity/policy-assignments',
    resourceName: 'Policy Assignments',
    requiredPermissions: ['Microsoft.Authorization/policyAssignments/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-identity/policy-definitions',
    resourceName: 'Policy Definitions',
    requiredPermissions: ['Microsoft.Authorization/policyDefinitions/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  
  // PaaS (azure-paas category)
  {
    resourceId: 'azure-paas/app-services',
    resourceName: 'App Services',
    requiredPermissions: ['Microsoft.Web/sites/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/app-service-plans',
    resourceName: 'App Service Plans',
    requiredPermissions: ['Microsoft.Web/serverfarms/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/function-apps',
    resourceName: 'Function Apps',
    requiredPermissions: ['Microsoft.Web/sites/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/sql-servers',
    resourceName: 'SQL Servers',
    requiredPermissions: ['Microsoft.Sql/servers/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/sql-databases',
    resourceName: 'SQL Databases',
    requiredPermissions: ['Microsoft.Sql/servers/databases/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/cosmos-accounts',
    resourceName: 'Cosmos DB Accounts',
    requiredPermissions: ['Microsoft.DocumentDB/databaseAccounts/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/redis-caches',
    resourceName: 'Redis Caches',
    requiredPermissions: ['Microsoft.Cache/redis/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/service-bus',
    resourceName: 'Service Bus Namespaces',
    requiredPermissions: ['Microsoft.ServiceBus/namespaces/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/event-hubs',
    resourceName: 'Event Hubs',
    requiredPermissions: ['Microsoft.EventHub/namespaces/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/container-registries',
    resourceName: 'Container Registries',
    requiredPermissions: ['Microsoft.ContainerRegistry/registries/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-paas/aks-clusters',
    resourceName: 'AKS Clusters',
    requiredPermissions: ['Microsoft.ContainerService/managedClusters/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  
  // Monitoring (azure-monitoring category)
  {
    resourceId: 'azure-monitoring/log-analytics',
    resourceName: 'Log Analytics Workspaces',
    requiredPermissions: ['Microsoft.OperationalInsights/workspaces/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-monitoring/app-insights',
    resourceName: 'Application Insights',
    requiredPermissions: ['Microsoft.Insights/components/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-monitoring/action-groups',
    resourceName: 'Action Groups',
    requiredPermissions: ['Microsoft.Insights/actionGroups/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-monitoring/metric-alerts',
    resourceName: 'Metric Alerts',
    requiredPermissions: ['Microsoft.Insights/metricAlerts/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-monitoring/activity-log-alerts',
    resourceName: 'Activity Log Alerts',
    requiredPermissions: ['Microsoft.Insights/activityLogAlerts/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
  {
    resourceId: 'azure-monitoring/diagnostic-settings',
    resourceName: 'Diagnostic Settings',
    requiredPermissions: ['Microsoft.Insights/diagnosticSettings/read'],
    alternativePermissions: ['*/read', 'Reader', 'Contributor', 'Owner'],
  },
];

export interface PreflightResult {
  resourceId: string;
  resourceName: string;
  hasPermission: boolean;
  grantedPermissions: string[];
  missingPermissions: string[];
  provider: 'graph' | 'azure';
}

export interface PreflightCheckResult {
  success: boolean;
  grantedRoles: string[];
  azureRoles: string[];
  results: PreflightResult[];
  totalResources: number;
  accessibleResources: number;
  deniedResources: number;
  graphResources: number;
  azureResources: number;
}

/**
 * Decode a JWT token without verification (for reading claims only)
 */
function decodeJWT(token: string): { header: unknown; payload: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    return { header, payload };
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Extract roles/permissions from a Microsoft Graph access token
 */
export function extractRolesFromToken(accessToken: string): string[] {
  const decoded = decodeJWT(accessToken);
  if (!decoded) return [];

  const payload = decoded.payload as Record<string, unknown>;
  
  // App-only tokens have 'roles' claim
  const roles = payload.roles as string[] | undefined;
  if (roles && Array.isArray(roles)) {
    return roles;
  }

  // Delegated tokens might have 'scp' (scope) claim
  const scp = payload.scp as string | undefined;
  if (scp && typeof scp === 'string') {
    return scp.split(' ');
  }

  return [];
}

/**
 * Check if the granted permissions include the required ones
 */
function hasPermission(
  grantedPermissions: string[],
  required: string[],
  alternatives?: string[]
): { hasPermission: boolean; granted: string[]; missing: string[] } {
  const allPossible = [...required, ...(alternatives || [])];
  const granted = allPossible.filter(p => 
    grantedPermissions.some(g => g.toLowerCase() === p.toLowerCase())
  );
  
  if (granted.length > 0) {
    return { hasPermission: true, granted, missing: [] };
  }

  return { hasPermission: false, granted: [], missing: required };
}

/**
 * Perform a preflight check for the selected resources
 * Supports both Graph API and Azure ARM resources
 */
export function performPreflightCheck(
  accessToken: string,
  selectedResources: string[],
  azureRoles: string[] = []
): PreflightCheckResult {
  const grantedRoles = extractRolesFromToken(accessToken);
  
  // Combine all permission requirements
  const allRequirements = [...PERMISSION_REQUIREMENTS, ...AZURE_PERMISSION_REQUIREMENTS];
  
  const results: PreflightResult[] = [];

  for (const resourceId of selectedResources) {
    const isAzureResource = resourceId.startsWith('azure-');
    const requirement = allRequirements.find(r => r.resourceId === resourceId);
    
    if (!requirement) {
      // Unknown resource - assume it will work
      results.push({
        resourceId,
        resourceName: resourceId,
        hasPermission: true,
        grantedPermissions: [],
        missingPermissions: [],
        provider: isAzureResource ? 'azure' : 'graph',
      });
      continue;
    }

    // Use appropriate roles based on provider
    const rolesToCheck = isAzureResource ? azureRoles : grantedRoles;
    
    const check = hasPermission(
      rolesToCheck,
      requirement.requiredPermissions,
      requirement.alternativePermissions
    );

    results.push({
      resourceId: requirement.resourceId,
      resourceName: requirement.resourceName,
      hasPermission: check.hasPermission,
      grantedPermissions: check.granted,
      missingPermissions: check.missing,
      provider: isAzureResource ? 'azure' : 'graph',
    });
  }

  const accessibleResources = results.filter(r => r.hasPermission).length;
  const deniedResources = results.filter(r => !r.hasPermission).length;
  const graphResources = results.filter(r => r.provider === 'graph').length;
  const azureResourceCount = results.filter(r => r.provider === 'azure').length;

  return {
    success: deniedResources === 0,
    grantedRoles,
    azureRoles,
    results,
    totalResources: results.length,
    accessibleResources,
    deniedResources,
    graphResources,
    azureResources: azureResourceCount,
  };
}

/**
 * Get a summary of all missing permissions
 */
export function getMissingPermissionsSummary(results: PreflightResult[]): string[] {
  const missingSet = new Set<string>();
  
  for (const result of results) {
    if (!result.hasPermission) {
      result.missingPermissions.forEach(p => missingSet.add(p));
    }
  }

  return Array.from(missingSet).sort();
}

/**
 * Check if a permission is an Azure RBAC action (e.g., Microsoft.Compute/virtualMachines/read)
 */
export function isAzureRbacPermission(permission: string): boolean {
  return permission.startsWith('Microsoft.') || permission === '*/read' || permission === 'Reader';
}

/**
 * Get user-friendly Azure role guidance instead of showing individual RBAC actions
 */
export function getAzureRoleGuidance(missingAzureResources: PreflightResult[]): {
  summary: string;
  recommendation: string;
  roleToAssign: string;
  portalUrl: string;
} {
  const count = missingAzureResources.length;
  
  return {
    summary: `${count} Azure resource${count === 1 ? '' : 's'} missing permissions`,
    recommendation: 'Assign the "Reader" role to your App Registration (Service Principal) on each Azure subscription you want to export.',
    roleToAssign: 'Reader',
    portalUrl: 'https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade',
  };
}

/**
 * Get copy-friendly instructions for missing permissions
 */
export function getPermissionsCopyText(results: PreflightResult[]): string {
  const graphMissing = results.filter(r => r.provider === 'graph' && !r.hasPermission);
  const azureMissing = results.filter(r => r.provider === 'azure' && !r.hasPermission);
  
  const lines: string[] = [];
  
  if (graphMissing.length > 0) {
    lines.push('=== Microsoft Graph API Permissions ===');
    lines.push('Add these permissions to your App Registration:');
    lines.push('Azure Portal → App Registrations → Your App → API Permissions → Add a permission → Microsoft Graph → Application permissions');
    lines.push('');
    lines.push('For EXPORT ONLY (Read):');
    const graphPerms = new Set<string>();
    graphMissing.forEach(r => r.missingPermissions.forEach(p => graphPerms.add(p)));
    Array.from(graphPerms).sort().forEach(p => lines.push(`  • ${p}`));
    lines.push('');
    lines.push('For EXPORT + IMPORT (ReadWrite) - replace .Read. with .ReadWrite. in each permission above');
    lines.push('');
    lines.push('After adding permissions, click "Grant admin consent for [Your Tenant]"');
    lines.push('');
  }
  
  if (azureMissing.length > 0) {
    lines.push('=== Azure RBAC (Resource Manager) ===');
    lines.push('');
    lines.push('For EXPORT ONLY: Assign "Reader" role');
    lines.push('For EXPORT + IMPORT: Assign "Contributor" role');
    lines.push('');
    lines.push('Steps:');
    lines.push('1. Go to Azure Portal → Subscriptions');
    lines.push('2. Select your subscription');
    lines.push('3. Click "Access control (IAM)" in the left menu');
    lines.push('4. Click "Add" → "Add role assignment"');
    lines.push('5. Select "Reader" or "Contributor" role');
    lines.push('6. Click "Members" tab → "Select members"');
    lines.push('7. Search for your App Registration name and select it');
    lines.push('8. Click "Review + assign"');
    lines.push('');
    lines.push('Repeat for each subscription you want to manage.');
    lines.push('');
    lines.push('NOTE: You do NOT need to add individual permissions like');
    lines.push('"Microsoft.Compute/virtualMachines/read" - the role includes everything!');
  }
  
  return lines.join('\n');
}
