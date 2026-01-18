import { supabase } from '@/integrations/supabase/client';
import { createPSATicket } from './psaApi';

interface PSAIntegration {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  auto_create_tickets: boolean;
  ticket_on_drift: boolean;
  ticket_on_compliance_fail: boolean;
  default_priority: string | null;
  default_ticket_type: string | null;
}

export interface DriftTicketData {
  driftDetectionId: string;
  baselineExportId: string;
  tenantName?: string;
  added: number;
  removed: number;
  modified: number;
  customerId?: string;
}

export interface ComplianceTicketData {
  complianceResultId: string;
  baselineName: string;
  failedCount: number;
  warningCount: number;
  totalChecks: number;
  customerId?: string;
}

export interface ScheduledDriftTicketData {
  scheduleId: string;
  scheduleName: string;
  driftRunId: string;
  tenantName: string;
  added: number;
  removed: number;
  modified: number;
  customerId?: string;
}

/**
 * Get all active PSA integrations configured for auto-ticketing
 */
async function getActiveTicketingIntegrations(
  eventType: 'drift' | 'compliance'
): Promise<PSAIntegration[]> {
  const column = eventType === 'drift' ? 'ticket_on_drift' : 'ticket_on_compliance_fail';
  
  const { data, error } = await supabase
    .from('psa_integrations')
    .select('*')
    .eq('is_active', true)
    .eq('auto_create_tickets', true)
    .eq(column, true);

  if (error) {
    console.error('Failed to fetch PSA integrations:', error);
    return [];
  }

  return (data || []) as PSAIntegration[];
}

/**
 * Create tickets for drift detection events
 */
export async function createDriftTickets(data: DriftTicketData): Promise<{
  ticketsCreated: number;
  errors: string[];
}> {
  const integrations = await getActiveTicketingIntegrations('drift');
  const errors: string[] = [];
  let ticketsCreated = 0;

  if (integrations.length === 0) {
    return { ticketsCreated: 0, errors: [] };
  }

  const title = data.tenantName 
    ? `Drift Detected - ${data.tenantName}`
    : `Configuration Drift Detected`;

  const description = `Configuration drift has been detected.

Summary:
- Added resources: ${data.added}
- Removed resources: ${data.removed}
- Modified resources: ${data.modified}

Baseline Export ID: ${data.baselineExportId}
Detection ID: ${data.driftDetectionId}

Please review the changes and take appropriate action.`;

  for (const integration of integrations) {
    try {
      const result = await createPSATicket({
        integrationId: integration.id,
        title,
        description,
        priority: integration.default_priority || 'medium',
        ticketType: integration.default_ticket_type || 'incident',
        customerId: data.customerId,
        sourceType: 'drift',
        sourceId: data.driftDetectionId,
      });

      if (result.success) {
        ticketsCreated++;
        console.log(`Created drift ticket in ${integration.name}:`, result.externalTicketId);
      } else {
        errors.push(`${integration.name}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${integration.name}: ${errorMsg}`);
    }
  }

  return { ticketsCreated, errors };
}

/**
 * Create tickets for compliance failure events
 */
export async function createComplianceTickets(data: ComplianceTicketData): Promise<{
  ticketsCreated: number;
  errors: string[];
}> {
  const integrations = await getActiveTicketingIntegrations('compliance');
  const errors: string[] = [];
  let ticketsCreated = 0;

  if (integrations.length === 0) {
    return { ticketsCreated: 0, errors: [] };
  }

  const title = `Compliance Check Failed - ${data.baselineName}`;
  
  const description = `A compliance check against the "${data.baselineName}" baseline has failed.

Summary:
- Total checks: ${data.totalChecks}
- Failed: ${data.failedCount}
- Warnings: ${data.warningCount}
- Passed: ${data.totalChecks - data.failedCount - data.warningCount}

Compliance Result ID: ${data.complianceResultId}

Please review the failed compliance checks and remediate the issues.`;

  for (const integration of integrations) {
    try {
      const result = await createPSATicket({
        integrationId: integration.id,
        title,
        description,
        priority: data.failedCount > 5 ? 'high' : integration.default_priority || 'medium',
        ticketType: integration.default_ticket_type || 'incident',
        customerId: data.customerId,
        sourceType: 'compliance',
        sourceId: data.complianceResultId,
      });

      if (result.success) {
        ticketsCreated++;
        console.log(`Created compliance ticket in ${integration.name}:`, result.externalTicketId);
      } else {
        errors.push(`${integration.name}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${integration.name}: ${errorMsg}`);
    }
  }

  return { ticketsCreated, errors };
}

/**
 * Create tickets for scheduled drift detection events
 */
export async function createScheduledDriftTickets(data: ScheduledDriftTicketData): Promise<{
  ticketsCreated: number;
  errors: string[];
}> {
  const integrations = await getActiveTicketingIntegrations('drift');
  const errors: string[] = [];
  let ticketsCreated = 0;

  if (integrations.length === 0) {
    return { ticketsCreated: 0, errors: [] };
  }

  const title = `Scheduled Drift Detected - ${data.tenantName}`;
  
  const description = `Scheduled drift detection "${data.scheduleName}" has found configuration changes.

Tenant: ${data.tenantName}

Summary:
- Added resources: ${data.added}
- Removed resources: ${data.removed}
- Modified resources: ${data.modified}

Schedule ID: ${data.scheduleId}
Run ID: ${data.driftRunId}

Please review the changes and take appropriate action.`;

  for (const integration of integrations) {
    try {
      const result = await createPSATicket({
        integrationId: integration.id,
        title,
        description,
        priority: integration.default_priority || 'medium',
        ticketType: integration.default_ticket_type || 'incident',
        customerId: data.customerId,
        sourceType: 'scheduled_drift',
        sourceId: data.driftRunId,
      });

      if (result.success) {
        ticketsCreated++;
        console.log(`Created scheduled drift ticket in ${integration.name}:`, result.externalTicketId);
      } else {
        errors.push(`${integration.name}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${integration.name}: ${errorMsg}`);
    }
  }

  return { ticketsCreated, errors };
}
