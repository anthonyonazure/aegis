-- Create audit_logs table for tracking all user actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own audit logs
CREATE POLICY "Users can create own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create compliance_results table for storing compliance check results
CREATE TABLE public.compliance_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  export_job_id UUID REFERENCES public.export_jobs(id) ON DELETE CASCADE,
  baseline_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_checks INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.compliance_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for compliance_results
CREATE POLICY "Users can view own compliance results"
ON public.compliance_results
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own compliance results"
ON public.compliance_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own compliance results"
ON public.compliance_results
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own compliance results"
ON public.compliance_results
FOR DELETE
USING (auth.uid() = user_id);

-- Create drift_detections table for storing drift detection results
CREATE TABLE public.drift_detections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL,
  baseline_export_id UUID REFERENCES public.export_jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_resources INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  added_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  modified_count INTEGER NOT NULL DEFAULT 0,
  drift_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.drift_detections ENABLE ROW LEVEL SECURITY;

-- RLS policies for drift_detections
CREATE POLICY "Users can view own drift detections"
ON public.drift_detections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own drift detections"
ON public.drift_detections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drift detections"
ON public.drift_detections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drift detections"
ON public.drift_detections
FOR DELETE
USING (auth.uid() = user_id);