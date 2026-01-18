import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeployRequest {
  deploymentId: string;
  resultId: string;
  tenantConnectionId: string;
  dryRun: boolean;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
}

interface PolicyChange {
  resourceType: string;
  action: 'create' | 'update' | 'delete' | 'skip';
  resourceId?: string;
  resourceName?: string;
  currentValue?: unknown;
  newValue?: unknown;
  reason?: string;
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

async function getExistingResource(accessToken: string, endpoint: string, filter?: string): Promise<unknown[] | null> {
  try {
    let url = `https://graph.microsoft.com/v1.0/${endpoint}`;
    if (filter) {
      url += `?$filter=${encodeURIComponent(filter)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.value || [data];
    }
    return null;
  } catch (error) {
    console.error(`Failed to get existing resource:`, error);
    return null;
  }
}

async function createResource(accessToken: string, endpoint: string, data: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, data: result };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function updateResource(accessToken: string, endpoint: string, id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok || response.status === 204) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getEndpointForResourceType(resourceType: string): string {
  const endpoints: Record<string, string> = {
    'conditionalAccessPolicy': 'identity/conditionalAccess/policies',
    'deviceCompliancePolicy': 'deviceManagement/deviceCompliancePolicies',
    'deviceConfigurationPolicy': 'deviceManagement/deviceConfigurations',
    'groupPolicy': 'groups',
    'namedLocation': 'identity/conditionalAccess/namedLocations',
    'authenticationMethod': 'policies/authenticationMethodsPolicy',
    'securityDefaults': 'policies/identitySecurityDefaultsEnforcementPolicy',
    'authorizationPolicy': 'policies/authorizationPolicy',
  };
  return endpoints[resourceType] || resourceType;
}

async function analyzeAndDeployPolicy(
  accessToken: string,
  policyData: Record<string, unknown>,
  resourceTypes: string[],
  dryRun: boolean
): Promise<{ changes: PolicyChange[]; success: boolean; errors: string[] }> {
  const changes: PolicyChange[] = [];
  const errors: string[] = [];

  for (const resourceType of resourceTypes) {
    const endpoint = getEndpointForResourceType(resourceType);
    const policies = (policyData[resourceType] || policyData.policies || []) as Record<string, unknown>[];

    if (!Array.isArray(policies)) continue;

    for (const policy of policies) {
      const policyName = (policy.displayName || policy.name) as string;
      
      try {
        // Check if policy already exists
        const existing = await getExistingResource(
          accessToken,
          endpoint,
          policyName ? `displayName eq '${policyName}'` : undefined
        );

        if (existing && existing.length > 0) {
          const existingPolicy = existing[0] as Record<string, unknown>;
          const existingId = existingPolicy.id as string;

          // Determine if update is needed
          const needsUpdate = JSON.stringify(existingPolicy) !== JSON.stringify(policy);

          if (needsUpdate) {
            changes.push({
              resourceType,
              action: 'update',
              resourceId: existingId,
              resourceName: policyName,
              currentValue: existingPolicy,
              newValue: policy,
              reason: 'Policy exists but differs from template',
            });

            if (!dryRun) {
              const result = await updateResource(accessToken, endpoint, existingId, policy);
              if (!result.success) {
                errors.push(`Failed to update ${policyName}: ${result.error}`);
              }
            }
          } else {
            changes.push({
              resourceType,
              action: 'skip',
              resourceId: existingId,
              resourceName: policyName,
              reason: 'Policy already matches template',
            });
          }
        } else {
          changes.push({
            resourceType,
            action: 'create',
            resourceName: policyName,
            newValue: policy,
            reason: 'Policy does not exist',
          });

          if (!dryRun) {
            const result = await createResource(accessToken, endpoint, policy);
            if (!result.success) {
              errors.push(`Failed to create ${policyName}: ${result.error}`);
            }
          }
        }
      } catch (policyError) {
        errors.push(`Error processing ${policyName}: ${policyError instanceof Error ? policyError.message : 'Unknown error'}`);
      }
    }
  }

  return {
    changes,
    success: errors.length === 0,
    errors,
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

    const body: DeployRequest = await req.json();
    console.log('Deploying policy:', body.deploymentId, 'to tenant:', body.tenantConnectionId, 'dry-run:', body.dryRun);

    // Update result status to running
    await supabase
      .from('deployment_results')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', body.resultId);

    // Get credentials for the tenant
    const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
      p_tenant_connection_id: body.tenantConnectionId,
      p_user_id: user.id,
    });

    if (credError || !credentials || credentials.length === 0) {
      await supabase
        .from('deployment_results')
        .update({
          status: 'failed',
          error_message: 'No credentials found for tenant',
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.resultId);

      return new Response(
        JSON.stringify({ success: false, error: 'No credentials found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cred = credentials[0];

    try {
      // Get access token
      const accessToken = await getGraphAccessToken(
        cred.client_id,
        cred.client_secret,
        cred.tenant_id
      );

      // Analyze and optionally deploy policies
      const result = await analyzeAndDeployPolicy(
        accessToken,
        body.policyData,
        body.resourceTypes,
        body.dryRun
      );

      // Update result with findings
      const updateData: Record<string, unknown> = {
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
      };

      if (body.dryRun) {
        updateData.dry_run_result = {
          changes: result.changes,
          summary: {
            create: result.changes.filter(c => c.action === 'create').length,
            update: result.changes.filter(c => c.action === 'update').length,
            skip: result.changes.filter(c => c.action === 'skip').length,
            total: result.changes.length,
          },
        };
      } else {
        updateData.applied_changes = {
          changes: result.changes,
          errors: result.errors,
          summary: {
            create: result.changes.filter(c => c.action === 'create').length,
            update: result.changes.filter(c => c.action === 'update').length,
            skip: result.changes.filter(c => c.action === 'skip').length,
            failed: result.errors.length,
          },
        };
        // Store rollback data for potential rollback
        updateData.rollback_data = result.changes
          .filter(c => c.action === 'update' && c.currentValue)
          .map(c => ({
            resourceType: c.resourceType,
            resourceId: c.resourceId,
            originalValue: c.currentValue,
          }));
      }

      if (result.errors.length > 0) {
        updateData.error_message = result.errors.join('; ');
      }

      await supabase
        .from('deployment_results')
        .update(updateData)
        .eq('id', body.resultId);

      // Update deployment progress
      const { data: allResults } = await supabase
        .from('deployment_results')
        .select('status')
        .eq('deployment_id', body.deploymentId);

      const completed = allResults?.filter(r => r.status === 'completed').length || 0;
      const failed = allResults?.filter(r => r.status === 'failed').length || 0;
      const total = allResults?.length || 0;

      const deploymentUpdate: Record<string, unknown> = {
        completed_tenants: completed,
        failed_tenants: failed,
      };

      if (completed + failed >= total) {
        deploymentUpdate.status = failed > 0 ? 'failed' : 'completed';
        deploymentUpdate.completed_at = new Date().toISOString();
      }

      await supabase
        .from('policy_deployments')
        .update(deploymentUpdate)
        .eq('id', body.deploymentId);

      console.log('Deployment result:', result.success ? 'success' : 'failed', 'changes:', result.changes.length);

      return new Response(
        JSON.stringify({
          success: result.success,
          dryRun: body.dryRun,
          changes: result.changes,
          errors: result.errors,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (deployError) {
      console.error('Deployment error:', deployError);

      await supabase
        .from('deployment_results')
        .update({
          status: 'failed',
          error_message: deployError instanceof Error ? deployError.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.resultId);

      return new Response(
        JSON.stringify({
          success: false,
          error: deployError instanceof Error ? deployError.message : 'Unknown error',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Deploy policy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
