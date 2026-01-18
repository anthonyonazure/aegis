import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const AuthRequestSchema = z.object({
  action: z.enum(['get-token', 'test-connection']),
  tenantId: z.string().uuid('Invalid tenant ID format'),
  clientId: z.string().uuid('Invalid client ID format'),
  clientSecret: z.string().min(1, 'Client secret required').max(1000, 'Client secret too long'),
});

const ListSubscriptionsSchema = z.object({
  action: z.literal('list-subscriptions'),
  accessToken: z.string().min(1, 'Access token required'),
});

const ListSubscriptionsFromStoredSchema = z.object({
  action: z.literal('list-subscriptions-from-stored'),
  tenantConnectionId: z.string().uuid('Invalid tenant connection ID'),
});

const ExportRequestSchema = z.object({
  action: z.literal('export'),
  accessToken: z.string().min(1, 'Access token required'),
  subscriptionIds: z.array(z.string()).min(1, 'At least one subscription required'),
  resources: z.array(z.string()).min(1, 'At least one resource type required'),
  exportJobId: z.string().uuid('Invalid export job ID'),
});

// Azure Resource Types mapping
const AZURE_RESOURCE_TYPES: Record<string, { resourceType: string; apiVersion: string }> = {
  // Compute
  'azure-compute/virtual-machines': { resourceType: 'Microsoft.Compute/virtualMachines', apiVersion: '2023-09-01' },
  'azure-compute/vm-scale-sets': { resourceType: 'Microsoft.Compute/virtualMachineScaleSets', apiVersion: '2023-09-01' },
  'azure-compute/availability-sets': { resourceType: 'Microsoft.Compute/availabilitySets', apiVersion: '2023-09-01' },
  'azure-compute/disks': { resourceType: 'Microsoft.Compute/disks', apiVersion: '2023-10-02' },
  'azure-compute/images': { resourceType: 'Microsoft.Compute/images', apiVersion: '2023-09-01' },
  'azure-compute/galleries': { resourceType: 'Microsoft.Compute/galleries', apiVersion: '2022-08-03' },
  
  // Networking
  'azure-networking/virtual-networks': { resourceType: 'Microsoft.Network/virtualNetworks', apiVersion: '2023-09-01' },
  'azure-networking/network-security-groups': { resourceType: 'Microsoft.Network/networkSecurityGroups', apiVersion: '2023-09-01' },
  'azure-networking/public-ip-addresses': { resourceType: 'Microsoft.Network/publicIPAddresses', apiVersion: '2023-09-01' },
  'azure-networking/load-balancers': { resourceType: 'Microsoft.Network/loadBalancers', apiVersion: '2023-09-01' },
  'azure-networking/application-gateways': { resourceType: 'Microsoft.Network/applicationGateways', apiVersion: '2023-09-01' },
  'azure-networking/vpn-gateways': { resourceType: 'Microsoft.Network/vpnGateways', apiVersion: '2023-09-01' },
  'azure-networking/private-endpoints': { resourceType: 'Microsoft.Network/privateEndpoints', apiVersion: '2023-09-01' },
  'azure-networking/dns-zones': { resourceType: 'Microsoft.Network/dnsZones', apiVersion: '2023-07-01-preview' },
  
  // Storage
  'azure-storage/storage-accounts': { resourceType: 'Microsoft.Storage/storageAccounts', apiVersion: '2023-01-01' },
  
  // Identity & Security
  'azure-identity/key-vaults': { resourceType: 'Microsoft.KeyVault/vaults', apiVersion: '2023-07-01' },
  'azure-identity/managed-identities': { resourceType: 'Microsoft.ManagedIdentity/userAssignedIdentities', apiVersion: '2023-01-31' },
  'azure-identity/role-assignments': { resourceType: 'Microsoft.Authorization/roleAssignments', apiVersion: '2022-04-01' },
  'azure-identity/role-definitions': { resourceType: 'Microsoft.Authorization/roleDefinitions', apiVersion: '2022-04-01' },
  'azure-identity/policy-assignments': { resourceType: 'Microsoft.Authorization/policyAssignments', apiVersion: '2022-06-01' },
  'azure-identity/policy-definitions': { resourceType: 'Microsoft.Authorization/policyDefinitions', apiVersion: '2021-06-01' },
  
  // PaaS
  'azure-paas/app-services': { resourceType: 'Microsoft.Web/sites', apiVersion: '2023-01-01' },
  'azure-paas/app-service-plans': { resourceType: 'Microsoft.Web/serverfarms', apiVersion: '2023-01-01' },
  'azure-paas/function-apps': { resourceType: 'Microsoft.Web/sites', apiVersion: '2023-01-01' },
  'azure-paas/sql-servers': { resourceType: 'Microsoft.Sql/servers', apiVersion: '2023-05-01-preview' },
  'azure-paas/sql-databases': { resourceType: 'Microsoft.Sql/servers/databases', apiVersion: '2023-05-01-preview' },
  'azure-paas/cosmos-accounts': { resourceType: 'Microsoft.DocumentDB/databaseAccounts', apiVersion: '2023-11-15' },
  'azure-paas/redis-caches': { resourceType: 'Microsoft.Cache/redis', apiVersion: '2023-08-01' },
  'azure-paas/service-bus': { resourceType: 'Microsoft.ServiceBus/namespaces', apiVersion: '2022-10-01-preview' },
  'azure-paas/event-hubs': { resourceType: 'Microsoft.EventHub/namespaces', apiVersion: '2023-01-01-preview' },
  'azure-paas/container-registries': { resourceType: 'Microsoft.ContainerRegistry/registries', apiVersion: '2023-07-01' },
  'azure-paas/aks-clusters': { resourceType: 'Microsoft.ContainerService/managedClusters', apiVersion: '2023-10-01' },
  
  // Monitoring
  'azure-monitoring/log-analytics': { resourceType: 'Microsoft.OperationalInsights/workspaces', apiVersion: '2022-10-01' },
  'azure-monitoring/app-insights': { resourceType: 'Microsoft.Insights/components', apiVersion: '2020-02-02' },
  'azure-monitoring/action-groups': { resourceType: 'Microsoft.Insights/actionGroups', apiVersion: '2023-01-01' },
  'azure-monitoring/metric-alerts': { resourceType: 'Microsoft.Insights/metricAlerts', apiVersion: '2018-03-01' },
  'azure-monitoring/activity-log-alerts': { resourceType: 'Microsoft.Insights/activityLogAlerts', apiVersion: '2020-10-01' },
};

