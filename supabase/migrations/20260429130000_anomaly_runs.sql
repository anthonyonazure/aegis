-- Phase 2 #3b: Persist anomaly detection results so the customer portal
-- (and MSP-side history) can read findings without re-running the AI.

CREATE TABLE IF NOT EXISTS public.anomaly_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  -- Aggregate counts pulled from the AI summary; useful for list views without
  -- parsing the JSONB payload.
  total_anomalies INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  overall_risk_level TEXT,                -- 'critical' | 'high' | 'medium' | 'low' | 'none'
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,    -- raw summary block from the AI
  anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,  -- the findings array
  data_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anomaly_runs_user_idx ON public.anomaly_runs (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS anomaly_runs_tenant_idx ON public.anomaly_runs (tenant_connection_id, completed_at DESC);

ALTER TABLE public.anomaly_runs ENABLE ROW LEVEL SECURITY;

-- MSP that owns the row sees it (mirrors how scheduled_drift_runs is owned).
CREATE POLICY "MSP users can view their own anomaly runs"
  ON public.anomaly_runs FOR SELECT
  USING (auth.uid() = user_id);

-- The function writing rows uses the service role; we still want a write
-- policy for self-served retries from MSP UI in the future.
CREATE POLICY "MSP users can insert their own anomaly runs"
  ON public.anomaly_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "MSP users can delete their own anomaly runs"
  ON public.anomaly_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Portal users can read anomaly runs whose tenant_connection_id maps to a
-- tenant under their customer (same pattern as the secure-score policies).
CREATE POLICY "Portal users can read anomaly runs for their tenants"
  ON public.anomaly_runs FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND tenant_connection_id IN (
      SELECT id FROM public.tenant_connections
      WHERE customer_id = public.current_portal_customer_id()
    )
  );

COMMENT ON TABLE public.anomaly_runs IS
  'Phase 2 #3b: Persisted output of ai-anomaly-detection. Read by the customer portal anomalies view.';
