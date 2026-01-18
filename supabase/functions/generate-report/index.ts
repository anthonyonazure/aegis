import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
}

// Fetch real data from the database
async function fetchRealData(supabase: SupabaseClient, userId: string, customerId?: string, dateRangeStart?: string, dateRangeEnd?: string): Promise<RealData> {
  try {
    // Build customer query
    let customerQuery = supabase.from('customers').select('id', { count: 'exact' }).eq('user_id', userId);
    
    // Build tenant query
    let tenantQuery = supabase.from('tenant_connections').select('id', { count: 'exact' }).eq('user_id', userId);
    if (customerId) {
      tenantQuery = tenantQuery.eq('customer_id', customerId);
    }

    // Build export jobs query
    let exportQuery = supabase.from('export_jobs').select('id, status', { count: 'exact' }).eq('user_id', userId);
    if (dateRangeStart) exportQuery = exportQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) exportQuery = exportQuery.lte('created_at', dateRangeEnd);

    // Build compliance results query
    let complianceQuery = supabase.from('compliance_results').select('id, passed_count, total_checks').eq('user_id', userId);
    if (dateRangeStart) complianceQuery = complianceQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) complianceQuery = complianceQuery.lte('created_at', dateRangeEnd);

    // Build drift runs query
    let driftQuery = supabase.from('drift_detections').select('id, modified_count, added_count, removed_count').eq('user_id', userId);
    if (dateRangeStart) driftQuery = driftQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) driftQuery = driftQuery.lte('created_at', dateRangeEnd);

    // Build PSA tickets query
    let psaQuery = supabase.from('psa_tickets').select('id', { count: 'exact' }).eq('user_id', userId);
    if (customerId) psaQuery = psaQuery.eq('customer_id', customerId);
    if (dateRangeStart) psaQuery = psaQuery.gte('created_at', dateRangeStart);
    if (dateRangeEnd) psaQuery = psaQuery.lte('created_at', dateRangeEnd);

    // Build billing usage query
    let billingQuery = supabase.from('billing_usage').select('id, total_users, total_devices, billable_amount').eq('user_id', userId);
    if (customerId) billingQuery = billingQuery.eq('customer_id', customerId);
    if (dateRangeStart) billingQuery = billingQuery.gte('period_start', dateRangeStart);
    if (dateRangeEnd) billingQuery = billingQuery.lte('period_end', dateRangeEnd);

    const [
      { count: customerCount },
      { count: tenantCount },
      { data: exportJobs, count: exportJobsCount },
      { data: complianceResults },
      { data: driftDetections },
      { count: psaTicketsCount },
      { data: billingUsage },
    ] = await Promise.all([
      customerQuery,
      tenantQuery,
      exportQuery,
      complianceQuery,
      driftQuery,
      psaQuery,
      billingQuery,
    ]);

    // Calculate metrics from fetched data
    const completedExportsCount = exportJobs?.filter(j => j.status === 'completed').length || 0;
    
    let avgComplianceScore = 0;
    if (complianceResults && complianceResults.length > 0) {
      const totalScore = complianceResults.reduce((sum, r) => {
        const score = r.total_checks > 0 ? (r.passed_count / r.total_checks) * 100 : 0;
        return sum + score;
      }, 0);
      avgComplianceScore = Math.round(totalScore / complianceResults.length);
    }

    const driftDetectedCount = driftDetections?.filter(d => 
      (d.modified_count || 0) + (d.added_count || 0) + (d.removed_count || 0) > 0
    ).length || 0;

    let totalUsers = 0;
    let totalDevices = 0;
    let totalBillableAmount = 0;
    if (billingUsage) {
      totalUsers = billingUsage.reduce((sum, b) => sum + (b.total_users || 0), 0);
      totalDevices = billingUsage.reduce((sum, b) => sum + (b.total_devices || 0), 0);
      totalBillableAmount = billingUsage.reduce((sum, b) => sum + (b.billable_amount || 0), 0);
    }

    return {
      customerCount: customerCount || 0,
      tenantCount: tenantCount || 0,
      totalUsers,
      totalDevices,
      exportJobsCount: exportJobsCount || 0,
      completedExportsCount,
      complianceChecksCount: complianceResults?.length || 0,
      avgComplianceScore,
      driftRunsCount: driftDetections?.length || 0,
      driftDetectedCount,
      psaTicketsCount: psaTicketsCount || 0,
      billingUsageCount: billingUsage?.length || 0,
      totalBillableAmount,
    };
  } catch (error) {
    console.error('Error fetching real data:', error);
    return {
      customerCount: 0,
      tenantCount: 0,
      totalUsers: 0,
      totalDevices: 0,
      exportJobsCount: 0,
      completedExportsCount: 0,
      complianceChecksCount: 0,
      avgComplianceScore: 0,
      driftRunsCount: 0,
      driftDetectedCount: 0,
      psaTicketsCount: 0,
      billingUsageCount: 0,
      totalBillableAmount: 0,
    };
  }
}