function sanitizeError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Azure API error:', errorMessage);
  
  if (errorMessage.includes('AADSTS')) {
    return 'Azure authentication failed. Please verify your credentials.';
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Check your Azure RBAC permissions.';
  }
  if (errorMessage.includes('404')) {
    return 'Resource not found.';
  }
  if (errorMessage.includes('429')) {
    return 'Rate limited. Please wait and try again.';
  }
  
  return 'An error occurred. Please try again.';
}

async function verifyAuth(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    console.error('Auth verification failed:', error);
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: data.claims.sub as string };
}

async function getAzureAccessToken(
  tenantId: string, 
  clientId: string, 
  clientSecret: string
): Promise<{ token: string; expiresIn: number } | { error: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Azure token error:', JSON.stringify(data));
      return { error: sanitizeError(new Error(data.error_description || data.error || 'Token request failed')) };
    }

    return {
      token: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('Azure token fetch error:', error);
    return { error: sanitizeError(error) };
  }
}

async function listSubscriptions(accessToken: string): Promise<{ subscriptions: any[] } | { error: string }> {
  try {
    const response = await fetch(
      'https://management.azure.com/subscriptions?api-version=2022-12-01',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Azure subscriptions error:', JSON.stringify(errorData));
      return { error: sanitizeError(new Error(`API_ERROR_${response.status}`)) };
    }

    const data = await response.json();
    return { subscriptions: data.value || [] };
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    return { error: sanitizeError(error) };
  }
}

