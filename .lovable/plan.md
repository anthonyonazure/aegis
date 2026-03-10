

# Add Multi-Tenant Selection to Copilot Readiness Features

## Problem
Currently, all Copilot features (Readiness Card, Usage Chart, Licensing Table, and Readiness Advisor) only run against the single focused tenant from `useTenant()`. There's no way to pick specific tenants or run against multiple tenants simultaneously.

## Approach
Create a reusable **TenantMultiSelector** component and integrate it into both the `CopilotReadinessAdvisorView` and `CopilotAgentsView`. Each Copilot feature tab will allow selecting one or more tenants with credentials, then run assessments in parallel showing per-tenant results.

## Files to Create/Modify

### 1. Create `src/components/copilot/TenantMultiSelector.tsx` (new)
A reusable component that:
- Queries `tenant_connections` with `hasCredentials` status (optionally filtered by selected customer)
- Shows checkboxes for each tenant with status indicators
- Has "Select All" / "Clear" actions
- Emits selected tenant IDs via callback
- Can operate in single-select or multi-select mode

### 2. Update `src/components/views/CopilotAgentsView.tsx`
- Replace the current single-tenant gating (`connectionId ? ...`) in each tab (readiness, analytics, licensing) with the `TenantMultiSelector`
- When multiple tenants selected, render a `CopilotReadinessCard` / `CopilotUsageChart` / `CopilotLicensingTable` for each selected tenant
- When single tenant selected, render as today

### 3. Update `src/components/views/CopilotReadinessAdvisorView.tsx`
- Add `TenantMultiSelector` above the `CopilotReadinessAdvisor`
- Pass selected tenants into the advisor so AI analysis covers chosen tenants
- Show per-tenant results when multiple tenants are assessed

### 4. Update `src/components/ai/CopilotReadinessAdvisor.tsx`
- Accept optional `selectedTenants` prop (array of `{id, name, customerId}`)
- When tenants provided, run analysis per-tenant using their actual `tenantConnectionId` instead of mock data
- Call `fetchReadinessAssessment()` per tenant and aggregate results
- Show a comparison/summary view when multiple tenants are assessed

### 5. Update `src/components/copilot/CopilotReadinessCard.tsx`
- No structural changes needed — already accepts `tenantConnectionId` as a prop
- Works correctly when rendered multiple times

## Key Design Decisions
- Reuse existing `tenant_connections` query pattern from `CrossTenantBenchmark`
- Only show tenants with stored credentials (prevents failed assessments)
- Run assessments in parallel with `Promise.allSettled` for multi-tenant
- Show individual results per tenant, not a single merged view

