// Hawk M365 Incident Response & Threat Hunting — Static reference data
// Based on T0pCyber/hawk PowerShell module v4.x

export interface HawkCommand {
  id: string;
  name: string;
  cmdlet: string;
  category: 'tenant' | 'user' | 'message' | 'setup';
  description: string;
  parameters: HawkParameter[];
  output: string;
  example: string;
  notes?: string;
}

export interface HawkParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface InvestigationPlaybook {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  scenario: string;
  description: string;
  steps: PlaybookStep[];
  indicators: string[];
  relatedCommands: string[];
}

export interface PlaybookStep {
  order: number;
  title: string;
  description: string;
  command?: string;
  expectedOutput?: string;
  redFlags?: string[];
}

export interface HawkPrerequisite {
  id: string;
  title: string;
  description: string;
  command?: string;
  required: boolean;
}

// ── Hawk Commands Reference ──────────────────────────────────────────

export const hawkCommands: HawkCommand[] = [
  // Setup
  {
    id: 'install-hawk',
    name: 'Install Hawk',
    cmdlet: 'Install-Module -Name Hawk -Force',
    category: 'setup',
    description: 'Install the Hawk module from the PowerShell Gallery.',
    parameters: [],
    output: 'Module installed to PowerShell modules directory',
    example: 'Install-Module -Name Hawk -Force -Scope CurrentUser',
    notes: 'Requires PowerShell 5.0+ and admin rights for AllUsers scope.',
  },
  {
    id: 'start-hawk',
    name: 'Initialize Hawk',
    cmdlet: 'Start-HawkTenantInvestigation',
    category: 'setup',
    description: 'Initialize Hawk, authenticate to M365, and set the output directory and date range for the investigation.',
    parameters: [
      { name: 'DaysToLookBack', type: 'Int32', required: false, description: 'Number of days of logs to pull (default 90)', defaultValue: '90' },
      { name: 'FilePath', type: 'String', required: false, description: 'Output folder for investigation files' },
    ],
    output: 'Creates output directory structure and authenticates to M365 services',
    example: 'Start-HawkTenantInvestigation -DaysToLookBack 30',
  },

  // Tenant-level
  {
    id: 'tenant-investigation',
    name: 'Tenant Investigation',
    cmdlet: 'Start-HawkTenantInvestigation',
    category: 'tenant',
    description: 'Run a comprehensive tenant-wide investigation. Collects admin audit logs, Entra ID sign-in data, consent grants, inbox rules, mail forwarding, and transport rules across the entire tenant.',
    parameters: [
      { name: 'DaysToLookBack', type: 'Int32', required: false, description: 'Days of history to examine', defaultValue: '90' },
    ],
    output: 'CSV & XML files for each data type in the output directory',
    example: 'Start-HawkTenantInvestigation -DaysToLookBack 30',
    notes: 'Can take significant time depending on tenant size and date range.',
  },
  {
    id: 'get-tenant-config',
    name: 'Get Tenant Configuration',
    cmdlet: 'Get-HawkTenantConfiguration',
    category: 'tenant',
    description: 'Retrieve tenant-level security configuration including organization config, authentication policies, domain settings, and transport rules.',
    parameters: [],
    output: 'Tenant configuration details exported to CSV/XML',
    example: 'Get-HawkTenantConfiguration',
  },
  {
    id: 'get-tenant-edr',
    name: 'Get Entra ID Configuration',
    cmdlet: 'Get-HawkTenantEntraIDConfiguration',
    category: 'tenant',
    description: 'Collect Entra ID (Azure AD) security configuration: conditional access policies, directory roles, app registrations, service principals, and consent grants.',
    parameters: [],
    output: 'Entra ID configuration exported to investigation folder',
    example: 'Get-HawkTenantEntraIDConfiguration',
  },
  {
    id: 'get-consent-grants',
    name: 'Get Consent Grants',
    cmdlet: 'Get-HawkTenantConsentGrant',
    category: 'tenant',
    description: 'Retrieve all OAuth consent grants in the tenant. Identifies potentially malicious app consent attacks where attackers trick users into granting access to rogue applications.',
    parameters: [],
    output: 'List of all consent grants with app details and permissions',
    example: 'Get-HawkTenantConsentGrant',
    notes: 'Critical for detecting illicit consent grant attacks.',
  },
  {
    id: 'get-admin-audit',
    name: 'Get Admin Audit Logs',
    cmdlet: 'Get-HawkTenantAZAdminAuditLog',
    category: 'tenant',
    description: 'Pull the Azure/Entra ID admin audit log to identify administrative changes made during the investigation period.',
    parameters: [],
    output: 'Admin audit log events in CSV format',
    example: 'Get-HawkTenantAZAdminAuditLog',
  },
  {
    id: 'get-inbox-rules',
    name: 'Get Inbox Rules (Tenant)',
    cmdlet: 'Get-HawkTenantInboxRules',
    category: 'tenant',
    description: 'Scan all mailboxes in the tenant for suspicious inbox rules that forward, delete, or redirect email — a common persistence mechanism.',
    parameters: [],
    output: 'All inbox rules across the tenant with flagged suspicious rules',
    example: 'Get-HawkTenantInboxRules',
    notes: 'Attackers frequently create rules to forward copies of email to external addresses.',
  },
  {
    id: 'get-mail-forwarding',
    name: 'Get Mail Forwarding',
    cmdlet: 'Get-HawkTenantMailForwarding',
    category: 'tenant',
    description: 'Check all mailboxes for mail forwarding rules configured at the mailbox level (ForwardingSmtpAddress, ForwardingAddress, DeliverToMailboxAndForward).',
    parameters: [],
    output: 'Forwarding configuration for all tenant mailboxes',
    example: 'Get-HawkTenantMailForwarding',
  },

  // User-level
  {
    id: 'user-investigation',
    name: 'User Investigation',
    cmdlet: 'Start-HawkUserInvestigation',
    category: 'user',
    description: 'Perform a comprehensive investigation of a specific user account. Collects sign-in history, mailbox audit logs, inbox rules, mail forwarding, and delegate permissions.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String[]', required: true, description: 'UPN of the user(s) to investigate' },
    ],
    output: 'User-specific investigation files organized by user',
    example: 'Start-HawkUserInvestigation -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-signin',
    name: 'Get User Sign-In Logs',
    cmdlet: 'Get-HawkUserSignInLog',
    category: 'user',
    description: 'Retrieve sign-in logs for a specific user to identify suspicious logins, impossible travel, or sign-ins from unfamiliar locations or devices.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'Sign-in log entries with location, device, app, and status details',
    example: 'Get-HawkUserSignInLog -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-inbox-rules',
    name: 'Get User Inbox Rules',
    cmdlet: 'Get-HawkUserInboxRule',
    category: 'user',
    description: 'Retrieve inbox rules for a specific user to detect auto-forwarding, deletion, or mark-as-read rules that may indicate compromise.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'Inbox rules with flagged suspicious patterns',
    example: 'Get-HawkUserInboxRule -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-mailbox-audit',
    name: 'Get Mailbox Audit Log',
    cmdlet: 'Get-HawkUserMailboxAuditLog',
    category: 'user',
    description: 'Pull mailbox audit logs for a user to see what actions were performed — message access, deletions, folder changes, and send-as operations.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'Mailbox audit events with timestamps and client info',
    example: 'Get-HawkUserMailboxAuditLog -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-email-forwarding',
    name: 'Get User Email Forwarding',
    cmdlet: 'Get-HawkUserEmailForwarding',
    category: 'user',
    description: 'Check whether a specific user has email forwarding configured to an external or internal address.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'Forwarding status and destination address',
    example: 'Get-HawkUserEmailForwarding -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-admin-audit',
    name: 'Get User Admin Changes',
    cmdlet: 'Get-HawkUserAdminAudit',
    category: 'user',
    description: 'Pull admin audit log entries related to a specific user to see what administrative changes were made to their account.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'Admin changes affecting the specified user',
    example: 'Get-HawkUserAdminAudit -UserPrincipalName user@contoso.com',
  },
  {
    id: 'get-user-mobile-devices',
    name: 'Get User Mobile Devices',
    cmdlet: 'Get-HawkUserMobileDevice',
    category: 'user',
    description: 'List mobile devices associated with a user account to identify unknown or suspicious device enrollments.',
    parameters: [
      { name: 'UserPrincipalName', type: 'String', required: true, description: 'UPN of the user' },
    ],
    output: 'List of enrolled mobile devices with model, OS, and last sync',
    example: 'Get-HawkUserMobileDevice -UserPrincipalName user@contoso.com',
  },

  // Message Trace
  {
    id: 'get-message-trace',
    name: 'Get Message Trace',
    cmdlet: 'Get-HawkMessageHeader',
    category: 'message',
    description: 'Trace email message headers to analyze delivery path, SPF/DKIM/DMARC results, and identify spoofed or malicious messages.',
    parameters: [
      { name: 'MessageId', type: 'String', required: true, description: 'Internet Message ID to trace' },
    ],
    output: 'Full message header analysis with authentication results',
    example: 'Get-HawkMessageHeader -MessageId "<msgid@contoso.com>"',
  },
];