async function fetchAzureResources(
  accessToken: string,
  subscriptionId: string,
  resourceType: string,
  apiVersion: string
): Promise<any[]> {
  const allResources: any[] = [];
  
  // First, get all resources of this type in the subscription
  const listUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resources?$filter=resourceType eq '${resourceType}'&api-version=2021-04-01`;
  
  const listResponse = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!listResponse.ok) {
    const errorData = await listResponse.json().catch(() => ({}));
    console.error(`Error fetching ${resourceType}:`, JSON.stringify(errorData));
    throw new Error(`API_ERROR_${listResponse.status}`);
  }

  const listData = await listResponse.json();
  const resources = listData.value || [];
  
  // Fetch detailed info for each resource
  for (const resource of resources) {
    try {
      const detailResponse = await fetch(
        `https://management.azure.com${resource.id}?api-version=${apiVersion}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (detailResponse.ok) {
        const detailedResource = await detailResponse.json();
        allResources.push(detailedResource);
      } else {
        allResources.push(resource);
      }
    } catch {
      allResources.push(resource);
    }
  }

  return allResources;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authResult.userId;
    console.log('Authenticated user for Azure API:', userId);

    const rawBody = await req.json();

    // Handle get-token action
    if (rawBody.action === 'get-token' || rawBody.action === 'test-connection') {
      const parseResult = AuthRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { tenantId, clientId, clientSecret } = parseResult.data;
      const tokenResult = await getAzureAccessToken(tenantId, clientId, clientSecret);

      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ success: false, error: tokenResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For test-connection, also fetch subscriptions
      if (rawBody.action === 'test-connection') {
        const subsResult = await listSubscriptions(tokenResult.token);
        
        if ('error' in subsResult) {
          return new Response(
            JSON.stringify({ success: false, error: subsResult.error }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            accessToken: tokenResult.token,
            expiresIn: tokenResult.expiresIn,
            subscriptions: subsResult.subscriptions,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          accessToken: tokenResult.token,
          expiresIn: tokenResult.expiresIn,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle list-subscriptions action
    if (rawBody.action === 'list-subscriptions') {
      const parseResult = ListSubscriptionsSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const subsResult = await listSubscriptions(parseResult.data.accessToken);
      
      if ('error' in subsResult) {
        return new Response(
          JSON.stringify({ success: false, error: subsResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          subscriptions: subsResult.subscriptions,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle list-subscriptions-from-stored action (uses stored credentials)
    if (rawBody.action === 'list-subscriptions-from-stored') {
      const parseResult = ListSubscriptionsFromStoredSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { tenantConnectionId } = parseResult.data;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get decrypted credentials using the database function
      const { data: credentials, error: credError } = await supabase
        .rpc('get_decrypted_credential', {
          p_tenant_connection_id: tenantConnectionId,
          p_user_id: userId,
        });

      if (credError || !credentials || credentials.length === 0) {
        console.error('Error fetching credentials:', credError);
        return new Response(
          JSON.stringify({ success: false, error: 'Could not retrieve stored credentials. Please reconfigure credentials.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, tenant_id } = credentials[0];
      
      // Get Azure ARM token
      const tokenResult = await getAzureAccessToken(tenant_id, client_id, client_secret);
      
      if ('error' in tokenResult) {
        return new Response(
          JSON.stringify({ success: false, error: tokenResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List subscriptions
      const subsResult = await listSubscriptions(tokenResult.token);
      
      if ('error' in subsResult) {
        return new Response(
          JSON.stringify({ success: false, error: subsResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          subscriptions: subsResult.subscriptions.map((s: any) => ({
            subscriptionId: s.subscriptionId,
            displayName: s.displayName,
            state: s.state,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (rawBody.action === 'export') {
      const parseResult = ExportRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { accessToken, subscriptionIds, resources, exportJobId } = parseResult.data;

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify job belongs to user
      const { data: jobData, error: jobError } = await supabase
        .from('export_jobs')
        .select('user_id')
        .eq('id', exportJobId)
        .single();

      if (jobError || !jobData || jobData.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Export job not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update job status to running
      await supabase
        .from('export_jobs')
        .update({ status: 'running', progress: 0 })
        .eq('id', exportJobId);

      const results: Array<{ resource: string; subscription: string; success: boolean; error?: string; count?: number }> = [];
      let completed = 0;
      const total = resources.length * subscriptionIds.length;

      for (const subscriptionId of subscriptionIds) {
        for (const resource of resources) {
          // Check for cancellation
          const { data: jobStatus } = await supabase
            .from('export_jobs')
            .select('status')
            .eq('id', exportJobId)
            .single();
          
          if (jobStatus?.status === 'cancelled') {
            console.log('Azure export job cancelled by user');
            return new Response(
              JSON.stringify({ success: false, error: 'Export cancelled by user', results }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const resourceConfig = AZURE_RESOURCE_TYPES[resource];
          
          if (!resourceConfig) {
            results.push({ resource, subscription: subscriptionId, success: false, error: 'Unknown resource type' });
            completed++;
            continue;
          }

          try {
            const resourceData = await fetchAzureResources(
              accessToken,
              subscriptionId,
              resourceConfig.resourceType,
              resourceConfig.apiVersion
            );

            results.push({ 
              resource, 
              subscription: subscriptionId, 
              success: true, 
              count: resourceData.length 
            });

            // Store in database
            const [categoryId, subcategoryId] = resource.split('/');
            
            await supabase
              .from('exported_resources')
              .insert({
                export_job_id: exportJobId,
                category: categoryId,
                resource_type: subcategoryId,
                resource_name: `${resourceData.length} ${subcategoryId} items (${subscriptionId.substring(0, 8)}...)`,
                resource_id: `${subscriptionId}/${resource}`,
                data: { value: resourceData, subscriptionId, resourceType: resourceConfig.resourceType },
              });

          } catch (error) {
            results.push({ 
              resource, 
              subscription: subscriptionId, 
              success: false, 
              error: sanitizeError(error) 
            });
          }

          completed++;
          const progress = Math.round((completed / total) * 100);
          
          await supabase
            .from('export_jobs')
            .update({ progress })
            .eq('id', exportJobId);
        }
      }

      // Mark job as completed
      const hasErrors = results.some(r => !r.success);
      
      await supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          metadata: { results },
          error: hasErrors ? 'Completed with some errors. See results.' : null,
        })
        .eq('id', exportJobId);

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure API error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
