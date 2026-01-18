import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileKey,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Shield,
  Cloud,
  ClipboardList,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  PERMISSION_REQUIREMENTS,
  AZURE_PERMISSION_REQUIREMENTS,
  PermissionRequirement,
} from '@/lib/permissionsCheck';

interface CategoryGroup {
  id: string;
  name: string;
  resources: PermissionRequirement[];
}

// Group Graph API permissions by category
function groupGraphPermissions(): CategoryGroup[] {
  const categories: Record<string, { name: string; resources: PermissionRequirement[] }> = {
    'intune': { name: 'Intune / Endpoint Manager', resources: [] },
    'conditional-access': { name: 'Conditional Access', resources: [] },
    'entra-id': { name: 'Entra ID (Azure AD)', resources: [] },
    'defender': { name: 'Microsoft Defender', resources: [] },
    'purview': { name: 'Microsoft Purview', resources: [] },
    'exchange': { name: 'Exchange Online', resources: [] },
    'sharepoint': { name: 'SharePoint Online', resources: [] },
    'teams': { name: 'Microsoft Teams', resources: [] },
  };

  for (const req of PERMISSION_REQUIREMENTS) {
    const category = req.resourceId.split('/')[0];
    if (categories[category]) {
      categories[category].resources.push(req);
    }
  }

  return Object.entries(categories)
    .filter(([_, v]) => v.resources.length > 0)
    .map(([id, v]) => ({ id, name: v.name, resources: v.resources }));
}

// Group Azure permissions by category
function groupAzurePermissions(): CategoryGroup[] {
  const categories: Record<string, { name: string; resources: PermissionRequirement[] }> = {
    'azure-compute': { name: 'Compute', resources: [] },
    'azure-networking': { name: 'Networking', resources: [] },
    'azure-storage': { name: 'Storage', resources: [] },
    'azure-identity': { name: 'Identity & Security', resources: [] },
    'azure-paas': { name: 'Platform Services (PaaS)', resources: [] },
    'azure-monitoring': { name: 'Monitoring', resources: [] },
  };

  for (const req of AZURE_PERMISSION_REQUIREMENTS) {
    const category = req.resourceId.split('/')[0];
    if (categories[category]) {
      categories[category].resources.push(req);
    }
  }

  return Object.entries(categories)
    .filter(([_, v]) => v.resources.length > 0)
    .map(([id, v]) => ({ id, name: v.name, resources: v.resources }));
}

// Convert read permission to write permission
function getWritePermission(readPermission: string): string {
  if (readPermission.includes('.Read.')) {
    return readPermission.replace('.Read.', '.ReadWrite.');
  }
  if (readPermission.includes('.Read')) {
    return readPermission.replace('.Read', '.ReadWrite');
  }
  if (readPermission === 'Reader') {
    return 'Contributor';
  }
  if (readPermission.endsWith('/read')) {
    return readPermission.replace('/read', '/*');
  }
  return readPermission;
}

// Get unique permissions for a category
function getUniquePermissions(resources: PermissionRequirement[], writeMode: boolean): string[] {
  const perms = new Set<string>();
  for (const resource of resources) {
    for (const perm of resource.requiredPermissions) {
      perms.add(writeMode ? getWritePermission(perm) : perm);
    }
  }
  return Array.from(perms).sort();
}

// Get all unique Graph permissions
function getAllGraphPermissions(writeMode: boolean): string[] {
  const perms = new Set<string>();
  for (const req of PERMISSION_REQUIREMENTS) {
    for (const perm of req.requiredPermissions) {
      perms.add(writeMode ? getWritePermission(perm) : perm);
    }
  }
  return Array.from(perms).sort();
}

