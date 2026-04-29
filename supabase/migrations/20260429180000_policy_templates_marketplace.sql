-- Phase 2 #5: Public marketplace for policy templates.
--
-- Separate table from policy_templates so publishing is opt-in and the
-- author's private templates stay private. Installing creates a fresh
-- policy_templates row owned by the installer (no shared mutable state).

CREATE TABLE IF NOT EXISTS public.marketplace_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publisher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional pointer back to the user's source template for "republish on update" UX
  source_template_id UUID REFERENCES public.policy_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  policy_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  resource_types TEXT[] NOT NULL DEFAULT '{}',
  framework_tags TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {hipaa-security, soc2-tsc}
  -- Public listing flag — publisher can unpublish without deleting
  is_published BOOLEAN NOT NULL DEFAULT true,
  -- Counters maintained by the install function (UPDATE) — read-only from client
  install_count INTEGER NOT NULL DEFAULT 0,
  rating_average NUMERIC(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  -- Versioning is per-publication; bump when republishing
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_templates_published_idx
  ON public.marketplace_templates (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_templates_publisher_idx
  ON public.marketplace_templates (publisher_id);
CREATE INDEX IF NOT EXISTS marketplace_templates_category_idx
  ON public.marketplace_templates (category);

ALTER TABLE public.marketplace_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse published items
CREATE POLICY "Authenticated can browse marketplace"
  ON public.marketplace_templates FOR SELECT
  USING (auth.role() = 'authenticated' AND is_published = true);

-- Publisher sees their own (published or not) and can update/delete
CREATE POLICY "Publishers can read their own (incl. unpublished)"
  ON public.marketplace_templates FOR SELECT
  USING (publisher_id = auth.uid());

CREATE POLICY "Publishers can insert their own"
  ON public.marketplace_templates FOR INSERT
  WITH CHECK (publisher_id = auth.uid());

CREATE POLICY "Publishers can update their own"
  ON public.marketplace_templates FOR UPDATE
  USING (publisher_id = auth.uid())
  WITH CHECK (publisher_id = auth.uid());

CREATE POLICY "Publishers can delete their own"
  ON public.marketplace_templates FOR DELETE
  USING (publisher_id = auth.uid());

CREATE TRIGGER update_marketplace_templates_updated_at
  BEFORE UPDATE ON public.marketplace_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ratings
CREATE TABLE IF NOT EXISTS public.marketplace_template_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.marketplace_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_ratings_template_idx
  ON public.marketplace_template_ratings (template_id);

ALTER TABLE public.marketplace_template_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read ratings"
  ON public.marketplace_template_ratings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own ratings"
  ON public.marketplace_template_ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
  ON public.marketplace_template_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
  ON public.marketplace_template_ratings FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_marketplace_template_ratings_updated_at
  BEFORE UPDATE ON public.marketplace_template_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to keep rating_average + rating_count fresh on the parent row.
-- Recomputed on insert/update/delete of a rating.
CREATE OR REPLACE FUNCTION public.recompute_marketplace_template_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
BEGIN
  v_template_id := COALESCE(NEW.template_id, OLD.template_id);
  UPDATE public.marketplace_templates
  SET
    rating_count = (SELECT count(*) FROM public.marketplace_template_ratings WHERE template_id = v_template_id),
    rating_average = (SELECT avg(rating)::numeric(3,2) FROM public.marketplace_template_ratings WHERE template_id = v_template_id)
  WHERE id = v_template_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_template_ratings_recompute ON public.marketplace_template_ratings;
CREATE TRIGGER marketplace_template_ratings_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_template_ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_marketplace_template_rating();

-- Atomic install: copy a marketplace template into the caller's policy_templates,
-- bump install_count. Wrapping in a function avoids races and lets the client
-- do it in one round trip with a single Supabase rpc.
CREATE OR REPLACE FUNCTION public.install_marketplace_template(p_template_id UUID)
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

  INSERT INTO public.policy_templates (
    user_id, name, description, category, baseline_type, policy_data, resource_types
  )
  SELECT
    v_user_id,
    mt.name,
    COALESCE(mt.description, '') || E'\n\n[Installed from marketplace]',
    mt.category,
    'custom'::baseline_type,
    mt.policy_data,
    mt.resource_types
  FROM public.marketplace_templates mt
  WHERE mt.id = p_template_id AND mt.is_published = true
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Template not found or not published';
  END IF;

  UPDATE public.marketplace_templates
  SET install_count = install_count + 1
  WHERE id = p_template_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.install_marketplace_template(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.install_marketplace_template(UUID) TO authenticated;
