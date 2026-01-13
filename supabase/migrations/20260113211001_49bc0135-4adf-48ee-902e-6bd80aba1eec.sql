-- Create import_jobs table for tracking restore operations
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_type TEXT NOT NULL DEFAULT 'file', -- 'file', 'export_job', 'url'
  source_export_job_id UUID REFERENCES public.export_jobs(id),
  resources_total INTEGER NOT NULL DEFAULT 0,
  resources_imported INTEGER NOT NULL DEFAULT 0,
  resources_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create validation_results table for export validation
CREATE TABLE public.validation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  export_job_id UUID REFERENCES public.export_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'passed', 'failed', 'warning'
  total_resources INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  validation_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on import_jobs
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_jobs
CREATE POLICY "Users can view own import jobs"
  ON public.import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON public.import_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import jobs"
  ON public.import_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on validation_results
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for validation_results
CREATE POLICY "Users can view own validation results"
  ON public.validation_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own validation results"
  ON public.validation_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own validation results"
  ON public.validation_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own validation results"
  ON public.validation_results FOR DELETE
  USING (auth.uid() = user_id);