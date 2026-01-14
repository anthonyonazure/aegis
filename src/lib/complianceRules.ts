// Compliance rules based on Microsoft and CIS security baselines

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  baseline: string;
  resourceTypes: string[];
  check: (resource: Record<string, unknown>) => { passed: boolean; message: string };
}

export const COMPLIANCE_BASELINES = [
  { id: 'microsoft-recommended', name: 'Microsoft Recommended', description: 'Microsoft security best practices' },
  { id: 'cis-m365', name: 'CIS Microsoft 365', description: 'CIS Benchmark for Microsoft 365' },
  { id: 'zero-trust', name: 'Zero Trust', description: 'Zero Trust security principles' },
  { id: 'nist', name: 'NIST 800-53', description: 'NIST security controls framework' },
] as const;

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // ===============================
  // Conditional Access Rules
  // ===============================
  {
    id: 'ca-mfa-all-users',
    name: 'MFA Required for All Users',
    description: 'Conditional Access policies should require MFA for all users',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasMfa = builtInControls?.includes('mfa');
      return {
        passed: hasMfa === true,
        message: hasMfa ? 'MFA is required' : 'MFA is not configured in grant controls',
      };
    },
  },
  {
    id: 'ca-block-legacy-auth',
    name: 'Block Legacy Authentication',
    description: 'Legacy authentication protocols should be blocked',
    category: 'conditional-access',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const conditions = resource.conditions as Record<string, unknown> | undefined;
      const clientAppTypes = conditions?.clientAppTypes as string[] | undefined;
      const hasLegacy = clientAppTypes?.some(t => 
        t === 'exchangeActiveSync' || t === 'other'
      );
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const isBlocked = builtInControls?.includes('block');
      
      if (hasLegacy && isBlocked) {
        return { passed: true, message: 'Legacy authentication is blocked' };
      }
      return { passed: false, message: 'No policy blocking legacy authentication found' };
    },
  },
  {
    id: 'ca-require-compliant-device',
    name: 'Require Compliant Device',
    description: 'Access should require device compliance for sensitive resources',
    category: 'conditional-access',
    severity: 'high',
    baseline: 'zero-trust',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const requiresCompliance = builtInControls?.includes('compliantDevice');
      return {
        passed: requiresCompliance === true,
        message: requiresCompliance ? 'Compliant device required' : 'Device compliance not enforced',
      };
    },
  },
  {
    id: 'ca-policy-enabled',
    name: 'Policy Is Enabled',
    description: 'Conditional Access policies should be enabled in production',
    category: 'conditional-access',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const state = resource.state as string;
      const isEnabled = state === 'enabled';
      return {
        passed: isEnabled,
        message: isEnabled ? 'Policy is enabled' : `Policy state is "${state}"`,
      };
    },
  },
  {
    id: 'ca-session-timeout',
    name: 'Session Timeout Configured',
    description: 'Session controls should enforce sign-in frequency',
    category: 'conditional-access',
    severity: 'medium',
    baseline: 'zero-trust',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const sessionControls = resource.sessionControls as Record<string, unknown> | undefined;
      const signInFrequency = sessionControls?.signInFrequency as Record<string, unknown> | undefined;
      const hasTimeout = signInFrequency?.isEnabled === true;
      return {
        passed: hasTimeout,
        message: hasTimeout ? 'Sign-in frequency is configured' : 'No session timeout configured',
      };
    },
  },
  {
    id: 'ca-risk-based-policy',
    name: 'Risk-Based Policy',
    description: 'Policies should consider user or sign-in risk',
    category: 'conditional-access',
    severity: 'high',
    baseline: 'zero-trust',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const conditions = resource.conditions as Record<string, unknown> | undefined;
      const userRiskLevels = conditions?.userRiskLevels as string[] | undefined;
      const signInRiskLevels = conditions?.signInRiskLevels as string[] | undefined;
      const hasRisk = (userRiskLevels && userRiskLevels.length > 0) || 
                      (signInRiskLevels && signInRiskLevels.length > 0);
      return {
        passed: hasRisk === true,
        message: hasRisk ? 'Risk-based conditions configured' : 'No risk-based conditions',
      };
    },
  },
  {
    id: 'ca-location-restrictions',
    name: 'Location Restrictions',
    description: 'Access should be restricted by location',
    category: 'conditional-access',
    severity: 'medium',
    baseline: 'nist',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const conditions = resource.conditions as Record<string, unknown> | undefined;
      const locations = conditions?.locations as Record<string, unknown> | undefined;
      const hasLocations = locations?.includeLocations || locations?.excludeLocations;
      return {
        passed: hasLocations !== undefined,
        message: hasLocations ? 'Location restrictions configured' : 'No location restrictions',
      };
    },
  },

  // ===============================
  // Intune Device Configuration Rules
  // ===============================
  {
    id: 'intune-bitlocker-enabled',
    name: 'BitLocker Encryption Required',
    description: 'Device configurations should require BitLocker encryption',
    category: 'intune',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['intune/device-configurations'],
    check: (resource) => {
      const odataType = resource['@odata.type'] as string || '';
      if (!odataType.includes('windows')) {
        return { passed: true, message: 'Not applicable (non-Windows config)' };
      }
      const bitLockerEnabled = resource.bitLockerEnabled === true || 
                               resource.requireDeviceEncryption === true;
      return {
        passed: bitLockerEnabled,
        message: bitLockerEnabled ? 'BitLocker is enabled' : 'BitLocker encryption not configured',
      };
    },
  },
  {
    id: 'intune-password-complexity',
    name: 'Password Complexity Required',
    description: 'Device policies should require complex passwords',
    category: 'intune',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['intune/compliance-policies', 'intune/device-configurations'],
    check: (resource) => {
      const passwordRequired = resource.passwordRequired === true || 
                               resource.passwordRequiredType === 'alphanumeric' ||
                               resource.passwordRequiredType === 'deviceDefault';
      const minLength = (resource.passwordMinimumLength as number) || 0;
      
      if (passwordRequired && minLength >= 8) {
        return { passed: true, message: `Password required (min ${minLength} chars)` };
      }
      return { 
        passed: false, 
        message: minLength < 8 ? `Password minimum length is ${minLength} (should be 8+)` : 'Password complexity not configured',
      };
    },
  },
  {
    id: 'intune-jailbreak-detection',
    name: 'Jailbreak Detection Enabled',
    description: 'Mobile devices should have jailbreak/root detection enabled',
    category: 'intune',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['intune/compliance-policies'],
    check: (resource) => {
      const odataType = resource['@odata.type'] as string || '';
      if (!odataType.includes('ios') && !odataType.includes('android')) {
        return { passed: true, message: 'Not applicable (non-mobile policy)' };
      }
      const securityBlockJailbroken = resource.securityBlockJailbrokenDevices === true ||
                                       resource.rootedDevicesBlocked === true;
      return {
        passed: securityBlockJailbroken,
        message: securityBlockJailbroken ? 'Jailbreak/root detection enabled' : 'Jailbreak detection not configured',
      };
    },
  },
  {
    id: 'intune-screen-lock',
    name: 'Screen Lock Required',
    description: 'Devices should require screen lock',
    category: 'intune',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['intune/compliance-policies', 'intune/device-configurations'],
    check: (resource) => {
      const screenLock = resource.passwordRequired === true || 
                         resource.securityRequireScreenLock === true ||
                         resource.screenLockRequired === true;
      return {
        passed: screenLock === true,
        message: screenLock ? 'Screen lock required' : 'Screen lock not enforced',
      };
    },
  },
  {
    id: 'intune-os-version',
    name: 'Minimum OS Version',
    description: 'Devices should run a minimum OS version',
    category: 'intune',
    severity: 'medium',
    baseline: 'cis-m365',
    resourceTypes: ['intune/compliance-policies'],
    check: (resource) => {
      const osMinVersion = resource.osMinimumVersion || 
                           resource.minAndroidSecurityPatchLevel ||
                           resource.osMinimumBuildVersion;
      return {
        passed: osMinVersion !== undefined,
        message: osMinVersion ? `Minimum OS version: ${osMinVersion}` : 'No minimum OS version configured',
      };
    },
  },
  {
    id: 'intune-firewall-enabled',
    name: 'Firewall Enabled',
    description: 'Windows devices should have firewall enabled',
    category: 'intune',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['intune/device-configurations'],
    check: (resource) => {
      const odataType = resource['@odata.type'] as string || '';
      if (!odataType.includes('windows')) {
        return { passed: true, message: 'Not applicable (non-Windows config)' };
      }
      const firewallEnabled = resource.firewallEnabled === true ||
                              resource.firewallBlockAllIncoming === true ||
                              resource.defenderFirewallRulesFromGroupPolicyNotMerged === false;
      return {
        passed: firewallEnabled !== false,
        message: firewallEnabled ? 'Firewall is enabled' : 'Firewall not configured',
      };
    },
  },

  // ===============================
  // Entra ID Rules
  // ===============================
  {
    id: 'entra-group-dynamic',
    name: 'Use Dynamic Groups',
    description: 'Groups should use dynamic membership where possible for automation',
    category: 'entra-id',
    severity: 'low',
    baseline: 'microsoft-recommended',
    resourceTypes: ['entra-id/groups'],
    check: (resource) => {
      const groupTypes = resource.groupTypes as string[] | undefined;
      const isDynamic = groupTypes?.includes('DynamicMembership');
      return {
        passed: isDynamic === true,
        message: isDynamic ? 'Dynamic membership enabled' : 'Static group membership',
      };
    },
  },
  {
    id: 'entra-app-credentials-expiry',
    name: 'App Credentials Should Expire',
    description: 'Application credentials should have expiry dates configured',
    category: 'entra-id',
    severity: 'medium',
    baseline: 'zero-trust',
    resourceTypes: ['entra-id/app-registrations'],
    check: (resource) => {
      const passwordCredentials = resource.passwordCredentials as Array<{ endDateTime?: string }> | undefined;
      if (!passwordCredentials || passwordCredentials.length === 0) {
        return { passed: true, message: 'No password credentials configured' };
      }
      const allHaveExpiry = passwordCredentials.every(cred => cred.endDateTime);
      return {
        passed: allHaveExpiry,
        message: allHaveExpiry ? 'All credentials have expiry dates' : 'Some credentials do not have expiry dates',
      };
    },
  },
  {
    id: 'entra-app-credentials-short-lived',
    name: 'App Credentials Short-Lived',
    description: 'Application credentials should expire within 1 year',
    category: 'entra-id',
    severity: 'medium',
    baseline: 'cis-m365',
    resourceTypes: ['entra-id/app-registrations'],
    check: (resource) => {
      const passwordCredentials = resource.passwordCredentials as Array<{ endDateTime?: string }> | undefined;
      if (!passwordCredentials || passwordCredentials.length === 0) {
        return { passed: true, message: 'No password credentials configured' };
      }
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      const allShortLived = passwordCredentials.every(cred => {
        if (!cred.endDateTime) return false;
        return new Date(cred.endDateTime) <= oneYearFromNow;
      });
      return {
        passed: allShortLived,
        message: allShortLived ? 'All credentials expire within 1 year' : 'Some credentials have long expiry (>1 year)',
      };
    },
  },
  {
    id: 'entra-admin-mfa',
    name: 'Admin Accounts Require MFA',
    description: 'Administrative accounts should always require MFA',
    category: 'entra-id',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['entra-id/directory-roles', 'conditional-access/ca-policies'],
    check: (resource) => {
      const displayName = (resource.displayName as string || '').toLowerCase();
      const isAdminRole = displayName.includes('admin') || displayName.includes('administrator');
      if (!isAdminRole) {
        return { passed: true, message: 'Not an admin role' };
      }
      // Check if MFA is assigned to admin roles
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasMfa = builtInControls?.includes('mfa');
      return {
        passed: hasMfa === true,
        message: hasMfa ? 'MFA required for admin' : 'Admin role without MFA requirement',
      };
    },
  },
  {
    id: 'entra-guest-access-restricted',
    name: 'Guest Access Restricted',
    description: 'Guest user access should be limited',
    category: 'entra-id',
    severity: 'medium',
    baseline: 'zero-trust',
    resourceTypes: ['entra-id/authorization-policy'],
    check: (resource) => {
      const guestUserRoleId = resource.guestUserRoleId as string;
      // Restricted guest access GUID
      const isRestricted = guestUserRoleId === '2af84b1e-32c8-42b7-82bc-daa82404023b' ||
                           guestUserRoleId === '10dae51f-b6af-4016-8d66-8c2a99b929b3';
      return {
        passed: isRestricted,
        message: isRestricted ? 'Guest access is restricted' : 'Guest access is not restricted',
      };
    },
  },
  {
    id: 'entra-self-service-password',
    name: 'Self-Service Password Reset',
    description: 'SSPR should be enabled for users',
    category: 'entra-id',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['entra-id/sspr-settings'],
    check: (resource) => {
      const enabled = resource.selfServicePasswordResetEnabled === true || 
                      resource.enabledForAllUsers === true;
      return {
        passed: enabled,
        message: enabled ? 'SSPR is enabled' : 'SSPR not enabled',
      };
    },
  },

  // ===============================
  // Defender Rules
  // ===============================
  {
    id: 'defender-asr-enabled',
    name: 'Attack Surface Reduction Enabled',
    description: 'ASR rules should be enabled to block common attack techniques',
    category: 'defender',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['defender/asr-policies'],
    check: (resource) => {
      const isEnabled = resource.isAssigned === true || resource.state === 'enabled';
      return {
        passed: isEnabled,
        message: isEnabled ? 'ASR policy is enabled' : 'ASR policy is not enabled',
      };
    },
  },
  {
    id: 'defender-realtime-protection',
    name: 'Real-time Protection Enabled',
    description: 'Antivirus real-time protection should be enabled',
    category: 'defender',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['defender/antivirus-policies'],
    check: (resource) => {
      const realtimeEnabled = resource.allowRealtimeMonitoring !== false;
      return {
        passed: realtimeEnabled,
        message: realtimeEnabled ? 'Real-time protection enabled' : 'Real-time protection is disabled',
      };
    },
  },
  {
    id: 'defender-cloud-protection',
    name: 'Cloud-Delivered Protection',
    description: 'Cloud-based protection should be enabled',
    category: 'defender',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['defender/antivirus-policies'],
    check: (resource) => {
      const cloudEnabled = resource.allowCloudProtection !== false ||
                           resource.cloudBlockLevel !== 'notConfigured';
      return {
        passed: cloudEnabled,
        message: cloudEnabled ? 'Cloud protection enabled' : 'Cloud protection disabled',
      };
    },
  },
  {
    id: 'defender-pua-protection',
    name: 'PUA Protection Enabled',
    description: 'Potentially Unwanted Application protection should be enabled',
    category: 'defender',
    severity: 'medium',
    baseline: 'cis-m365',
    resourceTypes: ['defender/antivirus-policies'],
    check: (resource) => {
      const puaEnabled = resource.puaProtection === 'enable' || 
                         resource.puaProtection === 'block' ||
                         resource.detectPotentiallyUnwantedApps === true;
      return {
        passed: puaEnabled === true,
        message: puaEnabled ? 'PUA protection enabled' : 'PUA protection not configured',
      };
    },
  },
  {
    id: 'defender-tamper-protection',
    name: 'Tamper Protection Enabled',
    description: 'Tamper protection should prevent disabling security features',
    category: 'defender',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['defender/antivirus-policies'],
    check: (resource) => {
      const tamperEnabled = resource.tamperProtection === 'enable' || 
                            resource.disableTamperProtection === false;
      return {
        passed: tamperEnabled !== false,
        message: tamperEnabled ? 'Tamper protection enabled' : 'Tamper protection disabled',
      };
    },
  },

  // ===============================
  // Exchange Online Rules
  // ===============================
  {
    id: 'exchange-audit-enabled',
    name: 'Mailbox Auditing Enabled',
    description: 'Mailbox auditing should be enabled for all mailboxes',
    category: 'exchange',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['exchange/mailboxes', 'exchange/organization-config'],
    check: (resource) => {
      const auditEnabled = resource.auditEnabled === true || 
                           resource.auditDisabled === false;
      return {
        passed: auditEnabled !== false,
        message: auditEnabled ? 'Mailbox auditing enabled' : 'Mailbox auditing disabled',
      };
    },
  },
  {
    id: 'exchange-external-forwarding',
    name: 'Block External Forwarding',
    description: 'External email forwarding should be blocked',
    category: 'exchange',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['exchange/transport-rules', 'exchange/remote-domains'],
    check: (resource) => {
      const autoForwardEnabled = resource.autoForwardEnabled;
      const isBlocked = autoForwardEnabled === false || 
                        resource.state === 'Enabled' && 
                        (resource.name as string)?.toLowerCase().includes('block');
      return {
        passed: isBlocked === true,
        message: isBlocked ? 'External forwarding blocked' : 'External forwarding may be allowed',
      };
    },
  },
  {
    id: 'exchange-modern-auth',
    name: 'Modern Authentication Required',
    description: 'Modern authentication should be enabled for Exchange',
    category: 'exchange',
    severity: 'critical',
    baseline: 'microsoft-recommended',
    resourceTypes: ['exchange/organization-config'],
    check: (resource) => {
      const modernAuth = resource.oAuth2ClientProfileEnabled === true ||
                         resource.modernAuthEnabled === true;
      return {
        passed: modernAuth !== false,
        message: modernAuth ? 'Modern authentication enabled' : 'Modern authentication not confirmed',
      };
    },
  },
  {
    id: 'exchange-spam-filtering',
    name: 'Spam Filtering Configured',
    description: 'Anti-spam policies should be configured',
    category: 'exchange',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['exchange/anti-spam-policies', 'exchange/hosted-content-filter-policy'],
    check: (resource) => {
      const spamAction = resource.spamAction || resource.highConfidenceSpamAction;
      const hasAction = spamAction && spamAction !== 'NoAction';
      return {
        passed: hasAction === true,
        message: hasAction ? `Spam action: ${spamAction}` : 'Spam filtering not configured',
      };
    },
  },

  // ===============================
  // SharePoint / OneDrive Rules
  // ===============================
  {
    id: 'sharepoint-external-sharing',
    name: 'External Sharing Restricted',
    description: 'External sharing should be appropriately restricted',
    category: 'sharepoint',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['sharepoint/tenant-settings', 'sharepoint/sharing-settings'],
    check: (resource) => {
      const sharingCapability = resource.sharingCapability as string;
      const isRestricted = sharingCapability === 'Disabled' || 
                           sharingCapability === 'ExistingExternalUserSharingOnly' ||
                           sharingCapability === 'ExternalUserSharingOnly';
      return {
        passed: isRestricted === true,
        message: isRestricted ? `Sharing: ${sharingCapability}` : 'Unrestricted external sharing',
      };
    },
  },
  {
    id: 'sharepoint-link-expiration',
    name: 'Sharing Links Expire',
    description: 'Anonymous sharing links should have expiration',
    category: 'sharepoint',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['sharepoint/tenant-settings'],
    check: (resource) => {
      const expirationDays = resource.requireAnonymousLinksExpireInDays as number;
      const hasExpiration = expirationDays && expirationDays > 0;
      return {
        passed: hasExpiration === true,
        message: hasExpiration ? `Links expire in ${expirationDays} days` : 'Anonymous links do not expire',
      };
    },
  },
  {
    id: 'sharepoint-versioning',
    name: 'Versioning Enabled',
    description: 'Document versioning should be enabled',
    category: 'sharepoint',
    severity: 'low',
    baseline: 'microsoft-recommended',
    resourceTypes: ['sharepoint/sites', 'sharepoint/document-libraries'],
    check: (resource) => {
      const versioningEnabled = resource.versioningEnabled === true || 
                                 resource.enableVersioning === true;
      return {
        passed: versioningEnabled !== false,
        message: versioningEnabled ? 'Versioning enabled' : 'Versioning not confirmed',
      };
    },
  },

  // ===============================
  // Teams Rules
  // ===============================
  {
    id: 'teams-external-access',
    name: 'External Access Controlled',
    description: 'Teams external access should be controlled',
    category: 'teams',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['teams/federation-settings', 'teams/external-access-policy'],
    check: (resource) => {
      const allowFederated = resource.allowFederatedUsers;
      const allowTeamsConsumer = resource.allowTeamsConsumer;
      const isControlled = allowFederated === false || allowTeamsConsumer === false;
      return {
        passed: isControlled || allowFederated !== undefined,
        message: isControlled ? 'External access restricted' : 'External access settings not restricted',
      };
    },
  },
  {
    id: 'teams-guest-access',
    name: 'Guest Access Configured',
    description: 'Teams guest access should be explicitly configured',
    category: 'teams',
    severity: 'medium',
    baseline: 'cis-m365',
    resourceTypes: ['teams/guest-settings', 'teams/guest-meeting-policy'],
    check: (resource) => {
      const allowGuests = resource.allowGuestUser;
      const guestCallingEnabled = resource.allowGuestToCalling;
      return {
        passed: allowGuests !== undefined,
        message: allowGuests === false ? 'Guest access disabled' : 
                 allowGuests === true ? 'Guest access enabled (verify if intended)' : 
                 'Guest access not configured',
      };
    },
  },
  {
    id: 'teams-meeting-recording',
    name: 'Meeting Recording Policy',
    description: 'Meeting recording settings should be configured',
    category: 'teams',
    severity: 'low',
    baseline: 'microsoft-recommended',
    resourceTypes: ['teams/meeting-policies'],
    check: (resource) => {
      const recordingMode = resource.allowCloudRecording || resource.recordingStorageMode;
      return {
        passed: recordingMode !== undefined,
        message: recordingMode !== undefined ? 'Recording policy configured' : 'Recording policy not set',
      };
    },
  },

  // ===============================
  // Purview / Information Protection Rules
  // ===============================
  {
    id: 'purview-dlp-enabled',
    name: 'DLP Policies Enabled',
    description: 'Data Loss Prevention policies should be active',
    category: 'purview',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['purview/dlp-policies'],
    check: (resource) => {
      const state = resource.state || resource.mode;
      const isEnabled = state === 'Enabled' || state === 'Enable' || state === 'enabled';
      return {
        passed: isEnabled,
        message: isEnabled ? 'DLP policy enabled' : `DLP policy state: ${state || 'unknown'}`,
      };
    },
  },
  {
    id: 'purview-sensitivity-labels',
    name: 'Sensitivity Labels Published',
    description: 'Sensitivity labels should be published for use',
    category: 'purview',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['purview/sensitivity-labels', 'purview/label-policies'],
    check: (resource) => {
      const isPublished = resource.isActive === true || 
                          resource.isEnabled === true ||
                          resource.contentFormats;
      return {
        passed: isPublished !== false,
        message: isPublished ? 'Label is active' : 'Label may not be published',
      };
    },
  },
  {
    id: 'purview-retention-policy',
    name: 'Retention Policies Configured',
    description: 'Retention policies should be configured for compliance',
    category: 'purview',
    severity: 'medium',
    baseline: 'nist',
    resourceTypes: ['purview/retention-policies', 'purview/retention-labels'],
    check: (resource) => {
      const isEnabled = resource.isEnabled !== false && resource.status !== 'Disabled';
      return {
        passed: isEnabled,
        message: isEnabled ? 'Retention policy active' : 'Retention policy not active',
      };
    },
  },

  // ===============================
  // Authentication Methods Rules
  // ===============================
  {
    id: 'auth-passwordless',
    name: 'Passwordless Methods Available',
    description: 'Passwordless authentication should be enabled',
    category: 'authentication',
    severity: 'medium',
    baseline: 'zero-trust',
    resourceTypes: ['entra-id/authentication-methods-policy'],
    check: (resource) => {
      const fido2 = resource.fido2 as Record<string, unknown> | undefined;
      const microsoftAuthenticator = resource.microsoftAuthenticator as Record<string, unknown> | undefined;
      const hasPasswordless = fido2?.state === 'enabled' || 
                               microsoftAuthenticator?.state === 'enabled';
      return {
        passed: hasPasswordless === true,
        message: hasPasswordless ? 'Passwordless methods enabled' : 'No passwordless methods enabled',
      };
    },
  },
  {
    id: 'auth-sms-disabled',
    name: 'SMS Authentication Discouraged',
    description: 'SMS-based authentication should be disabled for security',
    category: 'authentication',
    severity: 'medium',
    baseline: 'nist',
    resourceTypes: ['entra-id/authentication-methods-policy'],
    check: (resource) => {
      const sms = resource.sms as Record<string, unknown> | undefined;
      const smsDisabled = sms?.state !== 'enabled';
      return {
        passed: smsDisabled,
        message: smsDisabled ? 'SMS authentication disabled' : 'SMS authentication is enabled (less secure)',
      };
    },
  },
];

