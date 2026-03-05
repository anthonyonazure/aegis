import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface RealData {
  customerCount: number;
  tenantCount: number;
  totalUsers: number;
  totalDevices: number;
  exportJobsCount: number;
  completedExportsCount: number;
  complianceChecksCount: number;
  avgComplianceScore: number;
  driftRunsCount: number;
  driftDetectedCount: number;
  psaTicketsCount: number;
  billingUsageCount: number;
  totalBillableAmount: number;
  // Enriched data
  secureScores: Array<{ tenantName: string; currentScore: number; maxScore: number; percentage: number }>;
  avgSecureScorePercent: number;
  governanceMetrics: Record<string, unknown> | null;
  complianceDetails: Array<{ baselineName: string; passedCount: number; failedCount: number; warningCount: number; totalChecks: number; score: number; completedAt: string | null }>;
  driftDetails: Array<{ status: string; totalResources: number; addedCount: number; removedCount: number; modifiedCount: number; completedAt: string | null }>;
  psaTicketDetails: Array<{ title: string; status: string; priority: string; ticketType: string; createdAt: string }>;
  tenantList: Array<{ id: string; tenantName: string; displayName: string; status: string; environment: string; healthStatus: string; lastSync: string | null }>;
  exportedResourceCounts: Record<string, number>;
  copilotMetrics: { totalUsers: number; activeUsers: number; adoptionRate: number; totalQueries: number } | null;
  riskAssessments: Array<{ overallScore: number; createdAt: string }>;
}

