-- Phase 2 #2: Extend PSA providers (add ServiceNow + Jira) and route anomaly events
-- to webhooks and auto-tickets.

-- 1. Allow new PSA providers
ALTER TABLE public.psa_integrations
  DROP CONSTRAINT IF EXISTS psa_integrations_provider_check;

ALTER TABLE public.psa_integrations
  ADD CONSTRAINT psa_integrations_provider_check
  CHECK (provider IN ('halopsa', 'autotask', 'connectwise', 'servicenow', 'jira'));

-- 2. Provider-specific config (Jira needs a project key; ServiceNow uses api_url for the instance host)
ALTER TABLE public.psa_integrations
  ADD COLUMN IF NOT EXISTS external_project_key TEXT,         -- e.g. Jira project key "OPS"
  ADD COLUMN IF NOT EXISTS ticket_on_anomaly   BOOLEAN NOT NULL DEFAULT true;

-- 3. Allow tickets sourced from anomaly detection
ALTER TABLE public.psa_tickets
  DROP CONSTRAINT IF EXISTS psa_tickets_source_type_check;

ALTER TABLE public.psa_tickets
  ADD CONSTRAINT psa_tickets_source_type_check
  CHECK (source_type IN ('drift', 'compliance', 'manual', 'scheduled_drift', 'anomaly'));
