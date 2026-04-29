import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft Graph endpoints we know how to fetch current state for.
// Keys mirror the resource_type strings stored in exported_resources.
const GRAPH_ENDPOINTS: Record<string, { endpoint: string; useBeta?: boolean }> = {
  "intune/device-configurations": { endpoint: "/deviceManagement/deviceConfigurations" },
  "intune/compliance-policies": { endpoint: "/deviceManagement/deviceCompliancePolicies" },
  "intune/app-configurations": { endpoint: "/deviceAppManagement/mobileAppConfigurations", useBeta: true },
  "intune/autopilot": { endpoint: "/deviceManagement/windowsAutopilotDeploymentProfiles" },
  "intune/enrollment-restrictions": { endpoint: "/deviceManagement/deviceEnrollmentConfigurations" },
  "intune/scripts": { endpoint: "/deviceManagement/deviceManagementScripts" },
  "conditional-access/ca-policies": { endpoint: "/identity/conditionalAccess/policies" },
  "conditional-access/named-locations": { endpoint: "/identity/conditionalAccess/namedLocations" },
  "entra-id/groups": { endpoint: "/groups" },
  "entra-id/app-registrations": { endpoint: "/applications" },
  "entra-id/admin-units": { endpoint: "/administrativeUnits" },
};

const IGNORE_KEYS = new Set([
  "createdDateTime",
  "modifiedDateTime",
  "lastModifiedDateTime",
  "@odata.context",
  "@odata.type",
  "@odata.etag",
]);

interface Change {
  resourceType: string;
  resourceName: string;
  resourceId: string;
  changeType: "added" | "removed" | "modified";
  before: unknown;
  after: unknown;
  changedKeys?: string[];
}

interface BaselineRow {
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  data: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Token request failed");
  return data.access_token as string;
}

async function fetchGraphResources(token: string, endpoint: string, useBeta = false): Promise<Record<string, unknown>[]> {
  const baseUrl = useBeta ? "https://graph.microsoft.com/beta" : "https://graph.microsoft.com/v1.0";
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    console.error(`Graph error ${res.status} for ${endpoint}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data?.value) ? data.value : data ? [data] : [];
}

function getChangedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (IGNORE_KEYS.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { tenantConnectionId, baselineExportId } = body as {
      tenantConnectionId?: string;
      baselineExportId?: string;
    };

    if (!tenantConnectionId) {
      return jsonResponse({ error: "tenantConnectionId is required" }, 400);
    }

    // Verify tenant ownership
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenant_connections")
      .select("id, tenant_id, tenant_name, display_name, user_id")
      .eq("id", tenantConnectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return jsonResponse({ error: "Tenant not found or access denied" }, 404);
    }

    // Resolve baseline export — explicit or most recent completed export for this tenant
    let exportId = baselineExportId;
    if (!exportId) {
      const { data: latestExport } = await supabase
        .from("export_jobs")
        .select("id, completed_at")
        .eq("tenant_connection_id", tenantConnectionId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestExport) {
        return jsonResponse(
          {
            error: "no_baseline",
            message:
              "No completed export exists for this tenant yet. Run an export first to establish a baseline.",
          },
          422
        );
      }
      exportId = latestExport.id;
    }

    // Load baseline resources
    const { data: baselineRows, error: baselineErr } = await supabase
      .from("exported_resources")
      .select("resource_type, resource_id, resource_name, data")
      .eq("export_job_id", exportId);

    if (baselineErr) {
      return jsonResponse({ error: `Failed to load baseline: ${baselineErr.message}` }, 500);
    }
    if (!baselineRows || baselineRows.length === 0) {
      return jsonResponse(
        {
          error: "empty_baseline",
          message: "Baseline export contains no resources. Try a different export.",
        },
        422
      );
    }

    // Get tenant credentials
    const { data: credRows, error: credErr } = await supabase.rpc("get_decrypted_credential", {
      p_tenant_connection_id: tenantConnectionId,
      p_user_id: userId,
    });
    if (credErr || !credRows || credRows.length === 0) {
      return jsonResponse({ error: "No credentials configured for this tenant" }, 422);
    }
    const cred = credRows[0] as { tenant_id: string; client_id: string; client_secret: string };

    // Authenticate to Graph
    let graphToken: string;
    try {
      graphToken = await getAccessToken(cred.tenant_id, cred.client_id, cred.client_secret);
    } catch (e) {
      return jsonResponse(
        { error: `Graph authentication failed: ${e instanceof Error ? e.message : "unknown"}` },
        502
      );
    }

    // Group baseline by resource_type for diffing
    const baselineByType: Record<string, BaselineRow[]> = {};
    for (const row of baselineRows as BaselineRow[]) {
      const t = row.resource_type;
      (baselineByType[t] ??= []).push(row);
    }

    const changes: Change[] = [];
    let resourcesChecked = 0;

    for (const [resourceType, baselineList] of Object.entries(baselineByType)) {
      const endpointConfig = GRAPH_ENDPOINTS[resourceType];
      if (!endpointConfig) continue; // unsupported resource type — skip silently

      let currentList: Record<string, unknown>[] = [];
      try {
        currentList = await fetchGraphResources(graphToken, endpointConfig.endpoint, endpointConfig.useBeta);
      } catch (e) {
        console.error(`Fetch failed for ${resourceType}:`, e);
        continue;
      }
      resourcesChecked++;

      const baselineMap = new Map<string, BaselineRow>();
      for (const r of baselineList) {
        const id = r.resource_id || (r.data as Record<string, unknown>)?.id as string | undefined;
        if (id) baselineMap.set(id, r);
      }
      const currentMap = new Map<string, Record<string, unknown>>();
      for (const r of currentList) {
        if (typeof r.id === "string") currentMap.set(r.id, r);
      }

      // Added
      for (const [id, current] of currentMap) {
        if (!baselineMap.has(id)) {
          changes.push({
            resourceType,
            resourceId: id,
            resourceName: (current.displayName as string) || (current.name as string) || id,
            changeType: "added",
            before: null,
            after: current,
          });
        }
      }
      // Removed and modified
      for (const [id, baselineRow] of baselineMap) {
        const current = currentMap.get(id);
        if (!current) {
          changes.push({
            resourceType,
            resourceId: id,
            resourceName:
              baselineRow.resource_name ||
              (baselineRow.data as Record<string, unknown>)?.displayName as string ||
              id,
            changeType: "removed",
            before: baselineRow.data,
            after: null,
          });
        } else {
          const changedKeys = getChangedKeys(
            baselineRow.data as Record<string, unknown>,
            current as Record<string, unknown>
          );
          if (changedKeys.length > 0) {
            changes.push({
              resourceType,
              resourceId: id,
              resourceName:
                (current.displayName as string) ||
                baselineRow.resource_name ||
                id,
              changeType: "modified",
              before: baselineRow.data,
              after: current,
              changedKeys,
            });
          }
        }
      }
    }

    const summary = {
      added: changes.filter((c) => c.changeType === "added").length,
      removed: changes.filter((c) => c.changeType === "removed").length,
      modified: changes.filter((c) => c.changeType === "modified").length,
      resourcesChecked,
      totalChanges: changes.length,
    };

    return jsonResponse({
      tenant: {
        id: tenant.id,
        name: tenant.display_name || tenant.tenant_name || tenant.tenant_id,
      },
      baselineExportId: exportId,
      summary,
      changes,
    });
  } catch (error) {
    console.error("compute-drift-adhoc error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
