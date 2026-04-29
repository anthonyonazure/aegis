# Security policy

## Supported versions

Aegis is under active development. Security fixes land on `main`; there are no LTS branches at this time.

## Reporting a vulnerability

**Please don't open a public GitHub issue for security vulnerabilities.**

Instead, send a report by creating a private security advisory on GitHub:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Include:
   - Affected component (frontend, an edge function name, a migration, etc.)
   - Steps to reproduce
   - Impact (data exposure, privilege escalation, RCE, etc.)
   - Any proof-of-concept code or HTTP requests you ran
   - Whether the issue affects an unmodified deployment or only specific configurations

We aim to respond within **5 business days** and to ship a fix or mitigation within **30 days** of triage, depending on severity. We'll credit you in the release notes if you'd like.

## Scope

In scope:

- The Aegis codebase (frontend, edge functions, migrations)
- The default deployment configuration (Supabase + the documented env vars)
- Authentication / authorization issues, data exposure across customers, escalation between MSP and portal-user roles, RLS bypasses

Out of scope:

- Vulnerabilities in third-party dependencies — please report those directly to the upstream maintainer (we'll bump the dep when patched)
- Issues that require already-compromised credentials (a rogue MSP can hurt their own customers; that's a feature of the trust model, not a vulnerability)
- DoS via expensive queries to AI providers or Microsoft Graph — those are throttled by the providers themselves
- Issues only reproducible by modifying the source code

## Hardening recommendations for operators

If you self-host Aegis, please:

1. **Set `verify_jwt = true` on edge functions where possible.** Some functions intentionally use service-role auth (cron-triggered runners); read the function header comments.
2. **Enable Row-Level Security on every table you add.** Aegis ships with RLS on every new table; don't disable it.
3. **Rotate `AI_GATEWAY_API_KEY` periodically** and after any suspected compromise.
4. **Restrict `auth.users` admin invites** to your MSP-admin email domain.
5. **Configure SMTP for auth** — rate-limited default Supabase email is fine for testing but not production.
6. **Run `supabase db lint`** before applying migrations to catch any policy gaps.
7. **Audit `customer_users` regularly** — these grant cross-account access into the portal.
