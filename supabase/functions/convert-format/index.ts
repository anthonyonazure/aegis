import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const ConvertRequestSchema = z.object({
  data: z.any().refine((val) => {
    try {
      const str = JSON.stringify(val);
      return str.length < 5 * 1024 * 1024; // 5MB limit for data payload
    } catch {
      return false;
    }
  }, 'Data payload too large or invalid'),
  resourceType: z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource type format'),
  format: z.enum(['terraform', 'bicep', 'powershell']),
});

// Error sanitization function
function sanitizeError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log full error server-side for debugging
  console.error('Function error (sanitized for client):', errorMessage);
  
  // Return generic message
  if (errorMessage.includes('too large') || errorMessage.includes('size')) {
    return 'Data payload is too large to process.';
  }
  if (errorMessage.includes('format') || errorMessage.includes('invalid')) {
    return 'Invalid input format provided.';
  }
  
  return 'Conversion failed. Please try again or contact support.';
}

async function verifyAuth(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    console.error('Auth verification failed:', error);
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: data.claims.sub as string };
}

// Utility to sanitize resource names for Terraform/Bicep
function sanitizeName(name: string): string {
  return (name || 'resource')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 64);
}

// Escape strings for HCL
function escapeHcl(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Escape strings for Bicep
function escapeBicep(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// ===== TERRAFORM GENERATORS =====

function toTerraform(data: any, resourceType: string): string {
  const resources: string[] = [];
  const items = Array.isArray(data) ? data : [data];

  for (const item of items) {
    const resourceName = sanitizeName(item.displayName || item.name || item.id);
    let terraformResource = '';

    switch (resourceType) {
      // Conditional Access
      case 'conditional-access/ca-policies':
        terraformResource = generateCATerraform(item, resourceName);
        break;
      case 'conditional-access/named-locations':
        terraformResource = generateNamedLocationTerraform(item, resourceName);
        break;
      case 'conditional-access/auth-strengths':
        terraformResource = generateAuthStrengthTerraform(item, resourceName);
        break;

      // Entra ID
      case 'entra-id/groups':
        terraformResource = generateGroupTerraform(item, resourceName);
        break;
      case 'entra-id/app-registrations':
        terraformResource = generateAppRegistrationTerraform(item, resourceName);
        break;
      case 'entra-id/admin-units':
        terraformResource = generateAdminUnitTerraform(item, resourceName);
        break;
      case 'entra-id/directory-settings':
        terraformResource = generateDirectorySettingsTerraform(item, resourceName);
        break;

      // Intune
      case 'intune/device-configurations':
        terraformResource = generateDeviceConfigTerraform(item, resourceName);
        break;
      case 'intune/compliance-policies':
        terraformResource = generateComplianceTerraform(item, resourceName);
        break;
      case 'intune/autopilot':
        terraformResource = generateAutopilotTerraform(item, resourceName);
        break;
      case 'intune/scripts':
        terraformResource = generateScriptTerraform(item, resourceName);
        break;

      // Defender
      case 'defender/asr-policies':
      case 'defender/antivirus-policies':
      case 'defender/firewall-policies':
      case 'defender/edr-policies':
        terraformResource = generateDefenderPolicyTerraform(item, resourceName, resourceType);
        break;
      case 'defender/security-baselines':
        terraformResource = generateSecurityBaselineTerraform(item, resourceName);
        break;

      default:
        terraformResource = generateGenericTerraform(item, resourceName, resourceType);
    }

    resources.push(terraformResource);
  }

  const header = `# Generated by M365 Governance Manager
# Resource Type: ${resourceType}
# Generated: ${new Date().toISOString()}
# 
# Required Providers:
# - hashicorp/azuread (for Entra ID / Azure AD resources)
# - hashicorp/azurerm (for Azure resources)
# - microsoft/microsoft365 (for M365 workloads - community provider)

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
  }
}

provider "azuread" {
  # Configure via environment variables:
  # ARM_CLIENT_ID, ARM_CLIENT_SECRET, ARM_TENANT_ID
}

provider "azurerm" {
  features {}
}

`;

  return header + resources.join('\n\n');
}

// Conditional Access Policy
function generateCATerraform(policy: any, name: string): string {
  const conditions = policy.conditions || {};
  const users = conditions.users || {};
  const apps = conditions.applications || {};
  const locations = conditions.locations || {};
  const platforms = conditions.platforms || {};
  const grant = policy.grantControls || {};
  const session = policy.sessionControls || {};

  return `resource "azuread_conditional_access_policy" "${name}" {
  display_name = "${escapeHcl(policy.displayName || '')}"
  state        = "${policy.state || 'disabled'}"

  conditions {
    client_app_types = ${JSON.stringify(conditions.clientAppTypes || ['all'])}
    
    applications {
      included_applications = ${JSON.stringify(apps.includeApplications || ['All'])}
      excluded_applications = ${JSON.stringify(apps.excludeApplications || [])}
    }

    users {
      included_users  = ${JSON.stringify(users.includeUsers || [])}
      excluded_users  = ${JSON.stringify(users.excludeUsers || [])}
      included_groups = ${JSON.stringify(users.includeGroups || [])}
      excluded_groups = ${JSON.stringify(users.excludeGroups || [])}
      included_roles  = ${JSON.stringify(users.includeRoles || [])}
      excluded_roles  = ${JSON.stringify(users.excludeRoles || [])}
    }
${locations.includeLocations ? `
    locations {
      included_locations = ${JSON.stringify(locations.includeLocations || [])}
      excluded_locations = ${JSON.stringify(locations.excludeLocations || [])}
    }
` : ''}
${platforms.includePlatforms ? `
    platforms {
      included_platforms = ${JSON.stringify(platforms.includePlatforms || ['all'])}
      excluded_platforms = ${JSON.stringify(platforms.excludePlatforms || [])}
    }
` : ''}
  }

  grant_controls {
    operator          = "${grant.operator || 'OR'}"
    built_in_controls = ${JSON.stringify(grant.builtInControls || [])}
  }
${session.signInFrequency ? `
  session_controls {
    sign_in_frequency        = ${session.signInFrequency?.value || 0}
    sign_in_frequency_period = "${session.signInFrequency?.type || 'hours'}"
  }
` : ''}
}`;
}

// Named Location
function generateNamedLocationTerraform(location: any, name: string): string {
  const isIp = location['@odata.type']?.includes('ipNamedLocation');
  const isCountry = location['@odata.type']?.includes('countryNamedLocation');

  if (isIp) {
    const ranges = (location.ipRanges || []).map((r: any) => r.cidrAddress || r).filter(Boolean);
    return `resource "azuread_named_location" "${name}" {
  display_name = "${escapeHcl(location.displayName || '')}"

  ip {
    ip_ranges = ${JSON.stringify(ranges)}
    trusted   = ${location.isTrusted || false}
  }
}`;
  } else if (isCountry) {
    return `resource "azuread_named_location" "${name}" {
  display_name = "${escapeHcl(location.displayName || '')}"

  country {
    countries_and_regions                 = ${JSON.stringify(location.countriesAndRegions || [])}
    include_unknown_countries_and_regions = ${location.includeUnknownCountriesAndRegions || false}
  }
}`;
  }

  return generateGenericTerraform(location, name, 'conditional-access/named-locations');
}

// Authentication Strength
function generateAuthStrengthTerraform(strength: any, name: string): string {
  return `resource "azuread_authentication_strength_policy" "${name}" {
  display_name = "${escapeHcl(strength.displayName || '')}"
  description  = "${escapeHcl(strength.description || '')}"

  allowed_combinations = ${JSON.stringify(strength.allowedCombinations || [])}
}`;
}

// Group
function generateGroupTerraform(group: any, name: string): string {
  const isUnified = group.groupTypes?.includes('Unified');
  const isDynamic = group.membershipRule ? true : false;
  const types = [];
  if (isUnified) types.push('Unified');
  if (isDynamic) types.push('DynamicMembership');

  return `resource "azuread_group" "${name}" {
  display_name     = "${escapeHcl(group.displayName || '')}"
  description      = "${escapeHcl(group.description || '')}"
  security_enabled = ${group.securityEnabled ?? true}
  mail_enabled     = ${group.mailEnabled ?? false}
  mail_nickname    = "${escapeHcl(group.mailNickname || name)}"
${types.length > 0 ? `  types            = ${JSON.stringify(types)}` : ''}
${isDynamic ? `
  dynamic_membership {
    enabled = true
    rule    = "${escapeHcl(group.membershipRule || '')}"
  }
` : ''}
}`;
}

// App Registration
function generateAppRegistrationTerraform(app: any, name: string): string {
  const web = app.web || {};
  const api = app.api || {};
  
  return `resource "azuread_application" "${name}" {
  display_name = "${escapeHcl(app.displayName || '')}"
  
  sign_in_audience = "${app.signInAudience || 'AzureADMyOrg'}"
${web.redirectUris?.length ? `
  web {
    redirect_uris = ${JSON.stringify(web.redirectUris)}
    ${web.implicitGrantSettings?.enableIdTokenIssuance ? 'implicit_grant { id_token_issuance_enabled = true }' : ''}
  }
` : ''}
${api.oauth2PermissionScopes?.length ? `
  api {
    ${api.oauth2PermissionScopes.map((scope: any) => `
    oauth2_permission_scope {
      admin_consent_description  = "${escapeHcl(scope.adminConsentDescription || '')}"
      admin_consent_display_name = "${escapeHcl(scope.adminConsentDisplayName || '')}"
      id                         = "${scope.id}"
      enabled                    = ${scope.isEnabled ?? true}
      type                       = "${scope.type || 'User'}"
      value                      = "${escapeHcl(scope.value || '')}"
    }`).join('\n')}
  }
` : ''}
${app.requiredResourceAccess?.length ? `
  ${app.requiredResourceAccess.map((rra: any) => `
  required_resource_access {
    resource_app_id = "${rra.resourceAppId}"
    ${(rra.resourceAccess || []).map((ra: any) => `
    resource_access {
      id   = "${ra.id}"
      type = "${ra.type}"
    }`).join('\n')}
  }`).join('\n')}
` : ''}
}

resource "azuread_service_principal" "${name}_sp" {
  client_id = azuread_application.${name}.client_id
}`;
}

// Admin Unit
function generateAdminUnitTerraform(unit: any, name: string): string {
  return `resource "azuread_administrative_unit" "${name}" {
  display_name              = "${escapeHcl(unit.displayName || '')}"
  description               = "${escapeHcl(unit.description || '')}"
  hidden_membership_enabled = ${unit.visibility === 'HiddenMembership'}
}`;
}

// Directory Settings
function generateDirectorySettingsTerraform(setting: any, name: string): string {
  const values = setting.values || [];
  return `# Directory Setting: ${setting.displayName || name}
# Template: ${setting.templateId || 'Unknown'}

resource "azuread_directory_role_eligibility_schedule_request" "${name}" {
  # Directory settings require manual configuration or use of azuread_directory_setting
  # Exported values:
${values.map((v: any) => `  # ${v.name} = "${v.value}"`).join('\n')}
}`;
}

// Device Configuration
function generateDeviceConfigTerraform(config: any, name: string): string {
  const odataType = config['@odata.type'] || '';
  const platform = odataType.includes('windows') ? 'windows' : 
                   odataType.includes('ios') ? 'ios' :
                   odataType.includes('android') ? 'android' :
                   odataType.includes('macOS') ? 'macos' : 'generic';

  return `# Intune Device Configuration: ${config.displayName}
# Platform: ${platform}
# Type: ${odataType}
# 
# Note: Intune resources use the Microsoft Graph API. Use the microsoft/microsoft365
# provider or manage via PowerShell/Graph API directly.

resource "microsoft365_intune_device_configuration" "${name}" {
  display_name = "${escapeHcl(config.displayName || '')}"
  description  = "${escapeHcl(config.description || '')}"

  # Platform-specific settings - exported as JSON reference
  # Import this configuration using Invoke-MgGraphRequest or Terraform microsoft365 provider
  
  # Configuration payload:
  /*
  ${JSON.stringify(config, null, 2)}
  */
}`;
}

// Compliance Policy
function generateComplianceTerraform(policy: any, name: string): string {
  const odataType = policy['@odata.type'] || '';
  const platform = odataType.includes('windows') ? 'windows' : 
                   odataType.includes('ios') ? 'ios' :
                   odataType.includes('android') ? 'android' :
                   odataType.includes('macOS') ? 'macos' : 'generic';

  return `# Intune Compliance Policy: ${policy.displayName}
# Platform: ${platform}
# Type: ${odataType}

resource "microsoft365_intune_device_compliance_policy" "${name}" {
  display_name = "${escapeHcl(policy.displayName || '')}"
  description  = "${escapeHcl(policy.description || '')}"
  
  # Compliance settings vary by platform
  # Reference the JSON export for complete configuration
  
  /*
  ${JSON.stringify(policy, null, 2)}
  */
}`;
}

// Autopilot Profile
function generateAutopilotTerraform(profile: any, name: string): string {
  return `# Windows Autopilot Deployment Profile: ${profile.displayName}

resource "microsoft365_intune_windows_autopilot_deployment_profile" "${name}" {
  display_name                          = "${escapeHcl(profile.displayName || '')}"
  description                           = "${escapeHcl(profile.description || '')}"
  device_name_template                  = "${escapeHcl(profile.deviceNameTemplate || '')}"
  device_type                           = "${profile.deviceType || 'windowsPc'}"
  enable_white_glove                    = ${profile.enableWhiteGlove ?? false}
  extract_hardware_hash                 = ${profile.extractHardwareHash ?? false}
  out_of_box_experience_settings = {
    hide_eula                       = ${profile.outOfBoxExperienceSettings?.hideEULA ?? false}
    hide_privacy_settings           = ${profile.outOfBoxExperienceSettings?.hidePrivacySettings ?? false}
    hide_escape_link                = ${profile.outOfBoxExperienceSettings?.hideEscapeLink ?? false}
    skip_keyboard_selection_page    = ${profile.outOfBoxExperienceSettings?.skipKeyboardSelectionPage ?? false}
    user_type                       = "${profile.outOfBoxExperienceSettings?.userType || 'standard'}"
  }
}`;
}

// PowerShell Script
function generateScriptTerraform(script: any, name: string): string {
  // Decode base64 script content in Deno
  let scriptContent = '# Script content not available';
  if (script.scriptContent) {
    try {
      const decoded = atob(script.scriptContent);
      scriptContent = decoded;
    } catch {
      scriptContent = '# Unable to decode script content';
    }
  }
  
  return `# Intune PowerShell Script: ${script.displayName}

resource "microsoft365_intune_device_management_script" "${name}" {
  display_name            = "${escapeHcl(script.displayName || '')}"
  description             = "${escapeHcl(script.description || '')}"
  run_as_account          = "${script.runAsAccount || 'system'}"
  enforce_signature_check = ${script.enforceSignatureCheck ?? false}
  run_as_32_bit           = ${script.runAs32Bit ?? false}
  
  # Script content (base64 encoded in source)
  script_content = <<-EOT
${scriptContent}
  EOT
}`;
}

// Defender Policy
function generateDefenderPolicyTerraform(policy: any, name: string, resourceType: string): string {
  const policyType = resourceType.split('/')[1];
  return `# Microsoft Defender ${policyType}: ${policy.displayName}

resource "microsoft365_intune_device_configuration_policy" "${name}" {
  display_name = "${escapeHcl(policy.displayName || '')}"
  description  = "${escapeHcl(policy.description || '')}"
  template_id  = "${policy.templateId || ''}"
  
  # Policy settings - requires Microsoft Graph API
  # Use Invoke-MgGraphRequest or microsoft365 provider
  
  /*
  ${JSON.stringify(policy, null, 2)}
  */
}`;
}

// Security Baseline
function generateSecurityBaselineTerraform(baseline: any, name: string): string {
  return `# Security Baseline Template: ${baseline.displayName}

resource "microsoft365_intune_security_baseline" "${name}" {
  display_name = "${escapeHcl(baseline.displayName || '')}"
  description  = "${escapeHcl(baseline.description || '')}"
  template_id  = "${baseline.id || ''}"
  
  # Security baseline settings
  /*
  ${JSON.stringify(baseline, null, 2)}
  */
}`;
}

// Generic fallback
function generateGenericTerraform(item: any, name: string, resourceType: string): string {
  return `# Resource: ${item.displayName || item.name || name}
# Type: ${resourceType}
# ID: ${item.id || 'N/A'}
#
# This resource type requires manual Terraform configuration or a community provider.
# Export the JSON data and use with appropriate Graph API calls.

/*
Exported Configuration:
${JSON.stringify(item, null, 2)}
*/`;
}


// ===== BICEP GENERATORS =====

function toBicep(data: any, resourceType: string): string {
  const items = Array.isArray(data) ? data : [data];
  const resources: string[] = [];

  const header = `// Generated by M365 Governance Manager
// Resource Type: ${resourceType}
// Generated: ${new Date().toISOString()}
//
// Note: Microsoft Graph resources in Bicep require the Microsoft.Graph resource provider
// which is currently in preview. For production, consider using Terraform or PowerShell.
//
// Required: Enable Microsoft Graph Bicep types
// az bicep install --version v0.22.6 (or later)
// Set environment variable: BICEP_ENABLE_GRAPH_TYPES=true

@description('The tenant ID for deployment')
param tenantId string = tenant().tenantId

`;

  for (const item of items) {
    const resourceName = sanitizeName(item.displayName || item.name || item.id);

    switch (resourceType) {
      // Entra ID
      case 'entra-id/groups':
        resources.push(generateGroupBicep(item, resourceName));
        break;
      case 'entra-id/app-registrations':
        resources.push(generateAppRegistrationBicep(item, resourceName));
        break;
      case 'entra-id/admin-units':
        resources.push(generateAdminUnitBicep(item, resourceName));
        break;

      // Conditional Access
      case 'conditional-access/ca-policies':
        resources.push(generateCABicep(item, resourceName));
        break;
      case 'conditional-access/named-locations':
        resources.push(generateNamedLocationBicep(item, resourceName));
        break;

      // Intune
      case 'intune/device-configurations':
        resources.push(generateDeviceConfigBicep(item, resourceName));
        break;
      case 'intune/compliance-policies':
        resources.push(generateComplianceBicep(item, resourceName));
        break;

      default:
        resources.push(generateGenericBicep(item, resourceName, resourceType));
    }
  }

  return header + resources.join('\n\n');
}

// Group Bicep
function generateGroupBicep(group: any, name: string): string {
  const isUnified = group.groupTypes?.includes('Unified');
  const isDynamic = group.membershipRule ? true : false;

  return `// Azure AD Group: ${group.displayName}
resource group_${name} 'Microsoft.Graph/groups@v1.0' = {
  displayName: '${escapeBicep(group.displayName || '')}'
  description: '${escapeBicep(group.description || '')}'
  mailEnabled: ${group.mailEnabled || false}
  mailNickname: '${escapeBicep(group.mailNickname || name)}'
  securityEnabled: ${group.securityEnabled ?? true}
${isUnified ? "  groupTypes: ['Unified']" : ''}
${isDynamic ? `  membershipRule: '${escapeBicep(group.membershipRule || '')}'
  membershipRuleProcessingState: 'On'` : ''}
}

output group_${name}_id string = group_${name}.id`;
}

// App Registration Bicep
function generateAppRegistrationBicep(app: any, name: string): string {
  return `// Application Registration: ${app.displayName}
resource app_${name} 'Microsoft.Graph/applications@v1.0' = {
  displayName: '${escapeBicep(app.displayName || '')}'
  signInAudience: '${app.signInAudience || 'AzureADMyOrg'}'
${app.web?.redirectUris?.length ? `  web: {
    redirectUris: ${JSON.stringify(app.web.redirectUris)}
  }` : ''}
${app.identifierUris?.length ? `  identifierUris: ${JSON.stringify(app.identifierUris)}` : ''}
}

// Service Principal for the application
resource sp_${name} 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: app_${name}.appId
}

output app_${name}_id string = app_${name}.id
output app_${name}_appId string = app_${name}.appId`;
}

// Admin Unit Bicep
function generateAdminUnitBicep(unit: any, name: string): string {
  return `// Administrative Unit: ${unit.displayName}
resource adminUnit_${name} 'Microsoft.Graph/administrativeUnits@v1.0' = {
  displayName: '${escapeBicep(unit.displayName || '')}'
  description: '${escapeBicep(unit.description || '')}'
${unit.visibility === 'HiddenMembership' ? "  visibility: 'HiddenMembership'" : ''}
}

output adminUnit_${name}_id string = adminUnit_${name}.id`;
}

// Conditional Access Bicep
function generateCABicep(policy: any, name: string): string {
  const conditions = policy.conditions || {};
  
  return `// Conditional Access Policy: ${policy.displayName}
// Note: CA policies in Bicep require Microsoft.Graph provider preview
resource caPolicy_${name} 'Microsoft.Graph/conditionalAccessPolicies@v1.0' = {
  displayName: '${escapeBicep(policy.displayName || '')}'
  state: '${policy.state || 'disabled'}'
  conditions: {
    clientAppTypes: ${JSON.stringify(conditions.clientAppTypes || ['all'])}
    applications: {
      includeApplications: ${JSON.stringify(conditions.applications?.includeApplications || ['All'])}
      excludeApplications: ${JSON.stringify(conditions.applications?.excludeApplications || [])}
    }
    users: {
      includeUsers: ${JSON.stringify(conditions.users?.includeUsers || [])}
      excludeUsers: ${JSON.stringify(conditions.users?.excludeUsers || [])}
      includeGroups: ${JSON.stringify(conditions.users?.includeGroups || [])}
      excludeGroups: ${JSON.stringify(conditions.users?.excludeGroups || [])}
    }
  }
  grantControls: {
    operator: '${policy.grantControls?.operator || 'OR'}'
    builtInControls: ${JSON.stringify(policy.grantControls?.builtInControls || [])}
  }
}

output caPolicy_${name}_id string = caPolicy_${name}.id`;
}

// Named Location Bicep
function generateNamedLocationBicep(location: any, name: string): string {
  const isIp = location['@odata.type']?.includes('ipNamedLocation');
  
  if (isIp) {
    const ranges = (location.ipRanges || []).map((r: any) => r.cidrAddress || r).filter(Boolean);
    return `// Named Location (IP): ${location.displayName}
resource namedLocation_${name} 'Microsoft.Graph/namedLocations@v1.0' = {
  displayName: '${escapeBicep(location.displayName || '')}'
  '@odata.type': '#microsoft.graph.ipNamedLocation'
  isTrusted: ${location.isTrusted || false}
  ipRanges: ${JSON.stringify(ranges.map((r: string) => ({ '@odata.type': '#microsoft.graph.iPv4CidrRange', cidrAddress: r })))}
}`;
  }
  
  return `// Named Location (Country): ${location.displayName}
resource namedLocation_${name} 'Microsoft.Graph/namedLocations@v1.0' = {
  displayName: '${escapeBicep(location.displayName || '')}'
  '@odata.type': '#microsoft.graph.countryNamedLocation'
  countriesAndRegions: ${JSON.stringify(location.countriesAndRegions || [])}
  includeUnknownCountriesAndRegions: ${location.includeUnknownCountriesAndRegions || false}
}`;
}

// Device Config Bicep
function generateDeviceConfigBicep(config: any, name: string): string {
  return `// Intune Device Configuration: ${config.displayName}
// Note: Intune resources are not directly supported in Bicep.
// Use deployment scripts or Azure Functions to call Graph API.

resource deploymentScript_${name} 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: 'deploy-intune-config-${name}'
  location: resourceGroup().location
  kind: 'AzurePowerShell'
  properties: {
    azPowerShellVersion: '9.0'
    retentionInterval: 'P1D'
    scriptContent: '''
      # Deploy Intune Device Configuration via Graph API
      $config = @'
      ${JSON.stringify(config, null, 2)}
      '@
      
      $uri = "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations"
      Invoke-MgGraphRequest -Method POST -Uri $uri -Body $config -ContentType "application/json"
    '''
  }
}`;
}

// Compliance Policy Bicep
function generateComplianceBicep(policy: any, name: string): string {
  return `// Intune Compliance Policy: ${policy.displayName}
