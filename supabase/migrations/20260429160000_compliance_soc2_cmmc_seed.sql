-- Phase 2 #4b: SOC 2 + CMMC L2 framework seeds.
--
-- Reuses the HIPAA-shipped evaluators where the underlying tenant config is
-- the same control. New evaluator keys (legacy-auth-blocked,
-- guest-restrictions, risky-signin-protection) are referenced here and
-- implemented in supabase/functions/collect-compliance-evidence/index.ts.

-- 1. SOC 2 — AICPA Trust Services Criteria
INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'soc2-tsc',
  'SOC 2 — Trust Services Criteria',
  '2017 (rev. 2022)',
  'Subset of the AICPA Trust Services Criteria most directly satisfied by Microsoft 365 tenant configuration. Common Criteria CC6.* (Logical Access) and CC7.* (System Operations).'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('CC6.1',
   'access-control',
   'Logical and physical access controls',
   'The entity implements logical access security software, infrastructure, and architectures over protected information assets. Verified by ensuring no shared-mailbox patterns are signed in as standard accounts.',
   'high',
   'no-shared-account-signin',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('CC6.6',
   'access-control',
   'Restrict logical access from outside the boundary',
   'The entity restricts access from outside its boundaries by blocking legacy authentication protocols that bypass modern controls.',
   'critical',
   'legacy-auth-blocked',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('CC6.7',
   'access-control',
   'Multi-factor authentication',
   'The entity requires multi-factor authentication for privileged access. Verified via Conditional Access policy targeting admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('CC7.1',
   'audit',
   'System monitoring',
   'The entity uses detection and monitoring procedures. Verified by audit log endpoint accessibility + record presence.',
   'high',
   'audit-logs-enabled',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('CC7.2',
   'detection',
   'Anomaly detection',
   'The entity monitors for anomalies and acts on them. Verified by Conditional Access policy targeting sign-in risk.',
   'high',
   'risky-signin-protection',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('CC9.2',
   'governance',
   'Vendor and business partner management',
   'The entity restricts third-party (guest) access. Verified by authorizationPolicy.allowInvitesFrom not being unrestricted.',
   'medium',
   'guest-restrictions',
   'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'soc2-tsc'
ON CONFLICT (framework_id, control_code) DO NOTHING;

-- 2. CMMC Level 2
INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'cmmc-l2',
  'CMMC Level 2',
  'v2.0',
  'Subset of CMMC Level 2 (NIST SP 800-171 r2 aligned) practices verifiable from Microsoft 365 tenant configuration. Focus on AC, IA, AU, and SI families.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('AC.L2-3.1.1',
   'access-control',
   'Limit system access to authorized users',
   'Limit information system access to authorized users, processes acting on behalf of authorized users, or devices. Verified by MFA enforcement on admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('AC.L2-3.1.2',
   'audit',
   'Limit access to authorized transactions',
   'Limit information system access to the types of transactions and functions that authorized users are permitted to execute. Verified by accessible audit log endpoint.',
   'high',
   'audit-logs-enabled',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('AC.L2-3.1.20',
   'access-control',
   'External connections',
   'Verify and control connections to and use of external systems. Verified by restricting guest invitation policy.',
   'medium',
   'guest-restrictions',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('IA.L2-3.5.1',
   'access-control',
   'Identify users',
   'Identify information system users, processes acting on behalf of users, or devices. Verified by ensuring shared inboxes are not used as sign-in identities.',
   'high',
   'no-shared-account-signin',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('IA.L2-3.5.3',
   'access-control',
   'Multi-factor authentication',
   'Use multifactor authentication for local and network access to privileged accounts. Verified by Conditional Access policy targeting admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('IA.L2-3.5.7',
   'access-control',
   'Password complexity',
   'Enforce a minimum password complexity. Verified by enabling phishing-resistant authentication methods (FIDO2 / Microsoft Authenticator / Windows Hello).',
   'high',
   'strong-auth-methods-enabled',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('AU.L2-3.3.1',
   'audit',
   'Create audit records',
   'Create and retain system audit logs and records to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity.',
   'high',
   'audit-logs-enabled',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('SI.L2-3.14.6',
   'detection',
   'Monitor for unauthorized access',
   'Monitor organizational systems, including inbound and outbound communications traffic, to detect attacks and indicators of potential attacks. Verified by Conditional Access policy targeting sign-in risk.',
   'high',
   'risky-signin-protection',
   'https://dodcio.defense.gov/CMMC/Model/'),
  ('CM.L2-3.4.7',
   'configuration',
   'Restrict nonessential programs',
   'Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services. Verified by blocking legacy authentication protocols.',
   'critical',
   'legacy-auth-blocked',
   'https://dodcio.defense.gov/CMMC/Model/')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'cmmc-l2'
ON CONFLICT (framework_id, control_code) DO NOTHING;
