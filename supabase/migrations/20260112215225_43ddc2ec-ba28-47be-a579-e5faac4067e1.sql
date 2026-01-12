-- Create table for tenant connections
CREATE TABLE public.tenant_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tenant_name TEXT,
  auth_method TEXT NOT NULL CHECK (auth_method IN ('app', 'delegated')),
  client_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for export jobs
CREATE TABLE public.export_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  categories TEXT[] NOT NULL DEFAULT '{}',
  formats TEXT[] NOT NULL DEFAULT '{}',
  output_path TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create table for exported resources (stores the actual exported data)
CREATE TABLE public.exported_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_job_id UUID NOT NULL REFERENCES public.export_jobs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  resource_name TEXT,
  data JSONB NOT NULL,
  terraform_config TEXT,
  bicep_config TEXT,
  powershell_script TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for git configurations
CREATE TABLE public.git_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id),
  provider TEXT NOT NULL CHECK (provider IN ('github', 'azure-devops', 'gitlab')),
  repo_url TEXT,
  branch TEXT DEFAULT 'main',
  auto_commit BOOLEAN DEFAULT true,
  commit_message_template TEXT DEFAULT 'chore: update M365 export - {{date}}',
  cicd_template TEXT CHECK (cicd_template IN ('github-actions', 'azure-pipelines', 'gitlab-ci')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_export_jobs_tenant ON public.export_jobs(tenant_connection_id);
CREATE INDEX idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX idx_exported_resources_job ON public.exported_resources(export_job_id);
CREATE INDEX idx_exported_resources_category ON public.exported_resources(category);

-- Enable Row Level Security (allowing all operations for now since no auth)
ALTER TABLE public.tenant_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exported_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_configs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (will restrict once auth is added)
CREATE POLICY "Allow all operations on tenant_connections" ON public.tenant_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on export_jobs" ON public.export_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on exported_resources" ON public.exported_resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on git_configs" ON public.git_configs FOR ALL USING (true) WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_tenant_connections_updated_at
  BEFORE UPDATE ON public.tenant_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_git_configs_updated_at
  BEFORE UPDATE ON public.git_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();