// Note: Deploy via Graph API using deployment scripts

resource deploymentScript_${name} 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: 'deploy-compliance-policy-${name}'
  location: resourceGroup().location
  kind: 'AzurePowerShell'
  properties: {
    azPowerShellVersion: '9.0'
    retentionInterval: 'P1D'
    scriptContent: '''
      $policy = @'
      ${JSON.stringify(policy, null, 2)}
      '@
      
      $uri = "https://graph.microsoft.com/beta/deviceManagement/deviceCompliancePolicies"
      Invoke-MgGraphRequest -Method POST -Uri $uri -Body $policy -ContentType "application/json"
    '''
  }
}`;
}

// Generic Bicep
function generateGenericBicep(item: any, name: string, resourceType: string): string {
  return `// Resource: ${item.displayName || item.name || name}
// Type: ${resourceType}
// 
// This resource type requires Microsoft Graph API deployment.
// Consider using a deployment script or PowerShell for provisioning.

/*
Exported configuration:
${JSON.stringify(item, null, 2)}
*/`;
}


// ===== POWERSHELL GENERATORS =====

function toPowerShell(data: any, resourceType: string): string {
  const items = Array.isArray(data) ? data : [data];
  const scripts: string[] = [];

  const header = `# Generated by M365 Governance Manager
