-- Compliance: ISO/IEC 27001:2022 Annex A subset (issue #2)

INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'iso-27001',
  'ISO/IEC 27001 Annex A (subset)',
  '2022',
  'Subset of ISO/IEC 27001:2022 Annex A controls verifiable from Microsoft 365 tenant configuration. Maps to existing evaluators where the underlying check overlaps with HIPAA / SOC 2 / CMMC.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('5.15',
   'access-control',
   'Access control',
   'Establish and maintain rules to control physical and logical access to information and other associated assets. Verified by MFA enforcement on admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://www.iso.org/standard/27001'),
  ('5.16',
   'access-control',
   'Identity management',
   'The full life cycle of identities should be managed. Verified by ensuring shared mailbox patterns are not used as sign-in identities.',
   'high',
   'no-shared-account-signin',
   'https://www.iso.org/standard/27001'),
  ('5.17',
   'access-control',
   'Authentication information',
   'Allocation and management of authentication information should be controlled. Verified by enabling phishing-resistant authentication methods.',
   'high',
   'strong-auth-methods-enabled',
   'https://www.iso.org/standard/27001'),
  ('5.18',
   'access-control',
   'Access rights',
   'Access rights to information and associated assets should be provisioned, reviewed, modified, and removed in accordance with the topic-specific policy. Verified by no stale active users.',
   'high',
   'no-stale-active-users',
   'https://www.iso.org/standard/27001'),
  ('5.19',
   'governance',
   'Information security in supplier relationships',
   'Processes and procedures should be defined and implemented to manage information security risks associated with the use of supplier products or services. Verified by restricted guest invite policy.',
   'medium',
   'guest-restrictions',
   'https://www.iso.org/standard/27001'),
  ('8.5',
   'access-control',
   'Secure authentication',
   'Secure authentication technologies and procedures should be implemented based on access restrictions and the topic-specific policy. Verified by blocking legacy authentication.',
   'critical',
   'legacy-auth-blocked',
   'https://www.iso.org/standard/27001'),
  ('8.15',
   'audit',
   'Logging',
   'Logs that record activities, exceptions, faults and other relevant events should be produced, stored, protected and analysed. Verified by accessible audit log endpoint.',
   'high',
   'audit-logs-enabled',
   'https://www.iso.org/standard/27001'),
  ('8.16',
   'detection',
   'Monitoring activities',
   'Networks, systems and applications should be monitored for anomalous behaviour. Verified by Conditional Access policy responding to sign-in risk.',
   'high',
   'risky-signin-protection',
   'https://www.iso.org/standard/27001')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'iso-27001'
ON CONFLICT (framework_id, control_code) DO NOTHING;