// ── Investigation Playbooks ──────────────────────────────────────────

export const investigationPlaybooks: InvestigationPlaybook[] = [
  {
    id: 'bec-investigation',
    title: 'Business Email Compromise (BEC)',
    severity: 'critical',
    scenario: 'A user reports sending/receiving suspicious emails, or finance reports a fraudulent wire transfer request.',
    description: 'Investigate potential BEC attack where an attacker gains access to a business email account to conduct fraud.',
    indicators: [
      'Unusual sign-in locations or impossible travel',
      'New inbox rules forwarding email externally',
      'Mailbox delegation changes',
      'Emails sent from the account that the user denies sending',
      'Password reset or MFA changes the user didn\'t initiate',
    ],
    relatedCommands: ['user-investigation', 'get-user-signin', 'get-user-inbox-rules', 'get-user-email-forwarding', 'get-user-mailbox-audit'],
    steps: [
      {
        order: 1,
        title: 'Initialize Investigation',
        description: 'Set up Hawk and authenticate to the tenant.',
        command: 'Start-HawkTenantInvestigation -DaysToLookBack 90',
      },
      {
        order: 2,
        title: 'Investigate the Compromised User',
        description: 'Run a full user investigation to collect sign-in logs, inbox rules, and mailbox audit data.',
        command: 'Start-HawkUserInvestigation -UserPrincipalName compromised@contoso.com',
        redFlags: ['Sign-ins from foreign IPs', 'New inbox rules created during the incident window', 'Forwarding to external domains'],
      },
      {
        order: 3,
        title: 'Check Sign-In Anomalies',
        description: 'Review the sign-in log for impossible travel, unfamiliar devices, or sign-ins from anonymizing services.',
        command: 'Get-HawkUserSignInLog -UserPrincipalName compromised@contoso.com',
        expectedOutput: 'Review _Investigate files for flagged sign-ins',
        redFlags: ['VPN/Tor exit nodes', 'Sign-ins from countries where the user hasn\'t traveled', 'Multiple failed attempts followed by success'],
      },
      {
        order: 4,
        title: 'Inspect Inbox Rules',
        description: 'Check for malicious inbox rules that forward, delete, or hide emails.',
        command: 'Get-HawkUserInboxRule -UserPrincipalName compromised@contoso.com',
        redFlags: ['Rules forwarding to external addresses', 'Rules deleting specific keywords (invoice, payment, wire)', 'Rules marking messages as read automatically'],
      },
      {
        order: 5,
        title: 'Check Mail Forwarding',
        description: 'Verify if mailbox-level forwarding was configured.',
        command: 'Get-HawkUserEmailForwarding -UserPrincipalName compromised@contoso.com',
        redFlags: ['ForwardingSmtpAddress set to external domain', 'DeliverToMailboxAndForward enabled'],
      },
      {
        order: 6,
        title: 'Review Mailbox Audit',
        description: 'Examine what the attacker did inside the mailbox.',
        command: 'Get-HawkUserMailboxAuditLog -UserPrincipalName compromised@contoso.com',
        redFlags: ['SendAs or SendOnBehalf actions', 'Mass email reads or deletions', 'Folder bind operations from unknown clients'],
      },
      {
        order: 7,
        title: 'Document and Remediate',
        description: 'Reset password, revoke sessions, remove malicious rules, and document findings.',
      },
    ],
  },
  {
    id: 'consent-phishing',
    title: 'Illicit Consent Grant Attack',
    severity: 'critical',
    scenario: 'A user clicked a link that prompted them to grant permissions to an unknown application.',
    description: 'Investigate an OAuth consent phishing attack where users are tricked into granting access to malicious third-party applications.',
    indicators: [
      'Users received phishing email with app consent link',
      'Unknown applications with broad permissions in Entra ID',
      'Suspicious OAuth tokens being used to access data',
      'Data exfiltration through Graph API calls',
    ],
    relatedCommands: ['get-consent-grants', 'tenant-investigation', 'get-tenant-edr'],
    steps: [
      {
        order: 1,
        title: 'Initialize and Collect Tenant Data',
        command: 'Start-HawkTenantInvestigation -DaysToLookBack 30',
        description: 'Initialize Hawk and begin tenant-wide data collection.',
      },
      {
        order: 2,
        title: 'Review Consent Grants',
        command: 'Get-HawkTenantConsentGrant',
        description: 'List all OAuth consent grants and identify unknown or overly-permissive applications.',
        redFlags: ['Apps with Mail.Read, Mail.ReadWrite, or Files.ReadWrite.All', 'Apps registered in external tenants', 'Recently granted permissions matching the attack timeline'],
      },
      {
        order: 3,
        title: 'Check Entra ID Configuration',
        command: 'Get-HawkTenantEntraIDConfiguration',
        description: 'Review Entra ID settings — check if users can consent to apps without admin approval.',
        redFlags: ['User consent enabled for all apps', 'No app consent policy configured'],
      },
      {
        order: 4,
        title: 'Investigate Affected Users',
        description: 'For each user who granted consent, run a user investigation.',
        command: 'Start-HawkUserInvestigation -UserPrincipalName affected@contoso.com',
        redFlags: ['Data access patterns from the malicious app', 'Unusual Graph API activity'],
      },
      {
        order: 5,
        title: 'Revoke and Block',
        description: 'Remove the malicious app registration, revoke consent grants, and block the app tenant-wide.',
      },
    ],
  },
  {
    id: 'mail-forwarding-exfil',
    title: 'Email Forwarding & Data Exfiltration',
    severity: 'high',
    scenario: 'Security team suspects sensitive data is being exfiltrated via email forwarding rules.',
    description: 'Investigate tenant-wide email forwarding to detect unauthorized data exfiltration through inbox rules or transport rules.',
    indicators: [
      'Emails being forwarded to external domains',
      'New transport rules routing email externally',
      'Users reporting missing emails',
      'Unexpected auto-forwarding configurations',
    ],
    relatedCommands: ['get-inbox-rules', 'get-mail-forwarding', 'tenant-investigation'],
    steps: [
      {
        order: 1,
        title: 'Scan Tenant Inbox Rules',
        command: 'Get-HawkTenantInboxRules',
        description: 'Scan all mailboxes for inbox rules, focusing on rules that forward or redirect mail.',
        redFlags: ['Rules forwarding to external domains', 'Rules with broad conditions (all incoming mail)', 'Recently created rules during the incident window'],
      },
      {
        order: 2,
        title: 'Check Mailbox Forwarding',
        command: 'Get-HawkTenantMailForwarding',
        description: 'Review mailbox-level forwarding settings across the tenant.',
        redFlags: ['ForwardingSmtpAddress pointing to free email providers', 'Multiple mailboxes forwarding to the same external address'],
      },
      {
        order: 3,
        title: 'Review Transport Rules',
        command: 'Get-HawkTenantConfiguration',
        description: 'Check transport rules for blind carbon copy (BCC) or journaling to external addresses.',
        redFlags: ['BCC rules to external domains', 'New transport rules created during the incident period'],
      },
      {
        order: 4,
        title: 'Investigate Specific Users',
        description: 'Deep-dive into users with suspicious forwarding.',
        command: 'Start-HawkUserInvestigation -UserPrincipalName suspect@contoso.com',
      },
      {
        order: 5,
        title: 'Remediate',
        description: 'Remove malicious rules, disable external forwarding at org level if needed, and notify affected users.',
      },
    ],
  },
  {
    id: 'compromised-admin',
    title: 'Compromised Admin Account',
    severity: 'critical',
    scenario: 'An administrator account shows signs of compromise — unexpected config changes, new admin users, or MFA modifications.',
    description: 'Investigate a potentially compromised Global Admin or privileged role account.',
    indicators: [
      'Unauthorized role assignments',
      'New Global Admin accounts created',
      'Conditional Access policies disabled',
      'MFA reset for privileged accounts',
      'Unusual admin audit log entries',
    ],
    relatedCommands: ['get-admin-audit', 'get-tenant-edr', 'user-investigation', 'get-user-signin'],
    steps: [
      {
        order: 1,
        title: 'Pull Admin Audit Logs',
        command: 'Get-HawkTenantAZAdminAuditLog',
        description: 'Collect all admin changes to identify unauthorized modifications.',
        redFlags: ['New admin role assignments', 'Conditional Access policy changes', 'New app registrations with high-privilege permissions'],
      },
      {
        order: 2,
        title: 'Investigate the Admin User',
        command: 'Start-HawkUserInvestigation -UserPrincipalName admin@contoso.com',
        description: 'Full investigation of the compromised admin account.',
      },
      {
        order: 3,
        title: 'Review Sign-In Logs',
        command: 'Get-HawkUserSignInLog -UserPrincipalName admin@contoso.com',
        description: 'Check for anomalous sign-in patterns.',
        redFlags: ['Sign-ins from new locations/devices', 'Legacy authentication usage', 'Sign-ins immediately after MFA reset'],
      },
      {
        order: 4,
        title: 'Check Entra ID Changes',
        command: 'Get-HawkTenantEntraIDConfiguration',
        description: 'Verify the current state of Entra ID configuration for any backdoors.',
        redFlags: ['New service principals or app registrations', 'Modified Conditional Access policies', 'Disabled security defaults'],
      },
      {
        order: 5,
        title: 'Remediate',
        description: 'Reset all admin credentials, revoke sessions, review and revert config changes, enable PIM if available.',
      },
    ],
  },
  {
    id: 'general-triage',
    title: 'General Incident Triage',
    severity: 'medium',
    scenario: 'Security alert or SOC escalation requiring initial M365 triage — no specific incident type yet.',
    description: 'A general-purpose investigation workflow to quickly assess the security state of a tenant or user.',
    indicators: [
      'Security alert from Microsoft Defender',
      'User-reported suspicious activity',
      'SOC escalation for M365 environment',
    ],
    relatedCommands: ['tenant-investigation', 'user-investigation'],
    steps: [
      {
        order: 1,
        title: 'Run Full Tenant Investigation',
        command: 'Start-HawkTenantInvestigation -DaysToLookBack 30',
        description: 'Collect all available tenant-level data to get a broad picture.',
      },
      {
        order: 2,
        title: 'Review Flagged Files',
        description: 'Examine the output folder for any files with "_Investigate" in the name — these indicate findings that need attention.',
        redFlags: ['Any file named *_Investigate*', 'Multiple users with flagged inbox rules'],
      },
      {
        order: 3,
        title: 'Investigate Flagged Users',
        description: 'For each user identified in the tenant investigation, run a targeted user investigation.',
        command: 'Start-HawkUserInvestigation -UserPrincipalName flagged@contoso.com',
      },
      {
        order: 4,
        title: 'Determine Scope and Escalate',
        description: 'Based on findings, classify the incident type and follow the appropriate specialized playbook.',
      },
    ],
  },
];

