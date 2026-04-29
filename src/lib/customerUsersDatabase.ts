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
 * Invite a portal user by email (Phase 2 #3b).
 *
 * Calls the `invite-portal-user` edge function which uses the Supabase Auth
 * Admin API to either invite a new user (sending a magic link) or generate a
 * fresh magic link for an existing account, then upserts the customer_users
 * row that grants portal access.
 */
export async function inviteCustomerUserByEmail(input: {
  customerId: string;
  email: string;
  role?: CustomerUserRole;
  redirectTo?: string;
}): Promise<{
  authUserId: string;
  inviteEmailSent: boolean;
  message: string;
}> {
  const { data, error } = await supabase.functions.invoke('invite-portal-user', {
    body: {
      customerId: input.customerId,
      email: input.email,
      role: input.role ?? 'customer_viewer',
      ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
    },
  });
  if (error) {
    // Edge function returned non-2xx; supabase-js wraps the body in error.context
    throw new Error(error.message || 'Failed to invite portal user');
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to invite portal user');
  }
  return {
    authUserId: data.authUserId,
    inviteEmailSent: Boolean(data.inviteEmailSent),
    message: data.message ?? '',
  };
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
