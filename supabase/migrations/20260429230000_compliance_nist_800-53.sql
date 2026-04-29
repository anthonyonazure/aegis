-- Compliance: NIST SP 800-53 r5 (issue #1)
--
-- Federal-baseline controls verifiable from M365 tenant configuration. We
-- map to the existing evaluators where the underlying check is the same;
-- controls that need procedural / administrative evidence ship with
-- evaluator_key NULL (surfaces as N/A in the UI — auditor expects manual
-- evidence collected outside the platform).

INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'nist-800-53',
  'NIST SP 800-53 (Moderate Baseline subset)',
  'Rev. 5',
  'Subset of NIST SP 800-53 Rev. 5 controls verifiable from Microsoft 365 tenant configuration. Aligned to the FedRAMP Moderate baseline most MSPs encounter when working with US federal-adjacent customers.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('AC-2',
   'access-control',
   'Account management',
   'Manage information system accounts including establishment, activation, modification, review, disabling, and removal. Verified by ensuring no enabled accounts have been inactive >90 days.',
   'high',
   'no-stale-active-users',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=AC-2'),
  ('AC-3',
   'access-control',
   'Access enforcement',
   'Enforce approved authorizations for logical access. Verified by ensuring shared mailboxes are not used as sign-in identities.',
   'high',
   'no-shared-account-signin',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=AC-3'),
  ('AC-7',
   'access-control',
   'Unsuccessful logon attempts',
   'Enforce a limit on consecutive invalid logon attempts. Microsoft 365 enforces smart lockout by default; verify configuration aligns with organizational policy. (Manual review — no automated evaluator yet.)',
   'medium',
   NULL,
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=AC-7'),
  ('AU-2',
   'audit',
   'Event logging',
   'Identify the types of events the system is capable of logging. Verified by audit log endpoint accessibility.',
   'high',
   'audit-logs-enabled',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=AU-2'),
  ('AU-12',
   'audit',
   'Audit record generation',
   'Provide audit record generation capability. Verified by audit log endpoint returning records.',
   'high',
   'audit-logs-enabled',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=AU-12'),
  ('IA-2',
   'access-control',
   'Identification and authentication (organizational users)',
   'Uniquely identify and authenticate organizational users. Verified by MFA enforcement on privileged roles.',
   'critical',
   'mfa-required-for-admins',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=IA-2'),
  ('IA-2(1)',
   'access-control',
   'MFA to privileged accounts',
   'Implement multifactor authentication for access to privileged accounts. Verified via Conditional Access policy targeting admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=IA-2'),
  ('IA-5',
   'access-control',
   'Authenticator management',
   'Manage information system authenticators. Verified by enabling phishing-resistant authentication methods (FIDO2 / Microsoft Authenticator / Windows Hello).',
   'high',
   'strong-auth-methods-enabled',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=IA-5'),
  ('SC-7',
   'access-control',
   'Boundary protection',
   'Monitor and control communications at the external boundary of the system and at key internal boundaries. Verified by blocking legacy authentication protocols.',
   'critical',
   'legacy-auth-blocked',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=SC-7'),
  ('SI-4',
   'detection',
   'System monitoring',
   'Monitor the information system to detect attacks and indicators of potential attacks. Verified by Conditional Access policy targeting sign-in risk.',
   'high',
   'risky-signin-protection',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=SI-4'),
  ('PS-4',
   'governance',
   'Personnel termination',
   'When individual employment is terminated, disable system access and retrieve security-related credentials. Verified by no enabled accounts inactive >90 days.',
   'high',
   'no-stale-active-users',
   'https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#/control?version=5.1&number=PS-4')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'nist-800-53'
ON CONFLICT (framework_id, control_code) DO NOTHING;
