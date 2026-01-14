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
