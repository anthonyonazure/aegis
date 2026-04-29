import { supabase } from '@/integrations/supabase/client';
import { Customer, CustomerTier, TenantGroup } from '@/types/tenant';

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

// ============= Customer Operations =============

export async function createCustomer(customer: {
  name: string;
  industry?: string;
  tier?: CustomerTier;
  primaryContactName?: string;
  primaryContactEmail?: string;
  notes?: string;
}): Promise<Customer> {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: userId,
      name: customer.name,
      industry: customer.industry,
      tier: customer.tier || 'starter',
      primary_contact_name: customer.primaryContactName,
      primary_contact_email: customer.primaryContactEmail,
      notes: customer.notes,
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create customer');
  return mapCustomerFromDb(data);
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<Customer> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.industry !== undefined) updateData.industry = updates.industry;
  if (updates.tier !== undefined) updateData.tier = updates.tier;
  if (updates.primaryContactName !== undefined) updateData.primary_contact_name = updates.primaryContactName;
  if (updates.primaryContactEmail !== undefined) updateData.primary_contact_email = updates.primaryContactEmail;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.brandName !== undefined) updateData.brand_name = updates.brandName;
  if (updates.logoUrl !== undefined) updateData.logo_url = updates.logoUrl;
  if (updates.primaryColor !== undefined) updateData.primary_color = updates.primaryColor;
  if (updates.accentColor !== undefined) updateData.accent_color = updates.accentColor;
  if (updates.supportEmail !== undefined) updateData.support_email = updates.supportEmail;
  if (updates.supportUrl !== undefined) updateData.support_url = updates.supportUrl;
  if (updates.customSubdomain !== undefined) updateData.custom_subdomain = updates.customSubdomain;
  if (updates.customDomain !== undefined) updateData.custom_domain = updates.customDomain;
  // Setting custom_domain ALWAYS clears verification — re-verify required.
  if (updates.customDomain !== undefined) updateData.custom_domain_verified_at = null;

  const { data, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update customer');
  return mapCustomerFromDb(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete customer');
}

export async function getCustomers(options?: {
  activeOnly?: boolean;
  tier?: CustomerTier;
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }
  if (options?.tier) {
    query = query.eq('tier', options.tier);
  }

  const { data, error } = await query;

  if (error) throw sanitizeDatabaseError(error, 'fetch customers');
  return (data || []).map(mapCustomerFromDb);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch customer');
  return data ? mapCustomerFromDb(data) : null;
}

export async function getCustomerWithTenantCount(): Promise<(Customer & { tenantCount: number })[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      tenant_connections(id)
    `)
    .order('name', { ascending: true });

  if (error) throw sanitizeDatabaseError(error, 'fetch customers with tenant count');
  
  return (data || []).map(row => ({
    ...mapCustomerFromDb(row),
    tenantCount: Array.isArray(row.tenant_connections) ? row.tenant_connections.length : 0
  }));
}

// ============= Tenant Group Operations =============

export async function createTenantGroup(group: {
  customerId: string;
  name: string;
  description?: string;
  color?: string;
}): Promise<TenantGroup> {
  const { data, error } = await supabase
    .from('tenant_groups')
    .insert({
      customer_id: group.customerId,
      name: group.name,
      description: group.description,
      color: group.color || '#6366f1',
    })
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'create tenant group');
  return mapTenantGroupFromDb(data);
}

export async function updateTenantGroup(
  id: string,
  updates: Partial<Omit<TenantGroup, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>
): Promise<TenantGroup> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.color !== undefined) updateData.color = updates.color;

  const { data, error } = await supabase
    .from('tenant_groups')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw sanitizeDatabaseError(error, 'update tenant group');
  return mapTenantGroupFromDb(data);
}

export async function deleteTenantGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('tenant_groups')
    .delete()
    .eq('id', id);

  if (error) throw sanitizeDatabaseError(error, 'delete tenant group');
}

export async function getTenantGroups(customerId?: string): Promise<TenantGroup[]> {
  let query = supabase
    .from('tenant_groups')
    .select('*')
    .order('name', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant groups');
  return (data || []).map(mapTenantGroupFromDb);
}

export async function getTenantGroup(id: string): Promise<TenantGroup | null> {
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant group');
  return data ? mapTenantGroupFromDb(data) : null;
}

export async function getTenantGroupsWithTenantCount(customerId?: string): Promise<(TenantGroup & { tenantCount: number })[]> {
  let query = supabase
    .from('tenant_groups')
    .select(`
      *,
      tenant_connections(id)
    `)
    .order('name', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant groups with tenant count');
  
  return (data || []).map(row => ({
    ...mapTenantGroupFromDb(row),
    tenantCount: Array.isArray(row.tenant_connections) ? row.tenant_connections.length : 0
  }));
}

// ============= Tenant Connection Updates =============

export async function updateTenantConnectionCustomer(
  connectionId: string,
  customerId: string | null,
  tenantGroupId?: string | null
): Promise<void> {
  const updateData: Record<string, unknown> = {
    customer_id: customerId,
  };
  
  if (tenantGroupId !== undefined) {
    updateData.tenant_group_id = tenantGroupId;
  }

  const { error } = await supabase
    .from('tenant_connections')
    .update(updateData)
    .eq('id', connectionId);

  if (error) throw sanitizeDatabaseError(error, 'update tenant connection customer');
}

export async function getTenantConnectionsByCustomer(customerId: string) {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant connections by customer');
  return data || [];
}

export async function getTenantConnectionsByGroup(tenantGroupId: string) {
  const { data, error } = await supabase
    .from('tenant_connections')
    .select('*')
    .eq('tenant_group_id', tenantGroupId)
    .order('created_at', { ascending: false });

  if (error) throw sanitizeDatabaseError(error, 'fetch tenant connections by group');
  return data || [];
}

// ============= Mappers =============

function mapCustomerFromDb(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    industry: row.industry as string | undefined,
    tier: row.tier as CustomerTier,
    primaryContactName: row.primary_contact_name as string | undefined,
    primaryContactEmail: row.primary_contact_email as string | undefined,
    notes: row.notes as string | undefined,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    brandName: row.brand_name as string | undefined,
    logoUrl: row.logo_url as string | undefined,
    primaryColor: row.primary_color as string | undefined,
    accentColor: row.accent_color as string | undefined,
    supportEmail: row.support_email as string | undefined,
    supportUrl: row.support_url as string | undefined,
    customSubdomain: row.custom_subdomain as string | undefined,
    customDomain: row.custom_domain as string | undefined,
    customDomainVerifiedAt: row.custom_domain_verified_at
      ? new Date(row.custom_domain_verified_at as string)
      : undefined,
  };
}

function mapTenantGroupFromDb(row: Record<string, unknown>): TenantGroup {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    color: row.color as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
