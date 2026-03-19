

# Features Wired Up But Not Fully Implemented

After reviewing the codebase, here are the areas that have UI/routing but lack real backend implementation:

## 1. Git Integration — "Push to Git" (GitView.tsx)
- **What works:** Config form saves repo URL, branch, commit message template, CI/CD pipeline template copy
- **What doesn't:** The "Push to Git" button is permanently disabled (`disabled={!repoUrl || !selectedExportJob}`) and has **no onClick handler** — there is no edge function or API to actually push exports to a Git repository. It's purely UI.

## 2. Copilot Agents View (CopilotAgentsView.tsx)
- **What works:** Attempts to fetch from Graph API via export job
- **What doesn't:** Falls back to **hardcoded mock data** (`getMockAgents()`, `getMockPolicies()`) on any error or missing data. The policies tab always shows mock data (`setPolicies(getMockPolicies())` is called unconditionally). Cross-tenant status data is also mocked.

## 3. Governance Center — Partial Live Data (GovernanceCenterView.tsx)
- **What works:** Tenant health, compliance scores, billing data from DB
- **What doesn't:** Several stats are hardcoded to `0`: `avgSecureScore`, `activeAlerts`, `adminUsers`, `guestUsers`, `mfaEnabled`, `riskyUsers`. License breakdown (`licensesByProduct`) is always an empty array. These could be populated from Graph API but aren't wired.

## 4. AppDeploy & Remediation — "Deploy to Tenant" Buttons
- Both **AppDeploySection** and **RemediationSection** have "Deploy to Tenant" buttons that only show a **toast notification** ("Coming soon" / placeholder). No actual Graph API call to `POST /deviceManagement/deviceHealthScripts` or Win32 app creation is implemented.

## 5. Email Security — Several Sections
- The edge function (`email-security`) handles some actions, but the **SetupGuideSection** had a wrong action name (just fixed). Other sections like Anti-Malware, Anti-Phishing, Anti-Spam, Safe Links, Safe Attachments fetch data but their **remediation/fix actions** (if any) are likely UI-only without write-back capability.

---

## Recommendation

The highest-impact items to implement would be:

| Priority | Feature | Effort |
|----------|---------|--------|
| 1 | Deploy to Tenant for Remediation scripts | Medium — POST to `/deviceManagement/deviceHealthScripts` via existing `graph-api` function |
| 2 | Deploy to Tenant for AppDeploy templates | Medium — similar pattern, POST Win32 app metadata |
| 3 | Copilot Agents — remove mock fallback | Low — just remove mock data, show empty state instead |
| 4 | Git Push — implement actual push | High — needs a new edge function for Git API (GitHub/Azure DevOps) |
| 5 | Governance Center live stats | Medium — add Graph API calls for user/license/risk counts |

Would you like me to implement any of these?

