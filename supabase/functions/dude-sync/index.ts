import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 15) return false;
  entry.count++;
  return true;
}

async function graphGet(token: string, url: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = url.startsWith('https://') ? url : `https://graph.microsoft.com/v1.0${url}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Graph API ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (data.value) results.push(...data.value);
    nextUrl = data['@odata.nextLink'] || null;
  }
  return results;
}

async function graphPost(token: string, url: string, body: any): Promise<void> {
  const fullUrl = url.startsWith('https://') ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    // 400 with "already exist" means the member is already in the group
    if (res.status === 400 && errText.includes('already exist')) return;
    throw new Error(`Graph POST ${res.status}: ${errText}`);
  }
  await res.text(); // consume body
}

async function graphDelete(token: string, url: string): Promise<void> {
  const fullUrl = url.startsWith('https://') ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(fullUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Graph DELETE ${res.status}: ${errText}`);
  }
  await res.text(); // consume body
}

// Stored tenant credentials, decrypted on demand.
async function getStoredCredentials(supabase: any, tenantConnectionId: string, userId: string) {
  const { data, error } = await supabase.rpc('get_decrypted_credential', {
    p_tenant_connection_id: tenantConnectionId,
    p_user_id: userId,
  });
  if (error || !data?.[0]) throw new Error('Failed to retrieve credentials');
  return data[0] as { client_id: string; client_secret: string; tenant_id: string };
}

async function getAccessToken(supabase: any, tenantConnectionId: string, userId: string): Promise<string> {
  const cred = await getStoredCredentials(supabase, tenantConnectionId, userId);
  const tokenRes = await fetch(`https://login.microsoftonline.com/${cred.tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cred.client_id,
      client_secret: cred.client_secret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!tokenRes.ok) throw new Error('Failed to get access token');
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// List groups by name prefix
async function listGroups(token: string, prefix: string) {
  const filter = prefix ? `startsWith(displayName,'${prefix.replace(/'/g, "''")}')` : '';
  const url = `/groups?$filter=${encodeURIComponent(filter)}&$select=id,displayName,groupTypes,membershipRule&$top=50`;
  return await graphGet(token, url);
}

// ---------- Defender for Endpoint tagging (issue #6 PR2) ----------
//
// MDE has its own API surface (api.securitycenter.microsoft.com), separate
// from Microsoft Graph. Tagging a device requires:
//   1. A token for the Defender API scope.
//   2. POST /api/machines/{machineId}/tags with { Value, Action: "Add" }.
//
// We resolve the MDE machineId from the Entra device's azureADDeviceId via
// /api/machines/findbyaaddeviceid?id=<aad-device-id>. If the device isn't
// onboarded to MDE the lookup 404s and we skip it cleanly.
//
// Required app permissions on the service principal:
//   - Machine.ReadWrite.All on WindowsDefenderATP API
//
// If the customer hasn't granted these yet, the tag call returns 403 and
// the sync continues — devices land in the device group, just without the
// MDE tag. Operators see this in the sync log details.reason.

async function getDefenderToken(clientId: string, clientSecret: string, tenantId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.securitycenter.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      console.warn(`Defender token acquisition failed (${res.status}). Skipping MDE tagging.`);
      return null;
    }
    const data = await res.json();
    return data.access_token as string;
  } catch (e) {
    console.warn('Defender token acquisition threw:', e);
    return null;
  }
}

async function findMdeMachineByAadDeviceId(defenderToken: string, azureADDeviceId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.securitycenter.microsoft.com/api/machines/findbyaaddeviceid?id=${encodeURIComponent(azureADDeviceId)}`,
      { headers: { Authorization: `Bearer ${defenderToken}`, Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

async function setMdeTag(defenderToken: string, machineId: string, tag: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.securitycenter.microsoft.com/api/machines/${machineId}/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${defenderToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Value: tag, Action: 'Add' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- Nested device groups + AU user sync (issue #6 PR4) ----------
//
// Nested device groups: ensure each id in mapping.nested_device_group_ids is
// a member of mapping.device_group_id. We do this after the per-device sync
// so newly-enrolled devices land via Entra's transitive expansion of the
// nested group.
async function ensureNestedGroups(
  token: string,
  parentGroupId: string,
  nestedGroupIds: string[]
): Promise<{ added: number; alreadyMember: number; failed: number }> {
  let added = 0;
  let alreadyMember = 0;
  let failed = 0;
  for (const childId of nestedGroupIds) {
    if (!childId || childId === parentGroupId) continue;
    try {
      // graphPost already swallows "already exist" 400s as a no-op (line 52).
      // We can't distinguish added-vs-already-member from the response alone,
      // so use a quick membership check first.
      const isMember = await checkIsMember(token, parentGroupId, childId);
      if (isMember) {
        alreadyMember++;
        continue;
      }
      await graphPost(token, `/groups/${parentGroupId}/members/$ref`, {
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${childId}`,
      });
      added++;
    } catch (e) {
      console.warn(`Nested group attach failed (parent=${parentGroupId}, child=${childId}):`, e);
      failed++;
    }
  }
  return { added, alreadyMember, failed };
}

