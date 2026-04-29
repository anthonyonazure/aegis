# Aegis

> **AI-powered Microsoft 365 governance, security, and drift management for MSPs.** Multi-customer, multi-tenant, with AI woven through anomaly detection, policy generation, threat intelligence, drift detection, and incident response.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)
![Multi-LLM](https://img.shields.io/badge/AI-Multi--Provider-9333EA)
![License](https://img.shields.io/badge/License-Proprietary-yellow)

---

## What it is

Most MSP M365 tooling is read-only dashboards or pre-AI scripting platforms. Aegis is built differently: **multi-customer, multi-tenant, AI-augmented across every workflow** that an MSP runs against Microsoft 365.

Designed for the operator running 5–500 customers who needs leverage, not just visibility. Open-source under the MIT license — fork it, run your own instance, or contribute back.

## Capability Surface

### Governance & Configuration
- **Tenant Health** — connection health, API status, license usage across every connected tenant
- **Resource Explorer** — browse and select M365 resources across 11 categories (Intune, Conditional Access, Entra ID, Exchange, SharePoint, Teams, etc.)
- **Export Configuration** — tenant settings exported to JSON / Terraform / Bicep / PowerShell.
- **Import & Restore** — restore configurations from previous exports or migrate between tenants
- **Policy Templates** — reusable policy definitions for consistent deployments across customers
- **Customer Management** — group multiple tenants under MSP customers; org chart, contacts, PSA ticket links

### Intune Management
- **Intune Manager** — centralized device, app, policy, and configuration management across tenants
- **DUDE Sync** — auto-tag Microsoft Defender devices based on user-group membership (Microsoft Graph only)

### Threat Intelligence
- **MISP Browser** — local threat intel browser with curated ATT&CK techniques, IOCs, threat actor profiles, OSINT feeds
- **Hawk Forensics** — incident forensics workflow leveraging Microsoft Hawk
- **Reference Catalog** — 38 ATT&CK Techniques, 20 Galaxy Clusters, 14 OSINT Feeds, 4 Taxonomies built in

### Email Security
- **Email Security** — outbound + inbound posture monitoring, transport rule audit

### Tenant Health & AI
- **Health Dashboard** — cross-tenant health overview
- **Tenant Analyzer** *(AI)* — natural-language Q&A across tenant configurations
- **Secure Score** — Microsoft Secure Score tracked over time per tenant
- **Security Predictor** *(AI)* — predicts likely security incidents from current posture
- **Security Benchmark** *(AI)* — benchmarks tenant against industry baselines

### AI Workflows (the differentiator)
- **AI Query** — natural-language query across all connected tenants
- **AI Chat** — conversational interface to your tenant data
- **Cross-Tenant Insights** *(AI)* — patterns and anomalies across the customer book
- **Policy Generator** *(AI)* — generate Conditional Access, Intune compliance, and configuration policies from natural-language requirements
- **Remediation Scripts** *(AI)* — generate PowerShell / Graph remediation for detected issues
- **Change Impact** *(AI)* — predict downstream impact of proposed policy changes before applying
- **Anomaly Detection** *(AI)* — scan tenants for anomalous sign-ins, configuration changes, permission grants
- **Incident Responder** *(AI)* — guided incident response with Graph-based evidence collection
- **User Risk Profiler** *(AI)* — risk-score users based on sign-in behavior, app consent, group membership
- **Drift Detection** + **Drift Explainer** *(AI)* — detect and explain configuration drift between baseline and current state
- **Validation** — validate tenant state against compliance baselines before deployment

### Multi-LLM Provider Support
Aegis supports multiple AI providers — bring-your-own-key for Anthropic Claude, OpenAI, Azure OpenAI, Google Gemini, plus a built-in default option. Choose providers per workflow.

## Screenshots

| Threat Intelligence | AI Anomaly Detection |
|---|---|
| ![Threat Intel](docs/screenshots/threat-intel.png) | ![Anomaly](docs/screenshots/anomaly-detection.png) |

The MISP-inspired Threat Intelligence browser ships with **38 ATT&CK techniques, 15 threat actors, 20 IOC entries, 20 galaxy clusters, 14 OSINT feeds, and 4 taxonomies** as the seed reference catalog. AI Anomaly Detection scans tenants for anomalous sign-ins, configuration changes, and permission grants — multi-tenant aware.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS, shadcn/ui |
| State | TanStack React Query |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions) |
| M365 integration | Microsoft Graph API (Intune, Entra, Exchange, SharePoint, Teams) |
| AI providers | Multi-provider (Anthropic, OpenAI, Azure OpenAI, Gemini, built-in) |
| PSA integration | HaloPSA · Autotask · ConnectWise · ServiceNow · Jira |
| Threat intel | MISP-format ingestion |
| Routing | react-router-dom v6 |

## Quick Start

```bash
git clone https://github.com/<your-fork>/aegis.git
cd aegis

npm install
cp .env.example .env    # fill in Supabase URL + publishable key
npm run dev             # http://localhost:8080
```

### Prerequisites

- A **Supabase project** (cloud or self-hosted). Free tier works for evaluation.
- **Supabase CLI** installed and logged in (`supabase login`).
- An **Azure app registration** with Microsoft Graph API permissions for the modules you intend to enable. Required permissions vary by feature; the in-app **Permissions Reference** view lists them.
- **API key for at least one AI provider** (OpenAI, Anthropic, Google, Azure OpenAI, OpenRouter, etc.) for the AI features.

### Required environment variables

**Frontend (`.env`):**
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://abc.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `anon` / publishable key from Project Settings → API |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (used for diagnostics only) |
| `VITE_PORTAL_BASE_HOST` | *(optional)* Base host for the customer portal (e.g. `aegis.io`). Without this, only path-based portal routing works. |

**Supabase edge function secrets** (Project Settings → Edge Functions → Manage secrets):
| Variable | Description |
|---|---|
| `AI_GATEWAY_API_KEY` | API key for the built-in AI gateway |
| `AI_GATEWAY_URL` | Base URL for an OpenAI-compatible chat-completions endpoint (e.g. `https://api.openai.com/v1`) |
| `RESEND_API_KEY` | *(optional)* For outbound notification emails |
| `CUSTOM_DOMAIN_CNAME_TARGET` | *(optional)* For customer-owned portal domains (Phase 2 #3c) |
| `CUSTOM_DOMAIN_A_TARGETS` | *(optional)* Apex-domain fallback for the above |

Users can also bring their own provider keys via the in-app AI Provider Settings (BYOK).

### Deploying

After `supabase login` + `supabase link --project-ref <your-project-ref>`:

```powershell
# Windows
.\scripts\deploy-aegis.ps1
```
```bash
# macOS / WSL / Git Bash
./scripts/deploy-aegis.sh
```

This runs every database migration and deploys every edge function in order. Then paste `scripts/post-deploy.sql` into the Supabase SQL editor (after editing the placeholder URL + service-role key) to register the compliance cron job. See [HANDOFF.md](./HANDOFF.md) for the full deployment runbook including DNS / SSL setup for the customer portal.

## Project Structure

```
src/
  components/
    ai/                    AI provider settings, AI chat, prompt templates
    views/                 Major view components per feature module
    ...
  pages/                   Top-level routes
  integrations/            Graph API, AI providers, Supabase, DUDE/PSA
  hooks/, lib/, types/
supabase/
  migrations/              Schema for customers, tenants, policies, exports, audit
  functions/               Edge functions (Graph proxies, AI calls, scheduled scans)
docs/
  initial-plan.md          Product spec history
  screenshots/             Capture targets
```

## Roadmap

Implemented (Phase 2 of original roadmap):

- [x] White-label per-MSP branding
- [x] Webhook → ServiceNow / Jira / ConnectWise on detected anomalies
- [x] Customer-facing read-only portal (subdomain + custom-domain routing, branded per customer)
- [x] Automated CMMC / HIPAA / SOC 2 evidence collection with downloadable audit packages and scheduling
- [x] Public marketplace for shared Policy Templates across MSPs
- [x] Plugin SDK for community-contributed AI workflows

Open ideas:

- [ ] Additional compliance frameworks (NIST SP 800-53, ISO 27001, PCI DSS)
- [ ] More evaluator coverage per existing framework
- [ ] AI-generated narrative explanations on evidence packages
- [ ] Slack / Teams app surfaces for the customer portal

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding conventions, and the PR process. Please report security issues per [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) — see the LICENSE file for full terms.
