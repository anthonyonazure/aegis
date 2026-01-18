-- Create table to store tenant secure scores
CREATE TABLE public.tenant_secure_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  current_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  score_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN max_score > 0 THEN (current_score / max_score) * 100 ELSE 0 END
  ) STORED,
  control_scores JSONB DEFAULT '[]'::jsonb,
  improvement_actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for secure score history/trends
CREATE TABLE public.secure_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_secure_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_score_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_secure_scores
CREATE POLICY "Users can view own secure scores"
  ON public.tenant_secure_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own secure scores"
  ON public.tenant_secure_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own secure scores"
  ON public.tenant_secure_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own secure scores"
  ON public.tenant_secure_scores FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for secure_score_history
CREATE POLICY "Users can view own score history"
  ON public.secure_score_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own score history"
  ON public.secure_score_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own score history"
  ON public.secure_score_history FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_tenant_secure_scores_tenant ON public.tenant_secure_scores(tenant_connection_id);
CREATE INDEX idx_secure_score_history_tenant ON public.secure_score_history(tenant_connection_id);
CREATE INDEX idx_secure_score_history_recorded ON public.secure_score_history(recorded_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_tenant_secure_scores_updated_at
  BEFORE UPDATE ON public.tenant_secure_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();