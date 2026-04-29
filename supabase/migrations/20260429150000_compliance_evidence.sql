-- Phase 2 #4a: Compliance evidence collection.
--
-- Schema for: catalog of frameworks + controls (mostly metadata for UI),
-- a record of each evidence run, and per-control pass/fail items captured
-- against a tenant. The actual evaluators live in the edge function code
-- (collect-compliance-evidence) keyed by control_code so we can extend
-- frameworks without redeploying schema.

-- 1. Frameworks
CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,            -- 'hipaa-security', 'soc2-tsc', 'cmmc-l2'
  name TEXT NOT NULL,
  version TEXT,                         -- e.g. "2003" for HIPAA, "2017 TSC" for SOC2
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frameworks are static reference data — readable by any authenticated user
-- so both MSP and portal users see the catalog.
ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read frameworks"
  ON public.compliance_frameworks FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Controls (per framework)
CREATE TABLE IF NOT EXISTS public.compliance_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  control_code TEXT NOT NULL,           -- 'HIPAA-164.312(d)' — unique per framework
  category TEXT,                        -- e.g. 'access-control', 'audit', 'integrity'
  name TEXT NOT NULL,
  description TEXT,
  -- Severity for UI sorting; an audit doesn't strictly grade by severity but
  -- failed criticals should jump out in a list of 50.
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  -- Evaluator key — the edge function looks up handler by this string.
  -- Same value can map across frameworks (e.g. an MFA evaluator covers HIPAA + SOC2).
  evaluator_key TEXT,
  -- Optional human-readable mapping doc / external reference.
  reference_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, control_code)
);

CREATE INDEX IF NOT EXISTS compliance_controls_framework_idx
  ON public.compliance_controls (framework_id);

ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read controls"
  ON public.compliance_controls FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Evidence runs
CREATE TABLE IF NOT EXISTS public.compliance_evidence_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  total_controls INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  na_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_runs_user_idx
  ON public.compliance_evidence_runs (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS compliance_runs_tenant_idx
  ON public.compliance_evidence_runs (tenant_connection_id, completed_at DESC);

ALTER TABLE public.compliance_evidence_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MSP users can manage their own evidence runs"
  ON public.compliance_evidence_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Portal users can read evidence runs for their tenants"
  ON public.compliance_evidence_runs FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND tenant_connection_id IN (
      SELECT id FROM public.tenant_connections
      WHERE customer_id = public.current_portal_customer_id()
    )
  );

-- 4. Per-control evidence items
CREATE TABLE IF NOT EXISTS public.compliance_evidence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.compliance_evidence_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES public.compliance_controls(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'na', 'error')),
  -- Compact human-readable summary so list views don't have to parse the snapshot
  notes TEXT,
  -- The raw evidence at evaluation time — what auditors actually want
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_items_run_idx
  ON public.compliance_evidence_items (run_id);
CREATE INDEX IF NOT EXISTS compliance_items_status_idx
  ON public.compliance_evidence_items (run_id, status);

ALTER TABLE public.compliance_evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MSP users can manage their own evidence items"
  ON public.compliance_evidence_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Portal users can read evidence items for their runs"
  ON public.compliance_evidence_items FOR SELECT
  USING (
    public.current_portal_customer_id() IS NOT NULL
    AND run_id IN (
      SELECT r.id
      FROM public.compliance_evidence_runs r
      JOIN public.tenant_connections tc ON tc.id = r.tenant_connection_id
      WHERE tc.customer_id = public.current_portal_customer_id()
    )
  );

-- 5. Seed: HIPAA Security Rule (subset)
-- Five representative controls each backed by a Graph-checkable evaluator.
INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'hipaa-security',
  'HIPAA Security Rule',
  '45 CFR 164',
  'Subset of the HIPAA Security Rule technical safeguards relevant to Microsoft 365 tenant configuration.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('164.312(d)',
   'access-control',
   'Person or entity authentication',
   'Implement procedures to verify that the person or entity seeking access to ePHI is the one claimed. Verified via MFA enforcement on at least one admin role.',
   'critical',
   'mfa-required-for-admins',
   'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html'),
  ('164.312(b)',
   'audit',
   'Audit controls',
   'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI. Verified via accessible audit log endpoint.',
   'high',
   'audit-logs-enabled',
   'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html'),
  ('164.312(a)(2)(i)',
   'access-control',
   'Unique user identification',
   'Assign a unique name and/or number for identifying and tracking user identity. Verified by ensuring no shared-mailbox patterns are signed in as standard accounts.',
   'high',
   'no-shared-account-signin',
   'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html'),
  ('164.308(a)(5)(ii)(D)',
   'access-control',
   'Password management',
   'Procedures for creating, changing, and safeguarding passwords. Verified via authentication methods policy (preferably passwordless or strong factor enabled).',
   'high',
   'strong-auth-methods-enabled',
   'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html'),
  ('164.308(a)(3)(ii)(C)',
   'access-control',
   'Termination procedures',
   'Procedures for terminating access of workforce members. Verified by counting users active for >90 days with no recent sign-in (high count = stale).',
   'medium',
   'no-stale-active-users',
   'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'hipaa-security'
ON CONFLICT (framework_id, control_code) DO NOTHING;

COMMENT ON TABLE public.compliance_evidence_runs IS
  'Phase 2 #4a: Each run records collect-compliance-evidence output for one (tenant, framework) at a point in time.';
