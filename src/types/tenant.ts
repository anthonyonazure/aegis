// Customer hierarchy types for MSP multi-tenant management
export type CustomerTier = 'starter' | 'professional' | 'enterprise';

export interface Customer {
  id: string;
  userId: string;
  name: string;
  industry?: string;
  tier: CustomerTier;
  primaryContactName?: string;
  primaryContactEmail?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantGroup {
  id: string;
  customerId: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantEnvironment = 'production' | 'development' | 'staging' | 'test';
export type TenantHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export type ResourceProvider = 'graph' | 'azure';

export interface ResourceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: ResourceSubcategory[];
  exportFormats: ExportFormat[];
  provider?: ResourceProvider; // 'graph' for M365, 'azure' for ARM
}

export interface ResourceSubcategory {
  id: string;
  name: string;
  count?: number;
  graphEndpoint?: string;
  azureResourceType?: string; // Azure ARM resource type
  powershellModule?: string;
  supported?: boolean; // false = "Coming Soon", defaults to true if graphEndpoint exists
  comingSoonReason?: string;
}

export interface ExportFormat {
  id: 'json' | 'terraform' | 'bicep' | 'powershell' | 'arm';
  name: string;
  extension: string;
  supported: boolean;
}

export interface ExportJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  categories: string[];
  formats: ExportFormat['id'][];
  createdAt: Date;
  completedAt?: Date;
  outputPath?: string;
  error?: string;
}

export interface TenantConnection {
  id: string;
  tenantId: string;
  tenantName: string;
  authMethod: 'app' | 'delegated';
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  clientId?: string;
  connectionType?: 'graph' | 'azure' | 'both';
  subscriptionIds?: string[];
  // New MSP hierarchy fields
  customerId?: string;
  tenantGroupId?: string;
  displayName?: string;
  environment?: TenantEnvironment;
  tags?: string[];
  healthStatus?: TenantHealthStatus;
  lastHealthCheck?: Date;
}

export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state: string;
  selected?: boolean;
}

export interface GitConfig {
  id?: string;
  enabled: boolean;
  provider: 'github' | 'azure-devops' | 'gitlab';
  repoUrl?: string;
  branch?: string;
  autoCommit: boolean;
  commitMessage?: string;
  cicdTemplate?: 'github-actions' | 'azure-pipelines' | 'gitlab-ci';
}

