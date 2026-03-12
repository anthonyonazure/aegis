import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeployRequest {
  action?: 'deploy' | 'rollback' | 'import-policies';
  deploymentId?: string;
  resultId?: string;
  tenantConnectionId: string;
  sourceTenantConnectionId?: string | null;
  dryRun: boolean;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
  options?: {
    skipExisting?: boolean;
    overwriteExisting?: boolean;
    renameDuplicates?: boolean;
  };
}

interface RollbackRequest {
  action: 'rollback';
  resultId: string;
  tenantConnectionId: string;
}

interface PolicyChange {
  resourceType: string;
  action: 'create' | 'update' | 'delete' | 'skip' | 'rollback' | 'rename';
  resourceId?: string;
  resourceName?: string;
  currentValue?: unknown;
  newValue?: unknown;
  originalValue?: unknown;
  reason?: string;
}

interface RollbackItem {
  resourceType: string;
  resourceId: string;
  originalValue: Record<string, unknown>;
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

async function deleteResource(accessToken: string, endpoint: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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

async function rollbackDeployment(
  accessToken: string,
  rollbackData: RollbackItem[]
): Promise<{ changes: PolicyChange[]; success: boolean; errors: string[] }> {
  const changes: PolicyChange[] = [];
  const errors: string[] = [];

  for (const item of rollbackData) {
    const endpoint = getEndpointForResourceType(item.resourceType);
    const resourceName = (item.originalValue.displayName || item.originalValue.name || item.resourceId) as string;

    try {
      const result = await updateResource(accessToken, endpoint, item.resourceId, item.originalValue);

      if (result.success) {
        changes.push({
          resourceType: item.resourceType,
          action: 'rollback',
          resourceId: item.resourceId,
          resourceName,
          originalValue: item.originalValue,
          reason: 'Rolled back to original configuration',
        });
      } else {
        errors.push(`Failed to rollback ${resourceName}: ${result.error}`);
        changes.push({
          resourceType: item.resourceType,
          action: 'rollback',
          resourceId: item.resourceId,
          resourceName,
          reason: `Rollback failed: ${result.error}`,
        });
      }
    } catch (rollbackError) {
      errors.push(`Error rolling back ${resourceName}: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
    }
  }

  return {
    changes,
    success: errors.length === 0,
    errors,
  };
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
    // Cross-tenant import mappings
    'conditional-access/ca-policies': 'identity/conditionalAccess/policies',
    'conditional-access/named-locations': 'identity/conditionalAccess/namedLocations',
    'conditional-access/auth-contexts': 'identity/conditionalAccess/authenticationContextClassReferences',
    'conditional-access/auth-strengths': 'identity/conditionalAccess/authenticationStrengths/policies',
    'intune/device-configurations': 'deviceManagement/deviceConfigurations',
    'intune/compliance-policies': 'deviceManagement/deviceCompliancePolicies',
    'intune/app-configurations': 'deviceAppManagement/mobileAppConfigurations',
    'intune/autopilot': 'deviceManagement/windowsAutopilotDeploymentProfiles',
    'intune/enrollment-restrictions': 'deviceManagement/deviceEnrollmentConfigurations',
    'intune/scripts': 'deviceManagement/deviceManagementScripts',
    'intune/win32-apps': 'deviceAppManagement/mobileApps',
    'intune/update-rings': 'deviceManagement/deviceConfigurations',
    'entra-id/groups': 'groups',
    'entra-id/app-registrations': 'applications',
    'entra-id/enterprise-apps': 'servicePrincipals',
    'entra-id/admin-units': 'administrativeUnits',
    'entra-id/roles': 'directoryRoles',
    'entra-id/directory-settings': 'groupSettings',
    'entra-id/auth-methods-policy': 'policies/authenticationMethodsPolicy',
    'entra-id/cross-tenant-access': 'policies/crossTenantAccessPolicy',
    'entra-id/permission-grant-policies': 'policies/permissionGrantPolicies',
    'defender/asr-policies': 'deviceManagement/configurationPolicies',
    'defender/antivirus-policies': 'deviceManagement/configurationPolicies',
    'defender/firewall-policies': 'deviceManagement/configurationPolicies',
    'defender/edr-policies': 'deviceManagement/configurationPolicies',
    'defender/security-baselines': 'deviceManagement/configurationPolicies',
    'exchange/accepted-domains': 'domains',
    'purview/sensitivity-labels': 'security/informationProtection/sensitivityLabels',
    'purview/retention-policies': 'security/labels/retentionLabels',
    'teams/app-policies': 'appCatalogs/teamsApps',
    'teams/guest-policies': 'teamwork/teamSettings',
    'teams/external-access': 'teamwork/teamSettings',
  };
  return endpoints[resourceType] || resourceType;
}

// Clean policy data for import - remove read-only and tenant-specific properties
function cleanPolicyForImport(policy: Record<string, unknown>): Record<string, unknown> {
  const readOnlyProps = [
    'id',
    '@odata.context',
    '@odata.type',
    'createdDateTime',
    'modifiedDateTime',
    'lastModifiedDateTime',
    'version',
    'createdBy',
    'lastModifiedBy',
    'templateId',
    'templateReference',
    'deletedDateTime',
    'renewedDateTime',
  ];

  const cleaned: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(policy)) {
    if (!readOnlyProps.includes(key) && !key.startsWith('@')) {
      // Recursively clean nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = cleanPolicyForImport(value as Record<string, unknown>);
      } else {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

async function importPoliciesToTenant(
  accessToken: string,
  policyData: Record<string, unknown>,
  resourceTypes: string[],
  options: { skipExisting?: boolean; overwriteExisting?: boolean; renameDuplicates?: boolean },
  dryRun: boolean
): Promise<{ changes: PolicyChange[]; success: boolean; errors: string[] }> {
  const changes: PolicyChange[] = [];
  const errors: string[] = [];

  for (const resourceType of resourceTypes) {
    const endpoint = getEndpointForResourceType(resourceType);
    const policies = (policyData[resourceType] || []) as Record<string, unknown>[];

    if (!Array.isArray(policies)) continue;

    for (const rawPolicy of policies) {
      // Clean the policy data for import
      const policy = cleanPolicyForImport(rawPolicy);
      let policyName = (policy.displayName || policy.name) as string;
      
      try {
        // Check if policy already exists
        const existing = await getExistingResource(
          accessToken,
          endpoint,
          policyName ? `displayName eq '${policyName.replace(/'/g, "''")}'` : undefined
        );

        if (existing && existing.length > 0) {
          const existingPolicy = existing[0] as Record<string, unknown>;
          const existingId = existingPolicy.id as string;

          if (options.skipExisting) {
            changes.push({
              resourceType,
              action: 'skip',
              resourceId: existingId,
              resourceName: policyName,
              reason: 'Policy already exists (skip existing enabled)',
            });
            continue;
          }

          if (options.overwriteExisting) {
            changes.push({
              resourceType,
              action: 'update',
              resourceId: existingId,
              resourceName: policyName,
              currentValue: existingPolicy,
              newValue: policy,
              reason: 'Policy exists and will be updated (overwrite enabled)',
            });

            if (!dryRun) {
              const result = await updateResource(accessToken, endpoint, existingId, policy);
              if (!result.success) {
                errors.push(`Failed to update ${policyName}: ${result.error}`);
              }
            }
            continue;
          }

          if (options.renameDuplicates) {
            // Append suffix to make name unique
            const newName = `${policyName} (Imported)`;
            policy.displayName = newName;
            
            changes.push({
              resourceType,
              action: 'rename',
              resourceName: newName,
              newValue: policy,
              reason: `Policy renamed from "${policyName}" to avoid conflict`,
            });

            if (!dryRun) {
              const result = await createResource(accessToken, endpoint, policy);
              if (!result.success) {
                errors.push(`Failed to create renamed policy ${newName}: ${result.error}`);
              }
            }
            continue;
          }

          // Default: skip if exists
          changes.push({
            resourceType,
            action: 'skip',
            resourceId: existingId,
            resourceName: policyName,
            reason: 'Policy already exists',
          });
        } else {
          // Create new policy
          changes.push({
            resourceType,
            action: 'create',
            resourceName: policyName,
            newValue: policy,
            reason: 'Policy does not exist, will be created',
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
        const existing = await getExistingResource(
          accessToken,
          endpoint,
          policyName ? `displayName eq '${policyName}'` : undefined
        );

        if (existing && existing.length > 0) {
          const existingPolicy = existing[0] as Record<string, unknown>;
          const existingId = existingPolicy.id as string;

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

    const body = await req.json();
    const action = body.action || 'deploy';

    // Handle import-policies action (cross-tenant deployment)
    if (action === 'import-policies') {
      const { tenantConnectionId, sourceTenantConnectionId, dryRun, policyData, resourceTypes, options } = body as DeployRequest;
      
      console.log('Import policies to tenant:', tenantConnectionId, 'from source:', sourceTenantConnectionId, 'dry-run:', dryRun);

      // Get credentials for target tenant
      const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
        p_tenant_connection_id: tenantConnectionId,
        p_user_id: user.id,
      });

      if (credError || !credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No credentials found for target tenant', changes: [], errors: ['No credentials found'] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cred = credentials[0];

      try {
        const accessToken = await getGraphAccessToken(cred.client_id, cred.client_secret, cred.tenant_id);
        
        const result = await importPoliciesToTenant(
          accessToken,
          policyData,
          resourceTypes,
          options || {},
          dryRun
        );

        // Log the import action
        if (!dryRun) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'import_policies',
            resource_type: 'policies',
            tenant_connection_id: tenantConnectionId,
            details: {
              source_tenant_connection_id: sourceTenantConnectionId,
              resource_types: resourceTypes,
              created: result.changes.filter(c => c.action === 'create').length,
              updated: result.changes.filter(c => c.action === 'update').length,
              skipped: result.changes.filter(c => c.action === 'skip').length,
              errors: result.errors.length,
            },
          });
        }

        return new Response(
          JSON.stringify({
            success: result.success,
            dryRun,
            changes: result.changes,
            errors: result.errors,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (importError) {
        console.error('Import error:', importError);
        return new Response(
          JSON.stringify({
            success: false,
            error: importError instanceof Error ? importError.message : 'Import failed',
            changes: [],
            errors: [importError instanceof Error ? importError.message : 'Import failed'],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle rollback action
    if (action === 'rollback') {
      const { resultId, tenantConnectionId } = body as RollbackRequest;
      console.log('Rolling back deployment result:', resultId);

      const { data: deployResult, error: resultError } = await supabase
        .from('deployment_results')
        .select('rollback_data, deployment_id')
        .eq('id', resultId)
        .single();

      if (resultError || !deployResult || !deployResult.rollback_data) {
        return new Response(
          JSON.stringify({ success: false, error: 'No rollback data available' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('deployment_results')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', resultId);

      const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
        p_tenant_connection_id: tenantConnectionId,
        p_user_id: user.id,
      });

      if (credError || !credentials || credentials.length === 0) {
        await supabase
          .from('deployment_results')
          .update({ status: 'failed', error_message: 'No credentials found', completed_at: new Date().toISOString() })
          .eq('id', resultId);

        return new Response(
          JSON.stringify({ success: false, error: 'No credentials found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cred = credentials[0];

      try {
        const accessToken = await getGraphAccessToken(cred.client_id, cred.client_secret, cred.tenant_id);
        const rollbackItems = deployResult.rollback_data as RollbackItem[];
        const result = await rollbackDeployment(accessToken, rollbackItems);

        await supabase
          .from('deployment_results')
          .update({
            status: result.success ? 'rolled_back' : 'failed',
            completed_at: new Date().toISOString(),
            applied_changes: {
              rollback: true,
              changes: result.changes,
              errors: result.errors,
            },
            rollback_data: null,
            error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          })
          .eq('id', resultId);

        await supabase
          .from('policy_deployments')
          .update({ status: 'rolled_back' })
          .eq('id', deployResult.deployment_id);

        return new Response(
          JSON.stringify({
            success: result.success,
            action: 'rollback',
            changes: result.changes,
            errors: result.errors,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
        await supabase
          .from('deployment_results')
          .update({
            status: 'failed',
            error_message: rollbackError instanceof Error ? rollbackError.message : 'Rollback failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', resultId);

        return new Response(
          JSON.stringify({ success: false, error: rollbackError instanceof Error ? rollbackError.message : 'Rollback failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Standard deployment
    const deployBody = body as DeployRequest;
    console.log('Deploying policy:', deployBody.deploymentId, 'to tenant:', deployBody.tenantConnectionId, 'dry-run:', deployBody.dryRun);

    await supabase
      .from('deployment_results')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', deployBody.resultId);

    const { data: credentials, error: credError } = await supabase.rpc('get_decrypted_credential', {
      p_tenant_connection_id: deployBody.tenantConnectionId,
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
        .eq('id', deployBody.resultId);

      return new Response(
        JSON.stringify({ success: false, error: 'No credentials found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cred = credentials[0];

    try {
      const accessToken = await getGraphAccessToken(
        cred.client_id,
        cred.client_secret,
        cred.tenant_id
      );

      const result = await analyzeAndDeployPolicy(
        accessToken,
        deployBody.policyData,
        deployBody.resourceTypes,
        deployBody.dryRun
      );

      const updateData: Record<string, unknown> = {
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
      };

      if (deployBody.dryRun) {
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
        .eq('id', deployBody.resultId);

      const { data: allResults } = await supabase
        .from('deployment_results')
        .select('status')
        .eq('deployment_id', deployBody.deploymentId);

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
        .eq('id', deployBody.deploymentId);

      console.log('Deployment result:', result.success ? 'success' : 'failed', 'changes:', result.changes.length);

      return new Response(
        JSON.stringify({
          success: result.success,
          dryRun: deployBody.dryRun,
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
        .eq('id', deployBody.resultId);

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