// Generate template data with real database values
function generateTemplateData(templateId: string, templateCategory: string, realData: RealData): Record<string, unknown> {
  const now = new Date().toISOString();
  
  // Use real data or reasonable defaults based on actual counts
  const hasData = realData.customerCount > 0 || realData.tenantCount > 0;
  
  switch (templateCategory) {
    case 'security': {
      return {
        summary: {
          overallSecurityScore: realData.avgComplianceScore > 0 ? realData.avgComplianceScore : 0,
          criticalIssues: 0,
          highIssues: 0,
          mediumIssues: 0,
          lowIssues: 0,
          policiesEnabled: 0,
          policiesTotal: 0,
          mfaCoverage: 0,
          conditionalAccessCoverage: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        findings: [],
        recommendations: hasData ? [
          'Connect to Microsoft Graph API to fetch security data',
          'Run security assessments on connected tenants',
        ] : [
          'No customers or tenants configured',
          'Add customer tenants to generate security reports',
        ],
        trendData: [],
        generatedAt: now,
      };
    }
    
    case 'compliance': {
      return {
        summary: {
          overallComplianceScore: realData.avgComplianceScore,
          totalChecks: realData.complianceChecksCount,
          passedChecks: 0,
          failedChecks: 0,
          frameworks: [],
          lastAssessment: now,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        complianceByFramework: [],
        failedControls: [],
        history: [],
        recommendations: hasData ? [
          'Run compliance checks against connected tenants',
          `${realData.complianceChecksCount} compliance checks recorded`,
        ] : [
          'No customers or tenants configured',
          'Add customer tenants to run compliance checks',
        ],
        generatedAt: now,
      };
    }
    
    case 'identity': {
      return {
        summary: {
          totalUsers: realData.totalUsers,
          activeUsers: 0,
          guestUsers: 0,
          adminUsers: 0,
          usersWithMFA: 0,
          mfaCoveragePercent: 0,
          staleAccounts: 0,
          riskyUsers: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        userBreakdown: {
          byType: [],
          byDepartment: [],
          byLicense: [],
        },
        accessIssues: [],
        recommendations: hasData ? [
          `${realData.totalUsers} total users tracked across tenants`,
          'Connect to Graph API for detailed identity data',
        ] : [
          'No identity data available',
          'Add customer tenants to analyze identity posture',
        ],
        generatedAt: now,
      };
    }
    
    case 'devices': {
      return {
        summary: {
          totalDevices: realData.totalDevices,
          compliantDevices: 0,
          nonCompliantDevices: 0,
          complianceRate: 0,
          managedDevices: 0,
          unmanaged: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        deviceBreakdown: {
          byOS: [],
          byType: [],
        },
        complianceIssues: [],
        recommendations: hasData ? [
          `${realData.totalDevices} total devices tracked`,
          'Connect to Intune for detailed device data',
        ] : [
          'No device data available',
          'Add customer tenants to analyze device compliance',
        ],
        generatedAt: now,
      };
    }
    
    case 'exchange': {
      return {
        summary: {
          totalMailboxes: 0,
          activeMailboxes: 0,
          sharedMailboxes: 0,
          mailFlowRules: 0,
          quarantinedMessages: 0,
          spamBlocked: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        mailboxStats: {
          bySize: [],
          byType: [],
        },
        securityMetrics: {
          externalForwarding: 0,
          autoForwardRules: 0,
          delegatedAccess: 0,
          inboxRules: 0,
        },
        issues: [],
        recommendations: hasData ? [
          'Connect to Exchange Online for mailbox data',
          'Run mail flow analysis on connected tenants',
        ] : [
          'No Exchange data available',
          'Add customer tenants to analyze mailbox configuration',
        ],
        generatedAt: now,
      };
    }
    
    case 'sharepoint': {
      return {
        summary: {
          totalSites: 0,
          activeSites: 0,
          totalStorage: '0 GB',
          usedStorage: '0 GB',
          externalSharing: 0,
          anonymousLinks: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        siteBreakdown: {
          byType: [],
          byActivity: [],
        },
        sharingRisks: [],
        recommendations: hasData ? [
          'Connect to SharePoint Online for site data',
          'Run sharing analysis on connected tenants',
        ] : [
          'No SharePoint data available',
          'Add customer tenants to analyze SharePoint configuration',
        ],
        generatedAt: now,
      };
    }
    
    case 'teams': {
      return {
        summary: {
          totalTeams: 0,
          activeTeams: 0,
          totalChannels: 0,
          privateChannels: 0,
          guestUsers: 0,
          externalAccess: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        teamsBreakdown: {
          byActivity: [],
          bySize: [],
        },
        governance: {
          teamsWithOwners: 0,
          orphanedTeams: 0,
          teamsWithGuests: 0,
          teamsWithExternalSharing: 0,
        },
        recommendations: hasData ? [
          'Connect to Teams for collaboration data',
          'Run governance analysis on connected tenants',
        ] : [
          'No Teams data available',
          'Add customer tenants to analyze Teams governance',
        ],
        generatedAt: now,
      };
    }
    
    case 'licensing': {
      return {
        summary: {
          totalLicenses: 0,
          assignedLicenses: 0,
          availableLicenses: 0,
          utilizationRate: 0,
          monthlySpend: '$0',
          potentialSavings: '$0',
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        licenseBreakdown: [],
        unusedLicenses: [],
        recommendations: hasData ? [
          'Connect to Graph API for license data',
          'Run license optimization analysis',
        ] : [
          'No licensing data available',
          'Add customer tenants to analyze license usage',
        ],
        generatedAt: now,
      };
    }
    
    case 'copilot': {
      return {
        summary: {
          totalLicenses: 0,
          activatedUsers: 0,
          activeUsers: 0,
          adoptionRate: 0,
          avgInteractionsPerUser: 0,
          timeSavedHours: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        usageBreakdown: {
          byApp: [],
          byDepartment: [],
        },
        topUsers: [],
        recommendations: hasData ? [
          'Connect to Copilot analytics for usage data',
          'Track adoption metrics across tenants',
        ] : [
          'No Copilot data available',
          'Add customer tenants to analyze Copilot adoption',
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
          totalChanges: 0,
          criticalChanges: 0,
          autoRemediated: 0,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        recentDrift: [],
        driftByCategory: [],
        recommendations: hasData ? [
          `${realData.driftRunsCount} drift scans recorded`,
          `${realData.driftDetectedCount} scans detected drift`,
        ] : [
          'No drift detection data available',
          'Configure drift detection for connected tenants',
        ],
        generatedAt: now,
      };
    }
    
    case 'tenant_health': {
      return {
        summary: {
          overallHealth: 0,
          servicesHealthy: 0,
          servicesTotal: 0,
          activeIncidents: 0,
          plannedMaintenance: 0,
          lastChecked: now,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        serviceStatus: [],
        recentIncidents: [],
        recommendations: hasData ? [
          `${realData.tenantCount} tenants connected`,
          'Run health checks on connected tenants',
        ] : [
          'No tenant health data available',
          'Add customer tenants to monitor health',
        ],
        generatedAt: now,
      };
    }
    
    case 'billing': {
      return {
        summary: {
          totalSpend: `$${realData.totalBillableAmount.toLocaleString()}`,
          previousPeriod: '$0',
          changePercent: 0,
          topCostCenter: 'N/A',
          projectedAnnual: `$${(realData.totalBillableAmount * 12).toLocaleString()}`,
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
          totalUsers: realData.totalUsers,
          totalDevices: realData.totalDevices,
        },
        spendBreakdown: [],
        trendData: [],
        costOptimization: [],
        recommendations: hasData ? [
          `$${realData.totalBillableAmount.toLocaleString()} total billable amount`,
          `${realData.billingUsageCount} billing records found`,
        ] : [
          'No billing data available',
          'Track resource usage to generate billing reports',
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
          customerCount: realData.customerCount,
          tenantCount: realData.tenantCount,
        },
        message: hasData 
          ? 'Report data generated - connect to Microsoft APIs for detailed metrics'
          : 'No customers or tenants configured. Add tenants to generate meaningful reports.',
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
      // If we have a template ID and category, use template-specific generation with real data
      if (body.templateId && body.templateCategory) {
        // Fetch real data from the database
        const realData = await fetchRealData(
          supabase, 
          user.id, 
          body.customerId,
          body.dateRangeStart,
          body.dateRangeEnd
        );
        console.log('Real data fetched:', realData);
        reportData = generateTemplateData(body.templateId, body.templateCategory, realData);
      } else {
        // Fall back to standard report type generation
        switch (body.reportType) {
          case 'executive_summary': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalCustomers: realData.customerCount,
                totalTenants: realData.tenantCount,
                totalExports: realData.exportJobsCount,
                completedExports: realData.completedExportsCount,
                exportSuccessRate: realData.exportJobsCount > 0 ? Math.round((realData.completedExportsCount / realData.exportJobsCount) * 100) : 0,
                avgComplianceScore: realData.avgComplianceScore,
                driftDetectionRuns: realData.driftRunsCount,
                driftDetectedCount: realData.driftDetectedCount,
                totalUsers: realData.totalUsers,
                totalDevices: realData.totalDevices,
              },
              recommendations: [
                realData.avgComplianceScore < 80 && realData.avgComplianceScore > 0 ? 'Review compliance policies to improve score' : null,
                realData.driftDetectedCount > 0 ? 'Address detected configuration drift' : null,
                realData.customerCount === 0 ? 'Add customer tenants to manage' : null,
                realData.tenantCount === 0 ? 'Connect tenant credentials to enable monitoring' : null,
              ].filter(Boolean),
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'compliance': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalChecks: realData.complianceChecksCount,
                averageScore: realData.avgComplianceScore,
                customerCount: realData.customerCount,
                tenantCount: realData.tenantCount,
              },
              history: [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'drift': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalRuns: realData.driftRunsCount,
                runsWithDrift: realData.driftDetectedCount,
                driftRate: realData.driftRunsCount > 0 ? Math.round((realData.driftDetectedCount / realData.driftRunsCount) * 100) : 0,
                customerCount: realData.customerCount,
                tenantCount: realData.tenantCount,
              },
              runs: [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'billing': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalResources: 0,
                totalUsers: realData.totalUsers,
                totalDevices: realData.totalDevices,
                totalBillable: realData.totalBillableAmount,
                periodCount: realData.billingUsageCount,
                customerCount: realData.customerCount,
                tenantCount: realData.tenantCount,
              },
              usage: [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'security': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                complianceScore: realData.avgComplianceScore,
                checksRun: realData.complianceChecksCount,
                customerCount: realData.customerCount,
                tenantCount: realData.tenantCount,
              },
              details: [],
              recommendations: realData.customerCount === 0 ? ['Add customer tenants to run security assessments'] : [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'tenant_summary': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalCustomers: realData.customerCount,
                totalTenants: realData.tenantCount,
                totalUsers: realData.totalUsers,
                totalDevices: realData.totalDevices,
                complianceScore: realData.avgComplianceScore,
              },
              tenants: [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          case 'psa_tickets': {
            const realData = await fetchRealData(supabase, user.id, body.customerId, body.dateRangeStart, body.dateRangeEnd);

            reportData = {
              summary: {
                totalTickets: realData.psaTicketsCount,
                customerCount: realData.customerCount,
                tenantCount: realData.tenantCount,
              },
              tickets: [],
              generatedAt: new Date().toISOString(),
            };
            break;
          }

          default:
            reportData = {
              message: 'Unknown report type',
              generatedAt: new Date().toISOString(),
            };
        }
      }

      // Update report with generated data
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
        .update({
          status: 'failed',
          data: { error: errorMessage },
        })
        .eq('id', body.reportId)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ error: 'Failed to generate report', details: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
