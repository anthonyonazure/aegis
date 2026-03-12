

# Email Security & Domain Protection Feature

## Overview
Add a new top-level "Email Security" view (similar to the Intune Manager pattern) with its own sidebar and sections covering EOP/Defender for Office 365 policies, email authentication (SPF/DKIM/DMARC), and AI-powered recommendations.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│  Sidebar nav: "Email Security" (Mail icon)          │
├─────────────────────────────────────────────────────┤
│  EmailSecurityView (like IntuneView)                │
│  ┌──────────┬──────────────────────────────────────┐│
│  │ Internal │  Section content                     ││
│  │ sidebar  │                                      ││
│  │          │  • Overview dashboard                ││
│  │          │  • Anti-Phishing policies            ││
│  │          │  • Anti-Spam policies                ││
│  │          │  • Anti-Malware policies             ││
│  │          │  • Safe Links                        ││
│  │          │  • Safe Attachments                  ││
│  │          │  • Domain Auth (SPF/DKIM/DMARC)      ││
│  │          │  • AI Recommendations                ││
│  └──────────┴──────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## New Files

### 1. Edge Function: `supabase/functions/email-security/index.ts`
- Accepts `tenantConnectionId` and `action` (e.g. `fetch-eop-policies`, `fetch-domain-auth`)
- Retrieves credentials via `get_decrypted_credential`
- Queries Exchange Online Security endpoints via Microsoft Graph & Security API:
  - `/security/threatIntelligence` for EOP policy data
  - `/domains` for SPF/DKIM/DMARC verification (reads DNS TXT records via domain metadata)
  - `/admin/exchangeOnlineProtection` (beta) for anti-phishing/spam/malware
- For policies not available via Graph (most EOP policies require PowerShell), fetches what's available and supplements with an AI analysis call to provide recommendations based on domain config
- AI recommendations endpoint: sends collected domain/policy data to Lovable AI (`google/gemini-3-flash-preview`) for actionable hardening advice

### 2. Types: `src/components/email-security/EmailSecurityTypes.ts`
- `EmailSecuritySectionId` union type (overview, anti-phishing, anti-spam, anti-malware, safe-links, safe-attachments, domain-auth, recommendations)
- Interfaces for policy objects and domain auth results

### 3. Hook: `src/hooks/useEmailSecurityData.ts`
- Similar to `useIntuneData` — calls `email-security` edge function with tenant connection context
- Accepts `action` param to fetch different policy types

### 4. Sidebar: `src/components/email-security/EmailSecuritySidebar.tsx`
- Internal sidebar with collapsible groups (mirrors `IntuneSidebar` pattern)
- Groups: Overview, Protection Policies (anti-phishing/spam/malware), Advanced Protection (Safe Links/Attachments), Domain Security (SPF/DKIM/DMARC), AI Recommendations

### 5. Sections (one file each in `src/components/email-security/sections/`):
- **OverviewSection.tsx** — Summary cards: policy counts, domain auth status, protection coverage score
- **AntiPhishingSection.tsx** — Lists anti-phishing policies with impersonation protection settings
- **AntiSpamSection.tsx** — Inbound/outbound spam filter policies, allowed/blocked senders
- **AntiMalwareSection.tsx** — Malware filter policies, file type filters, ZAP settings
- **SafeLinksSection.tsx** — Safe Links policies with URL scanning/detonation settings
- **SafeAttachmentsSection.tsx** — Safe Attachments policies with dynamic delivery settings
- **DomainAuthSection.tsx** — Per-domain SPF, DKIM, DMARC status with pass/fail indicators; fetches domain list from `/domains` and checks DNS config
- **RecommendationsSection.tsx** — AI-powered analysis using collected policy + domain data; calls edge function with all gathered config to generate prioritized recommendations

### 6. View: `src/components/views/EmailSecurityView.tsx`
- Wraps `EmailSecuritySidebar` + section rendering (same pattern as `IntuneView`)

### 7. Wiring
- Add `'email-security'` to `IntuneSectionId`-equivalent type
- Add sidebar nav item under a new "Email Security" group in `Sidebar.tsx` (with `Mail` icon)
- Register in `Index.tsx` SIMPLE_VIEWS map
- Add `email-security` edge function config to `supabase/config.toml` with `verify_jwt = false`
- Add Graph endpoint mappings in `graph-api/index.ts` for any EOP-specific resources needed

## Graph API Endpoints Used
| Feature | Endpoint | Notes |
|---------|----------|-------|
| Domains | `/domains` | Lists verified domains |
| Domain DNS | `/domains/{id}/serviceConfigurationRecords` | SPF/DKIM records |
| Threat policies | `/security/threatIntelligence/hostComponents` | Available threat data |
| EOP policies | Exchange Online Security & Compliance APIs (beta) | Limited Graph support — supplement with AI |

## Data Flow
1. User navigates to Email Security view
2. Component calls `email-security` edge function with `tenantConnectionId`
3. Edge function decrypts credentials → gets Graph token → fetches domain + policy data
4. Returns structured results to frontend sections
5. Recommendations section aggregates all fetched data and sends to AI for analysis

## Key Decisions
- EOP/Defender for Office 365 policies have **limited Graph API coverage** — many settings require PowerShell. The implementation will fetch what's available via Graph and clearly indicate which settings require PowerShell/admin center review.
- The AI Recommendations section compensates by analyzing available config and providing specific hardening guidance.
- Uses the established `TenantMultiSelector` pattern — the view accepts `selectedTenants` from global context.

