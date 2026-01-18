-- Create table for Azure Automation configurations
CREATE TABLE public.azure_automation_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  resource_group TEXT NOT NULL,
  automation_account_name TEXT NOT NULL,
  runbook_name TEXT NOT NULL DEFAULT 'Export-M365Config',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  connection_status TEXT DEFAULT 'untested',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking automation job runs
CREATE TABLE public.automation_job_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  automation_config_id UUID NOT NULL REFERENCES public.azure_automation_configs(id) ON DELETE CASCADE,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL,
  azure_job_id TEXT,
  resource_types TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  output JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.azure_automation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_job_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for azure_automation_configs
CREATE POLICY "Users can view own automation configs"
  ON public.azure_automation_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation configs"
  ON public.azure_automation_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation configs"
  ON public.azure_automation_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation configs"
  ON public.azure_automation_configs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for automation_job_runs
CREATE POLICY "Users can view own job runs"
  ON public.automation_job_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own job runs"
  ON public.automation_job_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job runs"
  ON public.automation_job_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job runs"
  ON public.automation_job_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_azure_automation_configs_updated_at
  BEFORE UPDATE ON public.azure_automation_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();