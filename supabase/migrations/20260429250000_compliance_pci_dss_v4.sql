-- Compliance: PCI DSS v4.0 (subset) (issue #3)
--
-- Includes only the requirements that are tenant-config-checkable from
-- Microsoft 365 Graph. The other PCI requirements (network segmentation,
-- physical security, key management hardware, cardholder data tokenization)
-- are out of scope for an M365 governance tool.

INSERT INTO public.compliance_frameworks (code, name, version, description)
VALUES (
  'pci-dss-v4',
  'PCI DSS v4.0 (M365-relevant subset)',
  '4.0',
  'Subset of PCI DSS v4.0 requirements verifiable from Microsoft 365 tenant configuration. Network / physical / key-management requirements live outside the platform; collect that evidence separately.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.compliance_controls (framework_id, control_code, category, name, description, severity, evaluator_key, reference_url)
SELECT id, t.control_code, t.category, t.name, t.description, t.severity, t.evaluator_key, t.reference_url
FROM public.compliance_frameworks f,
LATERAL (VALUES
  ('7.2.1',
   'access-control',
   'Access to system components and data is appropriately defined and assigned',
   'An access control model is defined and includes granting access as follows: appropriate access depending on the entity''s business and access needs. Verified by no stale active users.',
   'high',
   'no-stale-active-users',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('7.3.1',
   'access-control',
   'Access to system components and data is managed via an access control system',
   'All user access to system components and data is managed via an access control system(s). Verified by ensuring shared accounts are not used as sign-in identities.',
   'high',
   'no-shared-account-signin',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('8.3.1',
   'access-control',
   'Strong authentication for users and administrators',
   'All user access to system components for users and administrators is authenticated via at least one of the authentication factors (something you know, have, or are). Verified by MFA enforcement on admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('8.4.1',
   'access-control',
   'MFA for non-console administrative access',
   'MFA is implemented for all non-console access into the CDE for personnel with administrative access. Verified via Conditional Access targeting admin roles.',
   'critical',
   'mfa-required-for-admins',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('8.4.2',
   'access-control',
   'MFA for all access into CDE',
   'MFA is implemented for all access into the CDE. (PCI v4.0 expanded MFA scope from administrators to all users.) Currently mapped to the same admin-MFA evaluator — full-tenant MFA evaluator is on the roadmap.',
   'critical',
   'mfa-required-for-admins',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('8.6.1',
   'access-control',
   'Use of authentication factors strictly controlled',
   'If accounts used by systems or applications can be used for interactive login, they are managed. Verified by blocking legacy authentication protocols.',
   'high',
   'legacy-auth-blocked',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('10.2.1',
   'audit',
   'Audit logs are enabled and active',
   'Audit logs are enabled and active for all system components and cardholder data. Verified by accessible audit log endpoint.',
   'critical',
   'audit-logs-enabled',
   'https://www.pcisecuritystandards.org/document_library/'),
  ('10.4.1',
   'audit',
   'Time synchronization',
   'System clocks and time are synchronized using time synchronization technology. Microsoft 365 manages time synchronization via Azure infrastructure — collect attestation from Microsoft trust documentation. (Manual review.)',
   'medium',
   NULL,
   'https://www.pcisecuritystandards.org/document_library/')
) AS t(control_code, category, name, description, severity, evaluator_key, reference_url)
WHERE f.code = 'pci-dss-v4'
ON CONFLICT (framework_id, control_code) DO NOTHING;
