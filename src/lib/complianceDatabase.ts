import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 2 #4a — compliance evidence helpers.
 *
 * Reads the catalog (frameworks + controls), recent runs, and per-control
 * items. Triggers a fresh run via the collect-compliance-evidence edge
 * function. RLS enforces who can read what — MSP owner sees everything
 * they own; portal users see runs scoped to their customer's tenants.
 */

export interface ComplianceFramework {
  id: string;
  code: string;
  name: string;
  version: string | null;
  description: string | null;
  isActive: boolean;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  controlCode: string;
  category: string | null;
  name: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evaluatorKey: string | null;
  referenceUrl: string | null;
  isActive: boolean;
}

export interface ComplianceEvidenceRun {
  id: string;
  userId: string;
  tenantConnectionId: string;
  frameworkId: string;
  status: 'running' | 'completed' | 'failed';
  totalControls: number;
  passedCount: number;
  failedCount: number;
  naCount: number;
  errorCount: number;
  summary: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ComplianceEvidenceItem {
  id: string;
  runId: string;
  controlId: string;
  status: 'pass' | 'fail' | 'na' | 'error';
  notes: string | null;
  snapshot: Record<string, unknown>;
  evaluatedAt: Date;
  // Joined control fields (populated when fetched via getRunItems)
  control?: {
    controlCode: string;
    name: string;
    severity: string;
  };
}

function mapFramework(row: Record<string, unknown>): ComplianceFramework {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    version: (row.version as string) ?? null,
    description: (row.description as string) ?? null,
    isActive: row.is_active as boolean,
  };
}

function mapControl(row: Record<string, unknown>): ComplianceControl {
  return {
    id: row.id as string,
    frameworkId: row.framework_id as string,
    controlCode: row.control_code as string,
    category: (row.category as string) ?? null,
    name: row.name as string,
    description: (row.description as string) ?? null,
    severity: (row.severity as ComplianceControl['severity']) ?? 'medium',
    evaluatorKey: (row.evaluator_key as string) ?? null,
    referenceUrl: (row.reference_url as string) ?? null,
    isActive: row.is_active as boolean,
  };
}

function mapRun(row: Record<string, unknown>): ComplianceEvidenceRun {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tenantConnectionId: row.tenant_connection_id as string,
    frameworkId: row.framework_id as string,
    status: row.status as ComplianceEvidenceRun['status'],
    totalControls: row.total_controls as number,
    passedCount: row.passed_count as number,
    failedCount: row.failed_count as number,
    naCount: row.na_count as number,
    errorCount: (row.error_count as number) ?? 0,
    summary: (row.summary as Record<string, unknown>) ?? {},
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
  };
}

export async function getComplianceFrameworks(): Promise<ComplianceFramework[]> {
  const { data, error } = await supabase
    .from('compliance_frameworks')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to load frameworks: ${error.message}`);
  return (data ?? []).map(mapFramework);
}

export async function getControlsForFramework(frameworkId: string): Promise<ComplianceControl[]> {
  const { data, error } = await supabase
    .from('compliance_controls')
    .select('*')
    .eq('framework_id', frameworkId)
    .eq('is_active', true)
    .order('control_code', { ascending: true });
  if (error) throw new Error(`Failed to load controls: ${error.message}`);
  return (data ?? []).map(mapControl);
}

export async function getRecentEvidenceRuns(options?: {
  tenantConnectionId?: string;
  frameworkId?: string;
  limit?: number;
}): Promise<ComplianceEvidenceRun[]> {
  let query = supabase
    .from('compliance_evidence_runs')
    .select('*')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(options?.limit ?? 20);
  if (options?.tenantConnectionId) query = query.eq('tenant_connection_id', options.tenantConnectionId);
  if (options?.frameworkId) query = query.eq('framework_id', options.frameworkId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load evidence runs: ${error.message}`);
  return (data ?? []).map(mapRun);
}

export async function getRunItems(runId: string): Promise<ComplianceEvidenceItem[]> {
  const { data, error } = await supabase
    .from('compliance_evidence_items')
    .select('id, run_id, control_id, status, notes, snapshot, evaluated_at, compliance_controls(control_code, name, severity)')
    .eq('run_id', runId)
    .order('evaluated_at', { ascending: true });
  if (error) throw new Error(`Failed to load run items: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => {
    const control = row.compliance_controls as { control_code?: string; name?: string; severity?: string } | null;
    return {
      id: row.id as string,
      runId: row.run_id as string,
      controlId: row.control_id as string,
      status: row.status as ComplianceEvidenceItem['status'],
      notes: (row.notes as string) ?? null,
      snapshot: (row.snapshot as Record<string, unknown>) ?? {},
      evaluatedAt: new Date(row.evaluated_at as string),
      control: control
        ? {
            controlCode: control.control_code ?? '',
            name: control.name ?? '',
            severity: control.severity ?? 'medium',
          }
        : undefined,
    };
  });
}

export interface CollectEvidenceResult {
  success: boolean;
  runId?: string;
  counts?: { passed: number; failed: number; na: number; error: number };
  framework?: string;
  tenant?: { id: string; name: string };
  error?: string;
  warning?: string;
}

export async function collectEvidence(input: {
  tenantConnectionId: string;
  frameworkCode: string;
}): Promise<CollectEvidenceResult> {
  const { data, error } = await supabase.functions.invoke('collect-compliance-evidence', {
    body: input,
  });
  if (error) return { success: false, error: error.message };
  return data as CollectEvidenceResult;
}
