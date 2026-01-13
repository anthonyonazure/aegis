-- Create scheduled_exports table
CREATE TABLE public.scheduled_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  resource_ids TEXT[] NOT NULL DEFAULT '{}',
  formats TEXT[] NOT NULL DEFAULT '{json}',
  schedule_cron TEXT NOT NULL,
  schedule_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook_configs table
CREATE TABLE public.webhook_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook_logs table for tracking deliveries
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_config_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Scheduled exports policies
CREATE POLICY "Users can view own scheduled exports" ON public.scheduled_exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own scheduled exports" ON public.scheduled_exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled exports" ON public.scheduled_exports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled exports" ON public.scheduled_exports FOR DELETE USING (auth.uid() = user_id);

-- Webhook configs policies
CREATE POLICY "Users can view own webhook configs" ON public.webhook_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own webhook configs" ON public.webhook_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own webhook configs" ON public.webhook_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own webhook configs" ON public.webhook_configs FOR DELETE USING (auth.uid() = user_id);

-- Webhook logs policies
CREATE POLICY "Users can view own webhook logs" ON public.webhook_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own webhook logs" ON public.webhook_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_scheduled_exports_updated_at BEFORE UPDATE ON public.scheduled_exports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON public.webhook_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();