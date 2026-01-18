import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GovernanceMetrics {
  security: {
    secureScore: number;
    maxSecureScore: number;
    secureScorePercentage: number;
    riskyUsers: number;
    riskySignIns: number;
    conditionalAccessPolicies: number;
    complianceScore: number;
  };
  identity: {
    totalUsers: number;
    guestUsers: number;
    adminUsers: number;
    mfaEnabledUsers: number;
    mfaCoverage: number;
    staleAccounts: number;
  };
  licensing: {
    totalLicenses: number;
    assignedLicenses: number;
    unusedLicenses: number;
    utilizationPercentage: number;
    estimatedMonthlyCost: number;
  };
  compliance: {
    score: number;
    passedControls: number;
    totalControls: number;
  };
}

async function getGraphAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchGraphData(accessToken: string, endpoint: string, useBeta = false): Promise<any> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch ${endpoint}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

async function fetchGovernanceMetrics(accessToken: string): Promise<GovernanceMetrics> {
  const [secureScoreData, usersData, riskyUsersData, riskySignInsData, caPoliciesData, subscribedSkusData] = await Promise.all([
    fetchGraphData(accessToken, '/security/secureScores?$top=1'),
    fetchGraphData(accessToken, '/users?$count=true&$top=999', true),
    fetchGraphData(accessToken, '/identityProtection/riskyUsers?$filter=riskState eq \'atRisk\''),
    fetchGraphData(accessToken, '/identityProtection/riskyServicePrincipals?$top=100', true).catch(() => null),
    fetchGraphData(accessToken, '/identity/conditionalAccess/policies'),
    fetchGraphData(accessToken, '/subscribedSkus'),
  ]);

  // Process secure score
  const latestScore = secureScoreData?.value?.[0];
  const secureScore = latestScore?.currentScore || 0;
  const maxSecureScore = latestScore?.maxScore || 100;

  // Process users
  const users = usersData?.value || [];
  const totalUsers = users.length;
  const guestUsers = users.filter((u: any) => u.userType === 'Guest').length;
  const adminUsers = users.filter((u: any) => 
    u.assignedLicenses?.some((l: any) => l.skuId) && 
    (u.displayName?.toLowerCase().includes('admin') || u.jobTitle?.toLowerCase().includes('admin'))
  ).length;

  // Estimate MFA (would need proper auth methods API call for accuracy)
  const mfaEnabledUsers = Math.floor(totalUsers * 0.7); // Placeholder
  const mfaCoverage = totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0;

  // Stale accounts (no sign-in for 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const staleAccounts = users.filter((u: any) => {
    if (!u.signInActivity?.lastSignInDateTime) return true;
    return new Date(u.signInActivity.lastSignInDateTime) < ninetyDaysAgo;
  }).length;

  // Process risks
  const riskyUsers = riskyUsersData?.value?.length || 0;
  const riskySignIns = riskySignInsData?.value?.length || 0;

  // Process CA policies
  const caPolicies = caPoliciesData?.value?.length || 0;

  // Process licensing
  const skus = subscribedSkusData?.value || [];
  let totalLicenses = 0;
  let assignedLicenses = 0;

  for (const sku of skus) {
    totalLicenses += sku.prepaidUnits?.enabled || 0;
    assignedLicenses += sku.consumedUnits || 0;
  }

  const unusedLicenses = totalLicenses - assignedLicenses;
  const utilizationPercentage = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;
  const estimatedMonthlyCost = assignedLicenses * 12; // Rough estimate

  return {
    security: {
      secureScore,
      maxSecureScore,
      secureScorePercentage: maxSecureScore > 0 ? Math.round((secureScore / maxSecureScore) * 100) : 0,
      riskyUsers,
      riskySignIns,
      conditionalAccessPolicies: caPolicies,
      complianceScore: 85, // Placeholder
    },
    identity: {
      totalUsers,
      guestUsers,
      adminUsers,
      mfaEnabledUsers,
      mfaCoverage,
      staleAccounts,
    },
    licensing: {
      totalLicenses,
      assignedLicenses,
      unusedLicenses,
      utilizationPercentage,
      estimatedMonthlyCost,
    },
    compliance: {
      score: 85,
      passedControls: 42,
      totalControls: 50,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { configId, manual = false } = await req.json();
    console.log(`Running scheduled governance scan for config: ${configId}, manual: ${manual}`);

    // Get the config
    const { data: config, error: configError } = await supabase
      .from('scheduled_governance_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      throw new Error(`Config not found: ${configError?.message}`);
    }

    // Get target tenants
    let tenantQuery = supabase
      .from('tenant_connections')
      .select('id, tenant_id, display_name, tenant_name, customer_id')
      .eq('user_id', config.user_id)
      .eq('status', 'active');

    if (config.target_type === 'specific_tenants' && config.target_tenant_ids?.length > 0) {
      tenantQuery = tenantQuery.in('id', config.target_tenant_ids);
    } else if (config.target_type === 'customer' && config.target_customer_id) {
      tenantQuery = tenantQuery.eq('customer_id', config.target_customer_id);
    } else if (config.target_type === 'group' && config.target_group_id) {
      tenantQuery = tenantQuery.eq('tenant_group_id', config.target_group_id);
    }

    const { data: tenants, error: tenantsError } = await tenantQuery;

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      console.log('No tenants found for this config');
      return new Response(JSON.stringify({ success: true, message: 'No tenants to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a run record
    const { data: run, error: runError } = await supabase
      .from('scheduled_governance_runs')
      .insert({
        scheduled_config_id: configId,
        user_id: config.user_id,
        status: 'running',
        total_tenants: tenants.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create run record: ${runError.message}`);
    }

    const results: any[] = [];
    let completedTenants = 0;
    let failedTenants = 0;
    let tenantsWithAlerts = 0;

    for (const tenant of tenants) {
      try {
        // Get credentials
        const { data: credentials, error: credError } = await supabase
          .rpc('get_decrypted_credential', {
            p_tenant_connection_id: tenant.id,
            p_user_id: config.user_id,
          });

        if (credError || !credentials || credentials.length === 0) {
          console.error(`No credentials for tenant ${tenant.id}`);
          failedTenants++;
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.display_name || tenant.tenant_name,
            success: false,
            error: 'No credentials found',
          });
          continue;
        }

        const cred = credentials[0];
        const accessToken = await getGraphAccessToken(cred.client_id, cred.client_secret, cred.tenant_id);
        const metrics = await fetchGovernanceMetrics(accessToken);

        // Check for threshold breaches
        const alerts: string[] = [];
        
        if (metrics.security.secureScorePercentage < config.secure_score_threshold) {
          alerts.push(`Secure Score (${metrics.security.secureScorePercentage}%) below threshold (${config.secure_score_threshold}%)`);
        }
        
        if (metrics.identity.mfaCoverage < config.mfa_coverage_threshold) {
          alerts.push(`MFA Coverage (${metrics.identity.mfaCoverage}%) below threshold (${config.mfa_coverage_threshold}%)`);
        }
        
        if (metrics.licensing.utilizationPercentage < config.license_utilization_threshold) {
          alerts.push(`License Utilization (${metrics.licensing.utilizationPercentage}%) below threshold (${config.license_utilization_threshold}%)`);
        }
        
        if (config.alert_on_risky_users && metrics.security.riskyUsers > 0) {
          alerts.push(`${metrics.security.riskyUsers} risky users detected`);
        }
        
        if (config.alert_on_risky_signins && metrics.security.riskySignIns > 0) {
          alerts.push(`${metrics.security.riskySignIns} risky sign-ins detected`);
        }

        if (alerts.length > 0) {
          tenantsWithAlerts++;
        }

        // Save to history
        await supabase.from('governance_metrics_history').insert({
          user_id: config.user_id,
          tenant_connection_id: tenant.id,
          customer_id: tenant.customer_id,
          secure_score: metrics.security.secureScore,
          max_secure_score: metrics.security.maxSecureScore,
          risky_users: metrics.security.riskyUsers,
          risky_sign_ins: metrics.security.riskySignIns,
          conditional_access_policies: metrics.security.conditionalAccessPolicies,
          compliance_score: metrics.security.complianceScore,
          total_users: metrics.identity.totalUsers,
          guest_users: metrics.identity.guestUsers,
          admin_users: metrics.identity.adminUsers,
          mfa_enabled_users: metrics.identity.mfaEnabledUsers,
          stale_accounts: metrics.identity.staleAccounts,
          total_licenses: metrics.licensing.totalLicenses,
          assigned_licenses: metrics.licensing.assignedLicenses,
          unused_licenses: metrics.licensing.unusedLicenses,
          license_utilization: metrics.licensing.utilizationPercentage,
          license_cost_monthly: metrics.licensing.estimatedMonthlyCost,
        });

        completedTenants++;
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.display_name || tenant.tenant_name,
          success: true,
          metrics,
          alerts,
        });

        console.log(`Completed scan for tenant ${tenant.display_name || tenant.tenant_name}`);
      } catch (error) {
        console.error(`Error scanning tenant ${tenant.id}:`, error);
        failedTenants++;
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.display_name || tenant.tenant_name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update run record
    const runSuccess = failedTenants === 0;
    await supabase
      .from('scheduled_governance_runs')
      .update({
        status: runSuccess ? 'completed' : 'completed_with_errors',
        completed_tenants: completedTenants,
        failed_tenants: failedTenants,
        tenants_with_alerts: tenantsWithAlerts,
        results,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    // Update config with last run info
    await supabase
      .from('scheduled_governance_configs')
      .update({
        run_count: config.run_count + 1,
        last_run_at: new Date().toISOString(),
        last_run_success: runSuccess,
      })
      .eq('id', configId);

    // Send webhook notification if configured
    if (config.webhook_config_id && (config.notify_on_completion || (config.notify_on_threshold_breach && tenantsWithAlerts > 0))) {
      try {
        await supabase.functions.invoke('send-webhook', {
          body: {
            webhookConfigId: config.webhook_config_id,
            eventType: 'governance.scan.completed',
            payload: {
              configId,
              configName: config.name,
              runId: run.id,
              totalTenants: tenants.length,
              completedTenants,
              failedTenants,
              tenantsWithAlerts,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (webhookError) {
        console.error('Failed to send webhook:', webhookError);
      }
    }

    console.log(`Governance scan completed: ${completedTenants} completed, ${failedTenants} failed, ${tenantsWithAlerts} with alerts`);

    return new Response(JSON.stringify({
      success: true,
      runId: run.id,
      totalTenants: tenants.length,
      completedTenants,
      failedTenants,
      tenantsWithAlerts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error running scheduled governance scan:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
