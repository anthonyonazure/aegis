-- Phase 2 #3a: Customer-facing read-only portal — foundation
--
-- Lets MSPs invite their clients to a branded read-only view of their own
-- tenant data. Portal users are auth.users rows linked to a customer via
-- public.customer_users. RLS uses a SECURITY DEFINER helper function so
-- new portal-scoped policies don't have to repeat the join logic.

-- 1. Map auth users to a customer for portal access.
CREATE TABLE IF NOT EXISTS public.customer_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer_viewer' CHECK (role IN ('customer_admin', 'customer_viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One auth user can only be linked to one customer (a portal user belongs to one client).
  CONSTRAINT customer_users_user_unique UNIQUE (auth_user_id)
);

CREATE INDEX IF NOT EXISTS customer_users_customer_id_idx ON public.customer_users (customer_id);

ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;

-- The MSP that owns the customer can manage portal users for that customer.
CREATE POLICY "MSP can manage portal users for their customers"
  ON public.customer_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_users.customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_users.customer_id
        AND c.user_id = auth.uid()
    )
  );

-- A portal user can read their own membership row (so the portal app can
-- introspect the active session). They cannot insert/update/delete it.
CREATE POLICY "Portal users can read their own membership"
  ON public.customer_users FOR SELECT
  USING (auth_user_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER update_customer_users_updated_at
  BEFORE UPDATE ON public.customer_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper used by every portal-scoped RLS policy.
-- Returns the customer_id the calling auth user is a portal user for, or
-- NULL when the caller is an MSP user (or unauthenticated).
-- SECURITY DEFINER so policies on other tables can call it without needing
-- a self-policy on customer_users for every reader.
CREATE OR REPLACE FUNCTION public.current_portal_customer_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT customer_id
  FROM public.customer_users
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_portal_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_portal_customer_id() TO authenticated;

-- 3. Portal-scoped read policies on the tables the read-only portal exposes.
--    Layered ON TOP of the existing MSP-owner policies; both can be true.
--
--    A portal user's customer_id maps to tenant_connections rows via
--    tenant_connections.customer_id, so child rows are filtered through
--    tenant_connection_id -> customer_id.

-- customers: portal user can read their own customer row only.
CREATE POLICY "Portal users can read their own customer"
  ON public.customers FOR SELECT
  USING (id = public.current_portal_customer_id());

-- tenant_connections: portal user can read tenants under their customer.
CREATE POLICY "Portal users can read tenants for their customer"
  ON public.tenant_connections FOR SELECT
  USING (
    customer_id IS NOT NULL
    AND customer_id = public.current_portal_customer_id()
  );

-- tenant_secure_scores: latest scores for the customer's tenants.
CREATE POLICY "Portal users can read secure scores for their tenants"
  ON public.tenant_secure_scores FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND tenant_connection_id IN (
      SELECT id FROM public.tenant_connections
      WHERE customer_id = public.current_portal_customer_id()
    )
  );

-- secure_score_history: trend data for the customer's tenants.
CREATE POLICY "Portal users can read secure score history for their tenants"
  ON public.secure_score_history FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND tenant_connection_id IN (
      SELECT id FROM public.tenant_connections
      WHERE customer_id = public.current_portal_customer_id()
    )
  );

-- scheduled_drift_runs: drift run summaries for the customer's tenants.
-- The run itself isn't tenant-scoped (it covers many tenants per run), so we
-- gate on whether ANY targeted tenant belongs to the portal user's customer.
-- The portal UI will then filter the results JSONB to only the tenants the
-- portal user owns.
CREATE POLICY "Portal users can read drift runs touching their tenants"
  ON public.scheduled_drift_runs FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(scheduled_drift_runs.results->'tenants', '[]'::jsonb)) AS t(elem)
      JOIN public.tenant_connections tc
        ON tc.id::text = (t.elem->>'connectionId')
      WHERE tc.customer_id = public.current_portal_customer_id()
    )
  );

COMMENT ON FUNCTION public.current_portal_customer_id() IS
  'Phase 2 #3a: Returns the customer_id for portal users; NULL for MSP users. Used by portal RLS policies.';
COMMENT ON TABLE public.customer_users IS
  'Phase 2 #3a: Links auth.users to a customer for the read-only portal.';
