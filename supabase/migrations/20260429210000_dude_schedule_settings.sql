-- DUDE: scheduled execution (issue #6 PR3).
--
-- DUDE-Manager runs as a scheduled Azure Function every 2 hours by default.
-- Add a per-MSP cadence + last_run timestamp to dude_settings so the
-- run-scheduled-dude function knows which mappings are due.

ALTER TABLE public.dude_settings
  ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_cron    TEXT    NOT NULL DEFAULT '0 */2 * * *', -- every 2 hours, on the hour
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ;

COMMENT ON COLUMN public.dude_settings.schedule_enabled IS
  'When true, run-scheduled-dude (called from pg_cron) processes this user''s mappings on the configured cadence. When false, sync only runs on manual trigger.';
