-- Add white-label branding fields to customers (Phase 2 #1)
-- MSPs can customize logo, colors, brand name, and support email per customer.
-- Foundation for the customer-facing portal in Phase 2 #3.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,    -- HSL string e.g. "210 100% 55%" so Tailwind CSS vars work
  ADD COLUMN IF NOT EXISTS accent_color TEXT,     -- HSL string
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_subdomain TEXT; -- reserved for Phase 2 #3 customer portal

-- Constrain custom_subdomain to a-z0-9 + hyphen, no leading/trailing hyphen, 3-63 chars
ALTER TABLE public.customers
  ADD CONSTRAINT customers_custom_subdomain_format
  CHECK (
    custom_subdomain IS NULL
    OR custom_subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'
  );

-- Subdomain must be globally unique when set
CREATE UNIQUE INDEX IF NOT EXISTS customers_custom_subdomain_uniq
  ON public.customers (custom_subdomain)
  WHERE custom_subdomain IS NOT NULL;
