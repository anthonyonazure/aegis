-- Create health check history table for tracking tenant health over time
CREATE TABLE public.tenant_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  response_time_ms INTEGER,
  check_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'realtime'
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_tenant_health_checks_tenant ON public.tenant_health_checks(tenant_connection_id);
CREATE INDEX idx_tenant_health_checks_user ON public.tenant_health_checks(user_id);
CREATE INDEX idx_tenant_health_checks_created ON public.tenant_health_checks(created_at DESC);

-- Enable RLS
ALTER TABLE public.tenant_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own health checks"
  ON public.tenant_health_checks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create health checks for their tenants"
  ON public.tenant_health_checks
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.tenant_connections 
      WHERE id = tenant_connection_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own health checks"
  ON public.tenant_health_checks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for health checks and tenant connections for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_health_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_connections;