async function fetchRealData(supabase: SupabaseClient, userId: string, customerId?: string, dateRangeStart?: string, dateRangeEnd?: string): Promise<RealData> {
  try {
    // Build queries
    let customerQuery = supabase.from('customers').select('id', { count: 'exact' }).eq('user_id', userId);
    let tenantQuery = supabase.from('tenant_connections').select('id, tenant_name, display_name, status, environment, health_status, last_sync').eq('user_id', userId);
    if (customerId) {
      tenantQuery = tenantQuery.eq('customer_id', customerId);
    }

    let exportQuery = supabase.from('export_jobs').select('id, status', { count: 'exact' }).eq('user_id', userId);
    if (dateRangeStart) exportQuery = exportQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) exportQuery = exportQuery.lte('created_at', dateRangeEnd);

    let complianceQuery = supabase.from('compliance_results').select('id, passed_count, failed_count, warning_count, total_checks, baseline_name, completed_at, status').eq('user_id', userId);
    if (dateRangeStart) complianceQuery = complianceQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) complianceQuery = complianceQuery.lte('created_at', dateRangeEnd);

    let driftQuery = supabase.from('drift_detections').select('id, modified_count, added_count, removed_count, total_resources, status, completed_at').eq('user_id', userId);
    if (dateRangeStart) driftQuery = driftQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) driftQuery = driftQuery.lte('created_at', dateRangeEnd);

    let psaQuery = supabase.from('psa_tickets').select('id, title, status, priority, ticket_type, created_at').eq('user_id', userId);
    if (customerId) psaQuery = psaQuery.eq('customer_id', customerId);
    if (dateRangeStart) psaQuery = psaQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) psaQuery = psaQuery.lte('created_at', dateRangeEnd);

    let billingQuery = supabase.from('billing_usage').select('id, total_users, total_devices, billable_amount').eq('user_id', userId);
    if (customerId) billingQuery = billingQuery.eq('customer_id', customerId);
    if (dateRangeStart) billingQuery = billingQuery.gte('period_start', dateRangeStart);
    if (dateRangeEnd) billingQuery = billingQuery.lte('period_end', dateRangeEnd);

    // Secure scores
    const secureScoreQuery = supabase.from('tenant_secure_scores').select('current_score, max_score, score_percentage, tenant_connection_id').eq('user_id', userId);

    // Governance metrics (latest per tenant)
    const governanceQuery = supabase.from('governance_metrics_history').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(10);

    // Exported resources counts by category
    const exportedResourcesQuery = supabase.from('exported_resources').select('category, export_job_id');

    // Copilot usage
    const copilotQuery = supabase.from('copilot_usage_metrics').select('total_users, active_users, adoption_rate, total_queries').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(1);

    // Risk assessments
    const riskQuery = supabase.from('risk_assessments').select('overall_score, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);

    const [
      { count: customerCount },
      { data: tenants },
      { data: exportJobs, count: exportJobsCount },
      { data: complianceResults },
      { data: driftDetections },
      { data: psaTickets },
      { data: billingUsage },
      { data: secureScores },
      { data: governanceData },
      { data: exportedResources },
      { data: copilotData },
      { data: riskData },
    ] = await Promise.all([
      customerQuery,
      tenantQuery,
      exportQuery,
      complianceQuery,
      driftQuery,
      psaQuery,
      billingQuery,
      secureScoreQuery,
      governanceQuery,
      exportedResourcesQuery,
      copilotQuery,
      riskQuery,
    ]);

    const completedExportsCount = exportJobs?.filter(j => j.status === 'completed').length || 0;
    
    let avgComplianceScore = 0;
    const complianceDetails = (complianceResults || []).map(r => {
      const score = r.total_checks > 0 ? Math.round((r.passed_count / r.total_checks) * 100) : 0;
      return {
        baselineName: r.baseline_name,
        passedCount: r.passed_count,
        failedCount: r.failed_count,
        warningCount: r.warning_count,
        totalChecks: r.total_checks,
        score,
        completedAt: r.completed_at,
      };
    });
    if (complianceDetails.length > 0) {
      avgComplianceScore = Math.round(complianceDetails.reduce((sum, r) => sum + r.score, 0) / complianceDetails.length);
    }

    const driftDetectedCount = driftDetections?.filter(d => 
      (d.modified_count || 0) + (d.added_count || 0) + (d.removed_count || 0) > 0
    ).length || 0;

    const driftDetails = (driftDetections || []).map(d => ({
      status: d.status,
      totalResources: d.total_resources,
      addedCount: d.added_count,
      removedCount: d.removed_count,
      modifiedCount: d.modified_count,
      completedAt: d.completed_at,
    }));

    let totalUsers = 0;
    let totalDevices = 0;
    let totalBillableAmount = 0;
    if (billingUsage) {
      totalUsers = billingUsage.reduce((sum, b) => sum + (b.total_users || 0), 0);
      totalDevices = billingUsage.reduce((sum, b) => sum + (b.total_devices || 0), 0);
      totalBillableAmount = billingUsage.reduce((sum, b) => sum + (b.billable_amount || 0), 0);
    }

    // Process secure scores
    const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
    const processedSecureScores = (secureScores || []).map(s => {
      const tenant = tenantMap.get(s.tenant_connection_id);
      return {
        tenantName: tenant?.display_name || tenant?.tenant_name || 'Unknown',
        currentScore: Number(s.current_score),
        maxScore: Number(s.max_score),
        percentage: Number(s.score_percentage) || (Number(s.max_score) > 0 ? Math.round((Number(s.current_score) / Number(s.max_score)) * 100) : 0),
      };
    });
    const avgSecureScorePercent = processedSecureScores.length > 0
      ? Math.round(processedSecureScores.reduce((sum, s) => sum + s.percentage, 0) / processedSecureScores.length)
      : 0;

    // Process governance metrics (latest)
    const latestGovernance = governanceData && governanceData.length > 0 ? {
      totalUsers: governanceData[0].total_users || 0,
      adminUsers: governanceData[0].admin_users || 0,
      guestUsers: governanceData[0].guest_users || 0,
      mfaEnabledUsers: governanceData[0].mfa_enabled_users || 0,
      riskyUsers: governanceData[0].risky_users || 0,
      riskySignIns: governanceData[0].risky_sign_ins || 0,
      staleAccounts: governanceData[0].stale_accounts || 0,
      totalLicenses: governanceData[0].total_licenses || 0,
      assignedLicenses: governanceData[0].assigned_licenses || 0,
      unusedLicenses: governanceData[0].unused_licenses || 0,
      licenseUtilization: Number(governanceData[0].license_utilization || 0),
      licenseCostMonthly: Number(governanceData[0].license_cost_monthly || 0),
      complianceScore: Number(governanceData[0].compliance_score || 0),
      conditionalAccessPolicies: governanceData[0].conditional_access_policies || 0,
      secureScore: Number(governanceData[0].secure_score || 0),
      maxSecureScore: Number(governanceData[0].max_secure_score || 0),
    } : null;

    // Exported resources by category
    const resourceCounts: Record<string, number> = {};
    (exportedResources || []).forEach(r => {
      resourceCounts[r.category] = (resourceCounts[r.category] || 0) + 1;
    });

    // Copilot
    const copilotMetrics = copilotData && copilotData.length > 0 ? {
      totalUsers: copilotData[0].total_users || 0,
      activeUsers: copilotData[0].active_users || 0,
      adoptionRate: Number(copilotData[0].adoption_rate || 0),
      totalQueries: copilotData[0].total_queries || 0,
    } : null;

    // PSA ticket details
    const psaTicketDetails = (psaTickets || []).map(t => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      ticketType: t.ticket_type,
      createdAt: t.created_at,
    }));

    // Tenant list
    const tenantList = (tenants || []).map(t => ({
      id: t.id,
      tenantName: t.tenant_name || '',
      displayName: t.display_name || t.tenant_name || '',
      status: t.status,
      environment: t.environment || 'production',
      healthStatus: t.health_status || 'unknown',
      lastSync: t.last_sync,
    }));

    // Risk assessments
    const riskAssessments = (riskData || []).map(r => ({
      overallScore: Number(r.overall_score),
      createdAt: r.created_at,
    }));

    return {
      customerCount: customerCount || 0,
      tenantCount: tenants?.length || 0,
      totalUsers,
      totalDevices,
      exportJobsCount: exportJobsCount || 0,
      completedExportsCount,
      complianceChecksCount: complianceResults?.length || 0,
      avgComplianceScore,
      driftRunsCount: driftDetections?.length || 0,
      driftDetectedCount,
      psaTicketsCount: psaTickets?.length || 0,
      billingUsageCount: billingUsage?.length || 0,
      totalBillableAmount,
      secureScores: processedSecureScores,
      avgSecureScorePercent,
      governanceMetrics: latestGovernance,
      complianceDetails,
      driftDetails,
      psaTicketDetails,
      tenantList,
      exportedResourceCounts: resourceCounts,
      copilotMetrics,
      riskAssessments,
    };
  } catch (error) {
    console.error('Error fetching real data:', error);
    return {
      customerCount: 0, tenantCount: 0, totalUsers: 0, totalDevices: 0,
      exportJobsCount: 0, completedExportsCount: 0, complianceChecksCount: 0,
      avgComplianceScore: 0, driftRunsCount: 0, driftDetectedCount: 0,
      psaTicketsCount: 0, billingUsageCount: 0, totalBillableAmount: 0,
      secureScores: [], avgSecureScorePercent: 0, governanceMetrics: null,
      complianceDetails: [], driftDetails: [], psaTicketDetails: [],
      tenantList: [], exportedResourceCounts: {}, copilotMetrics: null,
      riskAssessments: [],
    };
  }
}

