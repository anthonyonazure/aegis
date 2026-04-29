import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Phase 2 #3b — server-side portal-user invite.
 *
 * Verifies the caller is the MSP that owns the target customer, creates
 * (or reuses) an auth.users row via the Admin API, and links it to the
 * customer in public.customer_users. Sends a magic link redirected at
 * the customer's portal sign-in page.
 *
 * Caller:  the MSP user (via their JWT)
 * Effect:  creates/links customer_users; emails an invite from Supabase Auth
 *
 * Env required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (auth.admin scope)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  customerId?: string;
  email?: string;
  role?: "customer_admin" | "customer_viewer";
  /** Optional override; defaults to <origin>/portal/<slug>/login. */
  redirectTo?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(s: string): boolean {
  // Conservative — RFC 5322 is overkill; this matches what Supabase accepts
  // and rejects obvious garbage (whitespace, missing @, etc.).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 1) Identify the caller (MSP) via their user JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    // 2) Parse + validate input
    const body: Body = await req.json().catch(() => ({} as Body));
    const { customerId, email, role = "customer_viewer", redirectTo } = body;

    if (!customerId || typeof customerId !== "string") {
      return jsonResponse({ error: "customerId is required" }, 400);
    }
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: "A valid email is required" }, 400);
    }
    if (role !== "customer_admin" && role !== "customer_viewer") {
      return jsonResponse({ error: "role must be customer_admin or customer_viewer" }, 400);
    }

    // 3) Verify MSP ownership of the customer (RLS-equivalent check using
    //    the user-scoped client; never trust the body alone here).
    const { data: customer, error: customerErr } = await userClient
      .from("customers")
      .select("id, name, custom_subdomain, user_id")
      .eq("id", customerId)
      .maybeSingle();
    if (customerErr || !customer) {
      return jsonResponse({ error: "Customer not found or access denied" }, 404);
    }

    // 4) Resolve the redirect URL pointing at the portal login. Caller can
    //    override; otherwise we infer from request Origin + the customer slug.
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    let inferredRedirect: string | null = null;
    if (customer.custom_subdomain) {
      try {
        const u = new URL(origin || "http://localhost");
        inferredRedirect = `${u.origin}/portal/${customer.custom_subdomain}/login`;
      } catch {
        inferredRedirect = null;
      }
    }
    const finalRedirect = redirectTo || inferredRedirect;

    // 5) Service-role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 6) Reuse an existing auth user with this email if one is already there.
    //    Supabase Auth Admin doesn't expose a getUserByEmail directly across
    //    versions, so we list with a filter and pick the first match.
    let existingUserId: string | null = null;
    try {
      // listUsers supports email filter via query param in supabase-js v2.
      // deno-lint-ignore no-explicit-any
      const listResp: any = await (adminClient.auth.admin as any).listUsers({ filter: `email.eq.${email}` });
      const matched = listResp?.data?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
      if (matched?.id) existingUserId = matched.id;
    } catch (e) {
      console.error("listUsers failed (continuing to invite path):", e);
    }

    let authUserId: string;
    let inviteEmailSent = false;

    if (existingUserId) {
      authUserId = existingUserId;
      // For an existing account, generate a magic link instead of inviting;
      // this gives the user a one-click sign-in that lands on the portal.
      try {
        const { error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: finalRedirect ? { redirectTo: finalRedirect } : undefined,
        });
        if (linkErr) {
          console.error("generateLink error:", linkErr);
        } else {
          // Supabase emails the magic link automatically when SMTP is configured.
          inviteEmailSent = true;
        }
      } catch (e) {
        console.error("generateLink threw:", e);
      }
    } else {
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        ...(finalRedirect ? { redirectTo: finalRedirect } : {}),
        data: { invited_by: user.id, customer_id: customer.id, scope: "portal" },
      });
      if (inviteErr || !invited?.user) {
        console.error("inviteUserByEmail error:", inviteErr);
        return jsonResponse(
          { error: `Could not invite user: ${inviteErr?.message || "unknown error"}` },
          500
        );
      }
      authUserId = invited.user.id;
      inviteEmailSent = true;
    }

    // 7) Insert (or reactivate) the customer_users link. Service role bypasses
    //    RLS — that's fine, we already verified ownership in step 3.
    const { data: existingLink } = await adminClient
      .from("customer_users")
      .select("id, customer_id, is_active")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (existingLink) {
      if (existingLink.customer_id !== customer.id) {
        // The auth.users id is unique on customer_users — block cross-customer reuse.
        return jsonResponse(
          { error: "This email is already linked to a different customer." },
          409
        );
      }
      const { error: updErr } = await adminClient
        .from("customer_users")
        .update({ role, is_active: true })
        .eq("id", existingLink.id);
      if (updErr) {
        console.error("customer_users update error:", updErr);
        return jsonResponse({ error: `Could not update portal user: ${updErr.message}` }, 500);
      }
    } else {
      const { error: insErr } = await adminClient.from("customer_users").insert({
        auth_user_id: authUserId,
        customer_id: customer.id,
        role,
        invited_by: user.id,
      });
      if (insErr) {
        console.error("customer_users insert error:", insErr);
        return jsonResponse({ error: `Could not link portal user: ${insErr.message}` }, 500);
      }
    }

    return jsonResponse({
      success: true,
      authUserId,
      inviteEmailSent,
      customerSlug: customer.custom_subdomain || null,
      redirectTo: finalRedirect,
      message: inviteEmailSent
        ? "Invite email sent."
        : "Portal user linked, but invite email could not be sent — share the portal URL manually.",
    });
  } catch (error) {
    console.error("invite-portal-user error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
