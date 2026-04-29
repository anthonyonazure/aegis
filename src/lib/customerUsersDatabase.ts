import { supabase } from '@/integrations/supabase/client';
import { CustomerUser, CustomerUserRole } from '@/types/tenant';

/**
 * Phase 2 #3a — portal user management.
 *
 * customer_users links auth.users to a customer for the read-only customer
 * portal. RLS already restricts these queries to:
 *   - the MSP that owns the customer (manage)
 *   - the portal user themselves (read own row)
 */

function mapCustomerUserFromDb(row: Record<string, unknown>): CustomerUser {
  return {
    id: row.id as string,
    authUserId: row.auth_user_id as string,
    customerId: row.customer_id as string,
    role: row.role as CustomerUserRole,
    isActive: row.is_active as boolean,
    invitedBy: (row.invited_by as string) ?? null,
    invitedAt: new Date(row.invited_at as string),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/** List portal users for a customer (MSP-side). */
export async function getCustomerUsers(customerId: string): Promise<CustomerUser[]> {
  const { data, error } = await supabase
    .from('customer_users')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch portal users: ${error.message}`);
  return (data || []).map(mapCustomerUserFromDb);
}

/**
 * Get the portal-user row for the currently logged-in user, or null.
 * Used by the portal app to know "is the active session a portal session?".
 */
export async function getCurrentPortalUser(): Promise<CustomerUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('customer_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('getCurrentPortalUser error:', error);
    return null;
  }
  return data ? mapCustomerUserFromDb(data) : null;
}

/**
 * Invite a portal user. The auth.users row must already exist — calling this
 * before the user has signed up will fail. Real invite flow (email a magic
 * link) is the next iteration; for now the MSP creates the auth user out of
 * band (Supabase dashboard or signup) and pastes the resulting user id here.
 */
export async function addCustomerUser(input: {
  customerId: string;
  authUserId: string;
  role?: CustomerUserRole;
}): Promise<CustomerUser> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('customer_users')
    .insert({
      customer_id: input.customerId,
      auth_user_id: input.authUserId,
      role: input.role ?? 'customer_viewer',
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add portal user: ${error.message}`);
  return mapCustomerUserFromDb(data);
}

/** Toggle a portal user active/inactive (revoke without deleting). */
export async function setCustomerUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('customer_users')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(`Failed to update portal user: ${error.message}`);
}

/** Hard-delete a portal user link. Does NOT delete the auth.users row. */
export async function removeCustomerUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_users')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to remove portal user: ${error.message}`);
}

/**
 * Resolve a customer by its portal slug (custom_subdomain). Used by the
 * portal route to know which customer is being accessed BEFORE login.
 * Returns only the public-facing branding fields — RLS still applies.
 */
export async function getCustomerBySlug(slug: string): Promise<{
  id: string;
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
} | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, brand_name, logo_url, primary_color, accent_color, support_email, support_url')
    .eq('custom_subdomain', slug)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    brandName: (data.brand_name as string) ?? null,
    logoUrl: (data.logo_url as string) ?? null,
    primaryColor: (data.primary_color as string) ?? null,
    accentColor: (data.accent_color as string) ?? null,
    supportEmail: (data.support_email as string) ?? null,
    supportUrl: (data.support_url as string) ?? null,
  };
}
