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
    requiredPermissions: ['InformationProtectionPolicy.Read'],
  },
];

export interface PreflightResult {
  resourceId: string;
  resourceName: string;
  hasPermission: boolean;
  grantedPermissions: string[];
  missingPermissions: string[];
}

export interface PreflightCheckResult {
  success: boolean;
  grantedRoles: string[];
  results: PreflightResult[];
  totalResources: number;
  accessibleResources: number;
  deniedResources: number;
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
 */
export function performPreflightCheck(
  accessToken: string,
  selectedResources: string[]
): PreflightCheckResult {
  const grantedRoles = extractRolesFromToken(accessToken);
  
  const results: PreflightResult[] = [];

  for (const resourceId of selectedResources) {
    const requirement = PERMISSION_REQUIREMENTS.find(r => r.resourceId === resourceId);
    
    if (!requirement) {
      // Unknown resource - assume it will work
      results.push({
        resourceId,
        resourceName: resourceId,
        hasPermission: true,
        grantedPermissions: [],
        missingPermissions: [],
      });
      continue;
    }

    const check = hasPermission(
      grantedRoles,
      requirement.requiredPermissions,
      requirement.alternativePermissions
    );

    results.push({
      resourceId: requirement.resourceId,
      resourceName: requirement.resourceName,
      hasPermission: check.hasPermission,
      grantedPermissions: check.granted,
      missingPermissions: check.missing,
    });
  }

  const accessibleResources = results.filter(r => r.hasPermission).length;
  const deniedResources = results.filter(r => !r.hasPermission).length;

  return {
    success: deniedResources === 0,
    grantedRoles,
    results,
    totalResources: results.length,
    accessibleResources,
    deniedResources,
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
