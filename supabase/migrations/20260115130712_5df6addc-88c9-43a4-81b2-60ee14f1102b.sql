-- Create service_principal_configs table for storing reusable service principal configurations
CREATE TABLE public.service_principal_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  connection_types TEXT[] NOT NULL DEFAULT '{graph}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.service_principal_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own service principal configs"
ON public.service_principal_configs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own service principal configs"
ON public.service_principal_configs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service principal configs"
ON public.service_principal_configs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own service principal configs"
ON public.service_principal_configs
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_service_principal_configs_updated_at
BEFORE UPDATE ON public.service_principal_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add service_principal_config_id to scheduled_exports table
ALTER TABLE public.scheduled_exports
ADD COLUMN service_principal_config_id UUID REFERENCES public.service_principal_configs(id) ON DELETE SET NULL;