-- Phase 2 #3c: Custom domains + public branding lookup.
--
-- Adds custom_domain to customers (so a customer's portal can live at e.g.
-- portal.acme.com once a CNAME is verified) and a SECURITY DEFINER function
-- the unauthenticated portal-login page can call to fetch ONLY the
-- public-facing branding fields. Without the function the portal login
-- would have no way to brand itself before the user signs in (the existing
-- RLS on customers blocks anon reads).

-- 1. New columns
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

-- 2. Constrain custom_domain to a sensible hostname (no scheme, no path).
--    Letters / digits / dots / hyphens; each label 1-63 chars.
ALTER TABLE public.customers
  ADD CONSTRAINT customers_custom_domain_format
  CHECK (
    custom_domain IS NULL
    OR (
      length(custom_domain) BETWEEN 4 AND 253
      AND custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?))+$'
    )
  );

-- 3. Globally unique when set
CREATE UNIQUE INDEX IF NOT EXISTS customers_custom_domain_uniq
  ON public.customers (custom_domain)
  WHERE custom_domain IS NOT NULL;

-- 4. Public branding lookup — used pre-auth by the portal login page so it
--    can render the customer's logo / colors before the user signs in.
--    Returns NULL when neither identifier matches. SECURITY DEFINER bypasses
--    RLS but the function only ever returns a fixed set of public fields,
--    never anything sensitive.
--
--    Inputs:
--      p_slug — match against customers.custom_subdomain
--      p_host — match against customers.custom_domain (only when verified)
--
--    For custom domains, only return branding if custom_domain_verified_at is
--    set. Pre-verified domains shouldn't render as a real portal — they
--    should bounce to a "verify your domain first" state.
CREATE OR REPLACE FUNCTION public.get_portal_branding(
  p_slug TEXT DEFAULT NULL,
  p_host TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand_name TEXT,
  logo_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  support_email TEXT,
  support_url TEXT,
  custom_subdomain TEXT,
  custom_domain TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.brand_name,
    c.logo_url,
    c.primary_color,
    c.accent_color,
    c.support_email,
    c.support_url,
    c.custom_subdomain,
    c.custom_domain
  FROM public.customers c
  WHERE
    (p_slug IS NOT NULL AND c.custom_subdomain = p_slug)
    OR (
      p_host IS NOT NULL
      AND c.custom_domain = lower(p_host)
      AND c.custom_domain_verified_at IS NOT NULL
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_portal_branding(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_branding(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_portal_branding(TEXT, TEXT) IS
  'Phase 2 #3c: Public-safe lookup of a customer''s portal branding by subdomain slug or verified custom domain. Used by the portal login page pre-auth.';
