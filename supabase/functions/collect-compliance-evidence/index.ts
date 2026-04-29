import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Phase 2 #4a — collect compliance evidence for one (tenant, framework).
 *
 * Caller:  the MSP user (their JWT) that owns the tenant.
 * Effect:  authenticates to Graph, runs every active control's evaluator
 *          for the requested framework, and persists a run + per-control
 *          items into compliance_evidence_runs / compliance_evidence_items.
 *
 * Evaluators are coded by `evaluator_key`. New evaluators ship with code
 * deploys; new controls referencing an existing key just need a DB row.
 * Controls with no evaluator return status = 'na'.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  tenantConnectionId?: string;
  frameworkCode?: string;  // e.g. 'hipaa-security'
}

interface ControlRow {
  id: string;
  control_code: string;
  name: string;
  evaluator_key: string | null;
  severity: string;
}

interface GraphContext {
  token: string;
  tenantId: string;
  fetchGraph: (endpoint: string, useBeta?: boolean) => Promise<Record<string, unknown> | null>;
}

interface EvaluatorResult {
  status: 'pass' | 'fail' | 'na' | 'error';
  notes: string;
  snapshot: Record<string, unknown>;
}

type Evaluator = (ctx: GraphContext) => Promise<EvaluatorResult>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }).toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph token error: ${resp.status} ${text}`);
  }
  return (await resp.json()).access_token as string;
}

function makeFetchGraph(token: string) {
  return async (endpoint: string, useBeta = false) => {
    const baseUrl = useBeta ? "https://graph.microsoft.com/beta" : "https://graph.microsoft.com/v1.0";
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: "eventual" },
    });
    if (!res.ok) {
      // Forbidden / not-found return null so evaluators can mark "na" if a
      // permission isn't granted, instead of cascading errors.
      if (res.status === 403 || res.status === 404) return null;
      const text = await res.text().catch(() => "");
      throw new Error(`Graph ${endpoint} error: ${res.status} ${text}`);
    }
    return await res.json();
  };
}

// ---------- Evaluators ----------

const EVALUATORS: Record<string, Evaluator> = {
  /**
   * Pass: at least one ENABLED Conditional Access policy that requires MFA
   * for either Global Administrator or any role in the privileged-roles set.
   */
  'mfa-required-for-admins': async ({ fetchGraph }) => {
    const data = await fetchGraph('/identity/conditionalAccess/policies');
    if (!data) {
      return {
        status: 'na',
        notes: 'Conditional Access policies not readable (missing Policy.Read.All or no Entra ID P1+).',
        snapshot: {},
      };
    }
    const policies = (data.value as Array<Record<string, unknown>> | undefined) ?? [];
    const matches = policies.filter((p) => {
      if (p.state !== 'enabled') return false;
      const conditions = p.conditions as Record<string, unknown> | undefined;
      const users = conditions?.users as Record<string, unknown> | undefined;
      const includeRoles = (users?.includeRoles as string[]) ?? [];
      // 62e90394-69f5-4237-9190-012177145e10 = Global Administrator template id.
      // Using the GUID is more reliable than display name across locales.
      const adminRoleIds = new Set([
        '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
        '7be44c8a-adaf-4e2a-84d6-ab2649e08a13', // Privileged Authentication Administrator
        '194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
      ]);
      const targetsAdmins = includeRoles.some((r) => adminRoleIds.has(r));
      const grantControls = p.grantControls as Record<string, unknown> | undefined;
      const builtIn = (grantControls?.builtInControls as string[]) ?? [];
      return targetsAdmins && builtIn.includes('mfa');
    });
    if (matches.length > 0) {
      return {
        status: 'pass',
        notes: `${matches.length} enabled Conditional Access policy/policies enforce MFA for admin roles.`,
        snapshot: {
          matchedPolicies: matches.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            state: m.state,
          })),
          totalEnabledPolicies: policies.filter((p) => p.state === 'enabled').length,
        },
      };
    }
    return {
      status: 'fail',
      notes: 'No enabled Conditional Access policy enforces MFA for admin roles (Global Administrator / Privileged Authentication Administrator / Security Administrator).',
      snapshot: {
        totalPolicies: policies.length,
        enabledPolicies: policies.filter((p) => p.state === 'enabled').map((p) => ({ id: p.id, displayName: p.displayName })),
      },
    };
  },

  /**
   * Pass: the audit log sign-in endpoint is queryable, returns at least one record.
   * (If logging is disabled or the app lacks AuditLog.Read.All, the endpoint 403s
   * and we surface that as fail rather than na.)
   */
  'audit-logs-enabled': async ({ fetchGraph }) => {
    try {
      const data = await fetchGraph('/auditLogs/signIns?$top=1');
      if (data === null) {
        return {
          status: 'fail',
          notes: 'Audit log endpoint returned 403/404. Either AuditLog.Read.All is not granted or audit logging is disabled.',
          snapshot: {},
        };
      }
      const value = (data.value as unknown[]) ?? [];
      if (value.length > 0) {
        return {
          status: 'pass',
          notes: 'Audit log endpoint is accessible and contains records.',
          snapshot: { latestRecordCount: 1 },
        };
      }
      return {
        status: 'fail',
        notes: 'Audit log endpoint accessible but returned no records — verify auditing is enabled.',
        snapshot: { recordCount: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        notes: e instanceof Error ? e.message : 'Unknown error checking audit logs.',
        snapshot: {},
      };
    }
  },

  /**
   * Pass: no enabled non-shared-mailbox user accounts whose mail or UPN
   * matches typical "shared inbox" patterns (info@, support@, billing@, etc.)
   * AND whose accountEnabled is true. Failing means a shared address is being
   * used as a real signin identity, which violates unique-user-id requirements.
   */
  'no-shared-account-signin': async ({ fetchGraph }) => {
    const data = await fetchGraph('/users?$select=id,userPrincipalName,mail,accountEnabled,userType&$top=999');
    if (!data) {
      return {
        status: 'na',
        notes: 'Could not read /users (User.Read.All permission missing).',
        snapshot: {},
      };
    }
    const users = (data.value as Array<Record<string, unknown>> | undefined) ?? [];
    const sharedPattern = /^(info|support|admin|billing|noreply|no-reply|sales|hello|help|contact|team|office)@/i;
    const offenders = users.filter((u) => {
      if (u.accountEnabled !== true) return false;
      if (u.userType === 'Guest') return false;
      const upn = String(u.userPrincipalName ?? '');
      const mail = String(u.mail ?? '');
      return sharedPattern.test(upn) || sharedPattern.test(mail);
    });
    if (offenders.length === 0) {
      return {
        status: 'pass',
        notes: `${users.length} users scanned — no enabled accounts use shared mailbox naming conventions.`,
        snapshot: { totalUsers: users.length },
      };
    }
    return {
      status: 'fail',
      notes: `${offenders.length} enabled accounts use shared-mailbox naming. Convert to shared mailboxes or disable.`,
      snapshot: {
        totalUsers: users.length,
        offenders: offenders.slice(0, 25).map((u) => ({
          id: u.id,
          userPrincipalName: u.userPrincipalName,
          mail: u.mail,
        })),
      },
    };
  },

  /**
   * Pass: authentication methods policy has FIDO2 OR Microsoft Authenticator
   * enabled (presence of strong, phishing-resistant factors). Falls back to
   * surface the policy for manual review if the endpoint isn't reachable.
   */
  'strong-auth-methods-enabled': async ({ fetchGraph }) => {
    const data = await fetchGraph('/policies/authenticationMethodsPolicy', /*useBeta*/ true);
    if (!data) {
      return {
        status: 'na',
        notes: 'Authentication methods policy not readable (Policy.Read.All on beta required).',
        snapshot: {},
      };
    }
    const configs = (data.authenticationMethodConfigurations as Array<Record<string, unknown>> | undefined) ?? [];
    const strong = configs.filter((c) => {
      const id = String(c.id ?? '');
      const state = c.state;
      return state === 'enabled' && (id === 'Fido2' || id === 'MicrosoftAuthenticator' || id === 'WindowsHelloForBusiness');
    });
    if (strong.length > 0) {
      return {
        status: 'pass',
        notes: `Strong authentication methods enabled: ${strong.map((c) => c.id).join(', ')}.`,
        snapshot: {
          strongMethods: strong.map((c) => ({ id: c.id, state: c.state })),
        },
      };
    }
    return {
      status: 'fail',
      notes: 'No phishing-resistant authentication methods (FIDO2, Microsoft Authenticator, Windows Hello) are enabled.',
      snapshot: {
        configuredMethods: configs.map((c) => ({ id: c.id, state: c.state })),
      },
    };
  },

  /**
   * Pass: count of enabled users who have NOT signed in in the last 90 days
   * is below a threshold (relative to total active users — 5% or 1, whichever
   * is larger). Scoring stale accounts proportionally avoids penalizing very
   * small tenants where one stale account is 10%.
   */
  'no-stale-active-users': async ({ fetchGraph }) => {
    const data = await fetchGraph(
      '/users?$select=id,userPrincipalName,accountEnabled,signInActivity&$filter=accountEnabled eq true&$top=999',
      /*useBeta*/ true
    );
    if (!data) {
      return {
        status: 'na',
        notes: 'signInActivity not readable (AuditLog.Read.All on beta required).',
        snapshot: {},
      };
    }
    const users = (data.value as Array<Record<string, unknown>> | undefined) ?? [];
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const stale = users.filter((u) => {
      const sia = u.signInActivity as Record<string, unknown> | undefined;
      const last = sia?.lastSignInDateTime as string | undefined;
      if (!last) return true; // no record = effectively stale
      return new Date(last).getTime() < cutoff;
    });
    const threshold = Math.max(1, Math.floor(users.length * 0.05));
    if (stale.length <= threshold) {
      return {
        status: 'pass',
        notes: `${stale.length} of ${users.length} active users are stale (>90 days inactive). Within 5% tolerance.`,
        snapshot: { totalActive: users.length, staleCount: stale.length, threshold },
      };
    }
    return {
      status: 'fail',
      notes: `${stale.length} of ${users.length} active users have not signed in in 90+ days. Disable or remove per termination procedures.`,
      snapshot: {
        totalActive: users.length,
        staleCount: stale.length,
        threshold,
        stale: stale.slice(0, 25).map((u) => ({
          id: u.id,
          userPrincipalName: u.userPrincipalName,
          lastSignInDateTime: (u.signInActivity as Record<string, unknown> | undefined)?.lastSignInDateTime ?? null,
        })),
      },
    };
  },
};

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.tenantConnectionId) return jsonResponse({ error: 'tenantConnectionId is required' }, 400);
    if (!body.frameworkCode) return jsonResponse({ error: 'frameworkCode is required' }, 400);

    // Verify ownership of the tenant connection (RLS-equivalent select)
    const { data: tenant, error: tenantErr } = await userClient
      .from('tenant_connections')
      .select('id, tenant_id, tenant_name, display_name, user_id')
      .eq('id', body.tenantConnectionId)
      .maybeSingle();
    if (tenantErr || !tenant) return jsonResponse({ error: 'Tenant not found or access denied' }, 404);

    // Resolve framework + active controls
    const { data: framework, error: fwErr } = await userClient
      .from('compliance_frameworks')
      .select('id, code, name')
      .eq('code', body.frameworkCode)
      .eq('is_active', true)
      .maybeSingle();
    if (fwErr || !framework) return jsonResponse({ error: 'Framework not found' }, 404);

    const { data: controls, error: cErr } = await userClient
      .from('compliance_controls')
      .select('id, control_code, name, evaluator_key, severity')
      .eq('framework_id', framework.id)
      .eq('is_active', true);
    if (cErr) return jsonResponse({ error: `Failed to load controls: ${cErr.message}` }, 500);
    const controlList = (controls ?? []) as ControlRow[];
    if (controlList.length === 0) return jsonResponse({ error: 'No controls defined for this framework' }, 400);

    // Get tenant credentials + Graph token
    const { data: credRows, error: credErr } = await userClient.rpc('get_decrypted_credential', {
      p_tenant_connection_id: body.tenantConnectionId,
      p_user_id: user.id,
    });
    if (credErr || !credRows || credRows.length === 0) {
      return jsonResponse({ error: 'No credentials configured for this tenant' }, 422);
    }
    const cred = credRows[0] as { tenant_id: string; client_id: string; client_secret: string };

    let token: string;
    try {
      token = await getGraphToken(cred.client_id, cred.client_secret, cred.tenant_id);
    } catch (e) {
      return jsonResponse({ error: `Graph authentication failed: ${e instanceof Error ? e.message : 'unknown'}` }, 502);
    }

    const ctx: GraphContext = {
      token,
      tenantId: cred.tenant_id,
      fetchGraph: makeFetchGraph(token),
    };

    // Evaluate every control. Failures inside an evaluator become status='error'
    // so the run as a whole still completes.
    const results: Array<{ control: ControlRow; result: EvaluatorResult }> = [];
    for (const control of controlList) {
      if (!control.evaluator_key) {
        results.push({
          control,
          result: { status: 'na', notes: 'No evaluator implemented for this control yet.', snapshot: {} },
        });
        continue;
      }
      const fn = EVALUATORS[control.evaluator_key];
      if (!fn) {
        results.push({
          control,
          result: { status: 'na', notes: `Evaluator "${control.evaluator_key}" is not registered.`, snapshot: {} },
        });
        continue;
      }
      try {
        const r = await fn(ctx);
        results.push({ control, result: r });
      } catch (e) {
        results.push({
          control,
          result: {
            status: 'error',
            notes: e instanceof Error ? e.message : 'Evaluator threw an error.',
            snapshot: {},
          },
        });
      }
    }

    const counts = {
      passed: results.filter((r) => r.result.status === 'pass').length,
      failed: results.filter((r) => r.result.status === 'fail').length,
      na: results.filter((r) => r.result.status === 'na').length,
      error: results.filter((r) => r.result.status === 'error').length,
    };

    // Persist run + items via service role (RLS would be fine too — service
    // is just simpler for the bulk insert).
    const adminClient = createClient(supabaseUrl, serviceKey);
    const completedAt = new Date().toISOString();

    const { data: runRow, error: runErr } = await adminClient
      .from('compliance_evidence_runs')
      .insert({
        user_id: user.id,
        tenant_connection_id: body.tenantConnectionId,
        framework_id: framework.id,
        status: 'completed',
        total_controls: results.length,
        passed_count: counts.passed,
        failed_count: counts.failed,
        na_count: counts.na,
        error_count: counts.error,
        summary: {
          framework: { code: framework.code, name: framework.name },
          tenant: { id: tenant.id, name: tenant.display_name || tenant.tenant_name || tenant.tenant_id },
        },
        completed_at: completedAt,
      })
      .select('id')
      .single();
    if (runErr || !runRow) {
      return jsonResponse({ error: `Failed to persist run: ${runErr?.message ?? 'unknown'}` }, 500);
    }

    const runId = runRow.id as string;
    const itemsPayload = results.map((r) => ({
      run_id: runId,
      user_id: user.id,
      control_id: r.control.id,
      status: r.result.status,
      notes: r.result.notes,
      snapshot: r.result.snapshot,
      evaluated_at: completedAt,
    }));

    const { error: itemsErr } = await adminClient.from('compliance_evidence_items').insert(itemsPayload);
    if (itemsErr) {
      // Run row is already in. Surface the items failure but return runId so the
      // UI can still link to the partial.
      console.error('Failed to insert items:', itemsErr);
      return jsonResponse({
        success: false,
        runId,
        warning: `Run saved but items failed: ${itemsErr.message}`,
        counts,
      });
    }

    return jsonResponse({
      success: true,
      runId,
      counts,
      framework: framework.code,
      tenant: { id: tenant.id, name: tenant.display_name || tenant.tenant_name || tenant.tenant_id },
    });
  } catch (error) {
    console.error('collect-compliance-evidence error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
