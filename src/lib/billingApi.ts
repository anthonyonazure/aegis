import { supabase } from '@/integrations/supabase/client';

export interface UsageCollectionResult {
  success: boolean;
  message: string;
  collected: number;
  failed: number;
  results: Array<{
    tenantId: string;
    customerId: string | null;
    success: boolean;
    usage?: {
      users: number;
      devices: number;
      groups: number;
      applications: number;
      conditionalAccessPolicies: number;
      subscribedSkus: number;
    };
    error?: string;
  }>;
}

export async function collectUsage(options?: {
  customerId?: string;
  tenantConnectionId?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<UsageCollectionResult> {
  const { data, error } = await supabase.functions.invoke('collect-usage', {
    body: options || {},
  });

  if (error) {
    throw new Error(`Failed to collect usage: ${error.message}`);
  }

  return data as UsageCollectionResult;
}

export function exportToCsv(
  data: Array<{
    customerName: string;
    resources: number;
    users: number;
    devices: number;
    billable: number;
  }>,
  filename: string
): void {
  const headers = ['Customer', 'Resources', 'Users', 'Devices', 'Billable Amount'];
  const rows = data.map(row => [
    `"${row.customerName}"`,
    row.resources,
    row.users,
    row.devices,
    row.billable,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateBillableAmount(
  resources: number,
  users: number,
  devices: number,
  ratePerResource: number = 0.10,
  ratePerUser: number = 0.50,
  ratePerDevice: number = 0.25
): number {
  return (resources * ratePerResource) + (users * ratePerUser) + (devices * ratePerDevice);
}
