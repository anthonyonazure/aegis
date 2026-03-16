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

async function getAccessToken(supabase: any, tenantConnectionId: string, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_decrypted_credential', {
    p_tenant_connection_id: tenantConnectionId,
    p_user_id: userId,
  });
  if (error || !data?.[0]) throw new Error('Failed to retrieve credentials');

  const { client_id, client_secret, tenant_id } = data[0];
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id,
      client_secret,
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

// Resolve user group → devices
async function resolveDevices(token: string, userGroupId: string, osFilter: string) {
  // Get transitive members (users) of the user group
  const members = await graphGet(token, `/groups/${userGroupId}/transitiveMembers?$select=id&$filter=@odata.type eq '#microsoft.graph.user'&$top=999`);

  const deviceMap = new Map<string, { id: string; displayName: string; operatingSystem: string; userPrincipalName: string }>();

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

// Execute sync
async function executeSync(token: string, mapping: any, supabase: any, userId: string) {
  const startTime = Date.now();
  let status = 'success';
  let devicesAdded = 0;
  let devicesRemoved = 0;
  let devicesSkipped = 0;
  const details: any = {};

  try {
    const preview = await previewSync(token, mapping);
    details.preview = {
      resolvedDevices: preview.resolvedDeviceCount,
      currentMembers: preview.currentMemberCount,
      toAddCount: preview.toAdd.length,
      toRemoveCount: preview.toRemove.length,
    };

    if (preview.blastRadiusExceeded) {
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

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Get access token for Graph API
    let token: string | null = null;
    if (tenantConnectionId && action !== 'list-groups-with-token') {
      token = await getAccessToken(supabase, tenantConnectionId, user.id);
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

        result = await executeSync(token, mapping, supabase, user.id);
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