// ── Prerequisites ────────────────────────────────────────────────────

export const hawkPrerequisites: HawkPrerequisite[] = [
  { id: 'ps-version', title: 'PowerShell 5.0+', description: 'Hawk requires PowerShell 5.0 or later. PowerShell 7.x is recommended.', command: '$PSVersionTable.PSVersion', required: true },
  { id: 'install-module', title: 'Install Hawk Module', description: 'Install the Hawk module from the PowerShell Gallery.', command: 'Install-Module -Name Hawk -Force -Scope CurrentUser', required: true },
  { id: 'exo-module', title: 'Exchange Online Module', description: 'Exchange Online Management module v3+ is required for mailbox operations.', command: 'Install-Module -Name ExchangeOnlineManagement -Force', required: true },
  { id: 'graph-module', title: 'Microsoft Graph Module', description: 'Microsoft Graph PowerShell SDK for Entra ID operations.', command: 'Install-Module -Name Microsoft.Graph -Force', required: true },
  { id: 'permissions', title: 'Required Permissions', description: 'Global Reader or Security Reader role for read-only investigation. Global Admin for full access.', required: true },
  { id: 'audit-logging', title: 'Unified Audit Logging', description: 'Ensure Unified Audit Logging is enabled in the tenant. Without it, Hawk cannot pull audit data.', command: 'Get-AdminAuditLogConfig | Select UnifiedAuditLogIngestionEnabled', required: true },
  { id: 'mailbox-audit', title: 'Mailbox Auditing', description: 'Mailbox auditing should be enabled (it is by default since 2019, but verify).', command: 'Get-OrganizationConfig | Select AuditDisabled', required: false },
];

