import { supabase } from '@/integrations/supabase/client';

export type WebhookEventType =
  | 'export.completed'
  | 'export.failed'
  | 'drift.detected'
  | 'compliance.failed'
  | 'compliance.warning'
  | 'import.completed'
  | 'import.failed'
  | 'schedule.run';

interface WebhookEventData {
  [key: string]: unknown;
}

export async function triggerWebhook(
  event: WebhookEventType,
  data: WebhookEventData
): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const { data: response, error } = await supabase.functions.invoke('send-webhook', {
      body: { event, data },
    });

    if (error) {
      console.error('Failed to trigger webhook:', error);
      return { success: false, error: error.message };
    }

    return { success: true, sent: response?.sent || 0 };
  } catch (err) {
    console.error('Error triggering webhook:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Helper functions for common events
export async function notifyExportCompleted(exportJobId: string, exportName: string, resourceCount: number) {
  return triggerWebhook('export.completed', {
    export_job_id: exportJobId,
    export_name: exportName,
    resource_count: resourceCount,
    completed_at: new Date().toISOString(),
  });
}

export async function notifyExportFailed(exportJobId: string, exportName: string, error: string) {
  return triggerWebhook('export.failed', {
    export_job_id: exportJobId,
    export_name: exportName,
    error,
    failed_at: new Date().toISOString(),
  });
}

export async function notifyDriftDetected(
  driftDetectionId: string,
  baselineExportId: string,
  changes: { added: number; removed: number; modified: number }
) {
  return triggerWebhook('drift.detected', {
    drift_detection_id: driftDetectionId,
    baseline_export_id: baselineExportId,
    ...changes,
    detected_at: new Date().toISOString(),
  });
}

export async function notifyComplianceFailed(
  complianceResultId: string,
  baselineName: string,
  failedCount: number,
  totalChecks: number
) {
  return triggerWebhook('compliance.failed', {
    compliance_result_id: complianceResultId,
    baseline_name: baselineName,
    failed_count: failedCount,
    total_checks: totalChecks,
    checked_at: new Date().toISOString(),
  });
}

export async function notifyComplianceWarning(
  complianceResultId: string,
  baselineName: string,
  warningCount: number,
  totalChecks: number
) {
  return triggerWebhook('compliance.warning', {
    compliance_result_id: complianceResultId,
    baseline_name: baselineName,
    warning_count: warningCount,
    total_checks: totalChecks,
    checked_at: new Date().toISOString(),
  });
}

export async function notifyImportCompleted(
  importJobId: string,
  importName: string,
  resourcesImported: number
) {
  return triggerWebhook('import.completed', {
    import_job_id: importJobId,
    import_name: importName,
    resources_imported: resourcesImported,
    completed_at: new Date().toISOString(),
  });
}

export async function notifyImportFailed(importJobId: string, importName: string, error: string) {
  return triggerWebhook('import.failed', {
    import_job_id: importJobId,
    import_name: importName,
    error,
    failed_at: new Date().toISOString(),
  });
}