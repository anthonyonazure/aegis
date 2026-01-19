-- Copilot readiness assessments
CREATE TABLE public.copilot_readiness_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_score INTEGER DEFAULT 0,
  licensing_ready BOOLEAN DEFAULT false,
  licensing_details JSONB DEFAULT '{}'::jsonb,
  permissions_ready BOOLEAN DEFAULT false,
  permissions_details JSONB DEFAULT '{}'::jsonb,
  semantic_index_ready BOOLEAN DEFAULT false,
  semantic_index_details JSONB DEFAULT '{}'::jsonb,
  data_governance_ready BOOLEAN DEFAULT false,
  data_governance_details JSONB DEFAULT '{}'::jsonb,
  network_ready BOOLEAN DEFAULT false,
  network_details JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Copilot usage metrics (historical tracking)
CREATE TABLE public.copilot_usage_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  total_queries INTEGER DEFAULT 0,
  avg_queries_per_user NUMERIC(10,2) DEFAULT 0,
  top_features JSONB DEFAULT '[]'::jsonb,
  adoption_rate NUMERIC(5,2) DEFAULT 0,
  usage_by_app JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Prompt library (organization-approved prompts)
CREATE TABLE public.prompt_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  target_apps TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI governance policies
CREATE TABLE public.ai_governance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  target_type TEXT NOT NULL DEFAULT 'all_tenants',
  target_tenant_ids UUID[] DEFAULT '{}',
  target_group_id UUID REFERENCES public.tenant_groups(id) ON DELETE SET NULL,
  enforcement_level TEXT DEFAULT 'audit',
  last_enforced_at TIMESTAMP WITH TIME ZONE,
  violations_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Copilot feedback tracking
CREATE TABLE public.copilot_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_responses INTEGER DEFAULT 0,
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  satisfaction_score NUMERIC(5,2) DEFAULT 0,
  common_issues JSONB DEFAULT '[]'::jsonb,
  feedback_by_app JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Copilot Studio bots/agents
CREATE TABLE public.copilot_studio_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  bot_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  environment_id TEXT,
  environment_name TEXT,
  status TEXT DEFAULT 'active',
  last_modified TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  topics_count INTEGER DEFAULT 0,
  triggers_count INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_connection_id, bot_id)
);

-- AI Builder models
CREATE TABLE public.ai_builder_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  model_type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  environment_id TEXT,
  environment_name TEXT,
  created_by TEXT,
  last_trained TIMESTAMP WITH TIME ZONE,
  accuracy_score NUMERIC(5,2),
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_connection_id, model_id)
);

-- Copilot plugins/connectors catalog
CREATE TABLE public.copilot_plugins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  plugin_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  publisher TEXT,
  plugin_type TEXT NOT NULL,
  status TEXT DEFAULT 'enabled',
  is_approved BOOLEAN DEFAULT false,
  approval_date TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_connection_id, plugin_id)
);

-- Enable RLS on all tables
ALTER TABLE public.copilot_readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_studio_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_builder_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_plugins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for copilot_readiness_assessments
CREATE POLICY "Users can view own readiness assessments" ON public.copilot_readiness_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own readiness assessments" ON public.copilot_readiness_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own readiness assessments" ON public.copilot_readiness_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own readiness assessments" ON public.copilot_readiness_assessments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for copilot_usage_metrics
CREATE POLICY "Users can view own usage metrics" ON public.copilot_usage_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own usage metrics" ON public.copilot_usage_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own usage metrics" ON public.copilot_usage_metrics
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for prompt_library
CREATE POLICY "Users can view own or public prompts" ON public.prompt_library
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can create own prompts" ON public.prompt_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prompts" ON public.prompt_library
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own prompts" ON public.prompt_library
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_governance_policies
CREATE POLICY "Users can view own governance policies" ON public.ai_governance_policies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own governance policies" ON public.ai_governance_policies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own governance policies" ON public.ai_governance_policies
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own governance policies" ON public.ai_governance_policies
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for copilot_feedback
CREATE POLICY "Users can view own feedback" ON public.copilot_feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own feedback" ON public.copilot_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback" ON public.copilot_feedback
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for copilot_studio_bots
CREATE POLICY "Users can view own studio bots" ON public.copilot_studio_bots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own studio bots" ON public.copilot_studio_bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own studio bots" ON public.copilot_studio_bots
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own studio bots" ON public.copilot_studio_bots
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_builder_models
CREATE POLICY "Users can view own AI models" ON public.ai_builder_models
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own AI models" ON public.ai_builder_models
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI models" ON public.ai_builder_models
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI models" ON public.ai_builder_models
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for copilot_plugins
CREATE POLICY "Users can view own plugins" ON public.copilot_plugins
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plugins" ON public.copilot_plugins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plugins" ON public.copilot_plugins
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plugins" ON public.copilot_plugins
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_copilot_readiness_assessments_updated_at
  BEFORE UPDATE ON public.copilot_readiness_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prompt_library_updated_at
  BEFORE UPDATE ON public.prompt_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_governance_policies_updated_at
  BEFORE UPDATE ON public.ai_governance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_copilot_studio_bots_updated_at
  BEFORE UPDATE ON public.copilot_studio_bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_builder_models_updated_at
  BEFORE UPDATE ON public.ai_builder_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_copilot_plugins_updated_at
  BEFORE UPDATE ON public.copilot_plugins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_copilot_readiness_tenant ON public.copilot_readiness_assessments(tenant_connection_id);
CREATE INDEX idx_copilot_readiness_customer ON public.copilot_readiness_assessments(customer_id);
CREATE INDEX idx_copilot_usage_tenant ON public.copilot_usage_metrics(tenant_connection_id);
CREATE INDEX idx_copilot_usage_period ON public.copilot_usage_metrics(period_start, period_end);
CREATE INDEX idx_prompt_library_category ON public.prompt_library(category);
CREATE INDEX idx_prompt_library_customer ON public.prompt_library(customer_id);
CREATE INDEX idx_ai_governance_customer ON public.ai_governance_policies(customer_id);
CREATE INDEX idx_ai_governance_type ON public.ai_governance_policies(policy_type);
CREATE INDEX idx_copilot_feedback_tenant ON public.copilot_feedback(tenant_connection_id);
CREATE INDEX idx_copilot_studio_tenant ON public.copilot_studio_bots(tenant_connection_id);
CREATE INDEX idx_ai_builder_tenant ON public.ai_builder_models(tenant_connection_id);
CREATE INDEX idx_copilot_plugins_tenant ON public.copilot_plugins(tenant_connection_id);