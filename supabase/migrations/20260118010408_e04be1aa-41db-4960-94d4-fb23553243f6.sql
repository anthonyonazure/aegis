-- Create scheduled deployment configs table
CREATE TABLE public.scheduled_deployment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  policy_template_id UUID NOT NULL REFERENCES public.policy_templates(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'selected',
  target_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  target_tenant_ids TEXT[] DEFAULT '{}',
  schedule_cron TEXT NOT NULL,
  schedule_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  notify_on_completion BOOLEAN NOT NULL DEFAULT true,
  webhook_config_id UUID REFERENCES public.webhook_configs(id) ON DELETE SET NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_success BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled deployment runs table
CREATE TABLE public.scheduled_deployment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_config_id UUID NOT NULL REFERENCES public.scheduled_deployment_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_tenants INTEGER NOT NULL DEFAULT 0,
  completed_tenants INTEGER NOT NULL DEFAULT 0,
  failed_tenants INTEGER NOT NULL DEFAULT 0,
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_deployment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_deployment_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_deployment_configs
CREATE POLICY "Users can view their own scheduled deployment configs" 
ON public.scheduled_deployment_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled deployment configs" 
ON public.scheduled_deployment_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled deployment configs" 
ON public.scheduled_deployment_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled deployment configs" 
ON public.scheduled_deployment_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for scheduled_deployment_runs
CREATE POLICY "Users can view their own scheduled deployment runs" 
ON public.scheduled_deployment_runs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled deployment runs" 
ON public.scheduled_deployment_runs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled deployment runs" 
ON public.scheduled_deployment_runs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_scheduled_deployment_configs_updated_at
BEFORE UPDATE ON public.scheduled_deployment_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_scheduled_deployment_configs_user_id ON public.scheduled_deployment_configs(user_id);
CREATE INDEX idx_scheduled_deployment_configs_is_active ON public.scheduled_deployment_configs(is_active);
CREATE INDEX idx_scheduled_deployment_configs_next_run_at ON public.scheduled_deployment_configs(next_run_at);
CREATE INDEX idx_scheduled_deployment_runs_config_id ON public.scheduled_deployment_runs(scheduled_config_id);
CREATE INDEX idx_scheduled_deployment_runs_status ON public.scheduled_deployment_runs(status);