import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Phase 2 #3c — verify a customer's custom portal domain.
 *
 * Caller:  the MSP user (their JWT) that owns the customer.
 * Effect:  reads customers.custom_domain, performs DNS lookups (CNAME first,
 *          A as fallback), and on success sets custom_domain_verified_at.
 *
 * Env required:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CUSTOM_DOMAIN_CNAME_TARGET   — the hostname customers must CNAME to
 *                                  (e.g. "aegis.io"). May be a comma-
 *                                  separated list to allow multiple targets
 *                                  (canonical + hosting-provider host).
 *   CUSTOM_DOMAIN_A_TARGETS      — optional, comma-separated IPv4 fallbacks
 *                                  (only used when CNAME isn't present).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  customerId?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeHost(host: string): string {
  return host.replace(/\.+$/, '').toLowerCase().trim();
}

function envList(name: string): string[] {
  const raw = Deno.env.get(name);
  if (!raw) return [];
  return raw.split(',').map((s) => normalizeHost(s)).filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const expectedCnames = envList('CUSTOM_DOMAIN_CNAME_TARGET');
    const expectedAs = envList('CUSTOM_DOMAIN_A_TARGETS');
    if (expectedCnames.length === 0 && expectedAs.length === 0) {
      return jsonResponse(
        { error: "Custom domain target not configured (CUSTOM_DOMAIN_CNAME_TARGET / CUSTOM_DOMAIN_A_TARGETS)" },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Identify the caller (MSP)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const body: Body = await req.json().catch(() => ({} as Body));
    if (!body.customerId) return jsonResponse({ error: "customerId is required" }, 400);

    // Verify ownership and load custom_domain (RLS already enforces ownership)
    const { data: customer, error: customerErr } = await userClient
      .from("customers")
      .select("id, custom_domain")
      .eq("id", body.customerId)
      .maybeSingle();
    if (customerErr || !customer) return jsonResponse({ error: "Customer not found or access denied" }, 404);
    if (!customer.custom_domain) {
      return jsonResponse({ error: "No custom domain set on this customer" }, 400);
    }

    const target = normalizeHost(customer.custom_domain);

    // 1) Try CNAME — most common setup for portal subdomains.
    let cnameRecords: string[] = [];
    try {
      const r = await Deno.resolveDns(target, "CNAME");
      cnameRecords = (r as string[]).map(normalizeHost);
    } catch (e) {
      console.log(`CNAME lookup failed for ${target}:`, e instanceof Error ? e.message : e);
    }

    let matchedVia: 'cname' | 'a' | null = null;
    let matchedValue: string | null = null;

    if (cnameRecords.length > 0 && expectedCnames.length > 0) {
      const hit = cnameRecords.find((r) => expectedCnames.some((t) => r === t || r.endsWith(`.${t}`)));
      if (hit) {
        matchedVia = 'cname';
        matchedValue = hit;
      }
    }

    // 2) Fallback to A records when no CNAME match — covers apex domains
    //    (acme.com) which can't have a CNAME at the apex.
    if (!matchedVia && expectedAs.length > 0) {
      try {
        const r = await Deno.resolveDns(target, "A");
        const records = (r as string[]).map((s) => s.trim());
        const hit = records.find((ip) => expectedAs.includes(ip));
        if (hit) {
          matchedVia = 'a';
          matchedValue = hit;
        }
      } catch (e) {
        console.log(`A lookup failed for ${target}:`, e instanceof Error ? e.message : e);
      }
    }

    if (!matchedVia) {
      return jsonResponse(
        {
          success: false,
          verified: false,
          error: 'DNS does not point at this Aegis instance yet.',
          checked: target,
          expected: {
            cname: expectedCnames,
            a: expectedAs,
          },
          actual: {
            cname: cnameRecords,
          },
        },
        200
      );
    }

    // Mark verified (service role to bypass any RLS quirks; ownership already checked)
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: updErr } = await adminClient
      .from("customers")
      .update({ custom_domain_verified_at: new Date().toISOString() })
      .eq("id", customer.id);
    if (updErr) {
      console.error('Failed to mark custom domain verified:', updErr);
      return jsonResponse({ error: `Could not save verification status: ${updErr.message}` }, 500);
    }

    return jsonResponse({
      success: true,
      verified: true,
      via: matchedVia,
      matched: matchedValue,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("verify-custom-domain error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
