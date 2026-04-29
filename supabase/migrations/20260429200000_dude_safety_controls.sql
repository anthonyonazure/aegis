-- DUDE Sync safety controls (issue #6 PR1).
--
-- Adds dry-run-by-default, a per-mapping enabled toggle (column exists,
-- exposed via UI), and a per-MSP allowlist of group-name prefixes the
-- sync engine is allowed to write to. Together these three guards
-- approximate the "fail closed" posture of Daniel Petri's DUDE-Manager.

-- 1. Dry-run by default. New mappings preview but don't write until the
--    operator explicitly flips this off after reviewing the preview.
ALTER TABLE public.dude_mappings
  ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT true;

-- 2. Per-MSP prefix allowlist. NULL / empty array = no restriction
--    (backwards compatible with existing deployments). When populated,
--    sync writes are refused unless BOTH the user_group_name AND
--    device_group_name start with one of the allowed prefixes.
CREATE TABLE IF NOT EXISTS public.dude_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_group_prefixes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dude_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own DUDE settings"
  ON public.dude_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_dude_settings_updated_at
  BEFORE UPDATE ON public.dude_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.dude_mappings.dry_run IS
  'When true, sync produces a preview but does not write to the device group. New mappings ship dry_run=true.';

COMMENT ON TABLE public.dude_settings IS
  'Per-MSP DUDE safety configuration. Empty allowed_group_prefixes = no restriction (legacy deployments). Otherwise both user and device group names must start with an allowed prefix.';
