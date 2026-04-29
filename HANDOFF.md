# Aegis — Manual Follow-Ups

Things the operator deploying Aegis needs to do in Supabase / external services that can't be scripted from the dev shell. Cross items off as you complete them.

---

## ⚠️ Known risks / unverified areas

The codebase ships with `npm run build` green and CI passing on every push, but the following have **not** been runtime-tested end-to-end against a real Supabase project + M365 tenant. They are most likely to need adjustment on first deploy.

### High risk — likely to need a fix on first deploy

- **Service-role bypass in `dude-sync`**. The function checks `authHeader === \`Bearer ${SERVICE_ROLE_KEY}\`` for exact string equality so `run-scheduled-dude` can act on behalf of any user. Supabase's gateway sometimes rewrites or wraps the Authorization header; if so, the bypass never fires and the cron-triggered DUDE sync silently 401s. **Validate by triggering `run-scheduled-dude` manually and confirming dude_sync_logs gets a row.**

- **`Deno.resolveDns` in `verify-custom-domain`**. Supabase Edge runtime can have restrictions on outbound DNS. If lookups fail, switch to a DoH (DNS-over-HTTPS) fallback against `1.1.1.1` or `8.8.8.8`.

- **`pg_cron` + `net.http_post` setup**. The post-deploy SQL enables both extensions and schedules two cron jobs. Exact syntax + extension permissions vary by Supabase tier (free tier has limits on outbound HTTP from cron). If `cron.schedule` errors, fall back to invoking the runner functions from a long-running external scheduler.

- **Supabase Auth `redirectTo` allowlist**. `invite-portal-user` passes the customer's portal URL as the magic-link redirect. **You must add `https://<your-host>/portal/*` to Authentication → URL Configuration → Redirect URLs** or invitees land on the wrong sign-in page after clicking the magic link.

- **AI narrative prompt quality**. The prompt for `narrate-compliance-evidence` has been written but never run on a real failed-control snapshot. First runs may produce generic / verbose / hallucinated narratives. Iterate on the system prompt with one or two real failures before shipping the feature to customers.

### Medium risk — works under the documented conditions, breaks gracefully otherwise

- **MDE Defender API integration** (DUDE Defender tagging). Token scope is `https://api.securitycenter.microsoft.com/.default`, separate from Graph. Requires `Machine.ReadWrite.All` on the WindowsDefenderATP API on the app registration. If not granted, tagging fails open — devices land in the device group, but the tag silently no-ops and the sync log records the reason.

- **Graph `beta` endpoints in DUDE PR4** (`/beta/administrativeUnits/{id}/members/$ref`). Beta APIs change. The "400 = already a member" quirk we depend on for AU user sync may shift; if it does, expected counts in `details.adminUnitUserSync` will be off but the operation still succeeds.

- **Compliance evaluators (8 total)**. Coded against my mental model of Graph response shapes; never run against a live tenant. Most likely failure mode: a field I assumed always-present is actually optional, leading to a TypeError. Wrap the first few real runs in a debug log session.

- **PCI DSS 8.4.2 (full-tenant MFA, not just admins)**. Mapped to the existing admin-MFA evaluator. **This will report PASS even when only admins have MFA**, which is a false positive for that specific control. Add an `mfa-required-for-all-users` evaluator before anyone uses Aegis to sign off on a PCI report.

- **AC-7 (NIST smart lockout) and PCI 10.4.1 (time sync)**. Ship as `evaluator_key = NULL`, so they show as N/A in the UI. Auditor expects manual evidence collected outside the platform; document this explicitly in audit response.

### Low risk — should work as designed

- Plain CRUD UIs (marketplace browse/install/rate, plugin editor, branding form, custom-domain settings).
- RLS policy patterns reused from existing tables that already work.
- Migrations are additive — no destructive changes; rerunning is safe.
- Edge function packaging — `supabase/config.toml` lists every function, scripts deploy them in dependency order.

