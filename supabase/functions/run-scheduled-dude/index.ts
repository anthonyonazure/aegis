import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Scheduled DUDE sync runner (issue #6 PR3).
 *
 * Triggered by a pg_cron job every 15 min (or whatever the operator
 * configures in scripts/post-deploy.sql). For every MSP that has
 * dude_settings.schedule_enabled = true AND is past their cadence
 * window, this function POSTs back to the existing dude-sync edge
 * function with a service-role JWT, action=bulk-sync. Reuses the
 * full safety pipeline (allowlist, dry-run, blast radius,
 * defender_tag) we already built — no logic duplication.
 *
 * Cadence detection mirrors run-scheduled-compliance: simple cron-string
 * dispatch (every-N-min / hourly / daily / weekly / monthly).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DudeSettingsRow {
  user_id: string;
  schedule_enabled: boolean;
  schedule_cron: string;
  last_scheduled_run_at: string | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function shouldRun(s: DudeSettingsRow): boolean {
  if (!s.last_scheduled_run_at) return true;
  const last = new Date(s.last_scheduled_run_at).getTime();
  const diffMin = (Date.now() - last) / (1000 * 60);
  const parts = s.schedule_cron.split(' ');
  if (parts[0] === '*') return diffMin >= 1;       // every minute (test)
  if (parts[1] === '*') return diffMin >= 60;      // hourly
  // Bi-hourly default: '0 */2 * * *' — re-run every ~120 min
  if (parts[1].startsWith('*/')) {
    const n = parseInt(parts[1].slice(2), 10);
    if (Number.isFinite(n) && n > 0) return diffMin >= n * 60;
  }
  if (parts[2] === '*') return diffMin >= 1440;    // daily
  if (parts[4] === '*') return diffMin >= 10080;   // weekly
  return diffMin >= 1440;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Identify candidates: every MSP with schedule_enabled = true
    const { data: settings, error } = await adminClient
      .from('dude_settings')
      .select('user_id, schedule_enabled, schedule_cron, last_scheduled_run_at')
      .eq('schedule_enabled', true);
    if (error) return jsonResponse({ error: error.message }, 500);

    if (!settings || settings.length === 0) {
      return jsonResponse({ processed: 0, message: 'No MSPs with DUDE schedule enabled.' });
    }

    let processed = 0;
    const results: Record<string, unknown> = {};

    for (const s of settings as DudeSettingsRow[]) {
      if (!shouldRun(s)) continue;

      // Find this user's tenant connections — we kick off one bulk-sync per
      // tenant connection (each tenant has its own service principal).
      const { data: tenants } = await adminClient
        .from('tenant_connections')
        .select('id, tenant_id')
        .eq('user_id', s.user_id);
      if (!tenants || tenants.length === 0) continue;

      const tenantResults: Array<{ tenantId: string; status: string; error?: string }> = [];
      for (const t of tenants) {
        try {
          // dude-sync supports a service-role bypass when scheduled=true +
          // userId is supplied. The scheduled flag is checked against the
          // bearer token === SUPABASE_SERVICE_ROLE_KEY equality. Because
          // service-role keys never leave edge function env, this path is
          // not reachable from a client.
          const resp = await fetch(`${supabaseUrl}/functions/v1/dude-sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'bulk-sync',
              tenantConnectionId: t.id,
              scheduled: true,
              userId: s.user_id,
            }),
          });
          tenantResults.push({
            tenantId: t.tenant_id as string,
            status: resp.ok ? 'completed' : `failed_${resp.status}`,
          });
        } catch (e) {
          tenantResults.push({ tenantId: t.tenant_id as string, status: 'error', error: String(e) });
        }
      }

      // Mark this user's cadence window as fired regardless of per-tenant
      // success — operators see per-tenant errors in the dude_sync_logs UI.
      await adminClient
        .from('dude_settings')
        .update({ last_scheduled_run_at: new Date().toISOString() })
        .eq('user_id', s.user_id);

      results[s.user_id] = { tenantsAttempted: tenantResults.length, tenants: tenantResults };
      processed++;
    }

    return jsonResponse({ processed, results });
  } catch (error) {
    console.error('run-scheduled-dude error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
