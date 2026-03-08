import { supabase } from '@/integrations/supabase/client';
import { TenantConnection, ExportJob, GitConfig } from '@/types/tenant';

// Helper to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Sanitize database errors to prevent information leakage
function sanitizeDatabaseError(error: unknown, operation: string): Error {
  console.error(`Database error (${operation}):`, error);
  return new Error(`Failed to ${operation}. Please try again.`);
}

// Tenant Connections
export async function createTenantConnection(connection: Omit<TenantConnection, 'id'> & { customerId?: string }) {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('tenant_connections')
    .insert({
      user_id: userId,
      tenant_id: connection.tenantId,
      tenant_name: connection.tenantName,
      auth_method: connection.authMethod,
      client_id: connection.clientId,
      status: connection.status,
      customer_id: connection.customerId || null,
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create tenant connection');
  return data;
}

export async function updateTenantConnection(id: string, updates: Partial<TenantConnection>) {
  const { data, error } = await supabase
    .from('tenant_connections')
    .update({
      tenant_name: updates.tenantName,
      status: updates.status,
      last_sync: updates.lastSync?.toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update tenant connection');
  return data;
}

export async function getTenantConnections() {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant connections');
  return data;
}

export async function deleteTenantConnection(id: string) {
  const { error } = await supabase
    .from('tenant_connections')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete tenant connection');
}

// Store encrypted credentials server-side via edge function
export async function storeEncryptedCredential(
  tenantConnectionId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('store-credentials', {
    body: {
      tenantConnectionId,
      clientId,
      clientSecret,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error('Failed to store credentials. Please try again.');
  }

  if (!data?.success) {
    console.error('Store credentials failed:', data?.error);
    throw new Error(data?.error || 'Failed to store credentials. Please try again.');
  }

  return data.credentialId;
}

// Check if credentials are stored for a connection
export async function hasStoredCredentials(tenantConnectionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_credentials')
    .select('id')
    .eq('tenant_connection_id', tenantConnectionId)
    .maybeSingle();

  if (error) {
    console.error('Error checking credentials:', error);
    return false;
  }
  return !!data;
}

// Get single export job
export async function getExportJob(id: string) {
  const { data, error } = await supabase
    .from('export_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw sanitizeDatabaseError(error, 'fetch export job');
  return data;
}

// Get active tenant connection (most recent connected)
export async function getActiveTenantConnection() {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('*')
    .eq('status', 'connected')
    .order('last_sync', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active connection:', error);
    return null;
  }
  return data;
}

// Subscribe to export job updates via realtime
export function subscribeToExportJob(jobId: string, callback: (job: Record<string, unknown>) => void) {
  const channel = supabase
    .channel(`export-job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'export_jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => callback(payload.new as Record<string, unknown>)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Cancel an export job
export async function cancelExportJob(id: string) {
  const { data, error } = await supabase
    .from('export_jobs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'cancel export job');
  return data;
}

// Batch check credentials for multiple connections at once (avoids N+1)
export async function batchHasStoredCredentials(tenantConnectionIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (tenantConnectionIds.length === 0) return result;

  const { data, error } = await supabase
    .from('tenant_credentials')
    .select('tenant_connection_id')
    .in('tenant_connection_id', tenantConnectionIds);

  if (error) {
    console.error('Error batch checking credentials:', error);
    // Default all to false on error
    tenantConnectionIds.forEach(id => result.set(id, false));
    return result;
  }

  const credentialSet = new Set((data || []).map(d => d.tenant_connection_id));
  tenantConnectionIds.forEach(id => result.set(id, credentialSet.has(id)));
  return result;
}

// Export Jobs
export async function createExportJob(job: {
  name: string;
  tenantConnectionId?: string;
  categories: string[];
  formats: string[];
}) {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('export_jobs')
    .insert({
      user_id: userId,
      name: job.name,
      tenant_connection_id: job.tenantConnectionId,
      categories: job.categories,
      formats: job.formats,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create export job');
  return data;
}

export async function getExportJobs() {
  const { data, error } = await supabase
    .from('export_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw sanitizeDatabaseError(error, 'fetch export jobs');
  return data;
}

export async function updateExportJob(id: string, updates: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.progress !== undefined) updateData.progress = updates.progress;
  if (updates.error !== undefined) updateData.error = updates.error;
  if (updates.completedAt !== undefined) updateData.completed_at = (updates.completedAt as Date)?.toISOString();
  if (updates.outputPath !== undefined) updateData.output_path = updates.outputPath;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

  const { data, error } = await supabase
    .from('export_jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update export job');
  return data;
}

// Git Configs
export async function getGitConfig(tenantConnectionId?: string) {
  let query = supabase
    .from('git_configs')
    .select('*');

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch git config');
  return data;
}

export async function saveGitConfig(config: Record<string, unknown> & { tenantConnectionId?: string }) {
  const userId = await getCurrentUserId();
  
  const existing = await getGitConfig(config.tenantConnectionId);

  if (existing) {
    const { data, error } = await supabase
      .from('git_configs')
      .update({
        provider: config.provider as string,
        repo_url: config.repoUrl as string,
        branch: config.branch as string,
        auto_commit: config.autoCommit as boolean,
        commit_message_template: (config.commitMessage || config.commitMessageTemplate) as string,
        cicd_template: config.cicdTemplate as string,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw sanitizeDatabaseError(error, 'update git config');
    return data;
  } else {
    const { data, error } = await supabase
      .from('git_configs')
      .insert({
        user_id: userId,
        provider: config.provider || 'github',
        repo_url: config.repoUrl,
        branch: config.branch || 'main',
        auto_commit: config.autoCommit ?? false,
        commit_message_template: config.commitMessageTemplate,
        cicd_template: config.cicdTemplate,
        tenant_connection_id: config.tenantConnectionId,
      })
      .select()
      .single();

    if (error) throw sanitizeDatabaseError(error, 'save git config');
    return data;
  }
}

// Exported Resources
export async function getExportedResources(exportJobId: string) {
  const { data, error } = await supabase
    .from('exported_resources')
    .select('*')
    .eq('export_job_id', exportJobId)
    .order('category');

  if (error) throw sanitizeDatabaseError(error, 'fetch exported resources');
  return data;
}

export async function saveExportedResource(resource: {
  exportJobId: string;
  category: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  data: Record<string, unknown>;
  terraformConfig?: string;
  bicepConfig?: string;
  powershellScript?: string;
}) {
  const { data, error } = await supabase
    .from('exported_resources')
    .insert({
      export_job_id: resource.exportJobId,
      category: resource.category,
      resource_type: resource.resourceType,
      resource_id: resource.resourceId,
      resource_name: resource.resourceName,
      data: resource.data,
      terraform_config: resource.terraformConfig,
      bicep_config: resource.bicepConfig,
      powershell_script: resource.powershellScript,
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'save exported resource');
  return data;
}

export async function deleteExportJob(id: string) {
  // Delete resources first (cascade might handle this, but be explicit)
  await supabase
    .from('exported_resources')
    .delete()
    .eq('export_job_id', id);

  const { error } = await supabase
    .from('export_jobs')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete export job');
}
