export interface IntuneDevice {
  id: string;
  displayName?: string;
  deviceName?: string;
  managedDeviceOwnerType?: string;
  operatingSystem?: string;
  osVersion?: string;
  complianceState?: string;
  lastSyncDateTime?: string;
  lastModifiedDateTime?: string;
  userPrincipalName?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  enrolledDateTime?: string;
  managementAgent?: string;
  deviceRegistrationState?: string;
  isEncrypted?: boolean;
  userDisplayName?: string;
  '@odata.type'?: string;
}

export interface IntuneApp {
  id: string;
  displayName: string;
  description: string;
  publisher: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
  installSummary?: {
    installedDeviceCount: number;
    failedDeviceCount: number;
    notInstalledDeviceCount: number;
  };
}

export interface IntuneCompliancePolicy {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
  assignments?: any[];
}

export interface IntuneDeviceConfig {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
}

export interface IntuneScript {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  fileName: string;
  runAsAccount: string;
  enforceSignatureCheck: boolean;
  runAs32Bit: boolean;
}

export interface IntuneEnrollmentConfig {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
  priority: number;
}

export interface IntuneAutopilotProfile {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  outOfBoxExperienceSettings?: any;
}

export type IntuneSectionId = 
  | 'overview'
  | 'all-devices'
  | 'windows'
  | 'macos'
  | 'ios'
  | 'android'
  | 'all-apps'
  | 'app-configs'
  | 'app-deploy'
  | 'enrollment'
  | 'autopilot'
  | 'configuration'
  | 'compliance'
  | 'scripts'
  | 'remediation'
  | 'update-rings'
  | 'endpoint-security'
  | 'reports';

export interface IntuneSidebarItem {
  id: IntuneSectionId;
  label: string;
  icon: string;
  parent?: string;
}

export interface IntuneSidebarGroup {
  id: string;
  label: string;
  items: IntuneSidebarItem[];
}
