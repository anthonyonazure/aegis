import { supabase } from '@/integrations/supabase/client';

export interface WritePermissionResult {
  resourceType: string;
  resourceName: string;
  requiredPermission: string;
  hasPermission: boolean;
  error?: string;
  statusCode?: number;
  useBeta?: boolean;
}

export interface WriteValidationResponse {
  success: boolean;
  results: WritePermissionResult[];
  missingPermissions: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Validate write permissions for deployment to a target tenant
 */
export async function validateWritePermissions(
  tenantConnectionId: string,
  resourceTypes: string[]
): Promise<WriteValidationResponse> {
  const { data, error } = await supabase.functions.invoke('validate-write-permissions', {
    body: {
      tenantConnectionId,
      resourceTypes,
    },
  });

  if (error) {
    throw new Error(`Write permission validation failed: ${error.message}`);
  }

  return data as WriteValidationResponse;
}

/**
 * Get human-readable permission name
 */
export function getPermissionDisplayName(permission: string): string {
  const displayNames: Record<string, string> = {
    'DeviceManagementConfiguration.ReadWrite.All': 'Intune Device Management (Read/Write)',
    'DeviceManagementApps.ReadWrite.All': 'Intune Apps (Read/Write)',
    'DeviceManagementServiceConfig.ReadWrite.All': 'Intune Service Config (Read/Write)',
    'Policy.ReadWrite.ConditionalAccess': 'Conditional Access Policies (Read/Write)',
    'Policy.ReadWrite.AuthenticationMethod': 'Authentication Methods (Read/Write)',
    'Group.ReadWrite.All': 'Groups (Read/Write)',
    'Application.ReadWrite.All': 'Applications (Read/Write)',
    'AdministrativeUnit.ReadWrite.All': 'Administrative Units (Read/Write)',
    'Directory.ReadWrite.All': 'Directory (Read/Write)',
  };

  return displayNames[permission] || permission;
}

/**
 * Get Azure portal URL for adding permissions
 */
export function getAzurePortalPermissionsUrl(): string {
  return 'https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps';
}

/**
 * Format missing permissions as a markdown-friendly list
 */
export function formatMissingPermissionsText(missingPermissions: string[]): string {
  if (missingPermissions.length === 0) return '';

  const lines = [
    '## Missing Write Permissions',
    '',
    'Add these API permissions to your Azure App Registration and grant admin consent:',
    '',
    ...missingPermissions.map(p => `- **${p}** - ${getPermissionDisplayName(p)}`),
    '',
    '### Steps:',
    '1. Go to Azure Portal → App Registrations → Your App',
    '2. Click "API Permissions" → "Add a permission"',
    '3. Select "Microsoft Graph" → "Application permissions"',
    '4. Add each permission listed above',
    '5. Click "Grant admin consent for [Your Tenant]"',
  ];

  return lines.join('\n');
}