function generateTemplateData(templateId: string, templateCategory: string, realData: RealData): Record<string, unknown> {
  const now = new Date().toISOString();
  const gov = realData.governanceMetrics as Record<string, number> | null;
  const hasData = realData.customerCount > 0 || realData.tenantCount > 0;
  
  const mfaCoverage = gov && gov.totalUsers > 0 
    ? Math.round((gov.mfaEnabledUsers / gov.totalUsers) * 100) : 0;

  switch (templateCategory) {
    case 'security': {
      return {
        summary: {
          overallSecurityScore: realData.avgSecureScorePercent || realData.avgComplianceScore || 0,
          secureScorePercent: realData.avgSecureScorePercent,
          criticalIssues: gov?.riskyUsers || 0,
          highIssues: gov?.riskySignIns || 0,
          mediumIssues: gov?.staleAccounts || 0,
          totalIssues: (gov?.riskyUsers || 0) + (gov?.riskySignIns || 0) + (gov?.staleAccounts || 0),
          overallScore: realData.avgSecureScorePercent || realData.avgComplianceScore || 0,
          mfaCoverage,
          conditionalAccessPolicies: gov?.conditionalAccessPolicies || 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        secureScores: realData.secureScores,
        criticalFindings: (gov?.riskyUsers || 0) > 0 ? [
          { ruleName: 'Risky Users Detected', name: 'Risky Users', resourceType: 'Identity', message: `${gov?.riskyUsers} user(s) flagged as risky by Entra ID Protection`, resourceName: 'Entra ID' }
        ] : [],
        highFindings: [
          ...(gov?.riskySignIns || 0) > 0 ? [{ ruleName: 'Risky Sign-Ins', resourceType: 'Authentication', message: `${gov?.riskySignIns} risky sign-in(s) detected`, resourceName: 'Sign-in Logs' }] : [],
          ...(gov?.staleAccounts || 0) > 0 ? [{ ruleName: 'Stale Accounts', resourceType: 'Identity', message: `${gov?.staleAccounts} stale account(s) found`, resourceName: 'User Directory' }] : [],
          ...mfaCoverage < 100 && mfaCoverage > 0 ? [{ ruleName: 'Incomplete MFA Coverage', resourceType: 'Authentication', message: `MFA coverage at ${mfaCoverage}% — ${100 - mfaCoverage}% of users unprotected`, resourceName: 'MFA Policies' }] : [],
        ],
        recommendations: [
          ...(gov?.riskyUsers || 0) > 0 ? ['Investigate and remediate risky users in Entra ID Protection'] : [],
          ...mfaCoverage < 100 ? [`Increase MFA coverage from ${mfaCoverage}% to 100%`] : [],
          ...(gov?.staleAccounts || 0) > 0 ? [`Review and disable ${gov?.staleAccounts} stale accounts`] : [],
          ...realData.avgSecureScorePercent < 70 && realData.avgSecureScorePercent > 0 ? ['Review Microsoft Secure Score recommendations to improve posture'] : [],
          ...!hasData ? ['Connect tenant credentials to enable security monitoring'] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'compliance': {
      const lowestScore = realData.complianceDetails.length > 0 
        ? Math.min(...realData.complianceDetails.map(c => c.score)) : 0;
      const highestScore = realData.complianceDetails.length > 0 
        ? Math.max(...realData.complianceDetails.map(c => c.score)) : 0;
      
      return {
        summary: {
          overallComplianceScore: realData.avgComplianceScore,
          totalChecks: realData.complianceDetails.reduce((sum, c) => sum + c.totalChecks, 0),
          passedChecks: realData.complianceDetails.reduce((sum, c) => sum + c.passedCount, 0),
          failedChecks: realData.complianceDetails.reduce((sum, c) => sum + c.failedCount, 0),
          averageScore: realData.avgComplianceScore,
          lowestScore,
          highestScore,
          trend: 'stable',
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        history: realData.complianceDetails.map(c => ({
          checked_at: c.completedAt,
          score: c.score,
          passed_count: c.passedCount,
          failed_count: c.failedCount,
          warning_count: c.warningCount,
          baseline_name: c.baselineName,
        })),
        recommendations: [
          ...realData.avgComplianceScore < 80 && realData.avgComplianceScore > 0 ? [`Compliance score is ${realData.avgComplianceScore}% — review failed checks`] : [],
          ...lowestScore < 60 && lowestScore > 0 ? [`Lowest score is ${lowestScore}% — prioritize remediation`] : [],
          ...!hasData ? ['Run compliance checks against connected tenants'] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'identity': {
      return {
        summary: {
          totalUsers: gov?.totalUsers || realData.totalUsers || 0,
          adminUsers: gov?.adminUsers || 0,
          guestUsers: gov?.guestUsers || 0,
          mfaEnabledUsers: gov?.mfaEnabledUsers || 0,
          mfaCoveragePercent: mfaCoverage,
          staleAccounts: gov?.staleAccounts || 0,
          riskyUsers: gov?.riskyUsers || 0,
          conditionalAccessPolicies: gov?.conditionalAccessPolicies || 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: [
          ...mfaCoverage < 100 ? [`Enable MFA for remaining ${100 - mfaCoverage}% of users`] : ['MFA coverage is at 100% — excellent!'],
          ...(gov?.staleAccounts || 0) > 0 ? [`Disable or remove ${gov?.staleAccounts} stale accounts`] : [],
          ...(gov?.riskyUsers || 0) > 0 ? [`Investigate ${gov?.riskyUsers} risky user(s)`] : [],
          ...(gov?.adminUsers || 0) > 5 ? [`Review ${gov?.adminUsers} admin accounts — consider reducing privileged access`] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'devices': {
      return {
        summary: {
          totalDevices: gov ? (realData.totalDevices || 0) : 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: hasData ? [
          `${realData.totalDevices} devices tracked across tenants`,
          'Run device compliance assessments via Intune integration',
        ] : ['Connect tenants to monitor device compliance'],
        generatedAt: now,
      };
    }
    
    case 'exchange': {
      return {
        summary: {
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
          totalUsers: gov?.totalUsers || realData.totalUsers || 0,
        },
        recommendations: hasData ? [
          'Connect to Exchange Online for mailbox and mail flow data',
          `${realData.tenantCount} tenant(s) available for Exchange analysis`,
        ] : ['Add customer tenants to analyze Exchange configuration'],
        generatedAt: now,
      };
    }
    
    case 'sharepoint': {
      return {
        summary: {
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
          exportedResources: realData.exportedResourceCounts['sharepoint'] || 0,
        },
        recommendations: hasData ? [
          'Connect to SharePoint Online for site and sharing analytics',
          `${realData.exportedResourceCounts['sharepoint'] || 0} SharePoint resources exported`,
        ] : ['Add customer tenants to analyze SharePoint configuration'],
        generatedAt: now,
      };
    }
    
    case 'teams': {
      return {
        summary: {
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
          exportedResources: realData.exportedResourceCounts['teams'] || 0,
        },
        recommendations: hasData ? [
          'Connect to Teams for collaboration governance data',
          `${realData.exportedResourceCounts['teams'] || 0} Teams resources exported`,
        ] : ['Add customer tenants to analyze Teams governance'],
        generatedAt: now,
      };
    }
    
    case 'licensing': {
      return {
        summary: {
          totalLicenses: gov?.totalLicenses || 0,
          assignedLicenses: gov?.assignedLicenses || 0,
          unusedLicenses: gov?.unusedLicenses || 0,
          utilizationRate: gov?.licenseUtilization || 0,
          monthlySpend: `$${(gov?.licenseCostMonthly || 0).toLocaleString()}`,
          potentialSavings: gov?.unusedLicenses ? `$${Math.round((gov.unusedLicenses || 0) * (gov.licenseCostMonthly || 0) / Math.max(gov.totalLicenses || 1, 1)).toLocaleString()}` : '$0',
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: [
          ...(gov?.unusedLicenses || 0) > 0 ? [`Reclaim ${gov?.unusedLicenses} unused licenses to save costs`] : [],
          ...(gov?.licenseUtilization || 0) < 80 ? [`License utilization is ${gov?.licenseUtilization || 0}% — review assignments`] : [],
          ...!gov ? ['Run governance metrics collection to populate license data'] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'copilot': {
      const cm = realData.copilotMetrics;
      return {
        summary: {
          totalLicenses: cm?.totalUsers || 0,
          activeUsers: cm?.activeUsers || 0,
          adoptionRate: cm?.adoptionRate || 0,
          totalQueries: cm?.totalQueries || 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: [
          ...cm ? [
            `${cm.activeUsers} active Copilot users out of ${cm.totalUsers} licensed`,
            cm.adoptionRate < 50 ? 'Adoption rate below 50% — consider training programs' : `Good adoption rate at ${cm.adoptionRate}%`,
          ] : ['Connect to Copilot analytics to track usage and adoption'],
        ],
        generatedAt: now,
      };
    }
    
    case 'drift': {
      return {
        summary: {
          totalScans: realData.driftRunsCount,
          driftDetected: realData.driftDetectedCount,
          driftRate: realData.driftRunsCount > 0 ? Math.round((realData.driftDetectedCount / realData.driftRunsCount) * 100) : 0,
          totalRuns: realData.driftRunsCount,
          runsWithDrift: realData.driftDetectedCount,
          totalChanges: realData.driftDetails.reduce((sum, d) => sum + d.addedCount + d.removedCount + d.modifiedCount, 0),
          totalDifferences: realData.driftDetails.reduce((sum, d) => sum + d.addedCount + d.removedCount + d.modifiedCount, 0),
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        runs: realData.driftDetails.map(d => ({
          started_at: d.completedAt,
          status: d.status,
          total_tenants: 1,
          drift_detected: (d.addedCount + d.removedCount + d.modifiedCount) > 0,
          total_differences: d.addedCount + d.removedCount + d.modifiedCount,
          added: d.addedCount,
          removed: d.removedCount,
          modified: d.modifiedCount,
        })),
        recommendations: [
          ...realData.driftDetectedCount > 0 ? [`Drift detected in ${realData.driftDetectedCount} of ${realData.driftRunsCount} scans — review changes`] : [],
          ...realData.driftRunsCount === 0 ? ['Configure scheduled drift detection for your tenants'] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'tenant_health': {
      return {
        summary: {
          totalTenants: realData.tenantCount,
          healthyTenants: realData.tenantList.filter(t => t.healthStatus === 'healthy').length,
          warningTenants: realData.tenantList.filter(t => t.healthStatus === 'warning').length,
          criticalTenants: realData.tenantList.filter(t => t.healthStatus === 'critical').length,
          unknownTenants: realData.tenantList.filter(t => t.healthStatus === 'unknown').length,
          connectedTenants: realData.tenantList.filter(t => t.status === 'connected').length,
          avgSecureScore: realData.avgSecureScorePercent,
          avgComplianceScore: realData.avgComplianceScore,
          customerCount: realData.customerCount,
        },
        tenants: realData.tenantList.map(t => {
          const score = realData.secureScores.find(s => s.tenantName === t.displayName);
          return {
            ...t,
            secureScorePercent: score?.percentage || 0,
          };
        }),
        recommendations: [
          ...realData.tenantList.filter(t => t.healthStatus === 'critical').length > 0 ? ['Address critical health issues on affected tenants'] : [],
          ...realData.tenantList.filter(t => t.status !== 'connected').length > 0 ? [`${realData.tenantList.filter(t => t.status !== 'connected').length} tenant(s) not connected — verify credentials`] : [],
          ...realData.avgSecureScorePercent < 60 && realData.avgSecureScorePercent > 0 ? ['Improve Secure Score by addressing recommended actions'] : [],
        ],
        generatedAt: now,
      };
    }
    
    case 'billing': {
      return {
        summary: {
          totalSpend: `$${realData.totalBillableAmount.toLocaleString()}`,
          totalResources: Object.values(realData.exportedResourceCounts).reduce((sum, c) => sum + c, 0),
          totalUsers: realData.totalUsers,
          totalDevices: realData.totalDevices,
          totalBillable: realData.totalBillableAmount,
          periodCount: realData.billingUsageCount,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: [
          ...realData.totalBillableAmount > 0 ? [`$${realData.totalBillableAmount.toLocaleString()} total billable across ${realData.billingUsageCount} periods`] : [],
          ...!hasData ? ['Track resource usage to generate billing reports'] : [],
        ],
        generatedAt: now,
      };
    }
    
    default:
      return {
        summary: {
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recommendations: hasData 
          ? ['Report data generated from available database records']
          : ['Add customer tenants to generate meaningful reports'],
        generatedAt: now,
      };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    await supabase
      .from('reports')
      .update({ status: 'generating' })
      .eq('id', body.reportId)
      .eq('user_id', user.id);

    let reportData: Record<string, unknown> = {};

    try {
      // Always fetch real data
      const realData = await fetchRealData(
        supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd
      );
      console.log('Real data fetched:', {
        customers: realData.customerCount,
        tenants: realData.tenantCount,
        secureScores: realData.secureScores.length,
        complianceChecks: realData.complianceChecksCount,
        driftRuns: realData.driftRunsCount,
        psaTickets: realData.psaTicketsCount,
        hasGovernance: !!realData.governanceMetrics,
        hasCopilot: !!realData.copilotMetrics,
      });

      if (body.templateId && body.templateCategory) {
        reportData = generateTemplateData(body.templateId, body.templateCategory, realData);
      } else {
        // Use reportType as category for standard reports
        reportData = generateTemplateData('standard', body.reportType || 'security', realData);
      }

      await supabase
        .from('reports')
        .update({
          status: 'completed',
          data: reportData,
          generated_at: new Date().toISOString(),
        })
        .eq('id', body.reportId)
        .eq('user_id', user.id);

      console.log('Report generated successfully:', body.reportId);

      return new Response(
        JSON.stringify({ success: true, reportId: body.reportId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (genError) {
      console.error('Error generating report data:', genError);
      const errorMessage = genError instanceof Error ? genError.message : 'Failed to generate report';
      
      await supabase
        .from('reports')
        .update({ status: 'failed', data: { error: errorMessage } })
        .eq('id', body.reportId)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ error: 'Failed to generate report', details: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
