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
 * Public-safe lookup of a customer's portal branding. Phase 2 #3c moved this
 * to a SECURITY DEFINER RPC so the portal login page can fetch branding
 * BEFORE the user signs in (anonymous role can't read customers under RLS).
 *
 * Pass either a slug (matches custom_subdomain) OR a host (matches
 * custom_domain — only when verified). At least one must be supplied.
 */
export interface PortalBrandingLookup {
  id: string;
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
  customSubdomain: string | null;
  customDomain: string | null;
}

export async function getPortalBranding(input: {
  slug?: string;
  host?: string;
}): Promise<PortalBrandingLookup | null> {
  const { slug, host } = input;
  if (!slug && !host) return null;
  const { data, error } = await supabase.rpc('get_portal_branding', {
    p_slug: slug ?? null,
    p_host: host ?? null,
  });
  if (error || !data) {
    if (error) console.error('get_portal_branding RPC error:', error);
    return null;
  }
  // SECURITY DEFINER RETURNS TABLE: the client gets an array
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    brandName: (row.brand_name as string) ?? null,
    logoUrl: (row.logo_url as string) ?? null,
    primaryColor: (row.primary_color as string) ?? null,
    accentColor: (row.accent_color as string) ?? null,
    supportEmail: (row.support_email as string) ?? null,
    supportUrl: (row.support_url as string) ?? null,
    customSubdomain: (row.custom_subdomain as string) ?? null,
    customDomain: (row.custom_domain as string) ?? null,
  };
}

/** Back-compat wrapper retained so existing callers keep working. */
export async function getCustomerBySlug(slug: string): Promise<PortalBrandingLookup | null> {
  return getPortalBranding({ slug });
}

/**
 * DNS-verify a customer's custom_domain via the verify-custom-domain edge
 * function. Returns the function's full response so the UI can surface the
 * "expected vs actual" diagnostic on failure.
 */
export interface VerifyCustomDomainResult {
  success: boolean;
  verified: boolean;
  via?: 'cname' | 'a';
  matched?: string;
  verifiedAt?: string;
  error?: string;
  checked?: string;
  expected?: { cname?: string[]; a?: string[] };
  actual?: { cname?: string[] };
}

export async function verifyCustomDomain(customerId: string): Promise<VerifyCustomDomainResult> {
  const { data, error } = await supabase.functions.invoke('verify-custom-domain', {
    body: { customerId },
  });
  if (error) {
    return { success: false, verified: false, error: error.message };
  }
  return data as VerifyCustomDomainResult;
}