# Resource Type: ${resourceType}
# Generated: ${new Date().toISOString()}
#
# Prerequisites:
# Install-Module Microsoft.Graph -Scope CurrentUser
# Install-Module Microsoft.Graph.Beta -Scope CurrentUser
#
# Connect to Microsoft Graph with required scopes:
# Connect-MgGraph -Scopes "DeviceManagementConfiguration.ReadWrite.All", \\
#                         "Policy.ReadWrite.ConditionalAccess", \\
#                         "Group.ReadWrite.All", \\
#                         "Application.ReadWrite.All"

#Requires -Modules Microsoft.Graph

`;

  for (const item of items) {
    switch (resourceType) {
      case 'conditional-access/ca-policies':
        scripts.push(generateCAPowerShell(item));
        break;
      case 'conditional-access/named-locations':
        scripts.push(generateNamedLocationPowerShell(item));
        break;
      case 'entra-id/groups':
        scripts.push(generateGroupPowerShell(item));
        break;
      case 'entra-id/app-registrations':
        scripts.push(generateAppRegistrationPowerShell(item));
        break;
      case 'intune/device-configurations':
        scripts.push(generateDeviceConfigPowerShell(item));
        break;
      case 'intune/compliance-policies':
        scripts.push(generateCompliancePowerShell(item));
        break;
      case 'intune/autopilot':
        scripts.push(generateAutopilotPowerShell(item));
        break;
      case 'intune/scripts':
        scripts.push(generateScriptPowerShell(item));
        break;
      default:
        scripts.push(generateGenericPowerShell(item, resourceType));
    }
  }

  return header + scripts.join('\n\n');
}

function generateCAPowerShell(policy: any): string {
  const conditions = policy.conditions || {};
  return `#region Conditional Access Policy: ${policy.displayName}
