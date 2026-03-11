

# Plan: Add TenantMultiSelector to All AI Views

## Problem
Only 2 out of 17 AI views have a `TenantMultiSelector` (Copilot Readiness Advisor and Copilot Agents). The remaining 15 AI views have no tenant selection UI at all -- they either use the globally focused tenant silently or ignore tenant context entirely.

## AI Views Missing Tenant Selection (15 total)

**Should support multi-tenant selection:**
1. **TenantAnalyzerView** -- analyze multiple tenants side-by-side
2. **ComplianceAdvisorView** -- compare compliance across tenants
3. **SecurityBenchmarkView** -- benchmark multiple tenants
4. **SecurityPredictorView** -- predict risks across tenants
5. **CrossTenantInsightsView** -- already multi-tenant by nature, but uses hardcoded fake tenants instead of letting user pick
6. **AnomalyDetectionView** -- scan multiple tenants for anomalies
7. **CostPredictorView** -- forecast costs across tenants
8. **ExecutiveReportView** -- generate reports spanning tenants
9. **LicenseOptimizerView** -- optimize licenses across tenants
10. **ConfigOptimizerView** -- compare configs across tenants
11. **IncidentResponderView** -- respond to incidents per tenant

**Single-tenant selection (task is tenant-specific):**
12. **UserRiskProfilerView** -- profile a user in one tenant
13. **DriftExplainerView** -- explain drift for one tenant
14. **MigrationPlannerView** -- plan migration between two tenants (source/target)
15. **ChangeImpactView** -- assess impact on one tenant
16. **PolicyGeneratorView** -- generate policy for one tenant
17. **RemediationScriptsView** -- generate scripts for one tenant
18. **NaturalLanguageQueryView** -- query one tenant's data

## Changes

### 1. Update each View file to add TenantMultiSelector
For each of the 15 views listed above:
- Import `TenantMultiSelector` and `SelectedTenantInfo`
- Add `selectedTenants` state
- Render `TenantMultiSelector` between the header and the AI component
- Pass `selectedTenants` as a prop to the child AI component
- Use `multiSelect={true}` for multi-tenant views, `multiSelect={false}` for single-tenant views

### 2. Update each AI component to accept `selectedTenants` prop
Each AI component (e.g. `TenantAnalyzerFull`, `ComplianceAdvisorFull`, `SecurityBenchmark`, etc.) needs:
- Add `selectedTenants?: SelectedTenantInfo[]` to its props interface
- When `selectedTenants` is provided and non-empty, use those tenant IDs for the analysis instead of the globally focused tenant
- This is a prop addition only -- existing behavior (using focused tenant) remains the default when no tenants are explicitly selected

### Files to edit (18 view files + 15 AI component files = 33 files)

**View files** -- add TenantMultiSelector UI:
`TenantAnalyzerView`, `ComplianceAdvisorView`, `SecurityBenchmarkView`, `SecurityPredictorView`, `CrossTenantInsightsView`, `AnomalyDetectionView`, `CostPredictorView`, `ExecutiveReportView`, `LicenseOptimizerView`, `ConfigOptimizerView`, `IncidentResponderView`, `UserRiskProfilerView`, `DriftExplainerView`, `MigrationPlannerView`, `ChangeImpactView`, `PolicyGeneratorView`, `RemediationScriptsView`, `NaturalLanguageQueryView`

**AI component files** -- accept selectedTenants prop:
`TenantAnalyzerFull`, `ComplianceAdvisorFull`, `SecurityBenchmark`, `SecurityPosturePredictor`, `CrossTenantInsights`, `AnomalyDetector`, `CostPredictor`, `ExecutiveReportGenerator`, `LicenseOptimizer`, `ConfigOptimizer`, `IncidentResponder`, `UserRiskProfiler`, `DriftExplainer`, `MigrationPlanner`, `ChangeImpactAnalyzer`, `PolicyGenerator`, `RemediationScriptGenerator`, `NaturalLanguageQuery`

Given the scope (33 files), this will be implemented in batches.

