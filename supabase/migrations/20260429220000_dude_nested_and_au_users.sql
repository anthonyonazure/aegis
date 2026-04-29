-- DUDE: nested device groups + AU user sync (issue #6 PR4).
--
-- Nested device groups: per Daniel Petri's design, a target device group
-- can have other device groups (e.g. an Autopilot enrollment group) added
-- as members, so newly-enrolled devices land in the policy-bearing group
-- immediately at enrollment time without waiting for the next sync cycle.
-- Aegis now stores those nested device-group ids alongside the mapping.
--
-- AU user sync: when a mapping has admin_unit_id set, the sync engine
-- previously placed only DEVICES into the AU. To support proper
-- delegation (e.g. "HR admins manage HR users + HR devices") it needs to
-- also add the resolved users from the user-group transitive membership.
-- New flag controls whether to do that, default false to preserve existing
-- behavior on upgrade.

ALTER TABLE public.dude_mappings
  ADD COLUMN IF NOT EXISTS nested_device_group_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sync_users_to_admin_unit BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dude_mappings.nested_device_group_ids IS
  'Additional device-group object ids whose devices auto-flow into device_group_id (e.g. an Autopilot enrollment group nested into the policy-target group). Operates by adding the nested group itself as a member of device_group_id at sync time, so transitive expansion is handled by Entra.';

COMMENT ON COLUMN public.dude_mappings.sync_users_to_admin_unit IS
  'When true and admin_unit_id is set, the sync also adds resolved users from the user-group transitive membership into the Administrative Unit. Required for full RBAC delegation (HR admin role scoped to HR AU sees HR users AND HR devices).';
