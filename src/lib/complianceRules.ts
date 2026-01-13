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
] as const;

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // Conditional Access Rules
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
  
  // Intune Device Configuration Rules
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
  
  // Entra ID Rules
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
  
  // Defender Rules
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