$policyParams = @{
    DisplayName = "${policy.displayName || ''}"
    State = "${policy.state || 'disabled'}"
    Conditions = @{
        ClientAppTypes = @(${(conditions.clientAppTypes || []).map((t: string) => `"${t}"`).join(', ')})
        Applications = @{
            IncludeApplications = @(${(conditions.applications?.includeApplications || []).map((a: string) => `"${a}"`).join(', ')})
            ExcludeApplications = @(${(conditions.applications?.excludeApplications || []).map((a: string) => `"${a}"`).join(', ')})
        }
        Users = @{
            IncludeUsers = @(${(conditions.users?.includeUsers || []).map((u: string) => `"${u}"`).join(', ')})
            ExcludeUsers = @(${(conditions.users?.excludeUsers || []).map((u: string) => `"${u}"`).join(', ')})
            IncludeGroups = @(${(conditions.users?.includeGroups || []).map((g: string) => `"${g}"`).join(', ')})
            ExcludeGroups = @(${(conditions.users?.excludeGroups || []).map((g: string) => `"${g}"`).join(', ')})
        }
    }
    GrantControls = @{
        Operator = "${policy.grantControls?.operator || 'OR'}"
        BuiltInControls = @(${(policy.grantControls?.builtInControls || []).map((c: string) => `"${c}"`).join(', ')})
    }
}

