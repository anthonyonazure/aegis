import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type AuditAction = 
  | 'tenant_connect'
  | 'tenant_disconnect'
  | 'export_start'
  | 'export_complete'
  | 'export_failed'
  | 'import_start'
  | 'import_complete'
  | 'import_failed'
  | 'import_rollback'
  | 'validation_run'
  | 'compliance_check'
  | 'drift_detection'
  | 'resource_download';

interface AuditLogEntry {
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, Json>;
  tenantConnectionId?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert([{
      user_id: user.id,
      action: entry.action,
      resource_type: entry.resourceType || null,
      resource_id: entry.resourceId || null,
      details: (entry.details || {}) as Json,
      tenant_connection_id: entry.tenantConnectionId || null,
    }]);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

export function formatAuditAction(action: string): string {
  const actionLabels: Record<string, string> = {
    tenant_connect: 'Connected to Tenant',
    tenant_disconnect: 'Disconnected from Tenant',
    export_start: 'Started Export',
    export_complete: 'Completed Export',
    export_failed: 'Export Failed',
    import_start: 'Started Import',
    import_complete: 'Completed Import',
    import_failed: 'Import Failed',
    import_rollback: 'Rolled Back Import',
    validation_run: 'Ran Validation',
    compliance_check: 'Ran Compliance Check',
    drift_detection: 'Ran Drift Detection',
    resource_download: 'Downloaded Resource',
  };
  return actionLabels[action] || action;
}
