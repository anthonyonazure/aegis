-- AI Provider Settings (BYOK)
CREATE TABLE public.ai_provider_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'lovable', 'openai', 'google', 'anthropic', 'azure', 'perplexity', 'custom'
  display_name TEXT NOT NULL,
  api_endpoint TEXT, -- Custom endpoint URL
  model_id TEXT, -- Default model for this provider
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- AI Conversations (for chat features)
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  feature_type TEXT NOT NULL, -- 'tenant-analyzer', 'compliance-advisor', 'drift-explainer', 'general-chat'
  provider TEXT NOT NULL DEFAULT 'lovable',
  model_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Messages
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Analysis Results (cached analyses)
CREATE TABLE public.ai_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL, -- 'tenant-health', 'compliance', 'risk-score', 'cost-forecast'
  result JSONB NOT NULL,
  score NUMERIC(5,2),
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Risk Assessments
CREATE TABLE public.risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  category_scores JSONB NOT NULL DEFAULT '{}',
  risk_factors JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adoption Benchmarks
CREATE TABLE public.adoption_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  benchmark_type TEXT NOT NULL, -- 'copilot', 'security', 'compliance'
  metrics JSONB NOT NULL DEFAULT '{}',
  percentile NUMERIC(5,2),
  comparison_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_benchmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_provider_settings
CREATE POLICY "Users can view own AI settings" ON public.ai_provider_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own AI settings" ON public.ai_provider_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI settings" ON public.ai_provider_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI settings" ON public.ai_provider_settings FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_conversations
CREATE POLICY "Users can view own conversations" ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_messages
CREATE POLICY "Users can view own messages" ON public.ai_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can create own messages" ON public.ai_messages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- RLS Policies for ai_analysis_results
CREATE POLICY "Users can view own analyses" ON public.ai_analysis_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own analyses" ON public.ai_analysis_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON public.ai_analysis_results FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for risk_assessments
CREATE POLICY "Users can view own risk assessments" ON public.risk_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own risk assessments" ON public.risk_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for adoption_benchmarks
CREATE POLICY "Users can view own benchmarks" ON public.adoption_benchmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own benchmarks" ON public.adoption_benchmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX idx_ai_analysis_tenant ON public.ai_analysis_results(tenant_connection_id);
CREATE INDEX idx_risk_assessments_tenant ON public.risk_assessments(tenant_connection_id);

-- Function to store AI API keys securely
CREATE OR REPLACE FUNCTION public.store_ai_api_key(
  p_provider TEXT,
  p_api_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_secret_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Store in vault
  INSERT INTO vault.secrets (name, secret)
  VALUES ('ai_key_' || p_provider || '_' || v_user_id, p_api_key)
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret
  RETURNING id INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$$;

-- Function to get AI API key
CREATE OR REPLACE FUNCTION public.get_ai_api_key(p_provider TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_api_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE name = 'ai_key_' || p_provider || '_' || v_user_id;
  
  RETURN v_api_key;
END;
$$;