### What I would do before trusting any of this in front of a paying customer

1. Run `./scripts/deploy-aegis.sh` against a throwaway Supabase project. Catches migration ordering, function deploy errors, config.toml omissions.
2. Run one compliance evaluator against a real tenant. Check the snapshot JSON matches what the code expects.
3. Click the portal flow end-to-end: create customer → set slug → invite real email → click the magic link → confirm the dashboard loads.
4. Trigger `run-scheduled-dude` manually with the operator's user_id in the body and confirm a sync log lands.
5. Check the GitHub Actions CI badge in README — if it's red, something obvious broke between local and CI.

---

## TL;DR — fastest path

After `supabase login` + `supabase link --project-ref <your-project-ref>`:

```powershell
# Windows
.\scripts\deploy-aegis.ps1
```
```bash
# macOS / WSL / Git Bash
./scripts/deploy-aegis.sh
```

That handles every migration + every function deploy below in one pass. Then paste `scripts/post-deploy.sql` into the Supabase SQL editor (after editing the URL + service-role placeholders) to register the compliance cron job and rename any `provider='lovable'` rows.

The remaining items in this file are manual: gateway secrets, Auth redirect URLs, DNS/SSL for portal hosts, and the smoke-test passes.

## Open

### 1. Configure AI gateway secrets in Supabase
Edge functions now read these. The old `LOVABLE_API_KEY` is no longer referenced anywhere in source.

- [ ] Set `AI_GATEWAY_API_KEY` to your OpenAI key (or any OpenAI-compatible provider)
- [ ] Set `AI_GATEWAY_URL` to `https://api.openai.com/v1` (or Azure OpenAI / OpenRouter / your proxy)
- [ ] After confirming AI features still work, delete the old `LOVABLE_API_KEY` secret

### 2. Run the lovable → gateway provider rename SQL
One-shot migration to update existing rows. The migration file was deleted from the repo on request — paste this directly into the Supabase SQL editor:

```sql
ALTER TABLE public.ai_conversations ALTER COLUMN provider DROP DEFAULT;
UPDATE public.ai_provider_settings SET provider = 'gateway' WHERE provider = 'lovable';
UPDATE public.ai_conversations    SET provider = 'gateway' WHERE provider = 'lovable';
ALTER TABLE public.ai_conversations ALTER COLUMN provider SET DEFAULT 'gateway';
```

- [ ] Run the four statements

### 3. Apply the white-label branding migration
File: `supabase/migrations/20260429100000_add_customer_branding.sql`

- [ ] Apply the migration (Supabase CLI `db push`, or paste SQL into the editor)
- [ ] Verify columns exist on `customers`: `brand_name`, `logo_url`, `primary_color`, `accent_color`, `support_email`, `support_url`, `custom_subdomain`

### 4. Smoke-test branding end-to-end
- [ ] Pick a customer → Customers → open detail → **Branding** tab
- [ ] Set a brand name, paste a logo URL, try HSL colors like `300 70% 50%`
- [ ] Hit Save
- [ ] Switch active customer in the sidebar — confirm the sidebar logo, brand name, and primary/accent colors swap
- [ ] Switch back to a customer with no branding — confirm Aegis defaults return

### 5. Smoke-test the wedge features against a real tenant
After the gateway secrets above are set:

- [ ] **DriftExplainer**: pick a tenant that already has a completed export → click "Explain Drift" → verify it returns real findings (not the old MFA-disabled sample)
- [ ] **ChangeImpactAnalyzer**: paste a proposed change → verify the AI's analysis references your real user count / CA policy count (check the response object for `_dataSource: 'live'`)

### 6. Edge function deploys
If your Supabase project doesn't auto-deploy on git push, you'll need to manually deploy the new/modified functions:

