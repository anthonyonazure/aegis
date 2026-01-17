// Policy Template Types for MSP Policy Deployment

export type BaselineType = 'cis' | 'nist' | 'hipaa' | 'iso27001' | 'zero_trust' | 'microsoft_security' | 'custom';
export type DeploymentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type TargetType = 'all' | 'customer' | 'group' | 'selected';

export interface PolicyTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  baselineType: BaselineType;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDeployment {
  id: string;
  userId: string;
  policyTemplateId: string;
  name: string;
  description?: string;
  targetType: TargetType;
  targetCustomerId?: string;
  targetGroupId?: string;
  targetTenantIds: string[];
  dryRun: boolean;
  status: DeploymentStatus;
  totalTenants: number;
  completedTenants: number;
  failedTenants: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  template?: PolicyTemplate;
}

export interface DeploymentResult {
  id: string;
  deploymentId: string;
  tenantConnectionId: string;
  status: DeploymentStatus;
  dryRunResult?: Record<string, unknown>;
  appliedChanges?: Record<string, unknown>;
  errorMessage?: string;
  rollbackData?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  // Joined data
  tenantName?: string;
  tenantId?: string;
}

// Built-in baseline templates
export const BASELINE_TEMPLATES: Omit<PolicyTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'CIS Microsoft 365 Foundations Benchmark',
    description: 'Center for Internet Security benchmark for M365 security hardening',
    category: 'security',
    baselineType: 'cis',
    policyData: {
      conditionalAccess: {
        requireMFA: true,
        blockLegacyAuth: true,
        requireCompliantDevice: true,
      },
      intune: {
        requireEncryption: true,
        requireFirewall: true,
        requireAntivirus: true,
      },
    },
    resourceTypes: ['conditional-access', 'intune', 'entra-id'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'NIST Cybersecurity Framework',
    description: 'NIST CSF controls for Microsoft 365 environments',
    category: 'compliance',
    baselineType: 'nist',
    policyData: {
      identifyProtect: {
        assetInventory: true,
        accessControl: true,
        dataProtection: true,
      },
      detectRespond: {
        anomalyDetection: true,
        incidentResponse: true,
      },
    },
    resourceTypes: ['conditional-access', 'defender', 'entra-id'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'HIPAA Security Rule',
    description: 'HIPAA-compliant security configurations for healthcare organizations',
    category: 'compliance',
    baselineType: 'hipaa',
    policyData: {
      accessControls: {
        uniqueUserIds: true,
        automaticLogoff: true,
        encryptionDecryption: true,
      },
      auditControls: {
        activityLogging: true,
        logReview: true,
      },
    },
    resourceTypes: ['conditional-access', 'purview', 'entra-id'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Zero Trust Security Model',
    description: 'Microsoft Zero Trust implementation for M365',
    category: 'security',
    baselineType: 'zero_trust',
    policyData: {
      verifyExplicitly: {
        mfaRequired: true,
        deviceCompliance: true,
        riskBasedAccess: true,
      },
      leastPrivilege: {
        justInTimeAccess: true,
        privilegedAccessWorkstations: true,
      },
      assumeBreach: {
        microsegmentation: true,
        endToEndEncryption: true,
      },
    },
    resourceTypes: ['conditional-access', 'defender', 'entra-id', 'intune'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Microsoft Security Baseline',
    description: 'Microsoft recommended security configurations',
    category: 'security',
    baselineType: 'microsoft_security',
    policyData: {
      windows: {
        securityBaseline: true,
        defenderATP: true,
      },
      office: {
        macroSecurity: true,
        protectedView: true,
      },
      edge: {
        smartScreen: true,
        passwordMonitor: true,
      },
    },
    resourceTypes: ['intune', 'defender'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
];

export const BASELINE_CONFIG: Record<BaselineType, { label: string; color: string; icon: string }> = {
  cis: { label: 'CIS', color: 'bg-blue-500/20 text-blue-400', icon: 'Shield' },
  nist: { label: 'NIST', color: 'bg-purple-500/20 text-purple-400', icon: 'FileCheck' },
  hipaa: { label: 'HIPAA', color: 'bg-pink-500/20 text-pink-400', icon: 'Heart' },
  iso27001: { label: 'ISO 27001', color: 'bg-green-500/20 text-green-400', icon: 'Globe' },
  zero_trust: { label: 'Zero Trust', color: 'bg-orange-500/20 text-orange-400', icon: 'Lock' },
  microsoft_security: { label: 'Microsoft', color: 'bg-cyan-500/20 text-cyan-400', icon: 'Laptop' },
  custom: { label: 'Custom', color: 'bg-muted text-muted-foreground', icon: 'Settings' },
};

export const DEPLOYMENT_STATUS_CONFIG: Record<DeploymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  running: { label: 'Running', color: 'bg-primary/20 text-primary' },
  completed: { label: 'Completed', color: 'bg-success/20 text-success' },
  failed: { label: 'Failed', color: 'bg-destructive/20 text-destructive' },
  cancelled: { label: 'Cancelled', color: 'bg-warning/20 text-warning' },
  rolled_back: { label: 'Rolled Back', color: 'bg-orange-500/20 text-orange-400' },
};
