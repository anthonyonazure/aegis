-- Create table for storing permission test results
CREATE TABLE public.permission_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Test summary
  total_resources INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Detailed results (JSON array of test results)
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Provider breakdown
  graph_passed INTEGER NOT NULL DEFAULT 0,
  graph_failed INTEGER NOT NULL DEFAULT 0,
  azure_passed INTEGER NOT NULL DEFAULT 0,
  azure_failed INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  test_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'pre-export'
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.permission_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own permission health checks"
ON public.permission_health_checks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own permission health checks"
ON public.permission_health_checks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own permission health checks"
ON public.permission_health_checks
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_permission_health_checks_user_tenant 
ON public.permission_health_checks(user_id, tenant_connection_id, created_at DESC);

-- Create table for tracking permission changes (delta tracking)
CREATE TABLE public.permission_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Change details
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'graph' or 'azure'
  change_type TEXT NOT NULL, -- 'gained', 'lost', 'recovered'
  previous_status BOOLEAN, -- true = had permission, false = didn't have
  current_status BOOLEAN NOT NULL,
  
  -- Context
  health_check_id UUID REFERENCES public.permission_health_checks(id) ON DELETE CASCADE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.permission_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own permission changes"
ON public.permission_changes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own permission changes"
ON public.permission_changes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for timeline queries
CREATE INDEX idx_permission_changes_timeline 
ON public.permission_changes(user_id, tenant_connection_id, created_at DESC);