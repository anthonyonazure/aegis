import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GovernanceMetrics {
  security: {
    riskySignInsCount: number;
    riskySignInsHigh: number;
    riskySignInsMedium: number;
    mfaGapsCount: number;
    adminsMissingMfa: number;
    legacyAuthAttempts: number;
    conditionalAccessPolicies: number;
    secureScore: number;
    maxSecureScore: number;
  };
  identity: {
    totalUsers: number;
    adminUsers: number;
    guestUsers: number;
    mfaEnabledUsers: number;
    staleGuestAccounts: number;
    staleUserAccounts: number;
    privilegedRoleHolders: number;
    riskyUsers: number;
  };
  licensing: {
    totalLicenses: number;
    assignedLicenses: number;
    unusedLicenses: number;
    utilizationRate: number;
    licensesByProduct: Array<{
      productName: string;
      total: number;
      assigned: number;
      available: number;
    }>;
  };
  compliance: {
    conditionalAccessEnabled: boolean;
    mfaCoverage: number;
    legacyAuthBlocked: boolean;
    guestAccessRestricted: boolean;
  };
}

interface DynamicAction {
  id: string;
  title: string;
  description: string;
  category: 'security' | 'compliance' | 'identity' | 'licensing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actionType: 'policy' | 'config' | 'review' | 'remediate';
  policyTemplateId?: string;
  reportTemplateId?: string;
  affectedCount?: number;
}

async function getGraphAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to get access token');
  }

  return data.access_token;
}

async function fetchGraphData(accessToken: string, endpoint: string, useBeta = false): Promise<any> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`Graph API error for ${endpoint}:`, errorData);
    // Return empty result instead of throwing for partial failures
    return null;
  }

  return await response.json();
}

