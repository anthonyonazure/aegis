
-- Create dude_mappings table
CREATE TABLE public.dude_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  user_group_id TEXT NOT NULL,
  user_group_name TEXT NOT NULL,
  device_group_id TEXT NOT NULL,
  device_group_name TEXT NOT NULL,
  os_filter TEXT NOT NULL DEFAULT 'All',
  admin_unit_id TEXT,
  admin_unit_name TEXT,
  defender_tag TEXT,
  max_removal_percent INTEGER NOT NULL DEFAULT 25,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create dude_sync_logs table
CREATE TABLE public.dude_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mapping_id UUID NOT NULL REFERENCES public.dude_mappings(id) ON DELETE CASCADE,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  devices_added INTEGER NOT NULL DEFAULT 0,
  devices_removed INTEGER NOT NULL DEFAULT 0,
  devices_skipped INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dude_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dude_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for dude_mappings
CREATE POLICY "Users can view their own mappings" ON public.dude_mappings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create their own mappings" ON public.dude_mappings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own mappings" ON public.dude_mappings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own mappings" ON public.dude_mappings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS policies for dude_sync_logs
CREATE POLICY "Users can view their own sync logs" ON public.dude_sync_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create their own sync logs" ON public.dude_sync_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_dude_mappings_user_id ON public.dude_mappings(user_id);
CREATE INDEX idx_dude_mappings_tenant_connection_id ON public.dude_mappings(tenant_connection_id);
CREATE INDEX idx_dude_sync_logs_mapping_id ON public.dude_sync_logs(mapping_id);
CREATE INDEX idx_dude_sync_logs_user_id ON public.dude_sync_logs(user_id);
CREATE INDEX idx_dude_sync_logs_created_at ON public.dude_sync_logs(created_at DESC);

-- Updated_at trigger for dude_mappings
CREATE TRIGGER update_dude_mappings_updated_at
  BEFORE UPDATE ON public.dude_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