// ── Hawk Output File Descriptions ────────────────────────────────────

export interface HawkOutputFile {
  filename: string;
  description: string;
  investigateFlag: boolean;
  category: string;
}

export const hawkOutputFiles: HawkOutputFile[] = [
  { filename: 'Simple_Admin_Audit.csv', description: 'Simplified view of admin audit log entries', investigateFlag: false, category: 'Tenant' },
  { filename: 'Admin_Audit.csv', description: 'Full admin audit log with all details', investigateFlag: false, category: 'Tenant' },
  { filename: 'Consent_Grants.csv', description: 'OAuth app consent grants in the tenant', investigateFlag: true, category: 'Tenant' },
  { filename: 'Tenant_InboxRules.csv', description: 'All inbox rules across all mailboxes', investigateFlag: true, category: 'Tenant' },
  { filename: 'Tenant_MailForwarding.csv', description: 'Mailbox forwarding configurations', investigateFlag: true, category: 'Tenant' },
  { filename: 'Transport_Rules.csv', description: 'Exchange transport rules', investigateFlag: false, category: 'Tenant' },
  { filename: 'Domain_Info.csv', description: 'Tenant domain information and DNS records', investigateFlag: false, category: 'Tenant' },
  { filename: 'User_SignIn_Log.csv', description: 'User sign-in events with location and device', investigateFlag: true, category: 'User' },
  { filename: 'User_InboxRules.csv', description: 'Inbox rules for a specific user', investigateFlag: true, category: 'User' },
  { filename: 'User_MailForwarding.csv', description: 'Forwarding settings for a specific mailbox', investigateFlag: true, category: 'User' },
  { filename: 'User_MailboxAudit.csv', description: 'Mailbox audit log entries', investigateFlag: false, category: 'User' },
  { filename: 'User_AdminAudit.csv', description: 'Admin actions affecting a specific user', investigateFlag: false, category: 'User' },
  { filename: 'User_MobileDevices.csv', description: 'Mobile devices registered to the user', investigateFlag: false, category: 'User' },
];
