import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UsageRequest {
  customerId?: string;
  tenantConnectionId?: string;
  periodStart?: string;
  periodEnd?: string;
}

interface GraphApiUsageData {
  users: number;
  devices: number;
  groups: number;
  applications: number;
  conditionalAccessPolicies: number;
  subscribedSkus: number;
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
    throw new Error(`Token acquisition failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getResourceCount(accessToken: string, endpoint: string): Promise<number> {
  try {
    // Use $count for supported endpoints
    const countUrl = `https://graph.microsoft.com/v1.0/${endpoint}/$count`;
    const countResponse = await fetch(countUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ConsistencyLevel': 'eventual',
      },
    });

    if (countResponse.ok) {
      const count = await countResponse.text();
      return parseInt(count, 10) || 0;
    }

    // Fallback: fetch first page and check @odata.count
    const listUrl = `https://graph.microsoft.com/v1.0/${endpoint}?$top=1&$count=true`;
    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ConsistencyLevel': 'eventual',
      },
    });

    if (listResponse.ok) {
      const data = await listResponse.json();
      return data['@odata.count'] ?? data.value?.length ?? 0;
    }

    return 0;
  } catch (error) {
    console.error(`Failed to get count for ${endpoint}:`, error);
    return 0;
  }
}

async function collectTenantUsage(
  accessToken: string
): Promise<GraphApiUsageData> {
  console.log('Collecting tenant usage data...');

  const [users, devices, groups, applications, conditionalAccessPolicies, subscribedSkus] = await Promise.all([
    getResourceCount(accessToken, 'users'),
    getResourceCount(accessToken, 'devices'),
    getResourceCount(accessToken, 'groups'),
    getResourceCount(accessToken, 'applications'),
    getResourceCount(accessToken, 'identity/conditionalAccess/policies'),
    getResourceCount(accessToken, 'subscribedSkus'),
  ]);

  return {
    users,
    devices,
    groups,
    applications,
    conditionalAccessPolicies,
    subscribedSkus,
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

    const body: UsageRequest = await req.json();
    console.log('Collecting usage for:', body);

    // Determine date range
    const now = new Date();
    const periodStart = body.periodStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = body.periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Get tenant connections to collect usage for
    let query = supabase
      .from('tenant_connections')
      .select('id, tenant_id, customer_id, display_name, tenant_name')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    if (body.tenantConnectionId) {
      query = query.eq('id', body.tenantConnectionId);
    } else if (body.customerId) {
      query = query.eq('customer_id', body.customerId);
    }

    const { data: tenantConnections, error: tenantError } = await query;

    if (tenantError) {
      throw new Error(`Failed to get tenant connections: ${tenantError.message}`);
    }

    if (!tenantConnections || tenantConnections.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No connected tenants found',
          collected: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      tenantId: string;
      customerId: string | null;
      success: boolean;
      usage?: GraphApiUsageData;
      error?: string;
    }> = [];

    // Collect usage for each tenant
    for (const tenant of tenantConnections) {
      try {
        // Get credentials
        const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenant.id,
          p_user_id: user.id,
        });

        if (credError || !credentials || credentials.length === 0) {
          results.push({
            tenantId: tenant.tenant_id,
            customerId: tenant.customer_id,
            success: false,
            error: 'No credentials found',
          });
          continue;
        }

        const cred = credentials[0];
        
        // Get access token
        const accessToken = await getGraphAccessToken(
          cred.client_id,
          cred.client_secret,
          cred.tenant_id
        );

        // Collect usage data
        const usageData = await collectTenantUsage(accessToken);

        // Calculate totals
        const totalResources = 
          usageData.users + 
          usageData.devices + 
          usageData.groups + 
          usageData.applications + 
          usageData.conditionalAccessPolicies;

        // Check for existing record for this period and customer
        const { data: existingUsage } = await supabase
          .from('billing_usage')
          .select('id')
          .eq('customer_id', tenant.customer_id)
          .eq('period_start', periodStart)
          .eq('period_end', periodEnd)
          .eq('user_id', user.id)
          .single();

        const usageRecord = {
          customer_id: tenant.customer_id,
          period_start: periodStart,
          period_end: periodEnd,
          resource_counts: usageData,
          total_resources: totalResources,
          total_users: usageData.users,
          total_devices: usageData.devices,
          notes: `Collected from ${tenant.display_name || tenant.tenant_name || tenant.tenant_id} on ${new Date().toISOString()}`,
          user_id: user.id,
        };

        if (existingUsage) {
          // Update existing record
          await supabase
            .from('billing_usage')
            .update({
              resource_counts: usageData,
              total_resources: totalResources,
              total_users: usageData.users,
              total_devices: usageData.devices,
              notes: usageRecord.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUsage.id);
        } else {
          // Insert new record
          await supabase
            .from('billing_usage')
            .insert(usageRecord);
        }

        results.push({
          tenantId: tenant.tenant_id,
          customerId: tenant.customer_id,
          success: true,
          usage: usageData,
        });

        console.log(`Collected usage for tenant ${tenant.tenant_id}:`, usageData);

      } catch (tenantError) {
        console.error(`Failed to collect usage for tenant ${tenant.tenant_id}:`, tenantError);
        results.push({
          tenantId: tenant.tenant_id,
          customerId: tenant.customer_id,
          success: false,
          error: tenantError instanceof Error ? tenantError.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Usage collection complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Collected usage for ${successCount} tenant(s)`,
        collected: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Collect usage error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
