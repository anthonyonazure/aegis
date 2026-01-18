-- Create scheduled governance scan configs table
CREATE TABLE public.scheduled_governance_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schedule_cron TEXT NOT NULL DEFAULT '0 6 * * *',
  schedule_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Target configuration
  target_type TEXT NOT NULL DEFAULT 'all_tenants',
  target_tenant_ids UUID[] DEFAULT '{}',
  target_customer_id UUID REFERENCES public.customers(id),
  target_group_id UUID REFERENCES public.tenant_groups(id),
  
  -- Alert thresholds
  secure_score_threshold INTEGER DEFAULT 50,
  mfa_coverage_threshold INTEGER DEFAULT 80,
  license_utilization_threshold INTEGER DEFAULT 70,
  alert_on_risky_users BOOLEAN DEFAULT true,
  alert_on_risky_signins BOOLEAN DEFAULT true,
  
  -- Notification settings
  notify_on_completion BOOLEAN DEFAULT false,
  notify_on_threshold_breach BOOLEAN DEFAULT true,
  webhook_config_id UUID REFERENCES public.webhook_configs(id),
  
  -- Tracking
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_run_success BOOLEAN,
  next_run_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scheduled governance scan runs table
CREATE TABLE public.scheduled_governance_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_config_id UUID NOT NULL REFERENCES public.scheduled_governance_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Results
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  tenants_with_alerts INTEGER NOT NULL DEFAULT 0,
  
  results JSONB,
  error_message TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_governance_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_governance_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for configs
CREATE POLICY "Users can view their own governance configs"
  ON public.scheduled_governance_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own governance configs"
  ON public.scheduled_governance_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own governance configs"
  ON public.scheduled_governance_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own governance configs"
  ON public.scheduled_governance_configs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for runs
CREATE POLICY "Users can view their own governance runs"
  ON public.scheduled_governance_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own governance runs"
  ON public.scheduled_governance_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own governance runs"
  ON public.scheduled_governance_runs FOR UPDATE
  USING (auth.uid() = user_id);