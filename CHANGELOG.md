# Changelog

All notable changes to Aegis will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 2 of the original roadmap is complete. Highlights below.

### Added

- **White-label branding per customer** — `brand_name`, `logo_url`, primary/accent colors (HSL), support contacts, and a reserved `custom_subdomain` field on `customers`. `BrandingProvider` swaps CSS vars at `:root` based on the active customer; sidebar logo and page titles flow from `useBranding()`. Email templates pull brand metadata from a `customer_id` parameter.
- **ServiceNow + Jira PSA providers** alongside existing HaloPSA / Autotask / ConnectWise. New `external_project_key` column for Jira; new `ticket_on_anomaly` column for routing AI anomaly findings.
- **AI anomaly detection auto-routing** — webhooks (HMAC-signed, event `anomaly.detected`) and PSA ticket auto-creation for critical/high findings, fan-out via `EdgeRuntime.waitUntil` so the response stays fast.
- **Customer-facing read-only portal** with three layers:
  - `/portal/<slug>/login` and `/portal/<slug>/*` path-prefixed routes
  - Subdomain routing (`<slug>.<base>` when `VITE_PORTAL_BASE_HOST` is set)
  - Custom-domain routing (`portal.acme.com`) with DNS verification via `verify-custom-domain` edge function
  - Email-based portal user invites via `invite-portal-user` (creates auth user + magic link redirected at the portal)
  - Branded shell with portal-scoped Dashboard, Drift, and Anomaly views
  - Provider-tree isolation: `/portal/*` routes don't mount `TenantProvider` / `BrandingProvider`
- **Compliance evidence collection** for **HIPAA Security Rule**, **SOC 2 Trust Services Criteria**, and **CMMC Level 2** — 8 evaluators covering 20 seeded controls. Per-control snapshots are persisted, downloadable as a ZIP package (PDF cover + manifest + per-control JSON), and runnable on a schedule via pg_cron.
- **Public Policy Templates marketplace** — separate `marketplace_templates` table from private `policy_templates`; one-click install via SECURITY DEFINER RPC; 1–5 star ratings with review.
- **Plugin SDK** for community AI workflows — `prompt_template` with `{{variable}}` placeholders, JSON-defined `input_schema`, optional tenant-context auto-injection, public/private flag, install RPC, and a run-history table.
- **Persisted anomaly runs** (`anomaly_runs` table) — `ai-anomaly-detection` now writes a row after every AI parse so the customer portal can show historical findings.
- **Real drift detection in `DriftExplainer`** — replaced hardcoded sample data with a `compute-drift-adhoc` edge function that diffs live Graph state against the most recent export.

### Changed

- **Removed all dependency on the Lovable.dev gateway.** The platform-default AI provider is now any OpenAI-compatible endpoint, configured via `AI_GATEWAY_URL` + `AI_GATEWAY_API_KEY`. The provider id `'lovable'` was renamed to `'gateway'` across schema, code, and seed data.
- **Rebrand from PolicyForge → Aegis** across UI, page titles, email From, README, and metadata.
- **`ChangeImpactAnalyzer`** now passes `tenantConnectionIds: [id]` (plural) so the existing backend live-Graph fetch path actually runs (was a parameter-name mismatch — the AI was predicting impact from an empty config).
- **Dropped `lovable-tagger` Vite plugin** and stale `bun.lock` / `bun.lockb`.

### Fixed

- `AI_GATEWAY_URL` was placed inside an `if (!key) { ... }` guard block in 5 edge functions (`ai-anomaly-detection`, `ai-chat-assistant`, `ai-drift-explainer`, `ai-policy-generator`, `ai-remediation`) so the URL was never reachable on the happy path → ReferenceError at runtime.
- Portal login page couldn't fetch customer branding pre-auth (RLS blocks anonymous reads of `customers`). Added `get_portal_branding(slug, host)` SECURITY DEFINER function granted to `anon` returning only public branding fields.

### Security

- Every new table (`customer_users`, `anomaly_runs`, `compliance_*`, `marketplace_templates`, `marketplace_template_ratings`, `plugins`, `plugin_runs`, `scheduled_compliance_*`) has Row-Level Security enabled and explicit policies for MSP user + portal user (where applicable).
- Custom domain verification is gated behind ownership check on `customers` and only marks domains verified after live DNS resolution.
- Marketplace install + plugin install use SECURITY DEFINER RPCs to atomically clone + bump install counts.

---

## [0.1.0] — Initial public release

The first tagged release will mark the cut between the bootstrap / Lovable migration phase and the open-source codebase. Until then, work happens on `main` and is described under `[Unreleased]` above.

[Unreleased]: https://github.com/your-fork/aegis/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-fork/aegis/releases/tag/v0.1.0
