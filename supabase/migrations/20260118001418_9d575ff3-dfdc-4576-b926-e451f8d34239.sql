-- PSA Integrations table
CREATE TABLE public.psa_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('halopsa', 'autotask', 'connectwise')),
  api_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_ticket_type TEXT,
  default_priority TEXT,
  auto_create_tickets BOOLEAN NOT NULL DEFAULT false,
  ticket_on_drift BOOLEAN NOT NULL DEFAULT true,
  ticket_on_compliance_fail BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PSA Tickets table
CREATE TABLE public.psa_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  psa_integration_id UUID NOT NULL REFERENCES public.psa_integrations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  external_ticket_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  ticket_type TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('drift', 'compliance', 'manual', 'scheduled_drift')),
  source_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('executive_summary', 'compliance', 'drift', 'billing', 'security')),
  date_range_start TIMESTAMP WITH TIME ZONE,
  date_range_end TIMESTAMP WITH TIME ZONE,
  data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Billing/Usage tracking table
CREATE TABLE public.billing_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  resource_counts JSONB NOT NULL DEFAULT '{}',
  total_resources INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  total_devices INTEGER NOT NULL DEFAULT 0,
  billable_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.psa_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psa_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_usage ENABLE ROW LEVEL SECURITY;

-- PSA Integrations policies
CREATE POLICY "Users can view their own PSA integrations"
  ON public.psa_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own PSA integrations"
  ON public.psa_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PSA integrations"
  ON public.psa_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PSA integrations"
  ON public.psa_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- PSA Tickets policies
CREATE POLICY "Users can view their own PSA tickets"
  ON public.psa_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own PSA tickets"
  ON public.psa_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PSA tickets"
  ON public.psa_tickets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PSA tickets"
  ON public.psa_tickets FOR DELETE
  USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id);

-- Billing Usage policies
CREATE POLICY "Users can view their own billing usage"
  ON public.billing_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own billing usage"
  ON public.billing_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing usage"
  ON public.billing_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own billing usage"
  ON public.billing_usage FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_psa_integrations_user_id ON public.psa_integrations(user_id);
CREATE INDEX idx_psa_integrations_provider ON public.psa_integrations(provider);
CREATE INDEX idx_psa_tickets_user_id ON public.psa_tickets(user_id);
CREATE INDEX idx_psa_tickets_integration ON public.psa_tickets(psa_integration_id);
CREATE INDEX idx_psa_tickets_customer ON public.psa_tickets(customer_id);
CREATE INDEX idx_psa_tickets_source ON public.psa_tickets(source_type, source_id);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_customer ON public.reports(customer_id);
CREATE INDEX idx_reports_type ON public.reports(report_type);
CREATE INDEX idx_billing_usage_user_id ON public.billing_usage(user_id);
CREATE INDEX idx_billing_usage_customer ON public.billing_usage(customer_id);
CREATE INDEX idx_billing_usage_period ON public.billing_usage(period_start, period_end);

-- Triggers for updated_at
CREATE TRIGGER update_psa_integrations_updated_at
  BEFORE UPDATE ON public.psa_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_psa_tickets_updated_at
  BEFORE UPDATE ON public.psa_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_usage_updated_at
  BEFORE UPDATE ON public.billing_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();