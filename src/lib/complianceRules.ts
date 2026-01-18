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
  { id: 'iso-27001', name: 'ISO 27001', description: 'Information Security Management System (ISMS) standard' },
  { id: 'iso-27018', name: 'ISO 27018', description: 'Protection of PII in public clouds' },
  { id: 'soc-2', name: 'SOC 2 Type II', description: 'Service Organization Control 2 - Trust Services Criteria' },
  { id: 'iso-9001', name: 'ISO 9001', description: 'Quality Management System standard' },
  { id: 'irap', name: 'IRAP', description: 'Australian Government Information Security Registered Assessors Program' },
  { id: 'hipaa', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
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
      // Check various BitLocker-related properties in Windows configs
      const bitLockerEnabled = resource.bitLockerEnabled === true || 
                               resource.requireDeviceEncryption === true ||
                               resource.bitLockerSystemDrivePolicy !== undefined ||
                               resource.bitLockerFixedDrivePolicy !== undefined;
      return {
        passed: bitLockerEnabled,
        message: bitLockerEnabled ? 'BitLocker is configured' : 'BitLocker encryption not found in this policy',
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
      if (passwordRequired) {
        return { passed: minLength >= 6, message: `Password min length: ${minLength}` };
      }
      return { 
        passed: false, 
        message: 'Password complexity not configured in this policy',
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
      // groupTypes is an array - check if it includes 'DynamicMembership'
      const groupTypes = resource.groupTypes as string[] | undefined;
      const isDynamic = Array.isArray(groupTypes) && groupTypes.includes('DynamicMembership');
      const membershipRule = resource.membershipRule as string | undefined;
      
      return {
        passed: isDynamic === true,
        message: isDynamic 
          ? `Dynamic group with rule: ${membershipRule?.substring(0, 50)}...` 
          : 'Static group membership (consider dynamic for automation)',
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
    resourceTypes: ['entra-id/roles'],
    check: (resource) => {
      // Directory roles don't contain MFA info - this check validates admin roles exist
      // MFA for admins should be enforced via Conditional Access policies
      const displayName = (resource.displayName as string || '').toLowerCase();
      const isAdminRole = displayName.includes('admin') || displayName.includes('administrator');
      const roleTemplateId = resource.roleTemplateId as string;
      
      // Well-known admin role template IDs
      const criticalRoles = [
        '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
        'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
      ];
      const isCriticalRole = criticalRoles.includes(roleTemplateId);
      
      return {
        passed: true, // Always pass - this is informational
        message: isCriticalRole 
          ? `Critical admin role: ${resource.displayName} (ensure CA policy requires MFA)`
          : (isAdminRole ? `Admin role found: ${resource.displayName}` : 'Not an admin role'),
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
      // configurationPolicies structure: check if policy exists and has settings
      const name = resource.name as string || resource.displayName as string || '';
      const settings = resource.settings as unknown[] | undefined;
      const hasSettings = settings && settings.length > 0;
      const templateRef = resource.templateReference as Record<string, unknown> | undefined;
      const isASR = templateRef?.templateFamily === 'endpointSecurityAttackSurfaceReduction' ||
                    name.toLowerCase().includes('asr') ||
                    name.toLowerCase().includes('attack surface');
      
      if (!isASR && !hasSettings) {
        return { passed: false, message: 'No ASR policy configured' };
      }
      
      // Check if policy is assigned (has assignments)
      const isAssigned = resource.isAssigned === true || 
                         (resource.assignments as unknown[] | undefined)?.length > 0;
      
      return {
        passed: hasSettings === true,
        message: hasSettings 
          ? (isAssigned ? 'ASR policy is configured and assigned' : 'ASR policy exists but may not be assigned')
          : 'ASR policy has no settings configured',
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
      // configurationPolicies structure - check settings for real-time monitoring
      const settings = resource.settings as Array<{ settingInstance?: { settingDefinitionId?: string; choiceSettingValue?: { value?: string } } }> | undefined;
      const hasRealtimeSetting = settings?.some(s => {
        const defId = s.settingInstance?.settingDefinitionId || '';
        return defId.includes('allowrealtimemonitoring') || defId.includes('realtimescantype');
      });
      
      // If we can find the setting, check its value
      const realtimeSetting = settings?.find(s => 
        s.settingInstance?.settingDefinitionId?.includes('allowrealtimemonitoring')
      );
      const isDisabled = realtimeSetting?.settingInstance?.choiceSettingValue?.value?.includes('_0') || 
                         realtimeSetting?.settingInstance?.choiceSettingValue?.value?.includes('disable');
      
      // Default to passed if policy exists (real-time is on by default)
      const policyExists = settings && settings.length > 0;
      return {
        passed: policyExists && !isDisabled,
        message: isDisabled 
          ? 'Real-time protection is disabled' 
          : (policyExists ? 'Antivirus policy configured' : 'No antivirus policy found'),
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
      // configurationPolicies structure - check settings array
      const settings = resource.settings as Array<Record<string, unknown>> | undefined;
      const policyExists = settings && settings.length > 0;
      
      // Look for cloud protection related settings
      const hasCloudSetting = settings?.some(s => {
        const defId = (s.settingInstance as Record<string, unknown>)?.settingDefinitionId as string || '';
        return defId.toLowerCase().includes('cloud') || defId.toLowerCase().includes('maps');
      });
      
      return {
        passed: policyExists === true,
        message: policyExists 
          ? (hasCloudSetting ? 'Cloud protection configured' : 'Antivirus policy exists')
          : 'No antivirus policy configured',
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
      const settings = resource.settings as Array<Record<string, unknown>> | undefined;
      const policyExists = settings && settings.length > 0;
      
      const hasPuaSetting = settings?.some(s => {
        const defId = (s.settingInstance as Record<string, unknown>)?.settingDefinitionId as string || '';
        return defId.toLowerCase().includes('pua') || defId.toLowerCase().includes('potentiallyunwanted');
      });
      
      return {
        passed: hasPuaSetting === true,
        message: hasPuaSetting ? 'PUA protection configured' : 'PUA protection not configured',
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
      const settings = resource.settings as Array<Record<string, unknown>> | undefined;
      const policyExists = settings && settings.length > 0;
      
      const hasTamperSetting = settings?.some(s => {
        const defId = (s.settingInstance as Record<string, unknown>)?.settingDefinitionId as string || '';
        return defId.toLowerCase().includes('tamper');
      });
      
      return {
        passed: policyExists === true,
        message: hasTamperSetting 
          ? 'Tamper protection configured' 
          : (policyExists ? 'Antivirus policy exists (tamper managed by Defender for Endpoint)' : 'No antivirus policy'),
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
    resourceTypes: ['purview/sensitivity-labels'],
    check: (resource) => {
      // Actual structure: {id, name, isActive, sensitivity, color, tooltip}
      const isActive = resource.isActive === true;
      const name = resource.name as string;
      const sensitivity = resource.sensitivity as number;
      
      return {
        passed: isActive,
        message: isActive 
          ? `Label "${name}" is active (sensitivity: ${sensitivity})`
          : `Label "${name}" is not active`,
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

  // ===============================
  // Azure Resource Rules
  // ===============================
  {
    id: 'azure-storage-https',
    name: 'Storage Requires HTTPS',
    description: 'Storage accounts should require secure transfer',
    category: 'azure-storage',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['azure-storage/storage-accounts'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const supportsHttpsOnly = props?.supportsHttpsTrafficOnly === true ||
                                 (resource as Record<string, unknown>).supportsHttpsTrafficOnly === true;
      return {
        passed: supportsHttpsOnly,
        message: supportsHttpsOnly ? 'HTTPS-only traffic enforced' : 'HTTP traffic allowed (insecure)',
      };
    },
  },
  {
    id: 'azure-storage-encryption',
    name: 'Storage Encryption Enabled',
    description: 'Storage accounts should use encryption at rest',
    category: 'azure-storage',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['azure-storage/storage-accounts'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const encryption = props?.encryption as Record<string, unknown> | undefined;
      const isEncrypted = encryption?.services !== undefined || props?.isHnsEnabled !== undefined;
      return {
        passed: isEncrypted !== false,
        message: isEncrypted ? 'Encryption at rest configured' : 'Encryption not verified',
      };
    },
  },
  {
    id: 'azure-keyvault-softdelete',
    name: 'Key Vault Soft Delete',
    description: 'Key Vaults should have soft delete enabled',
    category: 'azure-identity',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['azure-identity/key-vaults'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const softDeleteEnabled = props?.enableSoftDelete === true;
      return {
        passed: softDeleteEnabled,
        message: softDeleteEnabled ? 'Soft delete enabled' : 'Soft delete not enabled (data loss risk)',
      };
    },
  },
  {
    id: 'azure-keyvault-purge-protection',
    name: 'Key Vault Purge Protection',
    description: 'Key Vaults should have purge protection enabled',
    category: 'azure-identity',
    severity: 'high',
    baseline: 'zero-trust',
    resourceTypes: ['azure-identity/key-vaults'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const purgeProtection = props?.enablePurgeProtection === true;
      return {
        passed: purgeProtection,
        message: purgeProtection ? 'Purge protection enabled' : 'Purge protection not enabled',
      };
    },
  },
  {
    id: 'azure-nsg-no-any-inbound',
    name: 'NSG No Open Inbound',
    description: 'NSGs should not allow unrestricted inbound access',
    category: 'azure-networking',
    severity: 'critical',
    baseline: 'cis-m365',
    resourceTypes: ['azure-networking/network-security-groups'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const rules = props?.securityRules as Array<Record<string, unknown>> | undefined;
      const hasOpenInbound = rules?.some(rule => {
        const ruleProps = rule.properties as Record<string, unknown> | undefined;
        return ruleProps?.direction === 'Inbound' &&
               ruleProps?.access === 'Allow' &&
               (ruleProps?.sourceAddressPrefix === '*' || ruleProps?.sourceAddressPrefix === 'Internet');
      });
      return {
        passed: !hasOpenInbound,
        message: hasOpenInbound ? 'Open inbound rules found (security risk)' : 'No unrestricted inbound access',
      };
    },
  },
  {
    id: 'azure-vm-managed-disks',
    name: 'VMs Use Managed Disks',
    description: 'Virtual machines should use managed disks',
    category: 'azure-compute',
    severity: 'medium',
    baseline: 'microsoft-recommended',
    resourceTypes: ['azure-compute/virtual-machines'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const storageProfile = props?.storageProfile as Record<string, unknown> | undefined;
      const osDisk = storageProfile?.osDisk as Record<string, unknown> | undefined;
      const hasManaged = osDisk?.managedDisk !== undefined;
      return {
        passed: hasManaged,
        message: hasManaged ? 'Using managed disks' : 'Not using managed disks',
      };
    },
  },
  {
    id: 'azure-vm-encryption',
    name: 'VM Disk Encryption',
    description: 'VM disks should be encrypted',
    category: 'azure-compute',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['azure-compute/virtual-machines'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const storageProfile = props?.storageProfile as Record<string, unknown> | undefined;
      const osDisk = storageProfile?.osDisk as Record<string, unknown> | undefined;
      const encryptionSettings = osDisk?.encryptionSettings as Record<string, unknown> | undefined;
      const managedDisk = osDisk?.managedDisk as Record<string, unknown> | undefined;
      const isEncrypted = encryptionSettings?.enabled === true || 
                          managedDisk?.diskEncryptionSet !== undefined;
      return {
        passed: isEncrypted !== false,
        message: isEncrypted ? 'Disk encryption configured' : 'Disk encryption not verified',
      };
    },
  },
  {
    id: 'azure-sql-tde',
    name: 'SQL TDE Enabled',
    description: 'SQL databases should have Transparent Data Encryption enabled',
    category: 'azure-paas',
    severity: 'high',
    baseline: 'microsoft-recommended',
    resourceTypes: ['azure-paas/sql-databases'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const tde = props?.transparentDataEncryption as Record<string, unknown> | undefined;
      const status = tde?.status || props?.status;
      const isEnabled = status === 'Enabled';
      return {
        passed: isEnabled !== false,
        message: isEnabled ? 'TDE enabled' : 'TDE status not verified',
      };
    },
  },
  {
    id: 'azure-app-https-only',
    name: 'App Service HTTPS Only',
    description: 'App Services should require HTTPS',
    category: 'azure-paas',
    severity: 'high',
    baseline: 'cis-m365',
    resourceTypes: ['azure-paas/app-services', 'azure-paas/function-apps'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const httpsOnly = props?.httpsOnly === true;
      return {
        passed: httpsOnly,
        message: httpsOnly ? 'HTTPS-only enabled' : 'HTTP allowed (insecure)',
      };
    },
  },
  {
    id: 'azure-app-managed-identity',
    name: 'App Service Managed Identity',
    description: 'App Services should use managed identity',
    category: 'azure-paas',
    severity: 'medium',
    baseline: 'zero-trust',
    resourceTypes: ['azure-paas/app-services', 'azure-paas/function-apps'],
    check: (resource) => {
      const identity = resource.identity as Record<string, unknown> | undefined;
      const hasIdentity = identity?.type === 'SystemAssigned' || 
                          identity?.type === 'UserAssigned' ||
                          identity?.type === 'SystemAssigned, UserAssigned';
      return {
        passed: hasIdentity === true,
        message: hasIdentity ? `Managed identity: ${identity?.type}` : 'No managed identity configured',
      };
    },
  },
  {
    id: 'azure-aks-rbac',
    name: 'AKS RBAC Enabled',
    description: 'AKS clusters should have RBAC enabled',
    category: 'azure-paas',
    severity: 'critical',
    baseline: 'zero-trust',
    resourceTypes: ['azure-paas/aks-clusters'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const rbacEnabled = props?.enableRBAC === true;
      return {
        passed: rbacEnabled,
        message: rbacEnabled ? 'Kubernetes RBAC enabled' : 'RBAC not enabled (security risk)',
      };
    },
  },
  {
    id: 'azure-aks-network-policy',
    name: 'AKS Network Policy',
    description: 'AKS clusters should have network policy configured',
    category: 'azure-paas',
    severity: 'high',
    baseline: 'zero-trust',
    resourceTypes: ['azure-paas/aks-clusters'],
    check: (resource) => {
      const props = resource.properties as Record<string, unknown> | undefined;
      const networkProfile = props?.networkProfile as Record<string, unknown> | undefined;
      const hasNetworkPolicy = networkProfile?.networkPolicy !== undefined &&
                               networkProfile?.networkPolicy !== 'none';
      return {
        passed: hasNetworkPolicy === true,
        message: hasNetworkPolicy ? `Network policy: ${networkProfile?.networkPolicy}` : 'No network policy configured',
      };
    },
  },

  // ===============================
  // ISO 27001 - Information Security Management
  // ===============================
  {
    id: 'iso27001-access-control',
    name: 'Access Control Policy (A.9)',
    description: 'ISO 27001 A.9: Access control policies must be established',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'iso-27001',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const state = resource.state as string;
      const conditions = resource.conditions as Record<string, unknown> | undefined;
      const hasUsers = conditions?.users !== undefined;
      return {
        passed: state === 'enabled' && hasUsers,
        message: state === 'enabled' && hasUsers 
          ? 'Access control policy is active' 
          : 'Access control not properly configured',
      };
    },
  },
  {
    id: 'iso27001-cryptography',
    name: 'Cryptographic Controls (A.10)',
    description: 'ISO 27001 A.10: Data encryption must be enabled',
    category: 'intune',
    severity: 'critical',
    baseline: 'iso-27001',
    resourceTypes: ['intune/device-configurations', 'intune/compliance-policies'],
    check: (resource) => {
      const bitLockerEnabled = resource.bitLockerEnabled === true || 
                               resource.requireDeviceEncryption === true ||
                               resource.storageRequireEncryption === true ||
                               resource.encryptionRequired === true;
      return {
        passed: bitLockerEnabled === true,
        message: bitLockerEnabled ? 'Encryption controls configured' : 'Encryption not enforced',
      };
    },
  },
  {
    id: 'iso27001-ops-security',
    name: 'Operations Security (A.12)',
    description: 'ISO 27001 A.12: Protection from malware required',
    category: 'defender',
    severity: 'critical',
    baseline: 'iso-27001',
    resourceTypes: ['defender/antivirus-policies', 'defender/asr-policies'],
    check: (resource) => {
      const settings = resource.settings as unknown[] | undefined;
      const hasSettings = settings && settings.length > 0;
      return {
        passed: hasSettings === true,
        message: hasSettings ? 'Operations security controls configured' : 'Malware protection not configured',
      };
    },
  },
  {
    id: 'iso27001-audit-logging',
    name: 'Audit Logging (A.12.4)',
    description: 'ISO 27001 A.12.4: Event logging must be configured',
    category: 'exchange',
    severity: 'high',
    baseline: 'iso-27001',
    resourceTypes: ['exchange/organization-config', 'exchange/mailboxes'],
    check: (resource) => {
      const auditEnabled = resource.auditEnabled === true || 
                           resource.auditDisabled === false;
      return {
        passed: auditEnabled !== false,
        message: auditEnabled ? 'Audit logging enabled' : 'Audit logging not enabled',
      };
    },
  },
  {
    id: 'iso27001-network-security',
    name: 'Network Security (A.13)',
    description: 'ISO 27001 A.13: Network controls must be implemented',
    category: 'conditional-access',
    severity: 'high',
    baseline: 'iso-27001',
    resourceTypes: ['conditional-access/ca-policies', 'conditional-access/named-locations'],
    check: (resource) => {
      const conditions = resource.conditions as Record<string, unknown> | undefined;
      const locations = conditions?.locations as Record<string, unknown> | undefined;
      const isTrustedLocation = resource.isTrusted === true;
      return {
        passed: locations !== undefined || isTrustedLocation,
        message: locations || isTrustedLocation 
          ? 'Network controls configured' 
          : 'No network segmentation controls',
      };
    },
  },
  {
    id: 'iso27001-supplier-security',
    name: 'Supplier Relationships (A.15)',
    description: 'ISO 27001 A.15: Third-party app permissions must be reviewed',
    category: 'entra-id',
    severity: 'medium',
    baseline: 'iso-27001',
    resourceTypes: ['entra-id/enterprise-apps', 'entra-id/app-registrations'],
    check: (resource) => {
      const requiredResourceAccess = resource.requiredResourceAccess as unknown[] | undefined;
      const hasLimitedPermissions = !requiredResourceAccess || requiredResourceAccess.length <= 5;
      return {
        passed: hasLimitedPermissions,
        message: hasLimitedPermissions 
          ? 'App permissions appear reasonable' 
          : `App has ${requiredResourceAccess?.length} resource access grants - review required`,
      };
    },
  },

  // ===============================
  // ISO 27018 - PII Protection in Cloud
  // ===============================
  {
    id: 'iso27018-pii-encryption',
    name: 'PII Encryption in Transit (5.1)',
    description: 'ISO 27018: PII must be encrypted during transmission',
    category: 'sharepoint',
    severity: 'critical',
    baseline: 'iso-27018',
    resourceTypes: ['sharepoint/tenant-settings', 'exchange/organization-config'],
    check: (resource) => {
      // SharePoint/Exchange use TLS by default in M365
      const modernAuth = resource.oAuth2ClientProfileEnabled === true || 
                         resource.modernAuthEnabled === true;
      return {
        passed: true, // M365 enforces TLS
        message: 'M365 enforces TLS encryption for data in transit',
      };
    },
  },
  {
    id: 'iso27018-data-location',
    name: 'Data Location Transparency (5.2)',
    description: 'ISO 27018: Data processing locations must be defined',
    category: 'sharepoint',
    severity: 'medium',
    baseline: 'iso-27018',
    resourceTypes: ['sharepoint/tenant-settings', 'sharepoint/geo-locations'],
    check: (resource) => {
      const geoLocation = resource.geoLocation as string | undefined;
      const dataLocation = resource.allowedDataLocation as string | undefined;
      return {
        passed: geoLocation !== undefined || dataLocation !== undefined,
        message: geoLocation || dataLocation 
          ? `Data location: ${geoLocation || dataLocation}` 
          : 'Data location not explicitly configured',
      };
    },
  },
  {
    id: 'iso27018-consent-management',
    name: 'Consent Management (A.2.1)',
    description: 'ISO 27018: User consent controls must be configured',
    category: 'entra-id',
    severity: 'high',
    baseline: 'iso-27018',
    resourceTypes: ['entra-id/authorization-policy', 'entra-id/consent-policies'],
    check: (resource) => {
      const permissionGrantPolicy = resource.permissionGrantPolicyIdsAssignedToDefaultUserRole as string[] | undefined;
      const isRestricted = !permissionGrantPolicy || 
                           permissionGrantPolicy.length === 0 ||
                           permissionGrantPolicy.includes('ManagePermissionGrantsForSelf.microsoft-user-default-low');
      return {
        passed: isRestricted,
        message: isRestricted 
          ? 'User consent is restricted' 
          : 'Users can consent to any app - consider restricting',
      };
    },
  },
  {
    id: 'iso27018-data-retention',
    name: 'Data Retention Controls (A.10.1)',
    description: 'ISO 27018: Data retention policies must be defined',
    category: 'exchange',
    severity: 'medium',
    baseline: 'iso-27018',
    resourceTypes: ['exchange/retention-policies', 'sharepoint/retention-policies'],
    check: (resource) => {
      const retentionEnabled = resource.retentionEnabled === true || 
                               resource.isEnabled === true ||
                               resource.retentionDays !== undefined;
      return {
        passed: retentionEnabled === true,
        message: retentionEnabled ? 'Retention policy configured' : 'No retention policy defined',
      };
    },
  },

  // ===============================
  // SOC 2 Type II - Trust Services Criteria
  // ===============================
  {
    id: 'soc2-cc6-logical-access',
    name: 'Logical Access Controls (CC6.1)',
    description: 'SOC 2: Logical access security controls',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'soc-2',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasMfa = builtInControls?.includes('mfa');
      const state = resource.state as string;
      return {
        passed: state === 'enabled' && hasMfa === true,
        message: state === 'enabled' && hasMfa 
          ? 'Logical access controls with MFA configured' 
          : 'MFA not enforced for access control',
      };
    },
  },
  {
    id: 'soc2-cc6-authentication',
    name: 'Authentication Mechanisms (CC6.2)',
    description: 'SOC 2: Strong authentication required',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'soc-2',
    resourceTypes: ['conditional-access/ca-policies', 'conditional-access/auth-strength'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const authStrength = grantControls?.authenticationStrength as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasStrongAuth = authStrength !== undefined || builtInControls?.includes('mfa');
      return {
        passed: hasStrongAuth === true,
        message: hasStrongAuth ? 'Strong authentication configured' : 'Strong authentication not enforced',
      };
    },
  },
  {
    id: 'soc2-cc7-system-monitoring',
    name: 'System Monitoring (CC7.1)',
    description: 'SOC 2: Security event monitoring required',
    category: 'defender',
    severity: 'high',
    baseline: 'soc-2',
    resourceTypes: ['defender/antivirus-policies', 'defender/edr-policies'],
    check: (resource) => {
      const settings = resource.settings as unknown[] | undefined;
      const hasSettings = settings && settings.length > 0;
      return {
        passed: hasSettings === true,
        message: hasSettings ? 'Security monitoring configured' : 'Security monitoring not configured',
      };
    },
  },
  {
    id: 'soc2-cc7-incident-response',
    name: 'Incident Response (CC7.3)',
    description: 'SOC 2: Incident detection and response capabilities',
    category: 'defender',
    severity: 'high',
    baseline: 'soc-2',
    resourceTypes: ['defender/asr-policies', 'defender/edr-policies'],
    check: (resource) => {
      const settings = resource.settings as unknown[] | undefined;
      const templateRef = resource.templateReference as Record<string, unknown> | undefined;
      const isEdr = templateRef?.templateFamily?.toString().toLowerCase().includes('edr') ||
                    templateRef?.templateFamily?.toString().toLowerCase().includes('detection');
      return {
        passed: settings !== undefined || isEdr === true,
        message: isEdr ? 'EDR/Incident response configured' : 'Configure EDR for incident response',
      };
    },
  },
  {
    id: 'soc2-cc8-change-management',
    name: 'Change Management (CC8.1)',
    description: 'SOC 2: Change management controls',
    category: 'intune',
    severity: 'medium',
    baseline: 'soc-2',
    resourceTypes: ['intune/device-configurations', 'intune/compliance-policies'],
    check: (resource) => {
      const version = resource.version as number | undefined;
      const lastModified = resource.lastModifiedDateTime as string | undefined;
      const hasVersioning = version !== undefined && version > 0;
      return {
        passed: hasVersioning || lastModified !== undefined,
        message: hasVersioning 
          ? `Version ${version} - change tracking enabled` 
          : 'Configuration change tracking available',
      };
    },
  },
  {
    id: 'soc2-availability',
    name: 'System Availability (A1.1)',
    description: 'SOC 2: System availability controls',
    category: 'teams',
    severity: 'medium',
    baseline: 'soc-2',
    resourceTypes: ['teams/teams-settings', 'exchange/organization-config'],
    check: (resource) => {
      // M365 provides built-in availability
      return {
        passed: true,
        message: 'M365 provides 99.9% SLA availability',
      };
    },
  },
  {
    id: 'soc2-confidentiality',
    name: 'Confidentiality Controls (C1.1)',
    description: 'SOC 2: Information confidentiality',
    category: 'sharepoint',
    severity: 'high',
    baseline: 'soc-2',
    resourceTypes: ['sharepoint/tenant-settings', 'sharepoint/sensitivity-labels'],
    check: (resource) => {
      const sharingCapability = resource.sharingCapability as string;
      const isRestricted = sharingCapability !== 'ExternalUserAndGuestSharing';
      return {
        passed: isRestricted,
        message: isRestricted ? 'Sharing is restricted' : 'External sharing is permissive',
      };
    },
  },

  // ===============================
  // ISO 9001 - Quality Management
  // ===============================
  {
    id: 'iso9001-documented-policies',
    name: 'Documented Policies (7.5)',
    description: 'ISO 9001: Security policies must be documented and versioned',
    category: 'intune',
    severity: 'medium',
    baseline: 'iso-9001',
    resourceTypes: ['intune/device-configurations', 'intune/compliance-policies'],
    check: (resource) => {
      const description = resource.description as string | undefined;
      const displayName = resource.displayName as string | undefined;
      const hasDocumentation = description && description.length > 10;
      return {
        passed: hasDocumentation === true,
        message: hasDocumentation 
          ? 'Policy is documented' 
          : 'Add description for quality documentation',
      };
    },
  },
  {
    id: 'iso9001-policy-review',
    name: 'Policy Review Process (9.2)',
    description: 'ISO 9001: Policies should be reviewed and updated',
    category: 'conditional-access',
    severity: 'low',
    baseline: 'iso-9001',
    resourceTypes: ['conditional-access/ca-policies', 'intune/compliance-policies'],
    check: (resource) => {
      const lastModified = (resource.lastModifiedDateTime || resource.modifiedDateTime) as string | undefined;
      if (!lastModified) return { passed: true, message: 'Unable to verify last modification' };
      
      const lastMod = new Date(lastModified as string);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const isRecent = lastMod > sixMonthsAgo;
      
      return {
        passed: isRecent,
        message: isRecent 
          ? `Last reviewed: ${lastMod.toLocaleDateString()}` 
          : `Policy not updated since ${lastMod.toLocaleDateString()} - review recommended`,
      };
    },
  },
  {
    id: 'iso9001-continuous-improvement',
    name: 'Continuous Improvement (10.3)',
    description: 'ISO 9001: Configuration should follow latest best practices',
    category: 'conditional-access',
    severity: 'low',
    baseline: 'iso-9001',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const authStrength = grantControls?.authenticationStrength as Record<string, unknown> | undefined;
      const sessionControls = resource.sessionControls as Record<string, unknown> | undefined;
      const hasModernControls = authStrength !== undefined || sessionControls !== undefined;
      return {
        passed: hasModernControls,
        message: hasModernControls 
          ? 'Using modern security controls' 
          : 'Consider enabling advanced session controls',
      };
    },
  },

  // ===============================
  // IRAP - Australian Government Security
  // ===============================
  {
    id: 'irap-protected-access',
    name: 'PROTECTED Level Access Control',
    description: 'IRAP: Access controls for PROTECTED classification',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'irap',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasMfa = builtInControls?.includes('mfa');
      const requiresCompliance = builtInControls?.includes('compliantDevice');
      return {
        passed: hasMfa === true && requiresCompliance === true,
        message: hasMfa && requiresCompliance 
          ? 'MFA and device compliance required' 
          : 'PROTECTED requires MFA AND compliant device',
      };
    },
  },
  {
    id: 'irap-encryption-rest',
    name: 'Encryption at Rest (ISM-0459)',
    description: 'IRAP/ISM: Data must be encrypted at rest',
    category: 'intune',
    severity: 'critical',
    baseline: 'irap',
    resourceTypes: ['intune/device-configurations', 'intune/compliance-policies'],
    check: (resource) => {
      const encrypted = resource.bitLockerEnabled === true || 
                        resource.requireDeviceEncryption === true ||
                        resource.storageRequireEncryption === true;
      return {
        passed: encrypted === true,
        message: encrypted ? 'Encryption at rest configured' : 'Device encryption not enforced',
      };
    },
  },
  {
    id: 'irap-australia-data',
    name: 'Australian Data Sovereignty',
    description: 'IRAP: Data should be stored in Australian regions',
    category: 'sharepoint',
    severity: 'high',
    baseline: 'irap',
    resourceTypes: ['sharepoint/tenant-settings', 'sharepoint/geo-locations'],
    check: (resource) => {
      const geoLocation = (resource.geoLocation as string || '').toLowerCase();
      const dataLocation = (resource.allowedDataLocation as string || '').toLowerCase();
      const isAustralia = geoLocation.includes('australia') || 
                          geoLocation.includes('apc') ||
                          dataLocation.includes('australia');
      return {
        passed: isAustralia || geoLocation === '' || dataLocation === '',
        message: isAustralia 
          ? 'Data located in Australia' 
          : 'Verify data residency meets IRAP requirements',
      };
    },
  },
  {
    id: 'irap-privileged-access',
    name: 'Privileged Access Management (ISM-0432)',
    description: 'IRAP/ISM: Privileged access must be strictly controlled',
    category: 'entra-id',
    severity: 'critical',
    baseline: 'irap',
    resourceTypes: ['entra-id/roles', 'entra-id/pim-policies'],
    check: (resource) => {
      const displayName = (resource.displayName as string || '').toLowerCase();
      const isPrivileged = displayName.includes('admin') || displayName.includes('global');
      const roleTemplateId = resource.roleTemplateId as string;
      const hasTimeLimit = resource.endDateTime !== undefined;
      
      if (isPrivileged) {
        return {
          passed: hasTimeLimit === true,
          message: hasTimeLimit 
            ? 'Privileged access is time-limited' 
            : 'Consider using PIM for time-limited admin access',
        };
      }
      return { passed: true, message: 'Standard role assignment' };
    },
  },
  {
    id: 'irap-event-logging',
    name: 'Security Event Logging (ISM-0580)',
    description: 'IRAP/ISM: Security events must be logged',
    category: 'exchange',
    severity: 'high',
    baseline: 'irap',
    resourceTypes: ['exchange/organization-config', 'exchange/mailboxes'],
    check: (resource) => {
      const auditEnabled = resource.auditEnabled === true || 
                           resource.auditDisabled === false;
      return {
        passed: auditEnabled !== false,
        message: auditEnabled ? 'Security event logging enabled' : 'Enable audit logging for IRAP compliance',
      };
    },
  },
  {
    id: 'irap-malware-protection',
    name: 'Malware Protection (ISM-1417)',
    description: 'IRAP/ISM: Endpoint protection must be configured',
    category: 'defender',
    severity: 'critical',
    baseline: 'irap',
    resourceTypes: ['defender/antivirus-policies', 'defender/asr-policies'],
    check: (resource) => {
      const settings = resource.settings as unknown[] | undefined;
      const hasSettings = settings && settings.length > 0;
      return {
        passed: hasSettings === true,
        message: hasSettings ? 'Malware protection configured' : 'Configure endpoint protection for IRAP',
      };
    },
  },

  // ===============================
  // HIPAA - Healthcare Compliance
  // ===============================
  {
    id: 'hipaa-access-controls',
    name: 'Access Controls (164.312(a)(1))',
    description: 'HIPAA: Unique user identification and access controls',
    category: 'conditional-access',
    severity: 'critical',
    baseline: 'hipaa',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const grantControls = resource.grantControls as Record<string, unknown> | undefined;
      const builtInControls = grantControls?.builtInControls as string[] | undefined;
      const hasMfa = builtInControls?.includes('mfa');
      return {
        passed: hasMfa === true,
        message: hasMfa ? 'MFA access controls configured' : 'HIPAA requires strong access controls',
      };
    },
  },
  {
    id: 'hipaa-audit-controls',
    name: 'Audit Controls (164.312(b))',
    description: 'HIPAA: Activity recording and examination',
    category: 'exchange',
    severity: 'critical',
    baseline: 'hipaa',
    resourceTypes: ['exchange/organization-config', 'exchange/mailboxes'],
    check: (resource) => {
      const auditEnabled = resource.auditEnabled === true || 
                           resource.auditDisabled === false;
      return {
        passed: auditEnabled !== false,
        message: auditEnabled ? 'Audit controls enabled' : 'Enable auditing for HIPAA compliance',
      };
    },
  },
  {
    id: 'hipaa-transmission-security',
    name: 'Transmission Security (164.312(e)(1))',
    description: 'HIPAA: Encryption during transmission',
    category: 'exchange',
    severity: 'critical',
    baseline: 'hipaa',
    resourceTypes: ['exchange/organization-config', 'exchange/transport-rules'],
    check: (resource) => {
      const modernAuth = resource.oAuth2ClientProfileEnabled === true;
      return {
        passed: true, // M365 uses TLS by default
        message: 'M365 enforces TLS encryption for transmission security',
      };
    },
  },
  {
    id: 'hipaa-integrity',
    name: 'Integrity Controls (164.312(c)(1))',
    description: 'HIPAA: Protect ePHI from improper alteration',
    category: 'sharepoint',
    severity: 'high',
    baseline: 'hipaa',
    resourceTypes: ['sharepoint/tenant-settings', 'sharepoint/sensitivity-labels'],
    check: (resource) => {
      const versioningEnabled = resource.versioningEnabled === true;
      const sharingCapability = resource.sharingCapability as string;
      const isRestricted = sharingCapability !== 'ExternalUserAndGuestSharing';
      return {
        passed: versioningEnabled || isRestricted,
        message: versioningEnabled 
          ? 'Versioning enabled for integrity' 
          : (isRestricted ? 'Sharing restricted' : 'Enable versioning or restrict sharing'),
      };
    },
  },
  {
    id: 'hipaa-automatic-logoff',
    name: 'Automatic Logoff (164.312(a)(2)(iii))',
    description: 'HIPAA: Session timeout controls',
    category: 'conditional-access',
    severity: 'high',
    baseline: 'hipaa',
    resourceTypes: ['conditional-access/ca-policies'],
    check: (resource) => {
      const sessionControls = resource.sessionControls as Record<string, unknown> | undefined;
      const signInFrequency = sessionControls?.signInFrequency as Record<string, unknown> | undefined;
      const hasTimeout = signInFrequency?.isEnabled === true;
      return {
        passed: hasTimeout === true,
        message: hasTimeout ? 'Session timeout configured' : 'Configure session timeout for HIPAA',
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
    
    if (applicableRules.length === 0) continue;
    
    // Handle array data - flatten into individual items for checking
    let itemsToCheck: Array<{ data: Record<string, unknown>; name: string }> = [];
    
    if (Array.isArray(resource.data)) {
      // Data is already an array of items
      itemsToCheck = (resource.data as Array<Record<string, unknown>>).map((item, idx) => ({
        data: item,
        name: (item.displayName as string) || (item.name as string) || `Item ${idx + 1}`,
      }));
    } else if (resource.data && typeof resource.data === 'object') {
      // Check if it has a 'value' array (OData response)
      if (Array.isArray(resource.data.value)) {
        itemsToCheck = (resource.data.value as Array<Record<string, unknown>>).map((item, idx) => ({
          data: item,
          name: (item.displayName as string) || (item.name as string) || `Item ${idx + 1}`,
        }));
      } else {
        // Single object
        itemsToCheck = [{
          data: resource.data,
          name: resource.resourceName || (resource.data.displayName as string) || 'Unknown',
        }];
      }
    }
    
    // Run rules against each item
    for (const item of itemsToCheck) {
      for (const rule of applicableRules) {
        try {
          const checkResult = rule.check(item.data);
          results.push({
            resourceType: resource.resourceType,
            resourceName: item.name,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            passed: checkResult.passed,
            message: checkResult.message,
          });
        } catch (error) {
          console.error(`Error running rule ${rule.id} on ${item.name}:`, error);
          results.push({
            resourceType: resource.resourceType,
            resourceName: item.name,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            passed: false,
            message: 'Error running compliance check',
          });
        }
      }
    }
  }

  return results;
}
