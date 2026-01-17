-- Create scheduled_drift_configs table for automated drift detection
CREATE TABLE IF NOT EXISTS public.scheduled_drift_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Targeting (similar to policy deployments)
  target_type TEXT NOT NULL DEFAULT 'selected',
  target_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  target_tenant_ids UUID[] NOT NULL DEFAULT '{}',
  
  -- Schedule configuration
  schedule_cron TEXT NOT NULL,
  schedule_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Baseline configuration
  baseline_export_id UUID REFERENCES public.export_jobs(id) ON DELETE SET NULL,
  resource_ids TEXT[] NOT NULL DEFAULT '{}',
  
  -- Service principal for automated auth
  service_principal_config_id UUID REFERENCES public.service_principal_configs(id) ON DELETE SET NULL,
  
  -- Notification settings
  notify_on_drift BOOLEAN NOT NULL DEFAULT true,
  drift_threshold_percent INTEGER DEFAULT 5,
  webhook_config_id UUID REFERENCES public.webhook_configs(id) ON DELETE SET NULL,
  
  -- Run statistics
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_drift_detected BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled_drift_runs table for tracking individual runs
CREATE TABLE IF NOT EXISTS public.scheduled_drift_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_config_id UUID NOT NULL REFERENCES public.scheduled_drift_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Results summary
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  tenants_with_drift INTEGER NOT NULL DEFAULT 0,
  
  -- Detailed results per tenant
  results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_drift_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_drift_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_drift_configs
CREATE POLICY "Users can view own scheduled drift configs" 
  ON public.scheduled_drift_configs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled drift configs" 
  ON public.scheduled_drift_configs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled drift configs" 
  ON public.scheduled_drift_configs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled drift configs" 
  ON public.scheduled_drift_configs FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS policies for scheduled_drift_runs
CREATE POLICY "Users can view own scheduled drift runs" 
  ON public.scheduled_drift_runs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled drift runs" 
  ON public.scheduled_drift_runs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled drift runs" 
  ON public.scheduled_drift_runs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled drift runs" 
  ON public.scheduled_drift_runs FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_drift_configs_user_id ON public.scheduled_drift_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_drift_configs_active ON public.scheduled_drift_configs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_drift_configs_next_run ON public.scheduled_drift_configs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_drift_runs_config_id ON public.scheduled_drift_runs(scheduled_config_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_drift_runs_status ON public.scheduled_drift_runs(status);

-- Add updated_at trigger
CREATE TRIGGER update_scheduled_drift_configs_updated_at
  BEFORE UPDATE ON public.scheduled_drift_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();