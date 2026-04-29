# Aegis — Manual Follow-Ups

Things I (Claude) cannot do from the dev shell that you, Anthony, need to do in Supabase / external services. Cross items off as you complete them.

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

### 15. Smoke-test the portal end-to-end (Phase 2 #3b)
- [ ] Open a customer's detail page → Branding tab → set `custom_subdomain` (e.g. `acme`) and Save
- [ ] Switch to the **Portal users** tab → Send invite to a real email address (use a throwaway you can check)
- [ ] Confirm the invite email arrives, click the magic link, land on `/portal/acme/login` (signed in)
- [ ] On the portal Dashboard, verify secure score / drift summary / tenant count populate
- [ ] Run AI Anomaly Detection (MSP side) for the customer's tenant — confirm a row in `anomaly_runs`, then refresh the portal **Anomalies** tab and see the run listed

## Done
_Move items here as you complete them so we have a running history._
