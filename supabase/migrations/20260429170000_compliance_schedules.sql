-- Phase 2 #4c: Scheduled compliance evidence collection.
--
-- Same pattern as scheduled_drift_configs / scheduled_drift_runs: a config
-- describes which (framework, target tenants, cadence) to run; a runner
-- entry point evaluates them and creates per-tenant compliance_evidence_runs.

CREATE TABLE IF NOT EXISTS public.scheduled_compliance_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE RESTRICT,
  -- Targeting: same dialect as scheduled_drift_configs
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'customer', 'group', 'selected')),
  target_tenant_ids UUID[] NOT NULL DEFAULT '{}',
  target_customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE CASCADE,
  -- Cadence: stored as cron expression. The runner uses the simple
  -- cadence-detection logic from run-scheduled-drift (every-N-minutes /
  -- hourly / daily / weekly / monthly) — enough for the typical "weekly
  -- evidence pull" cadence MSPs want.
  schedule_cron TEXT NOT NULL DEFAULT '0 9 * * 1', -- 09:00 every Monday
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_compliance_configs_user_idx
  ON public.scheduled_compliance_configs (user_id);

ALTER TABLE public.scheduled_compliance_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MSP users can manage their own compliance schedules"
  ON public.scheduled_compliance_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_scheduled_compliance_configs_updated_at
  BEFORE UPDATE ON public.scheduled_compliance_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Run records — each "schedule fire" produces one row summarizing how many
-- tenants were evaluated and how many compliance_evidence_runs it created.
CREATE TABLE IF NOT EXISTS public.scheduled_compliance_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_config_id UUID NOT NULL REFERENCES public.scheduled_compliance_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  -- Aggregate counts across all evidence_runs created by this fire
  passed_total INTEGER NOT NULL DEFAULT 0,
  failed_total INTEGER NOT NULL DEFAULT 0,
  -- Pointers to the per-tenant compliance_evidence_runs rows
  evidence_run_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS scheduled_compliance_runs_config_idx
  ON public.scheduled_compliance_runs (scheduled_config_id, started_at DESC);

ALTER TABLE public.scheduled_compliance_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MSP users can read their own compliance schedule runs"
  ON public.scheduled_compliance_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "MSP users can insert their own compliance schedule runs"
  ON public.scheduled_compliance_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