New-MgIdentityConditionalAccessPolicy -BodyParameter $policyParams
#endregion`;
}

function generateNamedLocationPowerShell(location: any): string {
  const isIp = location['@odata.type']?.includes('ipNamedLocation');
  
  if (isIp) {
    return `#region Named Location (IP): ${location.displayName}
$locationParams = @{
    "@odata.type" = "#microsoft.graph.ipNamedLocation"
    DisplayName = "${location.displayName || ''}"
    IsTrusted = $${location.isTrusted || false}
    IpRanges = @(
        ${(location.ipRanges || []).map((r: any) => `@{ "@odata.type" = "#microsoft.graph.iPv4CidrRange"; CidrAddress = "${r.cidrAddress || r}" }`).join('\n        ')}
    )
}

New-MgIdentityConditionalAccessNamedLocation -BodyParameter $locationParams
#endregion`;
  }
  
  return `#region Named Location (Country): ${location.displayName}
$locationParams = @{
    "@odata.type" = "#microsoft.graph.countryNamedLocation"
    DisplayName = "${location.displayName || ''}"
    CountriesAndRegions = @(${(location.countriesAndRegions || []).map((c: string) => `"${c}"`).join(', ')})
    IncludeUnknownCountriesAndRegions = $${location.includeUnknownCountriesAndRegions || false}
}

New-MgIdentityConditionalAccessNamedLocation -BodyParameter $locationParams
#endregion`;
}

