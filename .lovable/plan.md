

# Add Microsoft Learn-Based Copilot Readiness Checks

## What's Missing

Based on Microsoft's official documentation, the current readiness assessment is missing several critical checks. Here's what needs to be added:

### New Checks from Microsoft Learn

| Check | Source | Current Status |
|-------|--------|----------------|
| **Exchange Online Mailbox** | Minimum requirements | Not checked |
| **Update Channel** (Current/Monthly Enterprise, NOT Semi-Annual) | Setup guide | Not checked |
| **Connected Experiences / Privacy Settings** | App requirements | Not checked |
| **MFA Enabled** | Security measures | Not checked |
| **Conditional Access Policies** | Readiness activities | Not checked |
| **OneDrive Provisioned** | App requirements | Not checked |
| **Teams Transcription/Recording** (for Copilot in Teams) | App requirements | Not checked |
| **Teams Phone + PSTN License** (for Copilot Voice) | App requirements | Not checked |
| **Loop Enabled** | App requirements | Not checked |
| **WebSocket (WSS) Endpoints** (`*.cloud.microsoft`, `*.office.com`) | Network requirements | Hardcoded as "ready" |
| **SharePoint Governance / Oversharing** | Setup guide | Not checked |
| **Purview Sensitivity Labels** | Setup guide | Partially checked |
| **Audit Logging Enabled** | Security measures | Not checked |
| **Entra ID Accounts** | Minimum requirements | Not checked |
| **Third-Party Cookies** (for Web apps) | App requirements | Not checked |
| **Office Feature Updates Task** | App requirements | Not checked |

## Implementation Plan

### 1. Expand the Edge Function (`fetch-copilot-data/index.ts`)

Add new Graph API checks inside `performReadinessCheck`:

- **MFA check**: Query `GET /reports/authenticationMethods/usersRegisteredByMethod` or conditional access policies
- **Conditional Access**: `GET /identity/conditionalAccess/policies` - count active policies
- **Exchange Online mailbox**: `GET /users?$select=mailboxSettings` to verify mailbox hosted on EXO
- **OneDrive provisioned**: `GET /users?$select=mySite` or check OneDrive provisioning
- **Teams config**: `GET /teamwork/teamsAppSettings` for transcription/recording settings
- **Audit logging**: `GET /security/auditLog/queries` (beta) to check if enabled
- **SharePoint oversharing**: `GET /sites?$select=sharingCapability` for sharing policy review
- **Loop enabled**: Check via admin settings or org settings endpoint

Restructure the scoring from 5 categories to 8:
1. Licensing (weight: 15)
2. Identity & Access (MFA, Conditional Access, Entra ID) (weight: 15)
3. Exchange & Mailbox (weight: 10)
4. Data Governance (Sensitivity Labels, DLP, Purview) (weight: 15)
5. SharePoint & OneDrive (provisioning, oversharing) (weight: 10)
6. Teams & Voice (transcription, Teams Phone, PSTN) (weight: 10)
7. Apps & Update Channel (Current/Monthly channel, Loop, Connected Experiences) (weight: 10)
8. Network (WSS endpoints, `*.cloud.microsoft`) (weight: 15)

### 2. Update the `ReadinessAssessment` Interface (`copilotApi.ts`)

Add new category fields to match the expanded checks.

### 3. Update `CopilotReadinessCard.tsx`

Add new readiness items for each new check category with appropriate icons.

### 4. Update AI Advisor Edge Function (`ai-copilot-advisor/index.ts`)

Update the system prompt to reference the specific Microsoft Learn requirements so AI recommendations are grounded in official documentation.

### 5. Files to Modify

- `supabase/functions/fetch-copilot-data/index.ts` - Add 8+ new Graph API checks
- `src/lib/copilotApi.ts` - Expand `ReadinessAssessment` interface
- `src/components/copilot/CopilotReadinessCard.tsx` - Display new check categories
- `supabase/functions/ai-copilot-advisor/index.ts` - Update prompts with official requirements

