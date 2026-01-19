// Comprehensive remediation guides for governance actions
// Each guide includes step-by-step instructions, PowerShell commands, Graph API calls, and portal links

export interface RemediationStep {
  order: number;
  title: string;
  description: string;
  method: 'portal' | 'powershell' | 'graph-api' | 'manual';
  code?: string;
  portalUrl?: string;
  notes?: string;
}

export interface RemediationGuide {
  actionId: string;
  title: string;
  overview: string;
  prerequisites: string[];
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: RemediationStep[];
  documentationLinks: { title: string; url: string }[];
  rollbackSteps?: string[];
  verificationSteps: string[];
}

export const REMEDIATION_GUIDES: Record<string, RemediationGuide> = {
  'enable-mfa-admins': {
    actionId: 'enable-mfa-admins',
    title: 'Enable MFA for Admin Accounts',
    overview: 'Multi-factor authentication (MFA) is the single most effective control to prevent account compromise. Admin accounts are high-value targets and must have MFA enabled.',
    prerequisites: [
      'Global Administrator or Authentication Policy Administrator role',
      'Azure AD Premium P1 or higher (for Conditional Access)',
      'Authenticator app or FIDO2 key for admins',
    ],
    estimatedTime: '15-30 minutes',
    difficulty: 'easy',
    steps: [
      {
        order: 1,
        title: 'Identify admins without MFA',
        description: 'Run a report to find all admin accounts without MFA registered.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "User.Read.All", "Directory.Read.All", "UserAuthenticationMethod.Read.All"

# Get all users with admin roles
$adminRoles = @(
    "Global Administrator",
    "Security Administrator", 
    "Exchange Administrator",
    "SharePoint Administrator",
    "User Administrator"
)

$admins = Get-MgDirectoryRoleMember -DirectoryRoleId (
    Get-MgDirectoryRole | Where-Object { $adminRoles -contains $_.DisplayName }
).Id | Select-Object -ExpandProperty AdditionalProperties

# Check MFA registration status
foreach ($admin in $admins) {
    $methods = Get-MgUserAuthenticationMethod -UserId $admin.userPrincipalName
    $hasMfa = $methods | Where-Object { $_.AdditionalProperties.'@odata.type' -ne '#microsoft.graph.passwordAuthenticationMethod' }
    
    if (-not $hasMfa) {
        Write-Host "NO MFA: $($admin.userPrincipalName)" -ForegroundColor Red
    }
}`,
      },
      {
        order: 2,
        title: 'Create Conditional Access Policy',
        description: 'Create a policy requiring MFA for all admin roles.',
        method: 'portal',
        portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
        notes: 'Navigate to Protection > Conditional Access > Policies > New Policy',
      },
      {
        order: 3,
        title: 'Configure policy settings',
        description: 'Use these settings for the Conditional Access policy.',
        method: 'graph-api',
        code: `// POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "Require MFA for Admin Roles",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeRoles": [
        "62e90394-69f5-4237-9190-012177145e10", // Global Administrator
        "194ae4cb-b126-40b2-bd5b-6091b380977d", // Security Administrator
        "29232cdf-9323-42fd-ade2-1d097af3e4de", // Exchange Administrator
        "f28a1f50-f6e7-4571-818b-6a12f2af6b6c", // SharePoint Administrator
        "fe930be7-5e62-47db-91af-98c3a49a38b1"  // User Administrator
      ]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,
      },
      {
        order: 4,
        title: 'Notify affected admins',
        description: 'Send communication to admins about MFA requirement and provide setup instructions.',
        method: 'manual',
        notes: 'Use email template or Teams message to notify admins. Include link to aka.ms/mfasetup',
      },
    ],
    documentationLinks: [
      { title: 'Microsoft MFA documentation', url: 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks' },
      { title: 'Conditional Access for admins', url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-admin-mfa' },
      { title: 'Security defaults', url: 'https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults' },
    ],
    rollbackSteps: [
      'Disable the Conditional Access policy (set state to "disabled")',
      'Or exclude specific users temporarily while troubleshooting',
    ],
    verificationSteps: [
      'Sign in as an admin and verify MFA prompt appears',
      'Check Azure AD sign-in logs for MFA success events',
      'Run the admin MFA report again to confirm coverage',
    ],
  },

  'configure-conditional-access': {
    actionId: 'configure-conditional-access',
    title: 'Configure Conditional Access Baseline',
    overview: 'Conditional Access policies are the foundation of Zero Trust security, enabling you to enforce controls based on user, device, location, and risk signals.',
    prerequisites: [
      'Azure AD Premium P1 or P2 license',
      'Global Administrator or Security Administrator role',
      'Understanding of your organization access patterns',
    ],
    estimatedTime: '1-2 hours',
    difficulty: 'medium',
    steps: [
      {
        order: 1,
        title: 'Review current policy state',
        description: 'List all existing Conditional Access policies to understand current coverage.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Policy.Read.All"

# Get all Conditional Access policies
$policies = Get-MgIdentityConditionalAccessPolicy
$policies | Select-Object DisplayName, State, CreatedDateTime | Format-Table -AutoSize

# Show policy details
foreach ($policy in $policies) {
    Write-Host "\\n=== $($policy.DisplayName) ===" -ForegroundColor Cyan
    Write-Host "State: $($policy.State)"
    Write-Host "Users: $($policy.Conditions.Users.IncludeUsers -join ', ')"
    Write-Host "Apps: $($policy.Conditions.Applications.IncludeApplications -join ', ')"
    Write-Host "Grant Controls: $($policy.GrantControls.BuiltInControls -join ', ')"
}`,
      },
      {
        order: 2,
        title: 'Create baseline policies',
        description: 'Deploy recommended baseline policies for your organization.',
        method: 'portal',
        portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
        notes: 'Consider starting with Report-only mode to assess impact before enforcing',
      },
      {
        order: 3,
        title: 'Require MFA for all users',
        description: 'Create a policy requiring MFA for all users accessing cloud apps.',
        method: 'graph-api',
        code: `// POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "CA001: Require MFA for all users",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["GuestsOrExternalUsers"],
      "excludeGroups": ["<emergency-access-group-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,
      },
      {
        order: 4,
        title: 'Block legacy authentication',
        description: 'Block authentication protocols that cannot support MFA.',
        method: 'graph-api',
        code: `// POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "CA002: Block legacy authentication",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeGroups": ["<emergency-access-group-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": ["exchangeActiveSync", "other"]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,
      },
      {
        order: 5,
        title: 'Require compliant devices',
        description: 'Require device compliance for accessing sensitive applications.',
        method: 'graph-api',
        code: `// POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "CA003: Require compliant device for Office 365",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["Office365"]
    },
    "platforms": {
      "includePlatforms": ["android", "iOS", "windows", "macOS"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["compliantDevice", "domainJoinedDevice"]
  }
}`,
      },
    ],
    documentationLinks: [
      { title: 'Conditional Access overview', url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview' },
      { title: 'Common policies', url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-policy-common' },
      { title: 'What If tool', url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/what-if-tool' },
    ],
    rollbackSteps: [
      'Set policy state to "disabled" or "enabledForReportingButNotEnforced"',
      'Check sign-in logs for blocked users',
      'Add exclusion groups for emergency access',
    ],
    verificationSteps: [
      'Use the "What If" tool to test policy impact',
      'Monitor sign-in logs for policy triggers',
      'Review Conditional Access insights workbook',
    ],
  },

  'remove-stale-guests': {
    actionId: 'remove-stale-guests',
    title: 'Remove Stale Guest Accounts',
    overview: 'Guest accounts that have not been used for extended periods represent security risks. Regular cleanup reduces attack surface and maintains a clean directory.',
    prerequisites: [
      'Global Administrator or User Administrator role',
      'Microsoft Graph PowerShell module installed',
      'Approval process for bulk user removal',
    ],
    estimatedTime: '30-60 minutes',
    difficulty: 'easy',
    steps: [
      {
        order: 1,
        title: 'Identify stale guest accounts',
        description: 'Find all guest users who have not signed in for 90+ days.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "User.Read.All", "AuditLog.Read.All"

# Calculate date threshold (90 days ago)
$threshold = (Get-Date).AddDays(-90)

# Get all guest users
$guests = Get-MgUser -Filter "userType eq 'Guest'" -All -Property Id, DisplayName, Mail, UserPrincipalName, SignInActivity

# Find stale guests
$staleGuests = $guests | Where-Object {
    $lastSignIn = $_.SignInActivity.LastSignInDateTime
    (-not $lastSignIn) -or ([DateTime]$lastSignIn -lt $threshold)
}

# Export to CSV for review
$staleGuests | Select-Object DisplayName, Mail, UserPrincipalName, @{
    Name='LastSignIn'
    Expression={$_.SignInActivity.LastSignInDateTime}
} | Export-Csv -Path "StaleGuests.csv" -NoTypeInformation

Write-Host "Found $($staleGuests.Count) stale guest accounts" -ForegroundColor Yellow
Write-Host "Review StaleGuests.csv before proceeding with removal"`,
      },
      {
        order: 2,
        title: 'Review and approve removal list',
        description: 'Review the exported CSV and confirm which guests should be removed.',
        method: 'manual',
        notes: 'Share the list with business owners for approval. Some guests may still need access despite inactivity.',
      },
      {
        order: 3,
        title: 'Remove approved guest accounts',
        description: 'Delete the approved stale guest accounts.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph with write permissions
Connect-MgGraph -Scopes "User.ReadWrite.All"

# Import approved removal list
$guestsToRemove = Import-Csv -Path "ApprovedGuestsToRemove.csv"

# Remove each guest
foreach ($guest in $guestsToRemove) {
    try {
        Remove-MgUser -UserId $guest.UserPrincipalName -Confirm:$false
        Write-Host "Removed: $($guest.DisplayName)" -ForegroundColor Green
    } catch {
        Write-Host "Failed to remove $($guest.DisplayName): $_" -ForegroundColor Red
    }
}

# Alternatively, use Graph API
# DELETE https://graph.microsoft.com/v1.0/users/{user-id}`,
      },
      {
        order: 4,
        title: 'Set up recurring access review',
        description: 'Create an access review to automatically review guest access periodically.',
        method: 'portal',
        portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ERM/DashboardBlade/~/Controls',
        notes: 'Navigate to Identity Governance > Access Reviews > New access review',
      },
    ],
    documentationLinks: [
      { title: 'Manage guest access', url: 'https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b' },
      { title: 'Access reviews for guests', url: 'https://learn.microsoft.com/en-us/entra/id-governance/create-access-review' },
      { title: 'Guest user sign-in activity', url: 'https://learn.microsoft.com/en-us/entra/identity/users/clean-up-stale-guest-accounts' },
    ],
    rollbackSteps: [
      'Deleted guest users can be restored from the Deleted users blade within 30 days',
      'Navigate to Users > Deleted users in Entra admin center',
      'Select users and click "Restore user"',
    ],
    verificationSteps: [
      'Re-run the stale guest query to confirm removal',
      'Check audit logs for user deletion events',
      'Verify no access disruption complaints from business owners',
    ],
  },

  'optimize-licenses': {
    actionId: 'optimize-licenses',
    title: 'Optimize License Assignments',
    overview: 'Many organizations over-license users with E5 when they only need E3 or Business Premium features. Optimizing license assignments can result in significant cost savings.',
    prerequisites: [
      'License Administrator or Global Administrator role',
      'Access to Microsoft 365 usage reports',
      'Understanding of license feature differences',
    ],
    estimatedTime: '2-4 hours',
    difficulty: 'medium',
    steps: [
      {
        order: 1,
        title: 'Generate license usage report',
        description: 'Export detailed license usage data to identify optimization opportunities.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Reports.Read.All", "User.Read.All"

# Get license usage report
$report = Get-MgReportOffice365ActiveUserDetail -Period "D30"

# Parse and analyze usage
$usage = Import-Csv $report

# E5-specific features to check
$e5Features = @(
    "HasYammerLicense",
    "HasTeamsLicense", 
    "HasOneDriveLicense",
    "HasExchangeLicense",
    "HasSharePointLicense",
    "HasPowerBILicense",
    "HasProjectLicense"
)

# Find users with E5 but low feature usage
$e5Users = Get-MgUser -Filter "assignedLicenses/any(x:x/skuId eq 'c7df2760-2c81-4ef7-b578-5b5392b571df')" -All

foreach ($user in $e5Users) {
    $userUsage = $usage | Where-Object { $_.UserPrincipalName -eq $user.UserPrincipalName }
    # Analyze which premium features are actually used
    Write-Host "$($user.DisplayName): Check usage patterns"
}`,
      },
      {
        order: 2,
        title: 'Review E5-specific feature usage',
        description: 'Check usage of E5-only features like Advanced eDiscovery, Defender, etc.',
        method: 'portal',
        portalUrl: 'https://admin.microsoft.com/Adminportal/Home#/reportsUsage',
        notes: 'Review Microsoft 365 usage reports for Advanced features usage',
      },
      {
        order: 3,
        title: 'Create downgrade plan',
        description: 'Identify users eligible for E3 or Business Premium based on usage patterns.',
        method: 'graph-api',
        code: `// GET https://graph.microsoft.com/v1.0/users?$filter=assignedLicenses/any(x:x/skuId eq 'c7df2760-2c81-4ef7-b578-5b5392b571df')&$select=id,displayName,userPrincipalName,assignedLicenses

// For each user, check feature-specific usage:
// GET https://graph.microsoft.com/v1.0/reports/getOffice365ActiveUserDetail(period='D30')

// Criteria for E5 -> E3 downgrade:
// - No Defender for Office 365 alerts triggered
// - No eDiscovery cases created
// - No Advanced Audit logs accessed
// - No Power BI Premium features used`,
      },
      {
        order: 4,
        title: 'Execute license changes',
        description: 'Reassign licenses for identified users.',
        method: 'powershell',
        code: `# Connect with license management permissions
Connect-MgGraph -Scopes "User.ReadWrite.All", "Directory.ReadWrite.All"

# Define SKU IDs
$E5SkuId = "c7df2760-2c81-4ef7-b578-5b5392b571df"
$E3SkuId = "05e9a617-0261-4cee-bb44-138d3ef5d965"

# Import list of users to downgrade
$usersToDowngrade = Import-Csv "UsersToDowngrade.csv"

foreach ($user in $usersToDowngrade) {
    try {
        # Remove E5, add E3
        Set-MgUserLicense -UserId $user.UserPrincipalName \\
            -AddLicenses @{SkuId = $E3SkuId} \\
            -RemoveLicenses @($E5SkuId)
        
        Write-Host "Downgraded: $($user.UserPrincipalName)" -ForegroundColor Green
    } catch {
        Write-Host "Failed: $($user.UserPrincipalName) - $_" -ForegroundColor Red
    }
}`,
      },
    ],
    documentationLinks: [
      { title: 'License management', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/manage/assign-licenses-to-users' },
      { title: 'E3 vs E5 comparison', url: 'https://www.microsoft.com/en-us/microsoft-365/enterprise/compare-office-365-plans' },
      { title: 'Usage reports', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/activity-reports/activity-reports' },
    ],
    rollbackSteps: [
      'Reassign original E5 license if features are needed',
      'Use Set-MgUserLicense to reverse the assignment',
      'Monitor for user complaints about missing features',
    ],
    verificationSteps: [
      'Verify users can still access required apps',
      'Check for any service disruption tickets',
      'Confirm license count changes in admin center',
      'Calculate and document cost savings',
    ],
  },

  'fix-iso-compliance': {
    actionId: 'fix-iso-compliance',
    title: 'Address ISO 27001 Compliance Gaps',
    overview: 'ISO 27001 certification requires specific security controls to be in place. This guide helps address common compliance gaps in Microsoft 365 environments.',
    prerequisites: [
      'Security Administrator role',
      'Access to Compliance Manager',
      'Understanding of ISO 27001 requirements',
    ],
    estimatedTime: '4-8 hours',
    difficulty: 'hard',
    steps: [
      {
        order: 1,
        title: 'Review Compliance Manager assessment',
        description: 'Check the current ISO 27001 compliance score and identify gaps.',
        method: 'portal',
        portalUrl: 'https://compliance.microsoft.com/compliancemanager',
        notes: 'Navigate to Compliance Manager > Assessments > ISO 27001',
      },
      {
        order: 2,
        title: 'Export improvement actions',
        description: 'Get a list of all required improvement actions.',
        method: 'powershell',
        code: `# Using Security & Compliance PowerShell
Connect-IPPSSession

# Get compliance assessment data (if available via cmdlets)
# Note: Some data may only be available via portal

# Common ISO 27001 controls to check:
$controls = @(
    "A.9.2.3 - Privileged access management",
    "A.9.4.1 - Information access restriction", 
    "A.12.4.1 - Event logging",
    "A.12.4.3 - Administrator and operator logs",
    "A.13.1.1 - Network controls",
    "A.18.1.3 - Protection of records"
)

foreach ($control in $controls) {
    Write-Host "Review: $control"
}`,
      },
      {
        order: 3,
        title: 'Enable required audit logging',
        description: 'Ensure unified audit logging is enabled for all activities.',
        method: 'powershell',
        code: `# Connect to Exchange Online
Connect-ExchangeOnline

# Enable unified audit logging
Set-AdminAuditLogConfig -UnifiedAuditLogIngestionEnabled $true

# Verify audit log status
Get-AdminAuditLogConfig | Select-Object UnifiedAuditLogIngestionEnabled

# Enable mailbox auditing for all mailboxes
Get-Mailbox -ResultSize Unlimited | Set-Mailbox -AuditEnabled $true

# Configure audit log retention (E5 required for >90 days)
Set-OrganizationConfig -AuditDisabled $false`,
      },
      {
        order: 4,
        title: 'Configure data classification',
        description: 'Set up sensitivity labels for information classification (ISO A.8.2.1).',
        method: 'portal',
        portalUrl: 'https://compliance.microsoft.com/informationprotection',
        notes: 'Create sensitivity labels: Confidential, Internal, Public',
      },
      {
        order: 5,
        title: 'Implement DLP policies',
        description: 'Create Data Loss Prevention policies for sensitive data (ISO A.13.2.1).',
        method: 'powershell',
        code: `# Connect to Security & Compliance
Connect-IPPSSession

# Create a DLP policy for sensitive information
New-DlpCompliancePolicy -Name "ISO 27001 - Protect PII" \\
    -ExchangeLocation All \\
    -SharePointLocation All \\
    -OneDriveLocation All \\
    -Mode Enable

# Add rule to detect PII
New-DlpComplianceRule -Name "Block external sharing of PII" \\
    -Policy "ISO 27001 - Protect PII" \\
    -ContentContainsSensitiveInformation @{Name="U.S. Social Security Number (SSN)"} \\
    -BlockAccess $true \\
    -NotifyUser Owner`,
      },
    ],
    documentationLinks: [
      { title: 'Compliance Manager', url: 'https://learn.microsoft.com/en-us/microsoft-365/compliance/compliance-manager' },
      { title: 'ISO 27001 assessment', url: 'https://learn.microsoft.com/en-us/microsoft-365/compliance/offering-iso-27001' },
      { title: 'Audit logging', url: 'https://learn.microsoft.com/en-us/purview/audit-log-enable-disable' },
    ],
    rollbackSteps: [
      'DLP policies can be set to "Test" mode instead of "Enforce"',
      'Sensitivity labels can be scoped to specific groups initially',
      'Audit log settings can be adjusted if storage concerns arise',
    ],
    verificationSteps: [
      'Re-run Compliance Manager assessment after changes',
      'Verify audit logs are being captured',
      'Test DLP policies with sample sensitive content',
      'Document evidence for ISO auditor review',
    ],
  },

  'block-legacy-auth': {
    actionId: 'block-legacy-auth',
    title: 'Block Legacy Authentication',
    overview: 'Legacy authentication protocols (POP, IMAP, SMTP AUTH, ActiveSync basic auth) cannot enforce MFA and are commonly exploited in attacks. Blocking these protocols is a critical security control.',
    prerequisites: [
      'Azure AD Premium P1 or higher',
      'Global Administrator or Security Administrator role',
      'Inventory of apps using legacy auth',
    ],
    estimatedTime: '30-60 minutes',
    difficulty: 'easy',
    steps: [
      {
        order: 1,
        title: 'Identify legacy auth usage',
        description: 'Find applications and users still using legacy authentication.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "AuditLog.Read.All"

# Query sign-in logs for legacy auth
$startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ssZ")
$filter = "createdDateTime ge $startDate and clientAppUsed ne 'Browser' and clientAppUsed ne 'Mobile Apps and Desktop clients'"

$legacySignIns = Get-MgAuditLogSignIn -Filter $filter -All

# Group by client app type
$legacySignIns | Group-Object ClientAppUsed | Select-Object Name, Count | Sort-Object Count -Descending

# Show users using legacy auth
$legacySignIns | Select-Object UserPrincipalName, ClientAppUsed, AppDisplayName -Unique |
    Export-Csv "LegacyAuthUsers.csv" -NoTypeInformation`,
      },
      {
        order: 2,
        title: 'Notify affected users',
        description: 'Alert users who need to update their email clients or apps.',
        method: 'manual',
        notes: 'Common scenarios: Outlook 2010 or earlier, third-party email apps using POP/IMAP, scanning devices using SMTP AUTH',
      },
      {
        order: 3,
        title: 'Create Conditional Access policy',
        description: 'Block legacy authentication with a Conditional Access policy.',
        method: 'graph-api',
        code: `// POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "Block Legacy Authentication",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeGroups": ["<legacy-auth-exception-group>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": [
      "exchangeActiveSync",
      "other"
    ]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,
        notes: 'The "other" client app type covers legacy protocols like POP, IMAP, MAPI',
      },
      {
        order: 4,
        title: 'Disable per-user legacy auth (optional)',
        description: 'For additional security, disable legacy auth at the protocol level.',
        method: 'powershell',
        code: `# Connect to Exchange Online
Connect-ExchangeOnline

# Disable legacy auth for all mailboxes
Get-CASMailbox -ResultSize Unlimited | Set-CASMailbox \\
    -PopEnabled $false \\
    -ImapEnabled $false \\
    -SmtpClientAuthenticationDisabled $true

# Or for organization-wide:
Set-TransportConfig -SmtpClientAuthenticationDisabled $true`,
      },
    ],
    documentationLinks: [
      { title: 'Block legacy authentication', url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/block-legacy-authentication' },
      { title: 'Sign-in logs for legacy auth', url: 'https://learn.microsoft.com/en-us/entra/identity/monitoring-health/howto-use-sign-in-diagnostics' },
      { title: 'Disable basic auth in Exchange', url: 'https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/disable-basic-authentication-in-exchange-online' },
    ],
    rollbackSteps: [
      'Add users to the exception group temporarily',
      'Set Conditional Access policy to "Report-only" mode',
      'Re-enable SMTP AUTH for specific mailboxes if needed for scanning devices',
    ],
    verificationSteps: [
      'Attempt legacy auth from a test client - should be blocked',
      'Monitor sign-in logs for legacy auth attempts',
      'Verify no disruption to modern auth users',
    ],
  },

  'review-privileged-roles': {
    actionId: 'review-privileged-roles',
    title: 'Review Privileged Role Holders',
    overview: 'Excessive standing privilege is a major security risk. Implementing Privileged Identity Management (PIM) provides just-in-time access and reduces the attack surface.',
    prerequisites: [
      'Azure AD Premium P2 license',
      'Privileged Role Administrator role',
      'Approved list of permanent admins',
    ],
    estimatedTime: '1-2 hours',
    difficulty: 'medium',
    steps: [
      {
        order: 1,
        title: 'Audit current privileged role assignments',
        description: 'List all users with privileged admin roles.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "RoleManagement.Read.All", "Directory.Read.All"

# Get all directory roles
$roles = Get-MgDirectoryRole -All

# High-privilege roles to audit
$privilegedRoles = @(
    "Global Administrator",
    "Privileged Role Administrator",
    "Security Administrator",
    "Exchange Administrator",
    "SharePoint Administrator",
    "User Administrator",
    "Billing Administrator"
)

# Get members of each role
foreach ($role in $roles | Where-Object { $privilegedRoles -contains $_.DisplayName }) {
    Write-Host "\\n=== $($role.DisplayName) ===" -ForegroundColor Cyan
    $members = Get-MgDirectoryRoleMember -DirectoryRoleId $role.Id
    
    foreach ($member in $members) {
        $user = Get-MgUser -UserId $member.Id
        Write-Host "  - $($user.DisplayName) ($($user.UserPrincipalName))"
    }
}`,
      },
      {
        order: 2,
        title: 'Identify reduction opportunities',
        description: 'Determine which users need standing access vs. eligible access.',
        method: 'manual',
        notes: 'Best practice: Only 2-4 Global Admins with standing access. All others should use PIM for just-in-time elevation.',
      },
      {
        order: 3,
        title: 'Configure PIM for eligible roles',
        description: 'Set up Privileged Identity Management for just-in-time access.',
        method: 'portal',
        portalUrl: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ResourceMenuBlade/~/roles/resourceId//resourceType/tenant/provider/aadroles',
        notes: 'Navigate to Identity Governance > Privileged Identity Management > Azure AD roles',
      },
      {
        order: 4,
        title: 'Convert assignments to eligible',
        description: 'Change permanent assignments to PIM-eligible assignments.',
        method: 'graph-api',
        code: `// Remove permanent assignment
// DELETE https://graph.microsoft.com/v1.0/directoryRoles/{role-id}/members/{user-id}/$ref

// Create eligible assignment via PIM
// POST https://graph.microsoft.com/v1.0/roleManagement/directory/roleEligibilityScheduleRequests
{
  "action": "AdminAssign",
  "justification": "Converting to just-in-time access",
  "roleDefinitionId": "{role-definition-id}",
  "directoryScopeId": "/",
  "principalId": "{user-id}",
  "scheduleInfo": {
    "startDateTime": "2024-01-01T00:00:00Z",
    "expiration": {
      "type": "noExpiration"
    }
  }
}`,
      },
      {
        order: 5,
        title: 'Configure PIM settings',
        description: 'Set approval requirements and maximum activation duration.',
        method: 'portal',
        portalUrl: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ResourceMenuBlade/~/roles/resourceId//resourceType/tenant/provider/aadroles',
        notes: 'Recommended: Require MFA, justification, and approval for Global Admin activation. Max 8-hour activation.',
      },
    ],
    documentationLinks: [
      { title: 'Privileged Identity Management', url: 'https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure' },
      { title: 'PIM for Azure AD roles', url: 'https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-how-to-add-role-to-user' },
      { title: 'Securing privileged access', url: 'https://learn.microsoft.com/en-us/security/privileged-access-workstations/overview' },
    ],
    rollbackSteps: [
      'Convert eligible assignments back to permanent if needed',
      'Add users directly to directory roles for immediate access',
      'Adjust PIM settings to reduce friction if too restrictive',
    ],
    verificationSteps: [
      'Test PIM activation flow with a test admin',
      'Verify approval workflow functions correctly',
      'Check PIM audit logs for activation events',
      'Re-run privileged role audit to confirm reduction',
    ],
  },

  'reclaim-unused-licenses': {
    actionId: 'reclaim-unused-licenses',
    title: 'Reclaim Unused Licenses',
    overview: 'Licenses assigned to inactive users represent wasted spend. Regular reclamation of unused licenses can result in significant cost savings.',
    prerequisites: [
      'License Administrator or User Administrator role',
      'Access to sign-in activity reports',
      'Process for handling departures/leaves',
    ],
    estimatedTime: '30-60 minutes',
    difficulty: 'easy',
    steps: [
      {
        order: 1,
        title: 'Identify inactive licensed users',
        description: 'Find users with licenses who have not signed in for 60+ days.',
        method: 'powershell',
        code: `# Connect to Microsoft Graph
Connect-MgGraph -Scopes "User.Read.All", "AuditLog.Read.All"

# Calculate threshold (60 days ago)
$threshold = (Get-Date).AddDays(-60)

# Get all licensed users
$licensedUsers = Get-MgUser -Filter "assignedLicenses/\$count ne 0" -All \\
    -Property Id, DisplayName, UserPrincipalName, SignInActivity, AssignedLicenses, AccountEnabled

# Find inactive users
$inactiveUsers = $licensedUsers | Where-Object {
    $lastSignIn = $_.SignInActivity.LastSignInDateTime
    $_.AccountEnabled -eq $true -and (
        (-not $lastSignIn) -or ([DateTime]$lastSignIn -lt $threshold)
    )
}

# Calculate potential savings
$skuPrices = @{
    "c7df2760-2c81-4ef7-b578-5b5392b571df" = 57  # E5
    "05e9a617-0261-4cee-bb44-138d3ef5d965" = 38  # E3
    "3b555118-da6a-4418-894f-7df1e2096870" = 22  # Business Premium
}

$totalSavings = 0
foreach ($user in $inactiveUsers) {
    foreach ($license in $user.AssignedLicenses) {
        if ($skuPrices.ContainsKey($license.SkuId)) {
            $totalSavings += $skuPrices[$license.SkuId]
        }
    }
}

Write-Host "Found $($inactiveUsers.Count) inactive users with licenses" -ForegroundColor Yellow
Write-Host "Potential monthly savings: \$$totalSavings" -ForegroundColor Green

# Export for review
$inactiveUsers | Select-Object DisplayName, UserPrincipalName, @{
    Name='LastSignIn'
    Expression={$_.SignInActivity.LastSignInDateTime}
}, @{
    Name='LicenseCount'
    Expression={$_.AssignedLicenses.Count}
} | Export-Csv "InactiveLicensedUsers.csv" -NoTypeInformation`,
      },
      {
        order: 2,
        title: 'Verify user status',
        description: 'Confirm users are truly inactive and not on leave or special assignment.',
        method: 'manual',
        notes: 'Check with HR/managers for: Leave of absence, Contractors with project gaps, Service accounts that may not sign in',
      },
      {
        order: 3,
        title: 'Remove licenses from inactive users',
        description: 'Remove licenses from confirmed inactive accounts.',
        method: 'powershell',
        code: `# Connect with write permissions
Connect-MgGraph -Scopes "User.ReadWrite.All"

# Import approved list
$usersToUnlicense = Import-Csv "ApprovedForLicenseRemoval.csv"

foreach ($user in $usersToUnlicense) {
    try {
        # Get current licenses
        $currentUser = Get-MgUser -UserId $user.UserPrincipalName -Property AssignedLicenses
        $licensesToRemove = $currentUser.AssignedLicenses.SkuId
        
        # Remove all licenses
        Set-MgUserLicense -UserId $user.UserPrincipalName \\
            -AddLicenses @() \\
            -RemoveLicenses $licensesToRemove
        
        Write-Host "Removed licenses from: $($user.UserPrincipalName)" -ForegroundColor Green
    } catch {
        Write-Host "Failed for $($user.UserPrincipalName): $_" -ForegroundColor Red
    }
}`,
      },
      {
        order: 4,
        title: 'Set up automated reporting',
        description: 'Create a recurring report to identify inactive users monthly.',
        method: 'portal',
        portalUrl: 'https://admin.microsoft.com/Adminportal/Home#/reportsUsage',
        notes: 'Schedule the "Inactive users" report to run monthly and email to IT team',
      },
    ],
    documentationLinks: [
      { title: 'Manage licenses', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/manage/remove-licenses-from-users' },
      { title: 'Find inactive users', url: 'https://learn.microsoft.com/en-us/entra/identity/users/clean-up-unmanaged-accounts' },
      { title: 'License usage reports', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/activity-reports/microsoft-365-reports-in-the-admin-center' },
    ],
    rollbackSteps: [
      'Re-assign licenses if user returns or was incorrectly identified',
      'Use Set-MgUserLicense to add back specific SKUs',
      'Keep record of removed licenses for quick restoration',
    ],
    verificationSteps: [
      'Verify license count in admin center decreased',
      'Confirm no active users were impacted',
      'Calculate and document actual savings',
      'Check for any user complaints',
    ],
  },
};

// Helper function to get a guide by action ID
export function getRemediationGuide(actionId: string): RemediationGuide | null {
  return REMEDIATION_GUIDES[actionId] || null;
}

// Get all available guide IDs
export function getAvailableGuideIds(): string[] {
  return Object.keys(REMEDIATION_GUIDES);
}

// Search guides by keyword
export function searchRemediationGuides(query: string): RemediationGuide[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(REMEDIATION_GUIDES).filter(guide =>
    guide.title.toLowerCase().includes(lowerQuery) ||
    guide.overview.toLowerCase().includes(lowerQuery)
  );
}