function generateGroupPowerShell(group: any): string {
  const isUnified = group.groupTypes?.includes('Unified');
  const isDynamic = group.membershipRule ? true : false;
  
  return `#region Group: ${group.displayName}
$groupParams = @{
    DisplayName = "${group.displayName || ''}"
    Description = "${(group.description || '').replace(/"/g, '\\"')}"
    MailEnabled = $${group.mailEnabled || false}
    MailNickname = "${group.mailNickname || 'group'}"
    SecurityEnabled = $${group.securityEnabled ?? true}
${isUnified ? '    GroupTypes = @("Unified")' : ''}
${isDynamic ? `    GroupTypes = @("DynamicMembership")
    MembershipRule = "${(group.membershipRule || '').replace(/"/g, '\\"')}"
    MembershipRuleProcessingState = "On"` : ''}
}

New-MgGroup -BodyParameter $groupParams
#endregion`;
}

function generateAppRegistrationPowerShell(app: any): string {
  return `#region Application: ${app.displayName}
$appParams = @{
    DisplayName = "${app.displayName || ''}"
    SignInAudience = "${app.signInAudience || 'AzureADMyOrg'}"
${app.web?.redirectUris?.length ? `    Web = @{
        RedirectUris = @(${app.web.redirectUris.map((u: string) => `"${u}"`).join(', ')})
    }` : ''}
}

$app = New-MgApplication -BodyParameter $appParams

# Create Service Principal
New-MgServicePrincipal -AppId $app.AppId

Write-Host "Created application: $($app.DisplayName) with AppId: $($app.AppId)"
#endregion`;
}

