import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  reportId: string;
  reportType: string;
  customerId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
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
      switch (body.reportType) {
        case 'executive_summary': {
          // Gather comprehensive data for executive summary
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
          // Compliance-specific report
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
          // Drift detection report
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
          // Billing/usage report
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

          // Map customer IDs to names
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
          // Security posture report
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
          // Tenant summary report
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

          // Group health checks by tenant
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
          // PSA tickets report
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
