-- Aegis post-deploy SQL — paste into Supabase Dashboard → SQL editor and run.
-- Idempotent: every statement is safe to re-run.

-- ============================================================================
-- 1. HANDOFF item 2 — rename existing rows from lovable -> gateway
--    (no-op if you never had data created against the lovable provider)
-- ============================================================================
ALTER TABLE public.ai_conversations ALTER COLUMN provider DROP DEFAULT;
UPDATE public.ai_provider_settings SET provider = 'gateway' WHERE provider = 'lovable';
UPDATE public.ai_conversations    SET provider = 'gateway' WHERE provider = 'lovable';
ALTER TABLE public.ai_conversations ALTER COLUMN provider SET DEFAULT 'gateway';

-- ============================================================================
-- 2. HANDOFF item 28 — register the scheduled compliance runner
--
--    Hits run-scheduled-compliance every 15 minutes. The function is a no-op
--    when no schedule is due, so this is cheap.
--
--    Replace the placeholders before running:
--      <SUPABASE_URL>       — e.g. https://rcvtxvpyqmfuunnpsqny.supabase.co
--      <SERVICE_ROLE_KEY>   — service_role key from Project Settings → API
-- ============================================================================
-- Required extensions (Supabase has them, but enable just in case)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Drop any prior version of this job, then schedule fresh.
DO $$
BEGIN
  PERFORM cron.unschedule('aegis-compliance-runner') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'aegis-compliance-runner'
  );
EXCEPTION WHEN OTHERS THEN
  -- ignore if pg_cron isn't installed yet or no prior job
  NULL;
END $$;

-- NOTE: edit the URL + service-role key below before running.
SELECT cron.schedule(
  'aegis-compliance-runner',
  '*/15 * * * *',
  $cron$ SELECT net.http_post(
    url := 'https://rcvtxvpyqmfuunnpsqny.supabase.co/functions/v1/run-scheduled-compliance',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  ) $cron$
);

-- ============================================================================
-- Optional sanity checks (run after the above)
-- ============================================================================
-- Confirm the cron job exists:
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'aegis-compliance-runner';

-- Confirm framework + control seeds landed:
-- SELECT f.code, f.name, count(c.id) AS controls
-- FROM public.compliance_frameworks f
-- LEFT JOIN public.compliance_controls c ON c.framework_id = f.id
-- GROUP BY f.code, f.name ORDER BY f.code;