function generateDeviceConfigPowerShell(config: any): string {
  return `#region Device Configuration: ${config.displayName}
$configBody = @'
${JSON.stringify(config, null, 2)}
'@

$uri = "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations"
$response = Invoke-MgGraphRequest -Method POST -Uri $uri -Body $configBody -ContentType "application/json"
Write-Host "Created device configuration: $($response.displayName)"
#endregion`;
}

function generateCompliancePowerShell(policy: any): string {
  return `#region Compliance Policy: ${policy.displayName}
$policyBody = @'
${JSON.stringify(policy, null, 2)}
'@

$uri = "https://graph.microsoft.com/beta/deviceManagement/deviceCompliancePolicies"
$response = Invoke-MgGraphRequest -Method POST -Uri $uri -Body $policyBody -ContentType "application/json"
Write-Host "Created compliance policy: $($response.displayName)"
#endregion`;
}

function generateAutopilotPowerShell(profile: any): string {
  return `#region Autopilot Profile: ${profile.displayName}
$profileBody = @'
${JSON.stringify(profile, null, 2)}
'@

$uri = "https://graph.microsoft.com/beta/deviceManagement/windowsAutopilotDeploymentProfiles"
$response = Invoke-MgGraphRequest -Method POST -Uri $uri -Body $profileBody -ContentType "application/json"
Write-Host "Created Autopilot profile: $($response.displayName)"
#endregion`;
}

