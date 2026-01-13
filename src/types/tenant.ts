export interface ResourceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: ResourceSubcategory[];
  exportFormats: ExportFormat[];
}

export interface ResourceSubcategory {
  id: string;
  name: string;
  count?: number;
  graphEndpoint?: string;
  powershellModule?: string;
  supported?: boolean; // false = "Coming Soon", defaults to true if graphEndpoint exists
  comingSoonReason?: string;
}

export interface ExportFormat {
  id: 'json' | 'terraform' | 'bicep' | 'powershell';
  name: string;
  extension: string;
  supported: boolean;
}

export interface ExportJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
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
