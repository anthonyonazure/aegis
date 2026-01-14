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
export async function createTenantConnection(connection: Omit<TenantConnection, 'id'>) {
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
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant connections');
  return data;
}

export async function getActiveTenantConnection() {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('*')
    .eq('status', 'connected')
    .order('last_sync', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch active connection');
  return data;
}

// Store encrypted credentials server-side
export async function storeEncryptedCredential(
  tenantConnectionId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const { data, error } = await supabase
    .rpc('store_encrypted_credential', {
      p_tenant_connection_id: tenantConnectionId,
      p_client_id: clientId,
      p_client_secret: clientSecret,
    });

  if (error) throw sanitizeDatabaseError(error, 'store credentials');
  return data;
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
      progress: 0,
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create export job');
  return data;
}

export async function updateExportJob(id: string, updates: Partial<ExportJob>) {
  const updateData: Record<string, unknown> = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.progress !== undefined) updateData.progress = updates.progress;
  if (updates.error) updateData.error = updates.error;
  if (updates.completedAt) updateData.completed_at = updates.completedAt.toISOString();
  if (updates.outputPath) updateData.output_path = updates.outputPath;

  const { data, error } = await supabase
    .from('export_jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update export job');
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

export async function getExportJob(id: string) {
  const { data, error } = await supabase
    .from('export_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw sanitizeDatabaseError(error, 'fetch export job');
  return data;
}

export async function deleteExportJob(id: string) {
  const { error } = await supabase
    .from('export_jobs')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete export job');
}

export async function cancelExportJob(id: string) {
  const { data, error } = await supabase
    .from('export_jobs')
    .update({
      status: 'cancelled',
      error: 'Export cancelled by user',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['pending', 'running'])
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'cancel export job');
  return data;
}

// Exported Resources
export async function getExportedResources(exportJobId: string) {
  const { data, error } = await supabase
    .from('exported_resources')
    .select('*')
    .eq('export_job_id', exportJobId)
    .order('created_at', { ascending: true });

  if (error) throw sanitizeDatabaseError(error, 'fetch exported resources');
  return data;
}

// Git Config
export async function saveGitConfig(config: Omit<GitConfig, 'id'> & { tenantConnectionId?: string }) {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('git_configs')
    .upsert({
      user_id: userId,
      tenant_connection_id: config.tenantConnectionId,
      provider: config.provider,
      repo_url: config.repoUrl,
      branch: config.branch,
      auto_commit: config.autoCommit,
      commit_message_template: config.commitMessage,
      cicd_template: config.cicdTemplate,
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'save git config');
  return data;
}

export async function getGitConfig(tenantConnectionId?: string) {
  let query = supabase.from('git_configs').select('*');
  
  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch git config');
  return data;
}

// Subscribe to export job updates
export function subscribeToExportJob(jobId: string, callback: (job: unknown) => void) {
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
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
