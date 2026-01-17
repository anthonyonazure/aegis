-- Phase 2: Policy Deployment at Scale

-- 1. Create baseline type enum
CREATE TYPE public.baseline_type AS ENUM ('cis', 'nist', 'hipaa', 'iso27001', 'zero_trust', 'microsoft_security', 'custom');

-- 2. Create policy templates table
CREATE TABLE public.policy_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  baseline_type baseline_type NOT NULL DEFAULT 'custom',
  policy_data JSONB NOT NULL DEFAULT '{}',
  resource_types TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create deployment status enum
CREATE TYPE public.deployment_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'rolled_back');

-- 4. Create policy deployments table (tracks multi-tenant rollouts)
CREATE TABLE public.policy_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  policy_template_id UUID NOT NULL REFERENCES public.policy_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL DEFAULT 'selected', -- 'all', 'customer', 'group', 'selected'
  target_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  target_tenant_ids UUID[] NOT NULL DEFAULT '{}',
  dry_run BOOLEAN NOT NULL DEFAULT false,
  status deployment_status NOT NULL DEFAULT 'pending',
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create deployment results table (per-tenant deployment status)
CREATE TABLE public.deployment_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES public.policy_deployments(id) ON DELETE CASCADE,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  status deployment_status NOT NULL DEFAULT 'pending',
  dry_run_result JSONB,
  applied_changes JSONB,
  error_message TEXT,
  rollback_data JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable RLS on policy_templates
ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own policy templates"
ON public.policy_templates FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own policy templates"
ON public.policy_templates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policy templates"
ON public.policy_templates FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own policy templates"
ON public.policy_templates FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 7. Enable RLS on policy_deployments
ALTER TABLE public.policy_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own policy deployments"
ON public.policy_deployments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own policy deployments"
ON public.policy_deployments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policy deployments"
ON public.policy_deployments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own policy deployments"
ON public.policy_deployments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 8. Create function to check deployment ownership
CREATE OR REPLACE FUNCTION public.owns_deployment(p_deployment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.policy_deployments
    WHERE id = p_deployment_id AND user_id = auth.uid()
  )
$$;

-- 9. Enable RLS on deployment_results
ALTER TABLE public.deployment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deployment results"
ON public.deployment_results FOR SELECT TO authenticated
USING (public.owns_deployment(deployment_id));

CREATE POLICY "Users can create own deployment results"
ON public.deployment_results FOR INSERT TO authenticated
WITH CHECK (public.owns_deployment(deployment_id));

CREATE POLICY "Users can update own deployment results"
ON public.deployment_results FOR UPDATE TO authenticated
USING (public.owns_deployment(deployment_id));

CREATE POLICY "Users can delete own deployment results"
ON public.deployment_results FOR DELETE TO authenticated
USING (public.owns_deployment(deployment_id));

-- 10. Create indexes for performance
CREATE INDEX idx_policy_templates_user_id ON public.policy_templates(user_id);
CREATE INDEX idx_policy_templates_baseline_type ON public.policy_templates(baseline_type);
CREATE INDEX idx_policy_templates_category ON public.policy_templates(category);
CREATE INDEX idx_policy_deployments_user_id ON public.policy_deployments(user_id);
CREATE INDEX idx_policy_deployments_template_id ON public.policy_deployments(policy_template_id);
CREATE INDEX idx_policy_deployments_status ON public.policy_deployments(status);
CREATE INDEX idx_deployment_results_deployment_id ON public.deployment_results(deployment_id);
CREATE INDEX idx_deployment_results_tenant_id ON public.deployment_results(tenant_connection_id);

-- 11. Create triggers for updated_at timestamps
CREATE TRIGGER update_policy_templates_updated_at
  BEFORE UPDATE ON public.policy_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_policy_deployments_updated_at
  BEFORE UPDATE ON public.policy_deployments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();