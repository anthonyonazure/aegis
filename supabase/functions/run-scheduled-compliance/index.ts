import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Phase 2 #4c — scheduled compliance evidence runner.
 *
 * Triggered by a Supabase scheduled function (cron) OR manually with a
 * specific configId in the body. For each due active config:
 *   1. Resolves target tenants (all / customer / group / selected).
 *   2. For every tenant, invokes the existing collect-compliance-evidence
 *      function via the platform's Functions URL using the service-role
 *      JWT, so RLS-protected tables are reachable.
 *   3. Records a scheduled_compliance_runs summary row + updates the
 *      config's last_run_at / next_run_at / run_count.
 *
 * Mirrors the run-scheduled-drift cadence detection so we share an
 * operational mental model.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleConfig {
  id: string;
  user_id: string;
  name: string;
  framework_id: string;
  target_type: string;
  target_tenant_ids: string[];
  target_customer_id: string | null;
  target_group_id: string | null;
  schedule_cron: string;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function shouldRun(schedule: ScheduleConfig): boolean {
  if (!schedule.last_run_at) return true;
  const lastRun = new Date(schedule.last_run_at).getTime();
  const diffMin = (Date.now() - lastRun) / (1000 * 60);
  const parts = schedule.schedule_cron.split(' ');
  if (parts[0] === '*') return diffMin >= 1;       // every-minute (test)
  if (parts[1] === '*') return diffMin >= 60;      // hourly
  if (parts[2] === '*') return diffMin >= 1440;    // daily
  if (parts[4] === '*') return diffMin >= 10080;   // weekly
  return diffMin >= 1440;                           // anything else: at-least-daily
}

function nextRun(cron: string): string {
  const now = new Date();
  const parts = cron.split(' ');
  if (parts[0] === '*') now.setMinutes(now.getMinutes() + 1);
  else if (parts[1] === '*') {
    now.setHours(now.getHours() + 1);
    now.setMinutes(parseInt(parts[0]) || 0);
  } else if (parts[2] === '*') {
    now.setDate(now.getDate() + 1);
    now.setHours(parseInt(parts[1]) || 0);
    now.setMinutes(parseInt(parts[0]) || 0);
  } else if (parts[4] !== '*') {
    now.setDate(now.getDate() + 7);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}

interface TenantConn { id: string; tenant_id: string; }

async function getTargetTenants(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  schedule: ScheduleConfig
): Promise<TenantConn[]> {
  let q = supabase
    .from('tenant_connections')
    .select('id, tenant_id')
    .eq('user_id', schedule.user_id);
  switch (schedule.target_type) {
    case 'all':
      break;
    case 'customer':
      if (schedule.target_customer_id) q = q.eq('customer_id', schedule.target_customer_id);
      break;
    case 'group':
      if (schedule.target_group_id) q = q.eq('tenant_group_id', schedule.target_group_id);
      break;
    case 'selected':
      if (schedule.target_tenant_ids?.length) q = q.in('id', schedule.target_tenant_ids);
      break;
  }
  const { data } = await q;
  return (data ?? []) as TenantConn[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500);
    const adminClient = createClient(supabaseUrl, serviceKey);

    let specificConfigId: string | null = null;
    try {
      const body = await req.json();
      specificConfigId = body?.configId ?? null;
    } catch {
      // No body — running all due active schedules.
    }

    let configsQuery = adminClient.from('scheduled_compliance_configs').select('*');
    configsQuery = specificConfigId
      ? configsQuery.eq('id', specificConfigId)
      : configsQuery.eq('is_active', true);
    const { data: configs } = await configsQuery;
    if (!configs?.length) return jsonResponse({ message: 'no schedules to process', processed: 0 });

    const framework_codes = new Map<string, string>();

    const summary: Record<string, unknown> = {};
    let processedCount = 0;

    for (const cfg of configs as ScheduleConfig[]) {
      if (!specificConfigId && !shouldRun(cfg)) continue;

      // Resolve framework code (collect-compliance-evidence wants code, not id)
      let frameworkCode = framework_codes.get(cfg.framework_id);
      if (!frameworkCode) {
        const { data: fw } = await adminClient
          .from('compliance_frameworks')
          .select('code')
          .eq('id', cfg.framework_id)
          .maybeSingle();
        if (!fw) continue;
        frameworkCode = fw.code as string;
        framework_codes.set(cfg.framework_id, frameworkCode);
      }

      // Insert a run row in 'running' state
      const startedAt = new Date().toISOString();
      const { data: runRow } = await adminClient
        .from('scheduled_compliance_runs')
        .insert({
          scheduled_config_id: cfg.id,
          user_id: cfg.user_id,
          status: 'running',
          started_at: startedAt,
        })
        .select('id')
        .single();
      const runId = runRow?.id as string | undefined;

      const tenants = await getTargetTenants(adminClient, cfg);
      const evidenceIds: string[] = [];
      let completed = 0;
      let failed = 0;
      let passedTotal = 0;
      let failedTotal = 0;

      // For each tenant, hit the per-tenant evidence collector. We reuse the
      // existing function rather than duplicating the evaluator code.
      for (const t of tenants) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/collect-compliance-evidence`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tenantConnectionId: t.id,
              frameworkCode,
            }),
          });
          if (!resp.ok) {
            failed++;
            continue;
          }
          const result = await resp.json();
          if (result?.success && result.runId) {
            evidenceIds.push(result.runId);
            completed++;
            passedTotal += result.counts?.passed ?? 0;
            failedTotal += result.counts?.failed ?? 0;
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Compliance schedule ${cfg.name} tenant ${t.id} failed:`, e);
          failed++;
        }
      }

      const completedAt = new Date().toISOString();
      const status = failed === tenants.length && tenants.length > 0 ? 'failed' : 'completed';
      if (runId) {
        await adminClient
          .from('scheduled_compliance_runs')
          .update({
            status,
            total_tenants: tenants.length,
            completed_tenants: completed,
            failed_tenants: failed,
            passed_total: passedTotal,
            failed_total: failedTotal,
            evidence_run_ids: evidenceIds,
            completed_at: completedAt,
          })
          .eq('id', runId);
      }

      // Update the schedule
      await adminClient
        .from('scheduled_compliance_configs')
        .update({
          last_run_at: completedAt,
          next_run_at: nextRun(cfg.schedule_cron),
          run_count: cfg.run_count + 1,
        })
        .eq('id', cfg.id);

      summary[cfg.id] = {
        name: cfg.name,
        runId,
        tenantsChecked: tenants.length,
        completed,
        failed,
      };
      processedCount++;
    }

    return jsonResponse({ processed: processedCount, summary });
  } catch (error) {
    console.error('run-scheduled-compliance error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