- [ ] **New**: `compute-drift-adhoc`
- [ ] **Modified** (lovable cleanup + gateway rename): all 22 `ai-*` functions, `email-security`, `graph-api`, `send-ai-notification`
- [ ] **Modified** (URL-placement bug fix): `ai-anomaly-detection`, `ai-chat-assistant`, `ai-drift-explainer`, `ai-policy-generator`, `ai-remediation`
- [ ] **Modified** (Phase 2 #2): `create-psa-ticket` (ServiceNow + Jira creators), `ai-anomaly-detection` (webhook + auto-ticket dispatch)

Single command to deploy everything:
```bash
supabase functions deploy --project-ref <your-ref>
```

### 7. Apply the PSA + anomaly routing migration (Phase 2 #2)
File: `supabase/migrations/20260429110000_extend_psa_providers_and_anomaly_routing.sql`

- [ ] Apply the migration
- [ ] Verify `psa_integrations.provider` CHECK now allows `servicenow` and `jira`
- [ ] Verify new columns exist on `psa_integrations`: `external_project_key`, `ticket_on_anomaly`
- [ ] Verify `psa_tickets.source_type` CHECK now allows `anomaly`

### 8. Smoke-test ServiceNow / Jira / anomaly auto-ticketing
- [ ] PSA Integrations → Add Integration → pick ServiceNow → fill instance URL + api key (service-account user) + api secret (its password) → Test connection
- [ ] PSA Integrations → Add Integration → pick Jira → fill instance URL + api key (your Atlassian email) + api secret (API token from id.atlassian.com) + project key (e.g. `OPS`) → Test connection
- [ ] Toggle "Auto-Create Tickets" on at least one integration with "On Anomaly Detection" enabled
- [ ] Run AI Anomaly Detection on a tenant — confirm a ticket lands in the configured PSA when critical/high findings come back
- [ ] (Optional) Configure a webhook with event `anomaly.detected` and confirm it fires

### 9. Apply the customer-portal foundation migration (Phase 2 #3a)
File: `supabase/migrations/20260429120000_customer_portal_foundation.sql`

- [ ] Apply the migration
- [ ] Verify table `public.customer_users` exists with the expected columns
- [ ] Verify function `public.current_portal_customer_id()` returns NULL for an MSP user (run from a logged-in MSP session)
- [ ] Verify the new RLS policies are present on `customers`, `tenant_connections`, `tenant_secure_scores`, `secure_score_history`, `scheduled_drift_runs`

### 10. Set up a portal user (manual flow for #3a — invite-flow lands in #3b)
For now, granting portal access is two steps in Supabase:

- [ ] In Supabase Dashboard → Authentication → Users → **Add user** with the customer contact's email + a temp password (or invite via email)
- [ ] Copy the new `auth.users.id`
- [ ] In Aegis, open the customer's detail page → **Branding** tab → set `custom_subdomain` (e.g. `acme`) and Save
- [ ] Switch to the **Portal users** tab → paste the auth user id → Grant access (default role: viewer)
- [ ] Open `/portal/<slug>/login` (incognito window helps), sign in with the new user, confirm the dashboard loads with that customer's data only

### 11. Edge function deploys (Phase 2 #3a — none new)
No new edge functions in #3a; foundation is RLS + frontend only. The portal pulls existing tables through PostgREST, gated by the new policies.

### 12. Apply the anomaly_runs migration (Phase 2 #3b)
File: `supabase/migrations/20260429130000_anomaly_runs.sql`

- [ ] Apply the migration
- [ ] Verify table `public.anomaly_runs` exists with the JSONB columns + the four severity counters
- [ ] Verify the portal RLS policy `Portal users can read anomaly runs for their tenants` is present

### 13. Configure Supabase Auth for portal invites (Phase 2 #3b)
The new `invite-portal-user` edge function calls `auth.admin.inviteUserByEmail` and `auth.admin.generateLink`, which trigger emails through whatever SMTP is configured on your Supabase project.

- [ ] In Supabase Dashboard → Authentication → URL Configuration, add `https://<your-app-host>/portal/*` to **Redirect URLs** so the magic link redirect parameter is honored
- [ ] If you haven't set custom SMTP, the default Supabase sender may be rate-limited; for production, configure SMTP under Authentication → Emails

### 14. Deploy the new edge function (Phase 2 #3b)
- [ ] **New**: `invite-portal-user`
- [ ] **Modified**: `ai-anomaly-detection` (now persists rows into `anomaly_runs` after AI parse)
- [ ] **New (Phase 2 #3c)**: `verify-custom-domain` (DNS-checks a customer's custom_domain CNAME)

### 15. Smoke-test the portal end-to-end (Phase 2 #3b)
- [ ] Open a customer's detail page → Branding tab → set `custom_subdomain` (e.g. `acme`) and Save
- [ ] Switch to the **Portal users** tab → Send invite to a real email address (use a throwaway you can check)
- [ ] Confirm the invite email arrives, click the magic link, land on `/portal/acme/login` (signed in)
- [ ] On the portal Dashboard, verify secure score / drift summary / tenant count populate
- [ ] Run AI Anomaly Detection (MSP side) for the customer's tenant — confirm a row in `anomaly_runs`, then refresh the portal **Anomalies** tab and see the run listed

### 16. Apply the custom-domains migration (Phase 2 #3c)
File: `supabase/migrations/20260429140000_custom_domains_and_public_branding.sql`

- [ ] Apply the migration
- [ ] Verify `customers.custom_domain` and `customers.custom_domain_verified_at` columns exist
- [ ] Confirm the function `public.get_portal_branding(text, text)` is callable by the `anon` role (Supabase Studio → Database → Functions). The portal login page uses this to fetch branding pre-auth.

### 17. Wildcard DNS + SSL for portal subdomains (Phase 2 #3c)
The shipping configuration is `<slug>.<your-base-host>` for each customer. You need:

- [ ] **Pick a base host** — e.g. `aegis.io`, `app.aegis.io`, or whatever lives at the MSP app today
- [ ] **DNS**: add a wildcard A/AAAA/CNAME record `*.<base-host>` pointing at the same target as the base host (your Vercel/Netlify/Cloudflare deployment, etc.)
- [ ] **SSL**: ensure your hosting provider issues a wildcard cert for `*.<base-host>` automatically. Vercel, Cloudflare-for-SaaS, and Netlify all handle this via DNS challenge once the wildcard CNAME is in place. For self-hosted setups: add a Let's Encrypt DNS-01 wildcard cert.
- [ ] **Frontend env**: in your hosting provider, set `VITE_PORTAL_BASE_HOST=<base-host>` (no protocol, no path) and redeploy. Without this, host-based portal routing stays disabled and only the `/portal/<slug>` path-prefixed routes work.

### 18. Custom domain target (Phase 2 #3c — only if you offer customer-owned domains)
If MSPs want to give individual customers their own DNS hostname (e.g. `portal.acme.com`):

- [ ] In Supabase edge function secrets, set `CUSTOM_DOMAIN_CNAME_TARGET` = the canonical hostname customers point CNAMEs at (typically your base host or its hosting target). Comma-separate multiple acceptable targets if your hosting platform uses several.
- [ ] (Optional) Set `CUSTOM_DOMAIN_A_TARGETS` for apex-domain support — comma-separated IPv4 addresses, used as a fallback when no CNAME match is found.
- [ ] Deploy the new edge function `verify-custom-domain`.
- [ ] At the hosting provider, configure custom-domain handling so traffic for unmapped hostnames lands on the same app. For Vercel use the "Domains" feature with the "for SaaS" option; for Cloudflare use SaaS Custom Hostnames; for Netlify use Branch Subdomains + custom domains. Each request's `Host` header reaches the SPA, which then calls `get_portal_branding({host})` to identify the customer.

### 19. Test the portal subdomain (Phase 2 #3c)
After items 16-17 are done:

- [ ] Open `https://<your-customer-slug>.<base-host>/login` in an incognito window
- [ ] Confirm the page loads with the customer's branding pre-applied (logo + colors)
- [ ] Sign in with a portal user — should redirect to `/` (not `/portal/<slug>`) on the same host
- [ ] Verify the dashboard / drift / anomalies views all work

### 20. Test a custom domain (Phase 2 #3c — only if item 18 is done)
- [ ] On a customer with a portal user already set up, Branding tab → set Custom domain (e.g. `portal.acme.com`) and Save (clears any prior verification)
- [ ] At your customer's DNS, add CNAME: `portal.acme.com` → `<your CUSTOM_DOMAIN_CNAME_TARGET>`
- [ ] Wait a few minutes, click Verify. On success the portal becomes available at `https://portal.acme.com`
- [ ] Open `https://portal.acme.com/login` and sign in

### 21. Apply the compliance-evidence migration (Phase 2 #4a)
File: `supabase/migrations/20260429150000_compliance_evidence.sql`

- [ ] Apply the migration
- [ ] Verify tables `compliance_frameworks`, `compliance_controls`, `compliance_evidence_runs`, `compliance_evidence_items` exist
- [ ] Verify the HIPAA Security Rule framework + 5 seed controls were inserted (`SELECT * FROM compliance_controls JOIN compliance_frameworks USING…`)

### 22. Deploy the new edge function (Phase 2 #4a)
- [ ] **New**: `collect-compliance-evidence`

This function uses the same Graph credentials path other tenant-targeted functions use (RPC `get_decrypted_credential`); no new env vars to set.

### 23. Smoke-test compliance evidence collection (Phase 2 #4a)
- [ ] Open the MSP app → sidebar → **Security & Compliance** → **Compliance Evidence**
- [ ] Pick framework "HIPAA Security Rule", pick a tenant, click Collect
- [ ] Confirm a run lands in the Recent runs list with PASS/FAIL/N/A counts
- [ ] Click into the run; expand a control to see the captured snapshot JSON

Expected behavior on the seed controls (depends on your tenant's actual config):
- `mfa-required-for-admins`: pass if any enabled CA policy targets Global/Privileged Auth/Security Admin and requires MFA
- `audit-logs-enabled`: pass if `/auditLogs/signIns` returns records (needs `AuditLog.Read.All`)
- `no-shared-account-signin`: pass if no enabled accounts use info@/support@/etc patterns
- `strong-auth-methods-enabled`: pass if FIDO2 / Microsoft Authenticator / Windows Hello are enabled in the auth methods policy
- `no-stale-active-users`: pass if ≤5% of active users (or ≤1) have not signed in for 90+ days

Failures are detailed inline in the snapshot — the JSON gives you the actual data the auditor wants to see.

### 24. Apply the SOC 2 + CMMC seed migration (Phase 2 #4b)
File: `supabase/migrations/20260429160000_compliance_soc2_cmmc_seed.sql`

- [ ] Apply the migration
- [ ] Verify two new framework rows exist: `soc2-tsc` and `cmmc-l2`
- [ ] Verify their controls populate (6 SOC 2 controls + 9 CMMC L2 controls)

### 25. Redeploy the compliance evidence edge function (Phase 2 #4b)
The function file gained three new evaluators (`legacy-auth-blocked`, `guest-restrictions`, `risky-signin-protection`). Redeploy `collect-compliance-evidence`.

- [ ] Redeploy `collect-compliance-evidence`

### 26. Smoke-test SOC 2 + CMMC frameworks (Phase 2 #4b)
- [ ] Compliance Evidence view → switch framework to "SOC 2 — Trust Services Criteria" → Collect against a tenant
- [ ] Switch to "CMMC Level 2" → Collect
- [ ] Confirm both runs produce results across the new evaluator keys

The same tenant snapshots will produce different aggregate counts per framework because each framework asks different questions of the same data — that's the point.

### 27. Apply the compliance schedules migration (Phase 2 #4c)
File: `supabase/migrations/20260429170000_compliance_schedules.sql`

- [ ] Apply the migration
- [ ] Verify tables `scheduled_compliance_configs` + `scheduled_compliance_runs` exist with the expected RLS policies

### 28. Deploy run-scheduled-compliance + register cron (Phase 2 #4c)
- [ ] **New**: deploy `run-scheduled-compliance`
- [ ] In Supabase Dashboard → Database → Cron Jobs (or pg_cron), schedule a recurring HTTP call to `https://<your-project>.supabase.co/functions/v1/run-scheduled-compliance` every 15 minutes (the function checks `last_run_at` against each schedule's cadence, so it's a no-op when nothing is due). Use the service-role key as the auth header.

Example pg_cron entry:
```sql
SELECT cron.schedule(
  'compliance-runner',
  '*/15 * * * *',
  $$ SELECT net.http_post(
       url := '<SUPABASE_URL>/functions/v1/run-scheduled-compliance',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
     ); $$
);
```

### 29. Smoke-test scheduling + downloadable package (Phase 2 #4c)
- [ ] Compliance Evidence → **Schedules** tab → Create schedule (Weekly Mon 09:00, HIPAA, "all tenants")
- [ ] Click ▶ to run it manually; confirm one evidence run per tenant lands in the **On demand** tab
- [ ] Open a recent run, click **Download evidence package**, verify the ZIP contains `cover.pdf`, `manifest.json`, and `controls/<code>.json` files
- [ ] Open the PDF and confirm it shows the control table colored by status

### 30. Apply the marketplace migration (Phase 2 #5)
File: `supabase/migrations/20260429180000_policy_templates_marketplace.sql`

- [ ] Apply the migration
- [ ] Verify tables `marketplace_templates` and `marketplace_template_ratings` exist with their RLS policies
- [ ] Verify the SECURITY DEFINER function `install_marketplace_template(uuid)` is callable by `authenticated`

### 31. Smoke-test the marketplace (Phase 2 #5)
- [ ] Sidebar → Configuration & Policies → **Templates Marketplace**
- [ ] Click **Publish**, paste a small JSON object as `policy_data`, give it a category, hit Publish
- [ ] Refresh the **Browse** tab; the new template should be there
- [ ] Click into the card, hit **Install** — confirm a new entry shows up in your existing Policy Templates view
- [ ] Rate the template; confirm the average updates after a refresh
- [ ] Open the **My publications** tab, click Unpublish — confirm it disappears from Browse but stays in My publications

No new edge functions for #5 — install is a SECURITY DEFINER RPC, ratings + publish are plain RLS-protected inserts.

### 32. Apply the plugin SDK migration (Phase 2 #6)
File: `supabase/migrations/20260429190000_plugin_sdk.sql`

- [ ] Apply the migration
- [ ] Verify tables `plugins` and `plugin_runs` exist with their RLS policies
- [ ] Verify `install_plugin(uuid)` RPC is callable by `authenticated`

### 33. Deploy run-plugin (Phase 2 #6)
- [ ] **New**: deploy `run-plugin`. Reads the existing `AI_GATEWAY_API_KEY` and `AI_GATEWAY_URL` secrets you already configured for the AI features — no new env to set.

### 34. Smoke-test the Plugin SDK (Phase 2 #6)
- [ ] Sidebar → Configuration & Policies → **Plugins** → New plugin
- [ ] Use the seeded sample template (already filled in the editor) — Save
- [ ] Click ▶ Run on the new plugin, fill in `focusArea`, pick a tenant if you enabled "Tenant ctx", hit Run
- [ ] Confirm output appears in the dialog and a new row shows up in the **Run history** tab
- [ ] Toggle the plugin to Public, refresh the **Marketplace** tab, click Install — confirm a clone shows up in **My plugins** with the description tagged "[Installed from marketplace]"

## Done
_Move items here as you complete them so we have a running history._