// Fetch full paginated collections from Microsoft Graph.
// Many list endpoints return partial results with @odata.nextLink.
async function fetchGraphCollection(accessToken: string, endpoint: string, useBeta = false): Promise<any[]> {
  const baseUrl = useBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  let nextUrl: string | null = `${baseUrl}${endpoint}`;
  const results: any[] = [];

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Graph API collection error for ${nextUrl}:`, errorData);
      return results;
    }

    const page: any = await response.json();
    const pageValues = Array.isArray(page?.value) ? page.value : [];
    results.push(...pageValues);

    nextUrl = typeof page?.['@odata.nextLink'] === 'string' ? page['@odata.nextLink'] : null;
  }

  return results;
}

async function fetchSecurityMetrics(accessToken: string): Promise<GovernanceMetrics['security']> {
  const [riskySignIns, secureScore, conditionalAccess] = await Promise.all([
    fetchGraphData(accessToken, '/identityProtection/riskySignInDetections?$top=100', true).catch(() => null),
    fetchGraphData(accessToken, '/security/secureScores?$top=1', true).catch(() => null),
    fetchGraphData(accessToken, '/identity/conditionalAccess/policies').catch(() => null),
  ]);

  const riskySignInsData = riskySignIns?.value || [];
  const riskyHigh = riskySignInsData.filter((r: any) => r.riskLevel === 'high').length;
  const riskyMedium = riskySignInsData.filter((r: any) => r.riskLevel === 'medium').length;

  const secureScoreData = secureScore?.value?.[0];
  const currentScore = secureScoreData?.currentScore || 0;
  const maxScore = secureScoreData?.maxScore || 100;

  return {
    riskySignInsCount: riskySignInsData.length,
    riskySignInsHigh: riskyHigh,
    riskySignInsMedium: riskyMedium,
    mfaGapsCount: 0, // Will be calculated from users
    adminsMissingMfa: 0, // Will be calculated
    legacyAuthAttempts: 0, // From sign-in logs
    conditionalAccessPolicies: conditionalAccess?.value?.length || 0,
    secureScore: currentScore,
    maxSecureScore: maxScore,
  };
}

async function fetchIdentityMetrics(accessToken: string): Promise<GovernanceMetrics['identity'] & { adminsMissingMfa: number; mfaGapsCount: number }> {
  const [users, directoryRoles, riskyUsers, authMethods] = await Promise.all([
    fetchGraphData(accessToken, '/users?$select=id,displayName,userType,accountEnabled,signInActivity&$top=999').catch(() => null),
    fetchGraphData(accessToken, '/directoryRoles?$expand=members').catch(() => null),
    fetchGraphData(accessToken, '/identityProtection/riskyUsers?$top=100', true).catch(() => null),
    fetchGraphData(accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999', true).catch(() => null),
  ]);

  const usersData = users?.value || [];
  const totalUsers = usersData.length;
  const guestUsers = usersData.filter((u: any) => u.userType === 'Guest').length;
  
  // Calculate stale accounts (no sign-in in 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const staleGuests = usersData.filter((u: any) => {
    if (u.userType !== 'Guest') return false;
    const lastSignIn = u.signInActivity?.lastSignInDateTime;
    return !lastSignIn || new Date(lastSignIn) < ninetyDaysAgo;
  }).length;

  const staleUsers = usersData.filter((u: any) => {
    if (u.userType === 'Guest') return false;
    const lastSignIn = u.signInActivity?.lastSignInDateTime;
    return !lastSignIn || new Date(lastSignIn) < ninetyDaysAgo;
  }).length;

  // Count admin users
  const adminRoleIds = [
    '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
    'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
    '194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
  ];
  
  const rolesData = directoryRoles?.value || [];
  const adminUserIds = new Set<string>();
  
  for (const role of rolesData) {
    const members = role.members || [];
    for (const member of members) {
      if (member['@odata.type'] === '#microsoft.graph.user') {
        adminUserIds.add(member.id);
      }
    }
  }

  // MFA registration data
  const authMethodsData = authMethods?.value || [];
  const mfaEnabledUsers = authMethodsData.filter((u: any) => u.isMfaRegistered).length;
  const usersWithoutMfa = authMethodsData.filter((u: any) => !u.isMfaRegistered);
  
  // Check which admins are missing MFA
  const adminsMissingMfa = usersWithoutMfa.filter((u: any) => adminUserIds.has(u.id)).length;

  const riskyUsersData = riskyUsers?.value || [];

  return {
    totalUsers,
    adminUsers: adminUserIds.size,
    guestUsers,
    mfaEnabledUsers,
    staleGuestAccounts: staleGuests,
    staleUserAccounts: staleUsers,
    privilegedRoleHolders: adminUserIds.size,
    riskyUsers: riskyUsersData.filter((u: any) => u.riskState === 'atRisk').length,
    adminsMissingMfa,
    mfaGapsCount: totalUsers - mfaEnabledUsers,
  };
}

async function fetchLicensingMetrics(accessToken: string): Promise<GovernanceMetrics['licensing']> {
  // NOTE: Graph may paginate subscribedSkus; fetch all pages.
  const skusData = await fetchGraphCollection(accessToken, '/subscribedSkus?$top=999').catch(() => []);
  let totalLicenses = 0;
  let assignedLicenses = 0;

  const licensesByProduct = skusData.map((sku: any) => {
    const total = sku.prepaidUnits?.enabled || 0;
    const assigned = sku.consumedUnits || 0;
    
    totalLicenses += total;
    assignedLicenses += assigned;

    return {
      productName: sku.skuPartNumber || 'Unknown',
      total,
      assigned,
      available: total - assigned,
    };
  }).filter((l: any) => l.total > 0);

  return {
    totalLicenses,
    assignedLicenses,
    unusedLicenses: totalLicenses - assignedLicenses,
    utilizationRate: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0,
    licensesByProduct,
  };
}

function generateDynamicActions(metrics: GovernanceMetrics, identityExtras: { adminsMissingMfa: number; mfaGapsCount: number }): DynamicAction[] {
  const actions: DynamicAction[] = [];

  // Critical: Admins without MFA
  if (identityExtras.adminsMissingMfa > 0) {
    actions.push({
      id: 'dynamic-mfa-admins',
      title: `Enable MFA for ${identityExtras.adminsMissingMfa} admin account${identityExtras.adminsMissingMfa > 1 ? 's' : ''}`,
      description: `${identityExtras.adminsMissingMfa} admin accounts do not have MFA enabled, exposing privileged access to potential compromise.`,
      category: 'security',
      severity: 'critical',
      impact: 'Prevents 99.9% of account compromise attacks on admin accounts',
      effort: 'low',
      actionType: 'policy',
      policyTemplateId: 'MFA Enforcement Policy',
      affectedCount: identityExtras.adminsMissingMfa,
    });
  }

  // High: Risky sign-ins detected
  if (metrics.security.riskySignInsHigh > 0) {
    actions.push({
      id: 'dynamic-risky-signins',
      title: `Investigate ${metrics.security.riskySignInsHigh} high-risk sign-ins`,
      description: `${metrics.security.riskySignInsHigh} high-risk sign-in attempts detected that may indicate compromised accounts.`,
      category: 'security',
      severity: 'critical',
      impact: 'Identify and remediate potentially compromised accounts',
      effort: 'medium',
      actionType: 'review',
      reportTemplateId: 'sec-risky-signins',
      affectedCount: metrics.security.riskySignInsHigh,
    });
  }

  // High: No Conditional Access policies
  if (metrics.security.conditionalAccessPolicies === 0) {
    actions.push({
      id: 'dynamic-no-ca',
      title: 'Configure Conditional Access policies',
      description: 'No Conditional Access policies are configured. This leaves your environment without modern access controls.',
      category: 'security',
      severity: 'high',
      impact: 'Enforces security controls based on user, device, and location',
      effort: 'medium',
      actionType: 'config',
      policyTemplateId: 'Conditional Access Baseline',
    });
  }

  // Medium: MFA coverage gaps
  const mfaCoverage = metrics.identity.totalUsers > 0 
    ? Math.round((metrics.identity.mfaEnabledUsers / metrics.identity.totalUsers) * 100)
    : 0;
  
  if (mfaCoverage < 90 && identityExtras.mfaGapsCount > 0) {
    actions.push({
      id: 'dynamic-mfa-gaps',
      title: `Close MFA gaps for ${identityExtras.mfaGapsCount} users`,
      description: `Only ${mfaCoverage}% of users have MFA enabled. ${identityExtras.mfaGapsCount} users are not protected by multi-factor authentication.`,
      category: 'security',
      severity: mfaCoverage < 70 ? 'high' : 'medium',
      impact: 'Increases protection against credential theft and phishing',
      effort: 'low',
      actionType: 'policy',
      policyTemplateId: 'MFA Enforcement Policy',
      affectedCount: identityExtras.mfaGapsCount,
    });
  }

  // Medium: Stale guest accounts
  if (metrics.identity.staleGuestAccounts > 10) {
    actions.push({
      id: 'dynamic-stale-guests',
      title: `Review ${metrics.identity.staleGuestAccounts} stale guest accounts`,
      description: `${metrics.identity.staleGuestAccounts} guest users have not signed in for over 90 days. Consider removing or restricting access.`,
      category: 'identity',
      severity: 'medium',
      impact: 'Reduces attack surface and maintains clean directory',
      effort: 'low',
      actionType: 'remediate',
      policyTemplateId: 'Guest User Access Restriction',
      reportTemplateId: 'id-guest-users',
      affectedCount: metrics.identity.staleGuestAccounts,
    });
  }

  // Medium: Too many privileged users
  if (metrics.identity.privilegedRoleHolders > 10) {
    actions.push({
      id: 'dynamic-privileged-roles',
      title: `Review ${metrics.identity.privilegedRoleHolders} privileged role holders`,
      description: `${metrics.identity.privilegedRoleHolders} users have privileged admin roles. Consider using Privileged Identity Management (PIM) for just-in-time access.`,
      category: 'identity',
      severity: 'medium',
      impact: 'Reduces standing privilege and improves security posture',
      effort: 'medium',
      actionType: 'review',
      policyTemplateId: 'Privileged Identity Management',
      reportTemplateId: 'id-privileged-users',
      affectedCount: metrics.identity.privilegedRoleHolders,
    });
  }

  // Medium: Risky users
  if (metrics.identity.riskyUsers > 0) {
    actions.push({
      id: 'dynamic-risky-users',
      title: `Remediate ${metrics.identity.riskyUsers} risky user${metrics.identity.riskyUsers > 1 ? 's' : ''}`,
      description: `${metrics.identity.riskyUsers} users have been flagged as risky due to suspicious activity or compromised credentials.`,
      category: 'security',
      severity: metrics.identity.riskyUsers > 5 ? 'high' : 'medium',
      impact: 'Protect accounts that may be compromised',
      effort: 'medium',
      actionType: 'remediate',
      reportTemplateId: 'sec-risky-users',
      affectedCount: metrics.identity.riskyUsers,
    });
  }

  // Low: License optimization
  if (metrics.licensing.unusedLicenses > 10) {
    const estimatedSavings = metrics.licensing.unusedLicenses * 35; // Rough estimate per license
    actions.push({
      id: 'dynamic-unused-licenses',
      title: `Reclaim ${metrics.licensing.unusedLicenses} unused licenses`,
      description: `${metrics.licensing.unusedLicenses} licenses are assigned but not being used. Potential monthly savings of $${estimatedSavings.toLocaleString()}.`,
      category: 'licensing',
      severity: 'low',
      impact: `Potential savings of $${estimatedSavings.toLocaleString()}/month`,
      effort: 'low',
      actionType: 'remediate',
      policyTemplateId: 'License Optimization Policy',
      reportTemplateId: 'lic-inactive-users',
      affectedCount: metrics.licensing.unusedLicenses,
    });
  }

  // Low: Low license utilization
  if (metrics.licensing.utilizationRate < 80 && metrics.licensing.totalLicenses > 50) {
    actions.push({
      id: 'dynamic-license-utilization',
      title: `Optimize license utilization (${metrics.licensing.utilizationRate}%)`,
      description: `License utilization is at ${metrics.licensing.utilizationRate}%. Review assignments and consider right-sizing license tiers.`,
      category: 'licensing',
      severity: 'low',
      impact: 'Reduce costs by matching licenses to actual usage patterns',
      effort: 'medium',
      actionType: 'review',
      policyTemplateId: 'License Optimization Policy',
      reportTemplateId: 'lic-e5-usage',
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return actions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client (bypasses RLS) used ONLY for safe lookups + calling SECURITY DEFINER RPCs.
    // We still enforce per-user ownership in queries.
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tenantConnectionId } = await req.json();

    if (!tenantConnectionId) {
      return new Response(JSON.stringify({ error: 'tenantConnectionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get credentials from database
    let credentials: any[] | null = null;
    let credentialConnectionId = tenantConnectionId;

    const { data: directCreds, error: directCredError } = await supabase.rpc('get_decrypted_credential', {
      p_tenant_connection_id: tenantConnectionId,
      p_user_id: authData.user.id,
    });
    if (!directCredError && directCreds?.[0]) {
      credentials = directCreds;
    }

    // Fallback: if the UI passed a tenant connection ID with no stored credentials
    // (common when users have duplicate tenant_connections for the same tenant_id),
    // locate another connection for the SAME tenant_id that DOES have credentials.
    if (!credentials?.[0]) {
      console.warn('No credentials found for tenantConnectionId, attempting fallback lookup:', tenantConnectionId);

      const { data: currentConn, error: currentConnError } = await adminSupabase
        .from('tenant_connections')
        .select('tenant_id')
        .eq('id', tenantConnectionId)
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (!currentConnError && currentConn?.tenant_id) {
        const { data: siblingConnections, error: siblingError } = await adminSupabase
          .from('tenant_connections')
          .select('id')
          .eq('user_id', authData.user.id)
          .eq('tenant_id', currentConn.tenant_id);

        const siblingIds = (siblingConnections || []).map((c: any) => c.id);

        if (!siblingError && siblingIds.length > 0) {
          const { data: credentialCandidates, error: candidateError } = await adminSupabase
            .from('tenant_credentials')
            .select('tenant_connection_id, created_at')
            .eq('user_id', authData.user.id)
            .in('tenant_connection_id', siblingIds)
            .order('created_at', { ascending: false })
            .limit(1);

          const fallbackConnectionId = credentialCandidates?.[0]?.tenant_connection_id;

          if (!candidateError && fallbackConnectionId) {
            console.log('Using fallback credential connection id:', fallbackConnectionId);
            const { data: fallbackCreds, error: fallbackCredError } = await adminSupabase.rpc('get_decrypted_credential', {
              p_tenant_connection_id: fallbackConnectionId,
              p_user_id: authData.user.id,
            });

            if (!fallbackCredError && fallbackCreds?.[0]) {
              credentials = fallbackCreds;
              credentialConnectionId = fallbackConnectionId;
            }
          }
        }
      }
    }

    if (!credentials?.[0]) {
      console.error('Failed to get credentials:', directCredError ?? null);
      return new Response(JSON.stringify({ error: 'Failed to get tenant credentials' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { client_id, client_secret, tenant_id } = credentials[0];

    // Get Graph access token
    console.log('Getting access token for tenant:', tenant_id, 'using credentialConnectionId:', credentialConnectionId);
    const accessToken = await getGraphAccessToken(client_id, client_secret, tenant_id);

    // Fetch tenant info (helps ensure the connected tenant matches what the user expects)
    const organization = await fetchGraphData(accessToken, '/organization?$select=id,displayName').catch(() => null);
    const tenantInfo = organization?.value?.[0]
      ? { id: organization.value[0].id, displayName: organization.value[0].displayName }
      : null;

    // Fetch all metrics in parallel
    console.log('Fetching governance metrics...');
    const [securityMetrics, identityMetrics, licensingMetrics] = await Promise.all([
      fetchSecurityMetrics(accessToken),
      fetchIdentityMetrics(accessToken),
      fetchLicensingMetrics(accessToken),
    ]);

    // Merge security metrics with identity-derived values
    const fullSecurityMetrics: GovernanceMetrics['security'] = {
      ...securityMetrics,
      mfaGapsCount: identityMetrics.mfaGapsCount,
      adminsMissingMfa: identityMetrics.adminsMissingMfa,
    };

    const metrics: GovernanceMetrics = {
      security: fullSecurityMetrics,
      identity: identityMetrics,
      licensing: licensingMetrics,
      compliance: {
        conditionalAccessEnabled: securityMetrics.conditionalAccessPolicies > 0,
        mfaCoverage: identityMetrics.totalUsers > 0 
          ? Math.round((identityMetrics.mfaEnabledUsers / identityMetrics.totalUsers) * 100)
          : 0,
        legacyAuthBlocked: false, // Would need to check CA policies
        guestAccessRestricted: false, // Would need to check settings
      },
    };

    // Generate dynamic actions based on metrics
    const dynamicActions = generateDynamicActions(metrics, {
      adminsMissingMfa: identityMetrics.adminsMissingMfa,
      mfaGapsCount: identityMetrics.mfaGapsCount,
    });

    console.log(`Generated ${dynamicActions.length} dynamic actions`);

    return new Response(JSON.stringify({
      success: true,
      tenant: tenantInfo,
      metrics,
      actions: dynamicActions,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching governance metrics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch governance metrics',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