export function getApplicableRules(resourceTypes: string[], baseline?: string): ComplianceRule[] {
  return COMPLIANCE_RULES.filter(rule => {
    const matchesType = rule.resourceTypes.some(rt => resourceTypes.includes(rt));
    const matchesBaseline = !baseline || rule.baseline === baseline;
    return matchesType && matchesBaseline;
  });
}

export function runComplianceCheck(
  resources: Array<{ resourceType: string; data: Record<string, unknown>; resourceName?: string }>,
  baseline?: string
): Array<{
  resourceType: string;
  resourceName: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  passed: boolean;
  message: string;
}> {
  const results: Array<{
    resourceType: string;
    resourceName: string;
    ruleId: string;
    ruleName: string;
    severity: string;
    passed: boolean;
    message: string;
  }> = [];

  for (const resource of resources) {
    const applicableRules = getApplicableRules([resource.resourceType], baseline);
    
    for (const rule of applicableRules) {
      try {
        const checkResult = rule.check(resource.data);
        results.push({
          resourceType: resource.resourceType,
          resourceName: resource.resourceName || 'Unknown',
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          passed: checkResult.passed,
          message: checkResult.message,
        });
      } catch (error) {
        results.push({
          resourceType: resource.resourceType,
          resourceName: resource.resourceName || 'Unknown',
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          passed: false,
          message: 'Error running compliance check',
        });
      }
    }
  }

  return results;
}
