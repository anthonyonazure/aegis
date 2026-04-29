-- Phase 2 #6: Plugin SDK for community-contributed AI workflows.
--
-- A plugin is a saved AI workflow definition: prompt template with
-- {{variable}} placeholders, an input schema describing the variables,
-- and a flag for whether the workflow needs tenant context (which the
-- runner pre-fetches and inlines into the prompt).
--
-- One table covers private + marketplace usage via is_public — keeps the
-- data model tighter than the policy-templates pattern. Cloning a public
-- plugin into your own library is via an SECURITY DEFINER RPC.

CREATE TABLE IF NOT EXISTS public.plugins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                          -- 'analysis' | 'remediation' | 'reporting' | 'compliance' | 'other'
  -- Prompt template with {{variableName}} placeholders.
  -- Variables are resolved from input_schema entries at run time.
  prompt_template TEXT NOT NULL,
  -- Input schema: array of {name, label, type ('text'|'textarea'|'number'|'tenantId'), required, default, helpText}
  input_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- When true, run-plugin fetches a small tenant context (CA policies,
  -- license SKUs, user count) and exposes it as {{tenantContext}}.
  requires_tenant BOOLEAN NOT NULL DEFAULT false,
  -- AI gateway tuning
  default_model TEXT,                     -- e.g. 'gpt-4o-mini'; falls back to gateway default
  default_temperature NUMERIC(3,2) DEFAULT 0.30,
  -- Marketplace fields
  is_public BOOLEAN NOT NULL DEFAULT false,
  source_plugin_id UUID REFERENCES public.plugins(id) ON DELETE SET NULL,  -- pointer back to original on clone
  install_count INTEGER NOT NULL DEFAULT 0,
  -- Versioning is per-plugin; bumped on update for optimistic-concurrency UX
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plugins_user_idx ON public.plugins (user_id);
CREATE INDEX IF NOT EXISTS plugins_public_idx ON public.plugins (is_public, install_count DESC);
CREATE INDEX IF NOT EXISTS plugins_category_idx ON public.plugins (category);

ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can browse public plugins"
  ON public.plugins FOR SELECT
  USING (auth.role() = 'authenticated' AND is_public = true);

CREATE POLICY "Users can read their own plugins"
  ON public.plugins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own plugins"
  ON public.plugins FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own plugins"
  ON public.plugins FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own plugins"
  ON public.plugins FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_plugins_updated_at
  BEFORE UPDATE ON public.plugins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Plugin run history
CREATE TABLE IF NOT EXISTS public.plugin_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  error TEXT,
  model TEXT,
  duration_ms INTEGER,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plugin_runs_user_idx ON public.plugin_runs (user_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS plugin_runs_plugin_idx ON public.plugin_runs (plugin_id, ran_at DESC);

ALTER TABLE public.plugin_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own plugin runs"
  ON public.plugin_runs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Atomic install: clone a public plugin into the caller's library and bump install_count.
CREATE OR REPLACE FUNCTION public.install_plugin(p_plugin_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.plugins (
    user_id, name, description, category, prompt_template, input_schema,
    requires_tenant, default_model, default_temperature, is_public,
    source_plugin_id
  )
  SELECT
    v_user_id,
    p.name,
    COALESCE(p.description, '') || E'\n\n[Installed from marketplace]',
    p.category,
    p.prompt_template,
    p.input_schema,
    p.requires_tenant,
    p.default_model,
    p.default_temperature,
    false,    -- installed plugins start private
    p.id      -- pointer back to the public original
  FROM public.plugins p
  WHERE p.id = p_plugin_id AND p.is_public = true
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Plugin not found or not public';
  END IF;

  UPDATE public.plugins SET install_count = install_count + 1 WHERE id = p_plugin_id;
  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.install_plugin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.install_plugin(UUID) TO authenticated;
