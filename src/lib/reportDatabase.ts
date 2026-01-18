import { supabase } from '@/integrations/supabase/client';

export type ReportType = 'executive_summary' | 'compliance' | 'drift' | 'billing' | 'security' | 'tenant_summary' | 'psa_tickets';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface Report {
  id: string;
  user_id: string;
  customer_id: string | null;
  name: string;
  report_type: ReportType;
  date_range_start: string | null;
  date_range_end: string | null;
  data: Record<string, unknown>;
  generated_at: string;
  file_url: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface BillingUsage {
  id: string;
  user_id: string;
  customer_id: string | null;
  period_start: string;
  period_end: string;
  resource_counts: Record<string, number>;
  total_resources: number;
  total_users: number;
  total_devices: number;
  billable_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const REPORT_TYPES = [
  { id: 'executive_summary' as const, name: 'Executive Summary', description: 'High-level overview for stakeholders' },
  { id: 'tenant_summary' as const, name: 'Tenant Summary', description: 'Per-tenant status and health overview' },
  { id: 'compliance' as const, name: 'Compliance Report', description: 'Detailed compliance check results' },
  { id: 'drift' as const, name: 'Drift Report', description: 'Configuration drift analysis' },
  { id: 'security' as const, name: 'Security Report', description: 'Security posture assessment' },
  { id: 'psa_tickets' as const, name: 'PSA Tickets Report', description: 'Summary of PSA tickets created' },
  { id: 'billing' as const, name: 'Billing Report', description: 'Resource usage and billing summary' },
] as const;

// Reports CRUD
export async function getReports(filters?: {
  customerId?: string;
  reportType?: ReportType;
  status?: ReportStatus;
}): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.reportType) {
    query = query.eq('report_type', filters.reportType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as Report[];
}

export async function getReport(id: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as Report;
}

export async function createReport(report: {
  customer_id?: string | null;
  name: string;
  report_type: ReportType;
  date_range_start?: string | null;
  date_range_end?: string | null;
  data?: Record<string, unknown>;
  file_url?: string | null;
  status?: ReportStatus;
}): Promise<Report> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      customer_id: report.customer_id || null,
      name: report.name,
      report_type: report.report_type,
      date_range_start: report.date_range_start || null,
      date_range_end: report.date_range_end || null,
      data: (report.data || {}) as unknown as Record<string, never>,
      file_url: report.file_url || null,
      status: report.status || 'pending',
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Report;
}

export async function updateReport(id: string, updates: {
  name?: string;
  report_type?: ReportType;
  date_range_start?: string | null;
  date_range_end?: string | null;
  data?: Record<string, unknown>;
  file_url?: string | null;
  status?: ReportStatus;
  generated_at?: string;
}): Promise<Report> {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.report_type !== undefined) updateData.report_type = updates.report_type;
  if (updates.date_range_start !== undefined) updateData.date_range_start = updates.date_range_start;
  if (updates.date_range_end !== undefined) updateData.date_range_end = updates.date_range_end;
  if (updates.data !== undefined) updateData.data = updates.data;
  if (updates.file_url !== undefined) updateData.file_url = updates.file_url;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.generated_at !== undefined) updateData.generated_at = updates.generated_at;

  const { data, error } = await supabase
    .from('reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Report;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Billing Usage CRUD
export async function getBillingUsage(filters?: {
  customerId?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<BillingUsage[]> {
  let query = supabase
    .from('billing_usage')
    .select('*')
    .order('period_start', { ascending: false });

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.periodStart) {
    query = query.gte('period_start', filters.periodStart);
  }
  if (filters?.periodEnd) {
    query = query.lte('period_end', filters.periodEnd);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as BillingUsage[];
}

export async function createBillingUsage(usage: Omit<BillingUsage, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<BillingUsage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('billing_usage')
    .insert({
      ...usage,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as BillingUsage;
}

export async function updateBillingUsage(id: string, updates: Partial<Omit<BillingUsage, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<BillingUsage> {
  const { data, error } = await supabase
    .from('billing_usage')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as BillingUsage;
}

export async function deleteBillingUsage(id: string): Promise<void> {
  const { error } = await supabase
    .from('billing_usage')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Aggregate billing data
export async function getAggregatedBilling(periodStart: string, periodEnd: string): Promise<{
  totalResources: number;
  totalUsers: number;
  totalDevices: number;
  totalBillable: number;
  customerBreakdown: Array<{
    customerId: string;
    resources: number;
    users: number;
    devices: number;
    billable: number;
  }>;
}> {
  const { data, error } = await supabase
    .from('billing_usage')
    .select('*')
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);

  if (error) throw error;

  const usage = (data || []) as unknown as BillingUsage[];

  const customerMap = new Map<string, {
    resources: number;
    users: number;
    devices: number;
    billable: number;
  }>();

  let totalResources = 0;
  let totalUsers = 0;
  let totalDevices = 0;
  let totalBillable = 0;

  for (const record of usage) {
    totalResources += record.total_resources;
    totalUsers += record.total_users;
    totalDevices += record.total_devices;
    totalBillable += record.billable_amount || 0;

    if (record.customer_id) {
      const existing = customerMap.get(record.customer_id) || { resources: 0, users: 0, devices: 0, billable: 0 };
      customerMap.set(record.customer_id, {
        resources: existing.resources + record.total_resources,
        users: existing.users + record.total_users,
        devices: existing.devices + record.total_devices,
        billable: existing.billable + (record.billable_amount || 0),
      });
    }
  }

  return {
    totalResources,
    totalUsers,
    totalDevices,
    totalBillable,
    customerBreakdown: Array.from(customerMap.entries()).map(([customerId, data]) => ({
      customerId,
      ...data,
    })),
  };
}
