

# Plan: Expandable Cards with Explanations and Reference Links

## Scope
Apply the same expandable pattern across three sections of the Copilot Readiness Advisor:
1. **Prioritized Actions** (actions tab) -- add `explanation`, `goal`, `referenceUrl`
2. **Governance tab** -- make data governance recommendations, security gaps, and licensing recommendations expandable with explanations and reference links
3. **Risks tab** -- make each risk card expandable with a detailed `explanation` and `referenceUrl`

## Changes

### 1. Edge Function -- Extend AI JSON Schema
**File:** `supabase/functions/ai-copilot-advisor/index.ts`

Add to each relevant schema section:

- **`prioritizedActions`** items: add `explanation` (string), `goal` (string), `referenceUrl` (string -- Microsoft Learn URL)
- **`riskAssessment.risks`** items: add `explanation` (string), `referenceUrl` (string)
- **`dataGovernance.recommendations`**: change from `string[]` to `Array<{ title, explanation, referenceUrl }>` (or add a parallel `detailedRecommendations` array to avoid breaking the simple display)
- **`securityRequirements.gaps`** and **`securityRequirements.recommendations`**: same treatment
- **`licensingAnalysis.optimizationOpportunities`** and **`licensingAnalysis.licensingRecommendations`**: same treatment

Update the system prompt to instruct the AI to always provide a relevant `learn.microsoft.com` link for each item.

### 2. Frontend TypeScript Interface
**File:** `src/components/ai/CopilotReadinessAdvisor.tsx`

Update `CopilotAdvisorAnalysis`:
- `prioritizedActions[].explanation`, `.goal`, `.referenceUrl`
- `riskAssessment.risks[].explanation`, `.referenceUrl`
- `dataGovernance.recommendations` → array of objects with `title`, `explanation`, `referenceUrl`
- `securityRequirements.gaps` and `.recommendations` → same
- `licensingAnalysis` recommendations → same

### 3. Expandable UI Components
**File:** `src/components/ai/CopilotReadinessAdvisor.tsx`

- Add `expandedActions`, `expandedRisks`, `expandedGovItems` state sets
- **Actions tab**: Wrap each action in `Collapsible`, show goal/explanation/reference link on expand with chevron indicator and `ExternalLink` icon for the URL
- **Governance tab**: Each recommendation item becomes a collapsible card showing explanation and reference link
- **Risks tab**: Each risk card gets a `Collapsible` wrapper; expanded state shows `explanation` and reference link below the existing mitigation text

All expanded sections follow the same visual pattern:
- Goal in bold
- Explanation paragraph
- "Learn more" link with `ExternalLink` icon opening in new tab