export const PermissionsReferenceView = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [writeMode, setWriteMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const graphCategories = useMemo(() => groupGraphPermissions(), []);
  const azureCategories = useMemo(() => groupAzurePermissions(), []);

  const allGraphPermissions = useMemo(() => getAllGraphPermissions(writeMode), [writeMode]);
  const totalGraphResources = PERMISSION_REQUIREMENTS.length;
  const totalAzureResources = AZURE_PERMISSION_REQUIREMENTS.length;

  // Filter categories based on search
  const filterCategories = (categories: CategoryGroup[]) => {
    if (!searchQuery.trim()) return categories;
    
    const query = searchQuery.toLowerCase();
    return categories.map(cat => ({
      ...cat,
      resources: cat.resources.filter(r => 
        r.resourceName.toLowerCase().includes(query) ||
        r.requiredPermissions.some(p => p.toLowerCase().includes(query))
      ),
    })).filter(cat => cat.resources.length > 0);
  };

  const filteredGraphCategories = useMemo(() => filterCategories(graphCategories), [graphCategories, searchQuery]);
  const filteredAzureCategories = useMemo(() => filterCategories(azureCategories), [azureCategories, searchQuery]);

  const copyToClipboard = async (text: string, id: string, customTitle?: string, customDescription?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: customTitle || 'Copied!',
        description: customDescription || 'Permissions copied to clipboard',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Script Downloaded',
      description: `${filename} saved to your downloads folder`,
    });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = (categories: CategoryGroup[]) => {
    setExpandedCategories(new Set(categories.map(c => c.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const copyAllGraphPermissions = () => {
    const text = allGraphPermissions.join('\n');
    copyToClipboard(text, 'all-graph');
  };

  const getAzurePowerShellScript = () => {
    const role = writeMode ? 'Contributor' : 'Reader';
    return `# PowerShell script to assign Azure RBAC "${role}" role to an App Registration
# Run this in Azure Cloud Shell or with Az PowerShell module installed
# Requires: Az PowerShell module (Install-Module Az -Scope CurrentUser)

# Variables - UPDATE THESE BEFORE RUNNING
$AppId = "YOUR_APP_CLIENT_ID"      # Your App Registration's Application (Client) ID
$TenantId = "YOUR_TENANT_ID"       # Your Azure AD Tenant ID
$SubscriptionIds = @(              # List of Subscription IDs to grant access to
    "YOUR_SUBSCRIPTION_ID_1"
    # "YOUR_SUBSCRIPTION_ID_2"     # Add more subscriptions as needed
)

# ============================================
# STEP 1: Connect to Azure
# ============================================
Write-Host "Connecting to Azure..." -ForegroundColor Cyan
Connect-AzAccount -TenantId $TenantId

# ============================================
# STEP 2: Get the Service Principal
# ============================================
Write-Host "Finding Service Principal for App Registration..." -ForegroundColor Cyan
$ServicePrincipal = Get-AzADServicePrincipal -ApplicationId $AppId

if (-not $ServicePrincipal) {
    Write-Error "Service Principal not found for AppId: $AppId"
    Write-Host "Make sure your App Registration has a Service Principal (Enterprise Application)." -ForegroundColor Yellow
    exit 1
}
Write-Host "Found: $($ServicePrincipal.DisplayName) (ObjectId: $($ServicePrincipal.Id))" -ForegroundColor Green

# ============================================
# STEP 3: Assign ${role} Role to Each Subscription
# ============================================
$RoleName = "${role}"
$SuccessCount = 0
$FailCount = 0

foreach ($SubId in $SubscriptionIds) {
    Write-Host ""
    Write-Host "Processing Subscription: $SubId" -ForegroundColor Cyan
    
    # Set the context to the subscription
    try {
        Set-AzContext -SubscriptionId $SubId -ErrorAction Stop | Out-Null
    } catch {
        Write-Error "  Failed to access subscription: $SubId"
        Write-Host "  Error: $_" -ForegroundColor Red
        $FailCount++
        continue
    }
    
    # Check if role assignment already exists
    $ExistingAssignment = Get-AzRoleAssignment -ObjectId $ServicePrincipal.Id -RoleDefinitionName $RoleName -Scope "/subscriptions/$SubId" -ErrorAction SilentlyContinue
    
    if ($ExistingAssignment) {
        Write-Host "  ✓ $RoleName role already assigned" -ForegroundColor Yellow
        $SuccessCount++
        continue
    }
    
    # Create the role assignment
    try {
        New-AzRoleAssignment \`
            -ObjectId $ServicePrincipal.Id \`
            -RoleDefinitionName $RoleName \`
            -Scope "/subscriptions/$SubId" \`
            -ErrorAction Stop | Out-Null
        
        Write-Host "  ✓ Successfully assigned $RoleName role" -ForegroundColor Green
        $SuccessCount++
    } catch {
        Write-Error "  Failed to assign role to subscription: $SubId"
        Write-Host "  Error: $_" -ForegroundColor Red
        $FailCount++
    }
}

# ============================================
# STEP 4: Summary
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "COMPLETE!" -ForegroundColor Green
Write-Host "  Successful: $SuccessCount subscription(s)" -ForegroundColor Green
if ($FailCount -gt 0) {
    Write-Host "  Failed: $FailCount subscription(s)" -ForegroundColor Red
}
Write-Host "============================================" -ForegroundColor Green

Write-Host ""
Write-Host "Your App Registration now has '$RoleName' access to the specified subscriptions." -ForegroundColor Cyan
${writeMode ? `Write-Host "This allows the app to read AND modify Azure resources (VMs, Storage, etc.)." -ForegroundColor Yellow` : `Write-Host "This allows the app to read Azure resources (VMs, Storage, etc.)." -ForegroundColor Cyan`}

# Disconnect (optional)
# Disconnect-AzAccount
`;
  };

  const copyAzurePowerShellScript = () => {
    const script = getAzurePowerShellScript();
    copyToClipboard(script, 'azure-script', 'Azure PowerShell Script Copied', 'Script copied to clipboard. Update the variables before running.');
  };

  const downloadAzurePowerShellScript = () => {
    const script = getAzurePowerShellScript();
    const filename = `Azure-RBAC-${writeMode ? 'Contributor' : 'Reader'}.ps1`;
    downloadScript(script, filename);
  };

  const copyAzureInstructions = () => {
    const role = writeMode ? 'Contributor' : 'Reader';
    const text = `Azure RBAC Role Assignment Instructions

Required Role: ${role}

Steps to assign the role:
1. Go to Azure Portal → Subscriptions
2. Select your subscription
3. Click "Access control (IAM)" in the left menu
4. Click "Add" → "Add role assignment"
5. Select "${role}" role
6. Click "Members" tab → "Select members"
7. Search for your App Registration name and select it
8. Click "Review + assign"

Repeat for each subscription you want to ${writeMode ? 'manage' : 'export'}.`;

    copyToClipboard(text, 'all-azure');
  };

  const copyCategoryPermissions = (category: CategoryGroup) => {
    const perms = getUniquePermissions(category.resources, writeMode);
    copyToClipboard(perms.join('\n'), category.id);
  };

  const getGraphPowerShellScript = () => {
    const permissions = allGraphPermissions;
    return `# PowerShell script to add Microsoft Graph API permissions to an App Registration
# Run this in Azure Cloud Shell or with Azure PowerShell module installed
# Requires: Microsoft.Graph PowerShell module (Install-Module Microsoft.Graph -Scope CurrentUser)

# Variables - UPDATE THESE BEFORE RUNNING
$AppId = "YOUR_APP_CLIENT_ID"      # Your App Registration's Application (Client) ID
$TenantId = "YOUR_TENANT_ID"       # Your Azure AD Tenant ID

# ============================================
# STEP 1: Connect to Microsoft Graph
# ============================================
Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Cyan
Connect-MgGraph -TenantId $TenantId -Scopes "Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All"

# ============================================
# STEP 2: Get Service Principals
# ============================================
Write-Host "Finding your App Registration..." -ForegroundColor Cyan
$App = Get-MgApplication -Filter "appId eq '$AppId'"
if (-not $App) {
    Write-Error "App Registration not found with AppId: $AppId"
    exit 1
}
Write-Host "Found: $($App.DisplayName)" -ForegroundColor Green

# Get the Service Principal for your app (create if doesn't exist)
$ServicePrincipal = Get-MgServicePrincipal -Filter "appId eq '$AppId'"
if (-not $ServicePrincipal) {
    Write-Host "Creating Service Principal for the app..." -ForegroundColor Yellow
    $ServicePrincipal = New-MgServicePrincipal -AppId $AppId
}

# Microsoft Graph API App ID (constant - same for all tenants)
$GraphApiId = "00000003-0000-0000-c000-000000000000"
$GraphSP = Get-MgServicePrincipal -Filter "appId eq '$GraphApiId'"

# ============================================
# STEP 3: Define Required Permissions
# ============================================
$RequiredPermissions = @(
${permissions.map(p => `    "${p}"`).join(',\n')}
)

# ============================================
# STEP 4: Add Permissions to App Registration
# ============================================
Write-Host ""
Write-Host "Adding API permissions to App Registration..." -ForegroundColor Cyan

$ResourceAccess = @()
$AddedCount = 0
$SkippedCount = 0

foreach ($PermissionName in $RequiredPermissions) {
    $Role = $GraphSP.AppRoles | Where-Object { $_.Value -eq $PermissionName }
    if ($Role) {
        $ResourceAccess += @{
            Id = $Role.Id
            Type = "Role"  # "Role" = Application permission, "Scope" = Delegated
        }
        Write-Host "  + $PermissionName" -ForegroundColor Green
        $AddedCount++
    } else {
        Write-Warning "  - Permission not found: $PermissionName"
        $SkippedCount++
    }
}

# Build the required resource access object
$RequiredResourceAccess = @{
    ResourceAppId = $GraphApiId
    ResourceAccess = $ResourceAccess
}

# Get existing resource access and merge
$ExistingAccess = $App.RequiredResourceAccess | Where-Object { $_.ResourceAppId -ne $GraphApiId }
$AllResourceAccess = @($ExistingAccess) + @($RequiredResourceAccess)

# Update the application
Write-Host ""
Write-Host "Updating App Registration with new permissions..." -ForegroundColor Cyan
Update-MgApplication -ApplicationId $App.Id -RequiredResourceAccess $AllResourceAccess

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "SUCCESS! Added $AddedCount permissions." -ForegroundColor Green
if ($SkippedCount -gt 0) {
    Write-Host "Skipped $SkippedCount permissions (not found)." -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Green

# ============================================
# STEP 5: Grant Admin Consent (Automated)
# ============================================
Write-Host ""
Write-Host "Granting admin consent for all permissions..." -ForegroundColor Cyan
Write-Host "(This requires Global Administrator or Privileged Role Administrator)" -ForegroundColor Yellow
Write-Host ""

$ConsentGranted = 0
$ConsentSkipped = 0
$ConsentFailed = 0

foreach ($PermissionName in $RequiredPermissions) {
    $Role = $GraphSP.AppRoles | Where-Object { $_.Value -eq $PermissionName }
    if ($Role) {
        # Check if consent already exists
        $ExistingGrant = Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $ServicePrincipal.Id -ErrorAction SilentlyContinue | 
            Where-Object { $_.AppRoleId -eq $Role.Id -and $_.ResourceId -eq $GraphSP.Id }
        
        if ($ExistingGrant) {
            Write-Host "  ~ $PermissionName (already consented)" -ForegroundColor DarkGray
            $ConsentSkipped++
            continue
        }
        
        try {
            New-MgServicePrincipalAppRoleAssignment \`
                -ServicePrincipalId $ServicePrincipal.Id \`
                -PrincipalId $ServicePrincipal.Id \`
                -ResourceId $GraphSP.Id \`
                -AppRoleId $Role.Id \`
                -ErrorAction Stop | Out-Null
            
            Write-Host "  + $PermissionName" -ForegroundColor Green
            $ConsentGranted++
        } catch {
            Write-Warning "  - Failed to grant consent for: $PermissionName"
            Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
            $ConsentFailed++
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "PERMISSIONS CONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Permissions added to app: $AddedCount" -ForegroundColor White
Write-Host "  Admin consent granted: $ConsentGranted" -ForegroundColor White
Write-Host "  Already consented: $ConsentSkipped" -ForegroundColor White
if ($ConsentFailed -gt 0) {
    Write-Host "  Consent failed: $ConsentFailed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Note: Failed consents may require manual approval in Azure Portal:" -ForegroundColor Yellow
    Write-Host "  Azure Portal -> Azure AD -> App registrations -> $($App.DisplayName) -> API permissions" -ForegroundColor White
}

Write-Host ""
Write-Host "Disconnecting from Microsoft Graph..." -ForegroundColor Cyan
Disconnect-MgGraph

Write-Host ""
Write-Host "Script completed!" -ForegroundColor Green
`;
  };

  const copyGraphPowerShellScript = () => {
    const script = getGraphPowerShellScript();
    copyToClipboard(script, 'powershell', 'PowerShell Script Copied', 'Script copied to clipboard. Update the variables before running.');
  };

  const downloadGraphPowerShellScript = () => {
    const script = getGraphPowerShellScript();
    const filename = `Graph-API-Permissions-${writeMode ? 'ReadWrite' : 'Read'}.ps1`;
    downloadScript(script, filename);
  };

  const getCombinedPowerShellScript = () => {
    const permissions = allGraphPermissions;
    const role = writeMode ? 'Contributor' : 'Reader';
    return `# ============================================================
# COMBINED PowerShell Script: Graph API Permissions + Azure RBAC
# ============================================================
# This script configures BOTH:
#   1. Microsoft Graph API permissions on your App Registration
#   2. Azure RBAC role assignments on your subscriptions
#
# Requirements:
#   - Microsoft.Graph module: Install-Module Microsoft.Graph -Scope CurrentUser
#   - Az module: Install-Module Az -Scope CurrentUser
# ============================================================

# ============================================
# CONFIGURATION - UPDATE THESE BEFORE RUNNING
# ============================================
$AppId = "YOUR_APP_CLIENT_ID"           # Your App Registration's Application (Client) ID
$TenantId = "YOUR_TENANT_ID"            # Your Azure AD Tenant ID
$SubscriptionIds = @(                   # List of Subscription IDs for Azure RBAC
    "YOUR_SUBSCRIPTION_ID_1"
    # "YOUR_SUBSCRIPTION_ID_2"           # Add more as needed
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host " COMBINED PERMISSIONS CONFIGURATION    " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# ############################################
# PART 1: MICROSOFT GRAPH API PERMISSIONS
# ############################################

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PART 1: Microsoft Graph API Permissions" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Connect to Microsoft Graph
Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Cyan
Connect-MgGraph -TenantId $TenantId -Scopes "Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All"

# Get the App Registration
Write-Host "Finding your App Registration..." -ForegroundColor Cyan
$App = Get-MgApplication -Filter "appId eq '$AppId'"
if (-not $App) {
    Write-Error "App Registration not found with AppId: $AppId"
    exit 1
}
Write-Host "Found: $($App.DisplayName)" -ForegroundColor Green

# Get or create Service Principal
$ServicePrincipal = Get-MgServicePrincipal -Filter "appId eq '$AppId'"
if (-not $ServicePrincipal) {
    Write-Host "Creating Service Principal for the app..." -ForegroundColor Yellow
    $ServicePrincipal = New-MgServicePrincipal -AppId $AppId
}

# Microsoft Graph API Service Principal
$GraphApiId = "00000003-0000-0000-c000-000000000000"
$GraphSP = Get-MgServicePrincipal -Filter "appId eq '$GraphApiId'"

# Define required permissions
$RequiredPermissions = @(
${permissions.map(p => `    "${p}"`).join(',\n')}
)

# Add permissions
Write-Host ""
Write-Host "Adding $($RequiredPermissions.Count) API permissions..." -ForegroundColor Cyan

$ResourceAccess = @()
$GraphAddedCount = 0
$GraphSkippedCount = 0

foreach ($PermissionName in $RequiredPermissions) {
    $Role = $GraphSP.AppRoles | Where-Object { $_.Value -eq $PermissionName }
    if ($Role) {
        $ResourceAccess += @{
            Id = $Role.Id
            Type = "Role"
        }
        Write-Host "  + $PermissionName" -ForegroundColor Green
        $GraphAddedCount++
    } else {
        Write-Warning "  - Permission not found: $PermissionName"
        $GraphSkippedCount++
    }
}

# Update the application
$RequiredResourceAccess = @{
    ResourceAppId = $GraphApiId
    ResourceAccess = $ResourceAccess
}

$ExistingAccess = $App.RequiredResourceAccess | Where-Object { $_.ResourceAppId -ne $GraphApiId }
$AllResourceAccess = @($ExistingAccess) + @($RequiredResourceAccess)

Write-Host ""
Write-Host "Updating App Registration..." -ForegroundColor Cyan
Update-MgApplication -ApplicationId $App.Id -RequiredResourceAccess $AllResourceAccess

Write-Host ""
Write-Host "Graph API: Added $GraphAddedCount permissions" -ForegroundColor Green
if ($GraphSkippedCount -gt 0) {
    Write-Host "  Skipped $GraphSkippedCount (not found)" -ForegroundColor Yellow
}

# Grant admin consent automatically
Write-Host ""
Write-Host "Granting admin consent..." -ForegroundColor Cyan

$ConsentGranted = 0
$ConsentSkipped = 0

foreach ($PermissionName in $RequiredPermissions) {
    $Role = $GraphSP.AppRoles | Where-Object { $_.Value -eq $PermissionName }
    if ($Role) {
        $ExistingGrant = Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $ServicePrincipal.Id -ErrorAction SilentlyContinue | 
            Where-Object { $_.AppRoleId -eq $Role.Id -and $_.ResourceId -eq $GraphSP.Id }
        
        if ($ExistingGrant) {
            $ConsentSkipped++
            continue
        }
        
        try {
            New-MgServicePrincipalAppRoleAssignment \`
                -ServicePrincipalId $ServicePrincipal.Id \`
                -PrincipalId $ServicePrincipal.Id \`
                -ResourceId $GraphSP.Id \`
                -AppRoleId $Role.Id \`
                -ErrorAction Stop | Out-Null
            $ConsentGranted++
        } catch {
            # Silent fail - will be reported in summary
        }
    }
}

Write-Host "  Consent granted: $ConsentGranted | Already consented: $ConsentSkipped" -ForegroundColor Green

# Disconnect from Graph
Write-Host ""
Write-Host "Disconnecting from Microsoft Graph..." -ForegroundColor Cyan
Disconnect-MgGraph

# ############################################
# PART 2: AZURE RBAC ROLE ASSIGNMENTS
# ############################################

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host "PART 2: Azure RBAC Role Assignments" -ForegroundColor DarkYellow  
Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host ""

# Connect to Azure
Write-Host "Connecting to Azure..." -ForegroundColor Cyan
Connect-AzAccount -TenantId $TenantId

# Get Service Principal for role assignment
Write-Host "Finding Service Principal..." -ForegroundColor Cyan
$AzServicePrincipal = Get-AzADServicePrincipal -ApplicationId $AppId

if (-not $AzServicePrincipal) {
    Write-Error "Service Principal not found for AppId: $AppId"
    Write-Host "Skipping Azure RBAC assignments." -ForegroundColor Yellow
} else {
    Write-Host "Found: $($AzServicePrincipal.DisplayName)" -ForegroundColor Green
    
    $RoleName = "${role}"
    $AzureSuccessCount = 0
    $AzureFailCount = 0
    
    foreach ($SubId in $SubscriptionIds) {
        Write-Host ""
        Write-Host "Processing Subscription: $SubId" -ForegroundColor Cyan
        
        try {
            Set-AzContext -SubscriptionId $SubId -ErrorAction Stop | Out-Null
        } catch {
            Write-Error "  Failed to access subscription: $SubId"
            $AzureFailCount++
            continue
        }
        
        # Check existing assignment
        $ExistingAssignment = Get-AzRoleAssignment -ObjectId $AzServicePrincipal.Id -RoleDefinitionName $RoleName -Scope "/subscriptions/$SubId" -ErrorAction SilentlyContinue
        
        if ($ExistingAssignment) {
            Write-Host "  $RoleName role already assigned" -ForegroundColor Yellow
            $AzureSuccessCount++
            continue
        }
        
        try {
            New-AzRoleAssignment \`
                -ObjectId $AzServicePrincipal.Id \`
                -RoleDefinitionName $RoleName \`
                -Scope "/subscriptions/$SubId" \`
                -ErrorAction Stop | Out-Null
            
            Write-Host "  Successfully assigned $RoleName role" -ForegroundColor Green
            $AzureSuccessCount++
        } catch {
            Write-Error "  Failed to assign role"
            $AzureFailCount++
        }
    }
    
    Write-Host ""
    Write-Host "Azure RBAC: $AzureSuccessCount subscription(s) configured" -ForegroundColor Green
    if ($AzureFailCount -gt 0) {
        Write-Host "  Failed: $AzureFailCount subscription(s)" -ForegroundColor Red
    }
}

# ############################################
# SUMMARY
# ############################################

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host " CONFIGURATION COMPLETE!               " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Graph API Permissions: $GraphAddedCount added" -ForegroundColor White
Write-Host "  Azure RBAC ($RoleName): $AzureSuccessCount subscription(s)" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Admin consent is still required for Graph API permissions!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Grant consent at:" -ForegroundColor Cyan
Write-Host "  Azure Portal -> Azure AD -> App registrations -> Your App -> API permissions -> Grant admin consent" -ForegroundColor White
Write-Host ""
`;
  };

  const copyCombinedPowerShellScript = () => {
    const script = getCombinedPowerShellScript();
    copyToClipboard(script, 'combined-script', 'Combined Script Copied', 'Complete Graph + Azure script copied. Update variables before running.');
  };

  const downloadCombinedPowerShellScript = () => {
    const script = getCombinedPowerShellScript();
    const filename = `Complete-Setup-${writeMode ? 'ReadWrite' : 'Read'}.ps1`;
    downloadScript(script, filename);
  };

  const renderResourceCard = (resource: PermissionRequirement) => {
    const readPerm = resource.requiredPermissions[0];
    const writePerm = getWritePermission(readPerm);
    const currentPerm = writeMode ? writePerm : readPerm;
    const alternatives = resource.alternativePermissions?.map(p => writeMode ? getWritePermission(p) : p) || [];

    return (
      <div
        key={resource.resourceId}
        className="p-3 rounded-lg bg-muted/30 border border-border/50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{resource.resourceName}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="secondary" className="font-mono text-xs">
                {currentPerm}
              </Badge>
              {alternatives.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  or: {alternatives.slice(0, 2).join(', ')}
                  {alternatives.length > 2 && ` +${alternatives.length - 2} more`}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => copyToClipboard(currentPerm, resource.resourceId)}
          >
            {copiedId === resource.resourceId ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderCategorySection = (category: CategoryGroup, isAzure: boolean = false) => {
    const isExpanded = expandedCategories.has(category.id);
    const uniquePerms = getUniquePermissions(category.resources, writeMode);

    return (
      <Collapsible
        key={category.id}
        open={isExpanded}
        onOpenChange={() => toggleCategory(category.id)}
      >
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">{category.name}</span>
              <Badge variant="outline" className="ml-2">
                {category.resources.length} resource{category.resources.length !== 1 ? 's' : ''}
              </Badge>
              {!isAzure && (
                <Badge variant="secondary" className="ml-1">
                  {uniquePerms.length} permission{uniquePerms.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                copyCategoryPermissions(category);
              }}
            >
              {copiedId === category.id ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy All
            </Button>
          </div>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-2">
              {category.resources.map(resource => renderResourceCard(resource))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FileKey className="h-7 w-7 text-primary" />
            Permissions Reference
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete list of permissions required for all resource types
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={copyCombinedPowerShellScript}
          >
            {copiedId === 'combined-script' ? (
              <Check className="h-5 w-5" />
            ) : (
              <Terminal className="h-5 w-5" />
            )}
            Copy Full Script
          </Button>
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            onClick={downloadCombinedPowerShellScript}
          >
            <Download className="h-5 w-5" />
            Download Complete .ps1
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Graph API Permissions</CardDescription>
            <CardTitle className="text-2xl">{allGraphPermissions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">unique scopes required</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardDescription>Graph Resources</CardDescription>
            <CardTitle className="text-2xl">{totalGraphResources}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">M365 resource types</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription>Azure Resources</CardDescription>
            <CardTitle className="text-2xl">{totalAzureResources}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">ARM resource types</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription>Azure Role</CardDescription>
            <CardTitle className="text-2xl">{writeMode ? 'Contributor' : 'Reader'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">recommended RBAC role</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className={writeMode ? 'border-orange-500/50 bg-orange-500/5' : ''}>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="write-mode"
                  checked={writeMode}
                  onCheckedChange={setWriteMode}
                />
                <div>
                  <Label htmlFor="write-mode" className="cursor-pointer font-medium">
                    {writeMode ? 'Export + Import (Read-Write)' : 'Export Only (Read)'}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {writeMode 
                      ? 'Shows ReadWrite permissions & Contributor role for Azure' 
                      : 'Shows Read permissions & Reader role for Azure'}
                  </p>
                </div>
              </div>
              {writeMode && (
                <Badge variant="outline" className="border-orange-500/50 text-orange-600 bg-orange-500/10">
                  Import/Restore requires Contributor
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources or permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph" className="gap-2">
            <Shield className="h-4 w-4" />
            Microsoft 365 ({totalGraphResources})
          </TabsTrigger>
          <TabsTrigger value="azure" className="gap-2">
            <Cloud className="h-4 w-4" />
            Azure ({totalAzureResources})
          </TabsTrigger>
        </TabsList>

        {/* Graph API Tab */}
        <TabsContent value="graph" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Microsoft Graph API Permissions</CardTitle>
                  <CardDescription>
                    Add these permissions in Azure Portal → App Registrations → API Permissions
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => expandAll(filteredGraphCategories)}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAll}
                  >
                    Collapse All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={copyGraphPowerShellScript}
                  >
                    {copiedId === 'powershell' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Terminal className="h-4 w-4" />
                    )}
                    Copy Script
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={downloadGraphPowerShellScript}
                  >
                    <Download className="h-4 w-4" />
                    Download .ps1
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={copyAllGraphPermissions}
                  >
                    {copiedId === 'all-graph' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy All ({allGraphPermissions.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {filteredGraphCategories.length > 0 ? (
                    filteredGraphCategories.map(category => renderCategorySection(category))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No resources match your search
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Azure Tab */}
        <TabsContent value="azure" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Azure RBAC Permissions</CardTitle>
                  <CardDescription>
                    Assign the "{writeMode ? 'Contributor' : 'Reader'}" role to your Service Principal on each subscription
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => expandAll(filteredAzureCategories)}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAll}
                  >
                    Collapse All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={copyAzureInstructions}
                  >
                    {copiedId === 'all-azure' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy Instructions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={copyAzurePowerShellScript}
                  >
                    {copiedId === 'azure-script' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Terminal className="h-4 w-4" />
                    )}
                    Copy Script
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-orange-600 hover:bg-orange-700"
                    onClick={downloadAzurePowerShellScript}
                  >
                    <Download className="h-4 w-4" />
                    Download .ps1
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Azure Role Info */}
              <div className="mb-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <h4 className="font-medium text-foreground mb-2">
                  {writeMode ? '🔧 Contributor Role Required' : '👁️ Reader Role Required'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  Unlike Graph API permissions which are granular, Azure uses role-based access control (RBAC).
                  Assigning the "{writeMode ? 'Contributor' : 'Reader'}" role on a subscription grants access to all resource types listed below.
                </p>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {filteredAzureCategories.length > 0 ? (
                    filteredAzureCategories.map(category => renderCategorySection(category, true))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No resources match your search
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Reference Footer */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileKey className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-foreground mb-1">Need Help Setting Up?</h4>
              <p className="text-sm text-muted-foreground">
                Go to the <strong>Authentication</strong> page to configure your App Registration credentials. 
                Use the <strong>Preflight Check</strong> before exporting to verify your permissions are correctly configured.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
