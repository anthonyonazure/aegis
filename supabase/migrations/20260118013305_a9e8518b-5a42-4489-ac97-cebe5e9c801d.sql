-- Create table for automated backup configurations
CREATE TABLE public.automated_backup_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  backup_type TEXT NOT NULL DEFAULT 'policy', -- 'policy', 'full', 'selective'
  schedule_cron TEXT NOT NULL DEFAULT '0 2 * * *', -- Default: 2 AM daily
  schedule_description TEXT,
  resource_ids TEXT[] NOT NULL DEFAULT '{}',
  formats TEXT[] NOT NULL DEFAULT '{json}',
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'customer', 'group', 'selected'
  target_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  target_tenant_ids UUID[] DEFAULT '{}',
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_backups INTEGER NOT NULL DEFAULT 10,
  auto_cleanup BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_success BOOLEAN,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for backup runs/history
CREATE TABLE public.automated_backup_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  config_id UUID NOT NULL REFERENCES public.automated_backup_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  total_resources INTEGER NOT NULL DEFAULT 0,
  export_job_ids UUID[] DEFAULT '{}',
  error_message TEXT,
  results JSONB DEFAULT '[]',
  expires_at TIMESTAMP WITH TIME ZONE, -- For retention policy
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automated_backup_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_backup_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for automated_backup_configs
CREATE POLICY "Users can view own backup configs"
  ON public.automated_backup_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own backup configs"
  ON public.automated_backup_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backup configs"
  ON public.automated_backup_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own backup configs"
  ON public.automated_backup_configs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for automated_backup_runs
CREATE POLICY "Users can view own backup runs"
  ON public.automated_backup_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own backup runs"
  ON public.automated_backup_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backup runs"
  ON public.automated_backup_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own backup runs"
  ON public.automated_backup_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_backup_configs_user ON public.automated_backup_configs(user_id);
CREATE INDEX idx_backup_configs_active ON public.automated_backup_configs(is_active);
CREATE INDEX idx_backup_runs_config ON public.automated_backup_runs(config_id);
CREATE INDEX idx_backup_runs_status ON public.automated_backup_runs(status);
CREATE INDEX idx_backup_runs_expires ON public.automated_backup_runs(expires_at);

-- Add trigger for updated_at
CREATE TRIGGER update_automated_backup_configs_updated_at
  BEFORE UPDATE ON public.automated_backup_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();