import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  reportId: string;
  reportType: string;
  templateId?: string;
  templateCategory?: string;
  customerId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

// Generate realistic sample data based on template category
function generateTemplateData(templateId: string, templateCategory: string): Record<string, unknown> {
  const now = new Date().toISOString();
  
  // Helper to generate random metrics
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randPercent = () => rand(60, 100);
  
  switch (templateCategory) {
    case 'security': {
      return {
        summary: {
          overallSecurityScore: rand(70, 95),
          criticalIssues: rand(0, 3),
          highIssues: rand(1, 8),
          mediumIssues: rand(5, 20),
          lowIssues: rand(10, 40),
          policiesEnabled: rand(15, 30),
          policiesTotal: rand(25, 35),
          mfaCoverage: randPercent(),
          conditionalAccessCoverage: randPercent(),
        },
        findings: [
          { severity: 'critical', resourceType: 'Conditional Access', resourceName: 'Baseline Protection Policy', message: 'Policy is disabled - users not protected', ruleName: 'conditional_access_disabled' },
          { severity: 'high', resourceType: 'User', resourceName: 'admin@contoso.com', message: 'Admin account missing MFA registration', ruleName: 'admin_mfa_missing' },
          { severity: 'high', resourceType: 'Application', resourceName: 'Legacy Mail Client', message: 'Legacy authentication protocols allowed', ruleName: 'legacy_auth_enabled' },
          { severity: 'medium', resourceType: 'Device', resourceName: 'DESKTOP-ABC123', message: 'Device compliance policy not applied', ruleName: 'device_compliance' },
          { severity: 'medium', resourceType: 'SharePoint', resourceName: 'Public Documents', message: 'Anonymous sharing enabled', ruleName: 'anonymous_sharing' },
          { severity: 'low', resourceType: 'Group', resourceName: 'Marketing Team', message: 'Group missing classification label', ruleName: 'missing_label' },
        ],
        recommendations: [
          'Enable all disabled Conditional Access policies to ensure user protection',
          'Enforce MFA registration for all administrator accounts immediately',
          'Block legacy authentication protocols tenant-wide',
          'Apply device compliance policies to all managed devices',
          'Restrict anonymous sharing on SharePoint sites',
        ],
        trendData: [
          { date: '2026-01-12', score: rand(65, 75) },
          { date: '2026-01-13', score: rand(70, 80) },
          { date: '2026-01-14', score: rand(72, 82) },
          { date: '2026-01-15', score: rand(75, 85) },
          { date: '2026-01-16', score: rand(78, 88) },
          { date: '2026-01-17', score: rand(80, 92) },
          { date: '2026-01-18', score: rand(82, 95) },
        ],
        generatedAt: now,
      };
    }
    
    case 'compliance': {
      return {
        summary: {
          overallComplianceScore: rand(75, 98),
          totalChecks: rand(150, 300),
          passedChecks: rand(130, 280),
          failedChecks: rand(5, 25),
          frameworks: ['CIS Microsoft 365', 'NIST 800-53', 'ISO 27001'],
          lastAssessment: now,
        },
        complianceByFramework: [
          { framework: 'CIS Microsoft 365', score: randPercent(), passed: rand(40, 50), total: 52 },
          { framework: 'NIST 800-53', score: randPercent(), passed: rand(80, 95), total: 100 },
          { framework: 'ISO 27001', score: randPercent(), passed: rand(55, 65), total: 70 },
        ],
        failedControls: [
          { controlId: 'CIS-1.1.3', control: 'Ensure MFA is enabled for all users', severity: 'high', remediation: 'Enable MFA through Conditional Access policy' },
          { controlId: 'CIS-2.1.1', control: 'Ensure audit log search is enabled', severity: 'medium', remediation: 'Enable unified audit logging in compliance center' },
          { controlId: 'NIST-AC-2', control: 'Account Management', severity: 'medium', remediation: 'Review and remove stale accounts' },
          { controlId: 'ISO-A.9.2.1', control: 'User Registration and De-registration', severity: 'low', remediation: 'Implement automated provisioning' },
        ],
        history: [
          { date: '2026-01-10', score: rand(70, 80) },
          { date: '2026-01-12', score: rand(75, 85) },
          { date: '2026-01-14', score: rand(78, 88) },
          { date: '2026-01-16', score: rand(80, 92) },
          { date: '2026-01-18', score: rand(82, 98) },
        ],
        recommendations: [
          'Address high-severity control failures within 24 hours',
          'Schedule quarterly compliance assessments',
          'Implement automated compliance monitoring',
          'Document exceptions with business justification',
        ],
        generatedAt: now,
      };
    }
    
    case 'identity': {
      return {
        summary: {
          totalUsers: rand(500, 5000),
          activeUsers: rand(400, 4500),
          guestUsers: rand(50, 300),
          adminUsers: rand(5, 25),
          usersWithMFA: rand(350, 4200),
          mfaCoveragePercent: randPercent(),
          staleAccounts: rand(10, 100),
          riskyUsers: rand(0, 10),
        },
        userBreakdown: {
          byType: [
            { type: 'Member', count: rand(400, 4000) },
            { type: 'Guest', count: rand(50, 300) },
            { type: 'Admin', count: rand(5, 25) },
          ],
          byDepartment: [
            { department: 'Engineering', count: rand(50, 200) },
            { department: 'Sales', count: rand(40, 150) },
            { department: 'Marketing', count: rand(30, 100) },
            { department: 'HR', count: rand(10, 50) },
            { department: 'Finance', count: rand(15, 60) },
          ],
          byLicense: [
            { license: 'Microsoft 365 E5', count: rand(50, 200) },
            { license: 'Microsoft 365 E3', count: rand(200, 500) },
            { license: 'Microsoft 365 Business', count: rand(100, 300) },
          ],
        },
        accessIssues: [
          { user: 'john.doe@contoso.com', issue: 'No MFA registered', severity: 'high', daysInactive: 0 },
          { user: 'jane.smith@contoso.com', issue: 'Stale account - no sign-in for 90+ days', severity: 'medium', daysInactive: 95 },
          { user: 'guest_user@external.com', issue: 'Guest access expiring soon', severity: 'low', daysInactive: 0 },
        ],
        recommendations: [
          'Enforce MFA for all users without registration',
          'Review and disable stale accounts monthly',
          'Implement access reviews for guest users',
          'Reduce permanent admin role assignments',
        ],
        generatedAt: now,
      };
    }
    
    case 'devices': {
      return {
        summary: {
          totalDevices: rand(300, 3000),
          compliantDevices: rand(250, 2800),
          nonCompliantDevices: rand(20, 200),
          complianceRate: randPercent(),
          managedDevices: rand(280, 2900),
          unmanaged: rand(10, 100),
        },
        deviceBreakdown: {
          byOS: [
            { os: 'Windows 11', count: rand(200, 1500), compliant: rand(180, 1400) },
            { os: 'Windows 10', count: rand(100, 800), compliant: rand(80, 700) },
            { os: 'macOS', count: rand(50, 400), compliant: rand(45, 380) },
            { os: 'iOS', count: rand(100, 500), compliant: rand(95, 480) },
            { os: 'Android', count: rand(50, 300), compliant: rand(40, 250) },
          ],
          byType: [
            { type: 'Desktop', count: rand(150, 1000) },
            { type: 'Laptop', count: rand(200, 1200) },
            { type: 'Mobile', count: rand(150, 800) },
            { type: 'Tablet', count: rand(20, 100) },
          ],
        },
        complianceIssues: [
          { device: 'DESKTOP-XYZ789', issue: 'Antivirus not up to date', user: 'user1@contoso.com', severity: 'high' },
          { device: 'LAPTOP-ABC456', issue: 'Encryption not enabled', user: 'user2@contoso.com', severity: 'critical' },
          { device: 'iPhone-12-Pro', issue: 'Jailbreak detected', user: 'user3@contoso.com', severity: 'critical' },
          { device: 'DESKTOP-DEF123', issue: 'OS not updated', user: 'user4@contoso.com', severity: 'medium' },
        ],
        recommendations: [
          'Enable BitLocker/FileVault on all devices immediately',
          'Update antivirus definitions across all endpoints',
          'Block jailbroken/rooted devices from accessing resources',
          'Implement automatic OS update policies',
        ],
        generatedAt: now,
      };
    }
    
    case 'exchange': {
      return {
        summary: {
          totalMailboxes: rand(400, 4000),
          activeMailboxes: rand(350, 3800),
          sharedMailboxes: rand(20, 150),
          mailFlowRules: rand(10, 50),
          quarantinedMessages: rand(100, 5000),
          spamBlocked: rand(5000, 50000),
        },
        mailboxStats: {
          bySize: [
            { range: '0-5GB', count: rand(100, 1000) },
            { range: '5-25GB', count: rand(150, 1500) },
            { range: '25-50GB', count: rand(50, 500) },
            { range: '50GB+', count: rand(10, 100) },
          ],
          byType: [
            { type: 'User', count: rand(350, 3500) },
            { type: 'Shared', count: rand(20, 150) },
            { type: 'Room', count: rand(10, 50) },
            { type: 'Equipment', count: rand(5, 30) },
          ],
        },
        securityMetrics: {
          externalForwarding: rand(0, 20),
          autoForwardRules: rand(5, 50),
          delegatedAccess: rand(30, 200),
          inboxRules: rand(100, 1000),
        },
        issues: [
          { type: 'External Forwarding', mailbox: 'sales@contoso.com', destination: 'personal@gmail.com', severity: 'high' },
          { type: 'Suspicious Rule', mailbox: 'finance@contoso.com', rule: 'Move invoices to deleted items', severity: 'critical' },
        ],
        recommendations: [
          'Disable external auto-forwarding for sensitive mailboxes',
          'Review and audit suspicious inbox rules',
          'Implement mail flow rules to block sensitive data exfiltration',
          'Enable advanced threat protection for all mailboxes',
        ],
        generatedAt: now,
      };
    }
    
    case 'sharepoint': {
      return {
        summary: {
          totalSites: rand(50, 500),
          activeSites: rand(40, 450),
          totalStorage: `${rand(500, 5000)} GB`,
          usedStorage: `${rand(200, 4000)} GB`,
          externalSharing: rand(100, 2000),
          anonymousLinks: rand(10, 200),
        },
        siteBreakdown: {
          byType: [
            { type: 'Team Sites', count: rand(30, 300) },
            { type: 'Communication Sites', count: rand(10, 100) },
            { type: 'Hub Sites', count: rand(2, 10) },
            { type: 'OneDrive', count: rand(400, 4000) },
          ],
          byActivity: [
            { activity: 'Very Active (daily)', count: rand(20, 150) },
            { activity: 'Active (weekly)', count: rand(30, 200) },
            { activity: 'Low Activity', count: rand(20, 100) },
            { activity: 'Inactive (90+ days)', count: rand(10, 50) },
          ],
        },
        sharingRisks: [
          { site: 'HR Documents', risk: 'Anonymous links to sensitive files', count: 5, severity: 'critical' },
          { site: 'Sales Reports', risk: 'External users with edit permissions', count: 12, severity: 'high' },
          { site: 'Marketing Assets', risk: 'Overly permissive sharing settings', count: 25, severity: 'medium' },
        ],
        recommendations: [
          'Disable anonymous sharing for sensitive sites',
          'Review and remove excessive external sharing permissions',
          'Implement sensitivity labels for document classification',
          'Enable data loss prevention policies',
        ],
        generatedAt: now,
      };
    }
    
    case 'teams': {
      return {
        summary: {
          totalTeams: rand(50, 500),
          activeTeams: rand(40, 450),
          totalChannels: rand(200, 2000),
          privateChannels: rand(20, 200),
          guestUsers: rand(30, 300),
          externalAccess: rand(10, 100),
        },
        teamsBreakdown: {
          byActivity: [
            { activity: 'Highly Active', count: rand(20, 150), messages: rand(10000, 50000) },
            { activity: 'Moderately Active', count: rand(30, 200), messages: rand(1000, 10000) },
            { activity: 'Low Activity', count: rand(20, 100), messages: rand(100, 1000) },
            { activity: 'Inactive', count: rand(10, 50), messages: 0 },
          ],
          bySize: [
            { size: '1-10 members', count: rand(20, 150) },
            { size: '11-50 members', count: rand(20, 150) },
            { size: '51-100 members', count: rand(5, 50) },
            { size: '100+ members', count: rand(2, 20) },
          ],
        },
        governance: {
          teamsWithOwners: rand(40, 450),
          orphanedTeams: rand(2, 20),
          teamsWithGuests: rand(20, 150),
          teamsWithExternalSharing: rand(10, 100),
        },
        recommendations: [
          'Assign owners to orphaned teams or archive them',
          'Review guest access in sensitive teams',
          'Implement naming conventions for team creation',
          'Enable team expiration policies for inactive teams',
        ],
        generatedAt: now,
      };
    }
    
    case 'licensing': {
      return {
        summary: {
          totalLicenses: rand(500, 5000),
          assignedLicenses: rand(400, 4500),
          availableLicenses: rand(50, 500),
          utilizationRate: randPercent(),
          monthlySpend: `$${rand(5000, 50000)}`,
          potentialSavings: `$${rand(500, 5000)}`,
        },
        licenseBreakdown: [
          { sku: 'Microsoft 365 E5', total: rand(100, 500), assigned: rand(80, 450), cost: rand(50, 60), savings: rand(1000, 5000) },
          { sku: 'Microsoft 365 E3', total: rand(200, 1000), assigned: rand(180, 950), cost: rand(30, 40), savings: rand(500, 2000) },
          { sku: 'Microsoft 365 Business Premium', total: rand(100, 500), assigned: rand(90, 480), cost: rand(20, 25), savings: rand(200, 1000) },
          { sku: 'Power BI Pro', total: rand(50, 200), assigned: rand(30, 150), cost: rand(10, 15), savings: rand(200, 1000) },
          { sku: 'Visio Plan 2', total: rand(20, 100), assigned: rand(10, 50), cost: rand(15, 20), savings: rand(100, 500) },
        ],
        unusedLicenses: [
          { sku: 'Power BI Pro', unused: rand(10, 50), monthlyWaste: `$${rand(100, 500)}` },
          { sku: 'Visio Plan 2', unused: rand(5, 30), monthlyWaste: `$${rand(75, 300)}` },
          { sku: 'Project Plan 3', unused: rand(3, 20), monthlyWaste: `$${rand(90, 400)}` },
        ],
        recommendations: [
          'Reclaim unused licenses to reduce costs',
          'Consider downgrading E5 to E3 for users not utilizing premium features',
          'Implement license assignment automation',
          'Review and remove duplicate licenses',
        ],
        generatedAt: now,
      };
    }
    
    case 'copilot': {
      return {
        summary: {
          totalLicenses: rand(50, 500),
          activatedUsers: rand(40, 450),
          activeUsers: rand(30, 400),
          adoptionRate: randPercent(),
          avgInteractionsPerUser: rand(10, 50),
          timeSavedHours: rand(100, 2000),
        },
        usageBreakdown: {
          byApp: [
            { app: 'Word', users: rand(30, 350), interactions: rand(500, 5000) },
            { app: 'Excel', users: rand(25, 300), interactions: rand(400, 4000) },
            { app: 'PowerPoint', users: rand(20, 250), interactions: rand(300, 3000) },
            { app: 'Outlook', users: rand(35, 400), interactions: rand(600, 6000) },
            { app: 'Teams', users: rand(30, 350), interactions: rand(500, 5000) },
          ],
          byDepartment: [
            { department: 'Engineering', users: rand(10, 100), adoptionRate: randPercent() },
            { department: 'Sales', users: rand(15, 120), adoptionRate: randPercent() },
            { department: 'Marketing', users: rand(8, 80), adoptionRate: randPercent() },
            { department: 'HR', users: rand(5, 40), adoptionRate: randPercent() },
          ],
        },
        topUsers: [
          { user: 'power.user@contoso.com', interactions: rand(200, 500), timeSaved: `${rand(10, 40)} hrs` },
          { user: 'heavy.user@contoso.com', interactions: rand(150, 400), timeSaved: `${rand(8, 30)} hrs` },
          { user: 'active.user@contoso.com', interactions: rand(100, 300), timeSaved: `${rand(5, 20)} hrs` },
        ],
        recommendations: [
          'Provide training for users with low adoption',
          'Share success stories from top users',
          'Identify use cases specific to each department',
          'Monitor and measure productivity gains',
        ],
        generatedAt: now,
      };
    }
    
    case 'drift': {
      return {
        summary: {
          totalScans: rand(20, 100),
          driftDetected: rand(5, 30),
          driftRate: rand(10, 40),
          totalChanges: rand(50, 500),
          criticalChanges: rand(2, 20),
          autoRemediated: rand(10, 100),
        },
        recentDrift: [
          { timestamp: '2026-01-18T10:30:00Z', resource: 'Conditional Access Policy', change: 'Policy disabled', severity: 'critical', status: 'unresolved' },
          { timestamp: '2026-01-17T14:15:00Z', resource: 'Security Group', change: 'Member added', severity: 'medium', status: 'reviewed' },
          { timestamp: '2026-01-17T09:45:00Z', resource: 'SharePoint Site', change: 'External sharing enabled', severity: 'high', status: 'remediated' },
          { timestamp: '2026-01-16T16:00:00Z', resource: 'Mail Flow Rule', change: 'Rule modified', severity: 'medium', status: 'reviewed' },
        ],
        driftByCategory: [
          { category: 'Security Policies', count: rand(5, 30), critical: rand(1, 10) },
          { category: 'User Accounts', count: rand(10, 50), critical: rand(0, 5) },
          { category: 'Groups', count: rand(15, 60), critical: rand(0, 3) },
          { category: 'Applications', count: rand(5, 25), critical: rand(0, 5) },
          { category: 'Device Policies', count: rand(3, 20), critical: rand(0, 2) },
        ],
        recommendations: [
          'Review and resolve critical drift immediately',
          'Implement change management approval workflows',
          'Enable auto-remediation for known drift patterns',
          'Schedule more frequent drift detection scans',
        ],
        generatedAt: now,
      };
    }
    
    case 'tenant_health': {
      return {
        summary: {
          overallHealth: rand(80, 100),
          servicesHealthy: rand(15, 20),
          servicesTotal: 20,
          activeIncidents: rand(0, 3),
          plannedMaintenance: rand(0, 2),
          lastChecked: now,
        },
        serviceStatus: [
          { service: 'Exchange Online', status: 'healthy', uptime: `${rand(99, 100)}.${rand(90, 99)}%` },
          { service: 'SharePoint Online', status: 'healthy', uptime: `${rand(99, 100)}.${rand(90, 99)}%` },
          { service: 'Microsoft Teams', status: 'healthy', uptime: `${rand(99, 100)}.${rand(90, 99)}%` },
          { service: 'Azure AD', status: 'healthy', uptime: `${rand(99, 100)}.${rand(90, 99)}%` },
          { service: 'Intune', status: rand(0, 10) > 8 ? 'degraded' : 'healthy', uptime: `${rand(98, 100)}.${rand(50, 99)}%` },
        ],
        recentIncidents: [
          { id: 'INC-001', service: 'Exchange Online', title: 'Delayed email delivery', status: 'resolved', started: '2026-01-15T08:00:00Z', resolved: '2026-01-15T10:30:00Z' },
          { id: 'INC-002', service: 'Teams', title: 'Meeting join issues', status: 'resolved', started: '2026-01-12T14:00:00Z', resolved: '2026-01-12T15:45:00Z' },
        ],
        recommendations: [
          'Subscribe to Microsoft 365 Service Health alerts',
          'Document incident response procedures',
          'Test failover scenarios quarterly',
          'Monitor third-party service dependencies',
        ],
        generatedAt: now,
      };
    }
    
    case 'billing': {
      return {
        summary: {
          totalSpend: `$${rand(10000, 100000)}`,
          previousPeriod: `$${rand(9000, 95000)}`,
          changePercent: rand(-10, 15),
          topCostCenter: 'Engineering',
          projectedAnnual: `$${rand(100000, 1200000)}`,
        },
        spendBreakdown: [
          { category: 'Microsoft 365 Licenses', amount: rand(5000, 50000), percent: rand(30, 50) },
          { category: 'Azure Services', amount: rand(2000, 20000), percent: rand(15, 25) },
          { category: 'Power Platform', amount: rand(1000, 10000), percent: rand(5, 15) },
          { category: 'Add-on Services', amount: rand(500, 5000), percent: rand(5, 10) },
        ],
        trendData: [
          { month: 'Oct 2025', spend: rand(8000, 90000) },
          { month: 'Nov 2025', spend: rand(8500, 92000) },
          { month: 'Dec 2025', spend: rand(9000, 95000) },
          { month: 'Jan 2026', spend: rand(9500, 100000) },
        ],
        costOptimization: [
          { opportunity: 'Reclaim unused licenses', savings: `$${rand(500, 5000)}/month` },
          { opportunity: 'Right-size Azure VMs', savings: `$${rand(200, 2000)}/month` },
          { opportunity: 'Reserved instance pricing', savings: `$${rand(300, 3000)}/month` },
        ],
        recommendations: [
          'Implement license reclamation automation',
          'Review and optimize Azure resource usage',
          'Consider reserved capacity for predictable workloads',
          'Establish cost allocation tags for better tracking',
        ],
        generatedAt: now,
      };
    }
    
    default:
      return {
        summary: {
          reportGenerated: true,
          templateId,
          templateCategory,
        },
        message: 'Report data generated based on template configuration',
        generatedAt: now,
      };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ReportRequest = await req.json();
    console.log('Generating report:', body);

    // Update report status to generating
    await supabase
      .from('reports')
      .update({ status: 'generating' })
      .eq('id', body.reportId)
      .eq('user_id', user.id);

    // Gather data based on report type
    let reportData: Record<string, unknown> = {};

    try {
      // If we have a template ID and category, use template-specific generation
      if (body.templateId && body.templateCategory) {
        reportData = generateTemplateData(body.templateId, body.templateCategory);
      } else {
        // Fall back to standard report type generation
        switch (body.reportType) {
          case 'executive_summary': {
            const [
              { data: customers },
              { data: exportJobs },
              { data: complianceHistory },
              { data: driftRuns },
            ] = await Promise.all([
              supabase.from('customers').select('*').eq('user_id', user.id),
              supabase.from('export_jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
              supabase.from('compliance_history').select('*').eq('user_id', user.id).order('checked_at', { ascending: false }).limit(20),
              supabase.from('scheduled_drift_runs').select('*').order('started_at', { ascending: false }).limit(20),
            ]);

            const totalCustomers = customers?.length || 0;
            const totalExports = exportJobs?.length || 0;
            const completedExports = exportJobs?.filter(j => j.status === 'completed').length || 0;
            const avgComplianceScore = complianceHistory?.length 
              ? complianceHistory.reduce((sum, h) => sum + (h.score || 0), 0) / complianceHistory.length 
              : 0;
            const driftDetectedRuns = driftRuns?.filter(r => r.drift_detected).length || 0;

            reportData = {
              summary: {
                totalCustomers,
                totalExports,
                completedExports,
                exportSuccessRate: totalExports > 0 ? Math.round((completedExports / totalExports) * 100) : 0,
                avgComplianceScore: Math.round(avgComplianceScore),
                driftDetectionRuns: driftRuns?.length || 0,
                driftDetectedCount: driftDetectedRuns,
              },
              recentActivity: {
                exports: exportJobs?.slice(0, 5) || [],
                compliance: complianceHistory?.slice(0, 5) || [],
              },
              recommendations: [
                avgComplianceScore < 80 ? 'Review compliance policies to improve score' : null,
                driftDetectedRuns > 0 ? 'Address detected configuration drift' : null,
                totalCustomers === 0 ? 'Add customer tenants to manage' : null,
              ].filter(Boolean),
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'compliance': {
            let query = supabase.from('compliance_history').select('*').eq('user_id', user.id);
            
            if (body.dateRangeStart) {
              query = query.gte('checked_at', body.dateRangeStart);
            }
            if (body.dateRangeEnd) {
              query = query.lte('checked_at', body.dateRangeEnd);
            }

            const { data: history } = await query.order('checked_at', { ascending: false });

            const scores = history?.map(h => h.score || 0) || [];
            const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            const minScore = scores.length ? Math.min(...scores) : 0;
            const maxScore = scores.length ? Math.max(...scores) : 0;

            reportData = {
              summary: {
                totalChecks: history?.length || 0,
                averageScore: Math.round(avgScore),
                lowestScore: minScore,
                highestScore: maxScore,
                trend: scores.length >= 2 ? (scores[0] > scores[scores.length - 1] ? 'improving' : 'declining') : 'stable',
              },
              history: history || [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'drift': {
            let query = supabase.from('scheduled_drift_runs').select('*');
            
            if (body.dateRangeStart) {
              query = query.gte('started_at', body.dateRangeStart);
            }
            if (body.dateRangeEnd) {
              query = query.lte('started_at', body.dateRangeEnd);
            }

            const { data: runs } = await query.order('started_at', { ascending: false });

            const driftDetectedRuns = runs?.filter(r => r.drift_detected) || [];
            const totalDifferences = runs?.reduce((sum, r) => sum + (r.total_differences || 0), 0) || 0;

            reportData = {
              summary: {
                totalRuns: runs?.length || 0,
                runsWithDrift: driftDetectedRuns.length,
                driftRate: runs?.length ? Math.round((driftDetectedRuns.length / runs.length) * 100) : 0,
                totalDifferences,
              },
              runs: runs || [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'billing': {
            let query = supabase.from('billing_usage').select('*').eq('user_id', user.id);
            
            if (body.dateRangeStart) {
              query = query.gte('period_start', body.dateRangeStart);
            }
            if (body.dateRangeEnd) {
              query = query.lte('period_end', body.dateRangeEnd);
            }

            const { data: usage } = await query.order('period_start', { ascending: false });
            const { data: customers } = await supabase.from('customers').select('id, name').eq('user_id', user.id);

            const totalResources = usage?.reduce((sum, u) => sum + (u.total_resources || 0), 0) || 0;
            const totalUsers = usage?.reduce((sum, u) => sum + (u.total_users || 0), 0) || 0;
            const totalDevices = usage?.reduce((sum, u) => sum + (u.total_devices || 0), 0) || 0;
            const totalBillable = usage?.reduce((sum, u) => sum + (u.billable_amount || 0), 0) || 0;

            const customerMap = new Map(customers?.map(c => [c.id, c.name]) || []);
            const usageWithNames = usage?.map(u => ({
              ...u,
              customerName: u.customer_id ? customerMap.get(u.customer_id) || 'Unknown' : 'All',
            })) || [];

            reportData = {
              summary: {
                totalResources,
                totalUsers,
                totalDevices,
                totalBillable,
                periodCount: usage?.length || 0,
              },
              usage: usageWithNames,
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'security': {
            const { data: complianceResults } = await supabase
              .from('compliance_results')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1);

            const latestCompliance = complianceResults?.[0];
            const results = (latestCompliance?.results as Record<string, unknown>[]) || [];
            
            const criticalIssues = results.filter(r => r.severity === 'critical' && !r.passed);
            const highIssues = results.filter(r => r.severity === 'high' && !r.passed);
            const mediumIssues = results.filter(r => r.severity === 'medium' && !r.passed);

            reportData = {
              summary: {
                overallScore: latestCompliance?.passed_count && latestCompliance?.total_checks 
                  ? Math.round((latestCompliance.passed_count / latestCompliance.total_checks) * 100) 
                  : 0,
                criticalIssues: criticalIssues.length,
                highIssues: highIssues.length,
                mediumIssues: mediumIssues.length,
                totalIssues: criticalIssues.length + highIssues.length + mediumIssues.length,
              },
              criticalFindings: criticalIssues,
              highFindings: highIssues,
              recommendations: [
                criticalIssues.length > 0 ? 'Address critical security issues immediately' : null,
                highIssues.length > 0 ? 'Review and remediate high-priority findings' : null,
              ].filter(Boolean),
              lastChecked: latestCompliance?.created_at,
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'tenant_summary': {
            const { data: tenants } = await supabase
              .from('tenant_connections')
              .select('*')
              .eq('user_id', user.id);

            const { data: healthChecks } = await supabase
              .from('tenant_health_checks')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            const { data: customers } = await supabase
              .from('customers')
              .select('id, name')
              .eq('user_id', user.id);

            const customerMap = new Map(customers?.map(c => [c.id, c.name]) || []);

            const tenantHealthMap = new Map<string, { status: string; lastCheck: string }>();
            for (const check of healthChecks || []) {
              if (!tenantHealthMap.has(check.tenant_connection_id)) {
                tenantHealthMap.set(check.tenant_connection_id, {
                  status: check.health_status,
                  lastCheck: check.created_at,
                });
              }
            }

            const tenantsWithHealth = tenants?.map(t => ({
              id: t.id,
              name: t.display_name || t.tenant_name || t.tenant_id,
              customer: t.customer_id ? customerMap.get(t.customer_id) || 'Unknown' : 'Unassigned',
              status: t.status,
              healthStatus: tenantHealthMap.get(t.id)?.status || 'unknown',
              lastHealthCheck: tenantHealthMap.get(t.id)?.lastCheck || null,
              environment: t.environment,
            })) || [];

            const healthyCount = tenantsWithHealth.filter(t => t.healthStatus === 'healthy').length;
            const unhealthyCount = tenantsWithHealth.filter(t => t.healthStatus === 'unhealthy' || t.healthStatus === 'error').length;

            reportData = {
              summary: {
                totalTenants: tenants?.length || 0,
                healthyTenants: healthyCount,
                unhealthyTenants: unhealthyCount,
                unknownStatus: tenantsWithHealth.filter(t => t.healthStatus === 'unknown').length,
                totalCustomers: customers?.length || 0,
              },
              tenants: tenantsWithHealth,
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'psa_tickets': {
            let query = supabase.from('psa_tickets').select('*').eq('user_id', user.id);
            
            if (body.dateRangeStart) {
              query = query.gte('created_at', body.dateRangeStart);
            }
            if (body.dateRangeEnd) {
              query = query.lte('created_at', body.dateRangeEnd);
            }

            const { data: tickets } = await query.order('created_at', { ascending: false });

            const { data: integrations } = await supabase
              .from('psa_integrations')
              .select('id, name, provider')
              .eq('user_id', user.id);

            const integrationMap = new Map(integrations?.map(i => [i.id, { name: i.name, provider: i.provider }]) || []);

            const ticketsWithIntegration = tickets?.map(t => ({
              ...t,
              integrationName: integrationMap.get(t.psa_integration_id)?.name || 'Unknown',
              provider: integrationMap.get(t.psa_integration_id)?.provider || 'Unknown',
            })) || [];

            const bySource = {
              drift: tickets?.filter(t => t.source_type === 'drift').length || 0,
              compliance: tickets?.filter(t => t.source_type === 'compliance').length || 0,
              scheduled_drift: tickets?.filter(t => t.source_type === 'scheduled_drift').length || 0,
              manual: tickets?.filter(t => t.source_type === 'manual').length || 0,
            };

            const byStatus = {
              open: tickets?.filter(t => t.status === 'open').length || 0,
              in_progress: tickets?.filter(t => t.status === 'in_progress').length || 0,
              closed: tickets?.filter(t => t.status === 'closed').length || 0,
            };

            reportData = {
              summary: {
                totalTickets: tickets?.length || 0,
                bySource,
                byStatus,
                activeIntegrations: integrations?.length || 0,
              },
              tickets: ticketsWithIntegration.slice(0, 50),
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          default:
            reportData = {
              error: 'Unknown report type',
              generatedAt: new Date().toISOString(),
            };
        }
      }

      // Update report with data and mark as completed
      await supabase
        .from('reports')
        .update({
          data: reportData,
          status: 'completed',
          generated_at: new Date().toISOString(),
        })
        .eq('id', body.reportId)
        .eq('user_id', user.id);

      console.log('Report generated successfully:', body.reportId);

    } catch (dataError) {
      console.error('Failed to gather report data:', dataError);
      
      // Mark report as failed
      await supabase
        .from('reports')
        .update({
          status: 'failed',
          data: { error: dataError instanceof Error ? dataError.message : 'Unknown error' },
        })
        .eq('id', body.reportId)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ error: 'Failed to generate report data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportId: body.reportId,
        message: 'Report generated successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate report error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});