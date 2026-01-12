-- Add user_id columns to tables for user-scoped access
ALTER TABLE public.tenant_connections ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.export_jobs ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.git_configs ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for better query performance on user_id
CREATE INDEX idx_tenant_connections_user_id ON public.tenant_connections(user_id);
CREATE INDEX idx_export_jobs_user_id ON public.export_jobs(user_id);
CREATE INDEX idx_git_configs_user_id ON public.git_configs(user_id);

-- Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Allow all operations on tenant_connections" ON public.tenant_connections;
DROP POLICY IF EXISTS "Allow all operations on export_jobs" ON public.export_jobs;
DROP POLICY IF EXISTS "Allow all operations on exported_resources" ON public.exported_resources;
DROP POLICY IF EXISTS "Allow all operations on git_configs" ON public.git_configs;

-- Create secure user-scoped RLS policies for tenant_connections
CREATE POLICY "Users can view own tenant connections"
ON public.tenant_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tenant connections"
ON public.tenant_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tenant connections"
ON public.tenant_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tenant connections"
ON public.tenant_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure user-scoped RLS policies for export_jobs
CREATE POLICY "Users can view own export jobs"
ON public.export_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own export jobs"
ON public.export_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own export jobs"
ON public.export_jobs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own export jobs"
ON public.export_jobs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for exported_resources (linked through export_jobs)
CREATE POLICY "Users can view own exported resources"
ON public.exported_resources FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.export_jobs 
    WHERE export_jobs.id = exported_resources.export_job_id 
    AND export_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create exported resources for own jobs"
ON public.exported_resources FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.export_jobs 
    WHERE export_jobs.id = exported_resources.export_job_id 
    AND export_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own exported resources"
ON public.exported_resources FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.export_jobs 
    WHERE export_jobs.id = exported_resources.export_job_id 
    AND export_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own exported resources"
ON public.exported_resources FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.export_jobs 
    WHERE export_jobs.id = exported_resources.export_job_id 
    AND export_jobs.user_id = auth.uid()
  )
);

-- Create secure user-scoped RLS policies for git_configs
CREATE POLICY "Users can view own git configs"
ON public.git_configs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own git configs"
ON public.git_configs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own git configs"
ON public.git_configs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own git configs"
ON public.git_configs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);