export interface ExportConfig {
  selectedCategories: string[];
  selectedFormats: ExportFormat['id'][];
  outputDirectory: string;
  gitConfig: GitConfig;
  cicdTemplate?: 'github-actions' | 'azure-pipelines' | 'gitlab-ci';
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: 'intune',
    name: 'Intune / Endpoint Manager',
    icon: 'Laptop',
    description: 'Device management, compliance, and configuration policies',
    subcategories: [
      { id: 'device-configurations', name: 'Device Configuration Profiles', graphEndpoint: '/deviceManagement/deviceConfigurations' },
      { id: 'compliance-policies', name: 'Compliance Policies', graphEndpoint: '/deviceManagement/deviceCompliancePolicies' },
      { id: 'app-configurations', name: 'App Configuration Policies', graphEndpoint: '/deviceManagement/managedAppPolicies' },
      { id: 'autopilot', name: 'Autopilot Profiles', graphEndpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles' },
      { id: 'enrollment-restrictions', name: 'Enrollment Restrictions', graphEndpoint: '/deviceManagement/deviceEnrollmentConfigurations' },
      { id: 'scripts', name: 'PowerShell Scripts', graphEndpoint: '/deviceManagement/deviceManagementScripts' },
      { id: 'win32-apps', name: 'Win32 Applications', graphEndpoint: '/deviceAppManagement/mobileApps' },
      { id: 'update-rings', name: 'Update Rings', graphEndpoint: '/deviceManagement/deviceConfigurations' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'conditional-access',
    name: 'Conditional Access',
    icon: 'Shield',
    description: 'Access policies, named locations, and authentication contexts',
    subcategories: [
      { id: 'ca-policies', name: 'CA Policies', graphEndpoint: '/identity/conditionalAccess/policies' },
      { id: 'named-locations', name: 'Named Locations', graphEndpoint: '/identity/conditionalAccess/namedLocations' },
      { id: 'auth-contexts', name: 'Authentication Contexts', graphEndpoint: '/identity/conditionalAccess/authenticationContextClassReferences' },
      { id: 'auth-strengths', name: 'Authentication Strengths', graphEndpoint: '/identity/conditionalAccess/authenticationStrengths/policies' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'entra-id',
    name: 'Entra ID (Azure AD)',
    icon: 'Users',
    description: 'Directory settings, groups, and identity configuration',
    subcategories: [
      { id: 'groups', name: 'Groups & Dynamic Membership', graphEndpoint: '/groups' },
      { id: 'app-registrations', name: 'App Registrations', graphEndpoint: '/applications' },
      { id: 'enterprise-apps', name: 'Enterprise Applications', graphEndpoint: '/servicePrincipals' },
      { id: 'directory-settings', name: 'Directory Settings', graphEndpoint: '/settings' },
      { id: 'admin-units', name: 'Administrative Units', graphEndpoint: '/administrativeUnits' },
      { id: 'roles', name: 'Directory Roles', graphEndpoint: '/directoryRoles' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
    ],
  },
  {
    id: 'defender',
    name: 'Microsoft Defender',
    icon: 'ShieldCheck',
    description: 'Security policies, ASR rules, and threat protection settings',
    subcategories: [
      { id: 'asr-policies', name: 'Attack Surface Reduction', graphEndpoint: '/deviceManagement/intents' },
      { id: 'antivirus-policies', name: 'Antivirus Policies', graphEndpoint: '/deviceManagement/intents' },
      { id: 'firewall-policies', name: 'Firewall Policies', graphEndpoint: '/deviceManagement/intents' },
      { id: 'edr-policies', name: 'EDR Policies', graphEndpoint: '/deviceManagement/intents' },
      { id: 'security-baselines', name: 'Security Baselines', graphEndpoint: '/deviceManagement/templates' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'exchange',
    name: 'Exchange Online',
    icon: 'Mail',
    description: 'Mail flow rules, connectors, and organization settings',
    subcategories: [
      { id: 'transport-rules', name: 'Transport Rules', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
      { id: 'connectors', name: 'Connectors', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
      { id: 'accepted-domains', name: 'Accepted Domains', graphEndpoint: '/domains', supported: true },
      { id: 'mailbox-policies', name: 'Mailbox Policies', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
      { id: 'anti-spam', name: 'Anti-Spam Policies', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
      { id: 'dlp-policies', name: 'DLP Policies', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: false },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'sharepoint',
    name: 'SharePoint & OneDrive',
    icon: 'FolderOpen',
    description: 'Site configurations, sharing settings, and storage policies',
    subcategories: [
      { id: 'tenant-settings', name: 'Tenant Settings', powershellModule: 'PnP.PowerShell', supported: false, comingSoonReason: 'Requires PnP PowerShell' },
      { id: 'sharing-policies', name: 'Sharing Policies', powershellModule: 'PnP.PowerShell', supported: false, comingSoonReason: 'Requires PnP PowerShell' },
      { id: 'site-templates', name: 'Site Templates', graphEndpoint: '/sites', supported: true },
      { id: 'hub-sites', name: 'Hub Sites', graphEndpoint: '/sites?$filter=isHubSite eq true', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: false },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: 'MessageSquare',
    description: 'Teams policies, app permissions, and meeting configurations',
    subcategories: [
      { id: 'messaging-policies', name: 'Messaging Policies', powershellModule: 'MicrosoftTeams', supported: false, comingSoonReason: 'Requires Teams PowerShell' },
      { id: 'meeting-policies', name: 'Meeting Policies', powershellModule: 'MicrosoftTeams', supported: false, comingSoonReason: 'Requires Teams PowerShell' },
      { id: 'app-policies', name: 'App Permission Policies', graphEndpoint: '/appCatalogs/teamsApps', supported: true },
      { id: 'calling-policies', name: 'Calling Policies', powershellModule: 'MicrosoftTeams', supported: false, comingSoonReason: 'Requires Teams PowerShell' },
      { id: 'live-event-policies', name: 'Live Event Policies', powershellModule: 'MicrosoftTeams', supported: false, comingSoonReason: 'Requires Teams PowerShell' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: false },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
  {
    id: 'purview',
    name: 'Microsoft Purview',
    icon: 'Eye',
    description: 'Information protection, retention, and compliance settings',
    subcategories: [
      { id: 'sensitivity-labels', name: 'Sensitivity Labels', graphEndpoint: '/security/informationProtection/sensitivityLabels', supported: true },
      { id: 'retention-policies', name: 'Retention Policies', graphEndpoint: '/security/labels/retentionLabels', supported: true },
      { id: 'dlp-policies', name: 'DLP Policies', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
      { id: 'insider-risk', name: 'Insider Risk Policies', powershellModule: 'ExchangeOnlineManagement', supported: false, comingSoonReason: 'Requires PowerShell module' },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: false },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: false },
    ],
  },
];

// Azure Resource Manager Categories
export const AZURE_RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: 'azure-compute',
    name: 'Azure Compute',
    icon: 'Server',
    description: 'Virtual machines, scale sets, and compute resources',
    provider: 'azure',
    subcategories: [
      { id: 'virtual-machines', name: 'Virtual Machines', azureResourceType: 'Microsoft.Compute/virtualMachines', supported: true },
      { id: 'vm-scale-sets', name: 'VM Scale Sets', azureResourceType: 'Microsoft.Compute/virtualMachineScaleSets', supported: true },
      { id: 'availability-sets', name: 'Availability Sets', azureResourceType: 'Microsoft.Compute/availabilitySets', supported: true },
      { id: 'disks', name: 'Managed Disks', azureResourceType: 'Microsoft.Compute/disks', supported: true },
      { id: 'images', name: 'VM Images', azureResourceType: 'Microsoft.Compute/images', supported: true },
      { id: 'galleries', name: 'Shared Image Galleries', azureResourceType: 'Microsoft.Compute/galleries', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
  {
    id: 'azure-networking',
    name: 'Azure Networking',
    icon: 'Network',
    description: 'Virtual networks, load balancers, and network security',
    provider: 'azure',
    subcategories: [
      { id: 'virtual-networks', name: 'Virtual Networks', azureResourceType: 'Microsoft.Network/virtualNetworks', supported: true },
      { id: 'subnets', name: 'Subnets', azureResourceType: 'Microsoft.Network/virtualNetworks/subnets', supported: true },
      { id: 'network-security-groups', name: 'Network Security Groups', azureResourceType: 'Microsoft.Network/networkSecurityGroups', supported: true },
      { id: 'public-ip-addresses', name: 'Public IP Addresses', azureResourceType: 'Microsoft.Network/publicIPAddresses', supported: true },
      { id: 'load-balancers', name: 'Load Balancers', azureResourceType: 'Microsoft.Network/loadBalancers', supported: true },
      { id: 'application-gateways', name: 'Application Gateways', azureResourceType: 'Microsoft.Network/applicationGateways', supported: true },
      { id: 'vpn-gateways', name: 'VPN Gateways', azureResourceType: 'Microsoft.Network/vpnGateways', supported: true },
      { id: 'private-endpoints', name: 'Private Endpoints', azureResourceType: 'Microsoft.Network/privateEndpoints', supported: true },
      { id: 'dns-zones', name: 'DNS Zones', azureResourceType: 'Microsoft.Network/dnsZones', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
  {
    id: 'azure-storage',
    name: 'Azure Storage',
    icon: 'HardDrive',
    description: 'Storage accounts, blobs, files, and data storage',
    provider: 'azure',
    subcategories: [
      { id: 'storage-accounts', name: 'Storage Accounts', azureResourceType: 'Microsoft.Storage/storageAccounts', supported: true },
      { id: 'blob-containers', name: 'Blob Containers', azureResourceType: 'Microsoft.Storage/storageAccounts/blobServices/containers', supported: true },
      { id: 'file-shares', name: 'File Shares', azureResourceType: 'Microsoft.Storage/storageAccounts/fileServices/shares', supported: true },
      { id: 'tables', name: 'Storage Tables', azureResourceType: 'Microsoft.Storage/storageAccounts/tableServices/tables', supported: true },
      { id: 'queues', name: 'Storage Queues', azureResourceType: 'Microsoft.Storage/storageAccounts/queueServices/queues', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
  {
    id: 'azure-identity',
    name: 'Azure Identity & Security',
    icon: 'Shield',
    description: 'Key Vaults, Managed Identities, and RBAC',
    provider: 'azure',
    subcategories: [
      { id: 'key-vaults', name: 'Key Vaults', azureResourceType: 'Microsoft.KeyVault/vaults', supported: true },
      { id: 'managed-identities', name: 'Managed Identities', azureResourceType: 'Microsoft.ManagedIdentity/userAssignedIdentities', supported: true },
      { id: 'role-assignments', name: 'Role Assignments', azureResourceType: 'Microsoft.Authorization/roleAssignments', supported: true },
      { id: 'role-definitions', name: 'Custom Role Definitions', azureResourceType: 'Microsoft.Authorization/roleDefinitions', supported: true },
      { id: 'policy-assignments', name: 'Policy Assignments', azureResourceType: 'Microsoft.Authorization/policyAssignments', supported: true },
      { id: 'policy-definitions', name: 'Policy Definitions', azureResourceType: 'Microsoft.Authorization/policyDefinitions', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
  {
    id: 'azure-paas',
    name: 'Azure PaaS Services',
    icon: 'Cloud',
    description: 'App Services, Functions, SQL Databases, and more',
    provider: 'azure',
    subcategories: [
      { id: 'app-services', name: 'App Services', azureResourceType: 'Microsoft.Web/sites', supported: true },
      { id: 'app-service-plans', name: 'App Service Plans', azureResourceType: 'Microsoft.Web/serverfarms', supported: true },
      { id: 'function-apps', name: 'Function Apps', azureResourceType: 'Microsoft.Web/sites', supported: true },
      { id: 'sql-servers', name: 'SQL Servers', azureResourceType: 'Microsoft.Sql/servers', supported: true },
      { id: 'sql-databases', name: 'SQL Databases', azureResourceType: 'Microsoft.Sql/servers/databases', supported: true },
      { id: 'cosmos-accounts', name: 'Cosmos DB Accounts', azureResourceType: 'Microsoft.DocumentDB/databaseAccounts', supported: true },
      { id: 'redis-caches', name: 'Redis Caches', azureResourceType: 'Microsoft.Cache/redis', supported: true },
      { id: 'service-bus', name: 'Service Bus Namespaces', azureResourceType: 'Microsoft.ServiceBus/namespaces', supported: true },
      { id: 'event-hubs', name: 'Event Hubs', azureResourceType: 'Microsoft.EventHub/namespaces', supported: true },
      { id: 'container-registries', name: 'Container Registries', azureResourceType: 'Microsoft.ContainerRegistry/registries', supported: true },
      { id: 'aks-clusters', name: 'AKS Clusters', azureResourceType: 'Microsoft.ContainerService/managedClusters', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
  {
    id: 'azure-monitoring',
    name: 'Azure Monitoring',
    icon: 'Activity',
    description: 'Log Analytics, Application Insights, and alerts',
    provider: 'azure',
    subcategories: [
      { id: 'log-analytics', name: 'Log Analytics Workspaces', azureResourceType: 'Microsoft.OperationalInsights/workspaces', supported: true },
      { id: 'app-insights', name: 'Application Insights', azureResourceType: 'Microsoft.Insights/components', supported: true },
      { id: 'action-groups', name: 'Action Groups', azureResourceType: 'Microsoft.Insights/actionGroups', supported: true },
      { id: 'metric-alerts', name: 'Metric Alerts', azureResourceType: 'Microsoft.Insights/metricAlerts', supported: true },
      { id: 'activity-log-alerts', name: 'Activity Log Alerts', azureResourceType: 'Microsoft.Insights/activityLogAlerts', supported: true },
      { id: 'diagnostic-settings', name: 'Diagnostic Settings', azureResourceType: 'Microsoft.Insights/diagnosticSettings', supported: true },
    ],
    exportFormats: [
      { id: 'json', name: 'JSON', extension: '.json', supported: true },
      { id: 'arm', name: 'ARM Template', extension: '.json', supported: true },
      { id: 'terraform', name: 'Terraform', extension: '.tf', supported: true },
      { id: 'bicep', name: 'Bicep', extension: '.bicep', supported: true },
      { id: 'powershell', name: 'PowerShell', extension: '.ps1', supported: true },
    ],
  },
];

// Combined categories for unified view
export const ALL_RESOURCE_CATEGORIES = [...RESOURCE_CATEGORIES, ...AZURE_RESOURCE_CATEGORIES];

export const CICD_TEMPLATES = [
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    icon: 'Github',
    description: 'Automated workflows for GitHub repositories',
  },
  {
    id: 'azure-pipelines',
    name: 'Azure Pipelines',
    icon: 'Cloud',
    description: 'CI/CD pipelines for Azure DevOps',
  },
  {
    id: 'gitlab-ci',
    name: 'GitLab CI/CD',
    icon: 'GitBranch',
    description: 'Integrated CI/CD for GitLab repositories',
  },
];
