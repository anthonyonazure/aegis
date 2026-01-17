-- Phase 1: Customer Hierarchy Foundation

-- 1. Create customer tier enum
CREATE TYPE public.customer_tier AS ENUM ('starter', 'professional', 'enterprise');

-- 2. Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  tier customer_tier NOT NULL DEFAULT 'starter',
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create tenant groups table
CREATE TABLE public.tenant_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Alter tenant_connections table to add new columns
ALTER TABLE public.tenant_connections 
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN tenant_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  ADD COLUMN display_name TEXT,
  ADD COLUMN environment TEXT DEFAULT 'production',
  ADD COLUMN tags TEXT[] DEFAULT '{}',
  ADD COLUMN health_status TEXT DEFAULT 'unknown',
  ADD COLUMN last_health_check TIMESTAMPTZ;

-- 5. Create security definer function to check customer ownership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.owns_customer(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id AND user_id = auth.uid()
  )
$$;

-- 6. Enable RLS on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for customers table
CREATE POLICY "Users can view own customers"
ON public.customers FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
ON public.customers FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
ON public.customers FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 8. Enable RLS on tenant_groups table
ALTER TABLE public.tenant_groups ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for tenant_groups table (using security definer function)
CREATE POLICY "Users can view own tenant groups"
ON public.tenant_groups FOR SELECT TO authenticated
USING (public.owns_customer(customer_id));

CREATE POLICY "Users can create own tenant groups"
ON public.tenant_groups FOR INSERT TO authenticated
WITH CHECK (public.owns_customer(customer_id));

CREATE POLICY "Users can update own tenant groups"
ON public.tenant_groups FOR UPDATE TO authenticated
USING (public.owns_customer(customer_id));

CREATE POLICY "Users can delete own tenant groups"
ON public.tenant_groups FOR DELETE TO authenticated
USING (public.owns_customer(customer_id));

-- 10. Create indexes for performance
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_customers_tier ON public.customers(tier);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);
CREATE INDEX idx_tenant_groups_customer_id ON public.tenant_groups(customer_id);
CREATE INDEX idx_tenant_connections_customer_id ON public.tenant_connections(customer_id);
CREATE INDEX idx_tenant_connections_tenant_group_id ON public.tenant_connections(tenant_group_id);
CREATE INDEX idx_tenant_connections_environment ON public.tenant_connections(environment);

-- 11. Create triggers for updated_at timestamps
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_groups_updated_at
  BEFORE UPDATE ON public.tenant_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();