async function checkIsMember(token: string, parentId: string, candidateId: string): Promise<boolean> {
  try {
    // /groups/{id}/members/{candidateId}/$ref returns 404 if not a member
    const res = await fetch(`https://graph.microsoft.com/v1.0/groups/${parentId}/members/${candidateId}/$ref`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// AU user sync: when admin_unit_id is set and sync_users_to_admin_unit is
// true, add every resolved user from the user-group transitive membership
// into the Administrative Unit. AU member adds use POST
// /administrativeUnits/{id}/members/$ref which 400s on duplicates — graphPost
// already handles that.
async function addUsersToAdminUnit(
  token: string,
  adminUnitId: string,
  userGroupId: string
): Promise<{ added: number; alreadyMember: number; failed: number }> {
  let added = 0;
  let alreadyMember = 0;
  let failed = 0;
  const users = await graphGet(
    token,
    `/groups/${userGroupId}/transitiveMembers?$select=id&$filter=@odata.type eq '#microsoft.graph.user'&$top=999`
  );
  for (const u of users) {
    try {
      // Probe for existing membership to keep the counters honest.
      const probe = await fetch(
        `https://graph.microsoft.com/beta/administrativeUnits/${adminUnitId}/members/${u.id}/$ref`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (probe.ok) {
        alreadyMember++;
        continue;
      }
      const res = await fetch(`https://graph.microsoft.com/beta/administrativeUnits/${adminUnitId}/members/$ref`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@odata.id': `https://graph.microsoft.com/beta/users/${u.id}`,
        }),
      });
      if (res.ok || res.status === 400) {
        // 400 == "already a member" in the AU API
        if (res.status === 400) alreadyMember++;
        else added++;
      } else {
        failed++;
      }
    } catch (e) {
      console.warn(`AU user add failed (au=${adminUnitId}, user=${u.id}):`, e);
      failed++;
    }
  }
  return { added, alreadyMember, failed };
}

async function applyDefenderTags(
  defenderToken: string | null,
  tag: string,
  azureADDeviceIds: string[]
): Promise<{ tagged: number; skipped: number; reason?: string }> {
  if (!defenderToken) {
    return {
      tagged: 0,
      skipped: azureADDeviceIds.length,
      reason: 'No Defender API token (Machine.ReadWrite.All not granted or MDE not licensed).',
    };
  }
  let tagged = 0;
  let skipped = 0;
  for (const aadId of azureADDeviceIds) {
    const machineId = await findMdeMachineByAadDeviceId(defenderToken, aadId);
    if (!machineId) {
      skipped++;
      continue;
    }
    const ok = await setMdeTag(defenderToken, machineId, tag);
    if (ok) tagged++;
    else skipped++;
  }
  return { tagged, skipped };
}

// Resolve user group → devices
async function resolveDevices(token: string, userGroupId: string, osFilter: string) {
  // Get transitive members (users) of the user group
  const members = await graphGet(token, `/groups/${userGroupId}/transitiveMembers?$select=id&$filter=@odata.type eq '#microsoft.graph.user'&$top=999`);

  const deviceMap = new Map<string, {
    id: string;                 // Entra object id (used for group membership writes)
    azureADDeviceId: string;    // AAD device id (used for MDE lookups)
    displayName: string;
    operatingSystem: string;
    userPrincipalName: string;
  }>();

  // For each user, get their managed devices
  for (const user of members) {
    try {
      const devices = await graphGet(token, `/users/${user.id}/managedDevices?$select=azureADDeviceId,deviceName,operatingSystem,userPrincipalName`);
      for (const device of devices) {
        if (!device.azureADDeviceId) continue;

        // Apply OS filter
        if (osFilter !== 'All') {
          const deviceOs = (device.operatingSystem || '').toLowerCase();
          const filterOs = osFilter.toLowerCase();
          if (!deviceOs.includes(filterOs)) continue;
        }

        // Look up the Entra ID device object by azureADDeviceId
        if (!deviceMap.has(device.azureADDeviceId)) {
          try {
            const entraDevices = await graphGet(token, `/devices?$filter=deviceId eq '${device.azureADDeviceId}'&$select=id,displayName,operatingSystem`);
            if (entraDevices.length > 0) {
              deviceMap.set(device.azureADDeviceId, {
                id: entraDevices[0].id, // Entra object ID
                azureADDeviceId: device.azureADDeviceId,
                displayName: device.deviceName || entraDevices[0].displayName,
                operatingSystem: device.operatingSystem || entraDevices[0].operatingSystem,
                userPrincipalName: device.userPrincipalName,
              });
            }
          } catch {
            // Skip devices we can't resolve
          }
        }
      }
    } catch {
      // Skip users with no managed devices or access issues
    }
  }

  return Array.from(deviceMap.values());
}

// Get current device group members
async function getCurrentGroupMembers(token: string, groupId: string) {
  const members = await graphGet(token, `/groups/${groupId}/members?$select=id,displayName,operatingSystem&$filter=@odata.type eq '#microsoft.graph.device'&$top=999`);
  return members.map((m: any) => ({
    id: m.id,
    displayName: m.displayName,
    operatingSystem: m.operatingSystem,
  }));
}

// Preview sync (dry run)
async function previewSync(token: string, mapping: any) {
  const resolvedDevices = await resolveDevices(token, mapping.user_group_id, mapping.os_filter);
  const currentMembers = await getCurrentGroupMembers(token, mapping.device_group_id);

  const resolvedIds = new Set(resolvedDevices.map((d: any) => d.id));
  const currentIds = new Set(currentMembers.map((m: any) => m.id));

  const toAdd = resolvedDevices.filter((d: any) => !currentIds.has(d.id));
  const toRemove = currentMembers.filter((m: any) => !resolvedIds.has(m.id));

  // Check blast radius
  const removalPercent = currentMembers.length > 0 ? (toRemove.length / currentMembers.length) * 100 : 0;
  const blastRadiusExceeded = removalPercent > (mapping.max_removal_percent || 25);

  return {
    resolvedDeviceCount: resolvedDevices.length,
    currentMemberCount: currentMembers.length,
    toAdd,
    toRemove,
    removalPercent: Math.round(removalPercent * 100) / 100,
    blastRadiusExceeded,
    maxRemovalPercent: mapping.max_removal_percent || 25,
  };
}

// Load the per-MSP safety settings (allowed group-name prefixes).
// Empty / missing row = no restriction, for backwards compat.
async function loadSettings(supabase: any, userId: string): Promise<{ allowedPrefixes: string[] }> {
  const { data } = await supabase
    .from('dude_settings')
    .select('allowed_group_prefixes')
    .eq('user_id', userId)
    .maybeSingle();
  return { allowedPrefixes: (data?.allowed_group_prefixes as string[] | undefined) ?? [] };
}

// Returns null if allowed; otherwise a human-readable reason.
function checkPrefixAllowlist(
  mapping: { user_group_name: string; device_group_name: string },
  allowedPrefixes: string[]
): string | null {
  if (allowedPrefixes.length === 0) return null;
  const userOk = allowedPrefixes.some((p) => mapping.user_group_name?.startsWith(p));
  const deviceOk = allowedPrefixes.some((p) => mapping.device_group_name?.startsWith(p));
  if (userOk && deviceOk) return null;
  const offenders: string[] = [];
  if (!userOk) offenders.push(`user group "${mapping.user_group_name}"`);
  if (!deviceOk) offenders.push(`device group "${mapping.device_group_name}"`);
  return `Prefix allowlist violation: ${offenders.join(' and ')} must start with one of [${allowedPrefixes.join(', ')}].`;
}

// Execute sync. `cred` is optional — when present, lets the function mint a
// Defender API token for MDE tag application. Callers from `execute-sync`
// and `bulk-sync` pass it; callers that only want a preview don't need to.
async function executeSync(
  token: string,
  mapping: any,
  supabase: any,
  userId: string,
  cred?: { client_id: string; client_secret: string; tenant_id: string }
) {
  const startTime = Date.now();
  let status = 'success';
  let devicesAdded = 0;
  let devicesRemoved = 0;
  let devicesSkipped = 0;
  const details: any = {};

  try {
    // Safety: per-MSP prefix allowlist (issue #6 PR1).
    const settings = await loadSettings(supabase, userId);
    const allowlistViolation = checkPrefixAllowlist(mapping, settings.allowedPrefixes);
    if (allowlistViolation) {
      status = 'skipped';
      details.reason = allowlistViolation;
      const durationMs = Date.now() - startTime;
      await supabase.from('dude_sync_logs').insert({
        user_id: userId,
        mapping_id: mapping.id,
        tenant_connection_id: mapping.tenant_connection_id,
        status,
        devices_added: 0,
        devices_removed: 0,
        devices_skipped: 0,
        details,
        duration_ms: durationMs,
      });
      return { status, devicesAdded: 0, devicesRemoved: 0, devicesSkipped: 0, durationMs, details };
    }

    const preview = await previewSync(token, mapping);
    details.preview = {
      resolvedDevices: preview.resolvedDeviceCount,
      currentMembers: preview.currentMemberCount,
      toAddCount: preview.toAdd.length,
      toRemoveCount: preview.toRemove.length,
    };

    // Safety: dry-run (issue #6 PR1). New mappings ship dry_run=true.
    // Operator must explicitly flip the toggle off after reviewing the preview.
    if (mapping.dry_run) {
      status = 'dry-run';
      details.reason = 'Dry-run mode — preview only. Toggle "Apply" off to enable writes.';
      details.wouldAdd = preview.toAdd.length;
      details.wouldRemove = preview.toRemove.length;
      devicesSkipped = preview.toAdd.length + preview.toRemove.length;
    } else if (preview.blastRadiusExceeded) {
      status = 'skipped';
      details.reason = `Blast radius exceeded: ${preview.removalPercent}% > ${preview.maxRemovalPercent}% limit`;
      devicesSkipped = preview.toRemove.length;
    } else {
      // Add devices
      for (const device of preview.toAdd) {
        try {
          await graphPost(token, `/groups/${mapping.device_group_id}/members/$ref`, {
            '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${device.id}`,
          });
          devicesAdded++;
        } catch (e) {
          details[`add_error_${device.id}`] = String(e);
          devicesSkipped++;
        }
      }

      // Remove devices
      for (const device of preview.toRemove) {
        try {
          await graphDelete(token, `/groups/${mapping.device_group_id}/members/${device.id}/$ref`);
          devicesRemoved++;
        } catch (e) {
          details[`remove_error_${device.id}`] = String(e);
          devicesSkipped++;
        }
      }

      // Nested device groups (issue #6 PR4). Attach each nested device-group
      // id as a member of the target group so newly-enrolled devices get
      // policies via Entra's transitive expansion before the next sync runs.
      const nestedIds: string[] = Array.isArray(mapping.nested_device_group_ids)
        ? mapping.nested_device_group_ids
        : [];
      if (nestedIds.length > 0) {
        try {
          const nestedResult = await ensureNestedGroups(token, mapping.device_group_id, nestedIds);
          details.nestedDeviceGroups = nestedResult;
        } catch (e) {
          details.nestedDeviceGroups = { error: String(e) };
        }
      }

      // AU user sync (issue #6 PR4). When the mapping targets an Administrative
      // Unit AND the operator opted into user sync, add resolved users from
      // the user-group transitive membership into the AU.
      if (mapping.admin_unit_id && mapping.sync_users_to_admin_unit) {
        try {
          const auResult = await addUsersToAdminUnit(token, mapping.admin_unit_id, mapping.user_group_id);
          details.adminUnitUserSync = { adminUnitId: mapping.admin_unit_id, ...auResult };
        } catch (e) {
          details.adminUnitUserSync = { error: String(e) };
        }
      }

      // Apply Defender for Endpoint tag (issue #6 PR2). Tag every device that
      // SHOULD be in the group, not just additions — keeps the tag in sync if
      // a device was added by hand earlier or the tag was cleared in MDE.
      // Skips quietly when the customer hasn't licensed MDE or hasn't granted
      // Machine.ReadWrite.All on the WindowsDefenderATP API.
      if (mapping.defender_tag && cred) {
        try {
          const aadIds = preview.resolvedDevices
            .map((d: { azureADDeviceId?: string }) => d.azureADDeviceId)
            .filter((id: string | undefined): id is string => Boolean(id));
          const defenderToken = await getDefenderToken(cred.client_id, cred.client_secret, cred.tenant_id);
          const tagResult = await applyDefenderTags(defenderToken, mapping.defender_tag, aadIds);
          details.defenderTag = {
            tag: mapping.defender_tag,
            attempted: aadIds.length,
            tagged: tagResult.tagged,
            skipped: tagResult.skipped,
            ...(tagResult.reason ? { reason: tagResult.reason } : {}),
          };
        } catch (e) {
          details.defenderTag = { error: String(e) };
        }
      }
    }
  } catch (e) {
    status = 'error';
    details.error = String(e);
  }

  const durationMs = Date.now() - startTime;

  // Log to dude_sync_logs
  await supabase.from('dude_sync_logs').insert({
    user_id: userId,
    mapping_id: mapping.id,
    tenant_connection_id: mapping.tenant_connection_id,
    status,
    devices_added: devicesAdded,
    devices_removed: devicesRemoved,
    devices_skipped: devicesSkipped,
    details,
    duration_ms: durationMs,
  });

  // Update mapping status
  await supabase.from('dude_mappings').update({
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_summary: { devicesAdded, devicesRemoved, devicesSkipped },
  }).eq('id', mapping.id);

  return { status, devicesAdded, devicesRemoved, devicesSkipped, durationMs, details };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth — two paths:
    //   (a) End user JWT in the Authorization header — normal in-app flow.
    //   (b) Service-role key + scheduled=true + userId in body — internal
    //       call from run-scheduled-dude. Service-role keys never reach the
    //       client; they live only in edge function env, so trusting the
    //       supplied userId is safe in this controlled path.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const earlyBody = isServiceRole ? await req.clone().json().catch(() => ({})) : null;

    let user: { id: string };
    if (isServiceRole && earlyBody?.scheduled === true && typeof earlyBody?.userId === 'string') {
      user = { id: earlyBody.userId as string };
    } else {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: u }, error: userError } = await userClient.auth.getUser();
      if (userError || !u) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = { id: u.id };
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    const body = await req.json();
    const { action, tenantConnectionId } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get access token for Graph API + cache the underlying credentials so
    // the sync handler can mint a separate token for the Defender API when
    // a mapping has defender_tag set.
    let token: string | null = null;
    let cred: { client_id: string; client_secret: string; tenant_id: string } | undefined;
    if (tenantConnectionId && action !== 'list-groups-with-token') {
      cred = await getStoredCredentials(supabase, tenantConnectionId, user.id);
      const tokenRes = await fetch(`https://login.microsoftonline.com/${cred.tenant_id}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: cred.client_id,
          client_secret: cred.client_secret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      });
      if (!tokenRes.ok) throw new Error('Failed to get access token');
      token = ((await tokenRes.json()) as { access_token: string }).access_token;
    }

    let result: any;

    switch (action) {
      case 'list-groups': {
        if (!token) throw new Error('Missing tenantConnectionId');
        const groups = await listGroups(token, body.prefix || '');
        result = { groups };
        break;
      }

      case 'list-groups-with-token': {
        if (!body.accessToken) throw new Error('Missing accessToken');
        const groups = await listGroups(body.accessToken, body.prefix || '');
        result = { groups };
        break;
      }

      case 'preview-sync': {
        if (!token) throw new Error('Missing tenantConnectionId');
        if (!body.mappingId) throw new Error('Missing mappingId');

        const { data: mapping, error: mapErr } = await supabase
          .from('dude_mappings')
          .select('*')
          .eq('id', body.mappingId)
          .eq('user_id', user.id)
          .single();
        if (mapErr || !mapping) throw new Error('Mapping not found');

        result = await previewSync(token, mapping);
        break;
      }

      case 'execute-sync': {
        if (!token) throw new Error('Missing tenantConnectionId');
        if (!body.mappingId) throw new Error('Missing mappingId');

        const { data: mapping, error: mapErr } = await supabase
          .from('dude_mappings')
          .select('*')
          .eq('id', body.mappingId)
          .eq('user_id', user.id)
          .single();
        if (mapErr || !mapping) throw new Error('Mapping not found');

        result = await executeSync(token, mapping, supabase, user.id, cred);
        break;
      }

      case 'bulk-sync': {
        if (!tenantConnectionId) throw new Error('Missing tenantConnectionId');
        if (!token) throw new Error('Failed to get token');

        const { data: mappings, error: mapErr } = await supabase
          .from('dude_mappings')
          .select('*')
          .eq('user_id', user.id)
          .eq('tenant_connection_id', tenantConnectionId)
          .eq('enabled', true);
        if (mapErr) throw new Error('Failed to load mappings');

        const results = [];
        for (const mapping of (mappings || [])) {
          const syncResult = await executeSync(token, mapping, supabase, user.id);
          results.push({ mappingId: mapping.id, ...syncResult });
        }
        result = { results, totalMappings: (mappings || []).length };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('DUDE sync error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