function generateScriptPowerShell(script: any): string {
  return `#region PowerShell Script: ${script.displayName}
$scriptBody = @'
${JSON.stringify(script, null, 2)}
'@

$uri = "https://graph.microsoft.com/beta/deviceManagement/deviceManagementScripts"
$response = Invoke-MgGraphRequest -Method POST -Uri $uri -Body $scriptBody -ContentType "application/json"
Write-Host "Created PowerShell script: $($response.displayName)"
#endregion`;
}

function generateGenericPowerShell(item: any, resourceType: string): string {
  return `#region Resource: ${item.displayName || item.name || 'Unknown'}
# Type: ${resourceType}

$resourceBody = @'
${JSON.stringify(item, null, 2)}
'@

# Determine the appropriate Graph API endpoint for this resource type
# and execute the request manually
Write-Host "Exported resource: ${item.displayName || item.name || item.id}"
#endregion`;
}


// Maximum payload size: 10MB
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication first
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      console.log('Authentication failed:', authResult.error);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', authResult.userId);

    // Check payload size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request payload too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();

    // Validate input
    const parseResult = ConvertRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, resourceType, format } = parseResult.data;

    console.log(`Converting ${resourceType} to ${format}`);

    let result: string;

    switch (format) {
      case 'terraform':
        result = toTerraform(data, resourceType);
        break;
      case 'bicep':
        result = toBicep(data, resourceType);
        break;
      case 'powershell':
        result = toPowerShell(data, resourceType);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Conversion successful, output size: ${result.length} bytes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        output: result,
        format,
        resourceType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Convert error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
