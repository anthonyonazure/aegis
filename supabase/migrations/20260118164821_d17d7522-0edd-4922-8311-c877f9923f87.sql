-- Create governance_metrics_history table to store governance snapshots over time
CREATE TABLE public.governance_metrics_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Security metrics
  secure_score NUMERIC DEFAULT 0,
  max_secure_score NUMERIC DEFAULT 100,
  risky_sign_ins INTEGER DEFAULT 0,
  conditional_access_policies INTEGER DEFAULT 0,
  
  -- Identity metrics
  total_users INTEGER DEFAULT 0,
  admin_users INTEGER DEFAULT 0,
  guest_users INTEGER DEFAULT 0,
  mfa_enabled_users INTEGER DEFAULT 0,
  risky_users INTEGER DEFAULT 0,
  stale_accounts INTEGER DEFAULT 0,
  
  -- Licensing metrics
  total_licenses INTEGER DEFAULT 0,
  assigned_licenses INTEGER DEFAULT 0,
  unused_licenses INTEGER DEFAULT 0,
  license_utilization NUMERIC DEFAULT 0,
  license_cost_monthly NUMERIC DEFAULT 0,
  
  -- Compliance metrics
  compliance_score NUMERIC DEFAULT 0,
  
  -- Action counts
  critical_actions INTEGER DEFAULT 0,
  high_actions INTEGER DEFAULT 0,
  medium_actions INTEGER DEFAULT 0,
  low_actions INTEGER DEFAULT 0,
  
  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient time-series queries
CREATE INDEX idx_governance_metrics_history_user_recorded 
  ON public.governance_metrics_history(user_id, recorded_at DESC);

CREATE INDEX idx_governance_metrics_history_tenant_recorded 
  ON public.governance_metrics_history(tenant_connection_id, recorded_at DESC);

CREATE INDEX idx_governance_metrics_history_customer_recorded 
  ON public.governance_metrics_history(customer_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.governance_metrics_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own governance history" 
  ON public.governance_metrics_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own governance history" 
  ON public.governance_metrics_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own governance history" 
  ON public.governance_metrics_history 
  FOR DELETE 
  USING (auth.uid() = user_id);