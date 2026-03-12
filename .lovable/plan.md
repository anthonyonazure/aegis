

## Plan: Add All Missing M365 Policy Capture

### Summary
Wire up ~20 additional M365 policy types across Exchange, Entra ID, Purview, and Teams using the existing EXO InvokeCommand infrastructure and Graph API endpoints.

### Changes by Area

#### 1. New EXO InvokeCommand Resources
Move these from PowerShell-only (`POWERSHELL_RESOURCE_TYPES`) to EXO REST (`EXO_RESOURCE_TYPES`) since InvokeCommand can fetch them directly without Azure Automation:

| Resource | Cmdlet |
|----------|--------|
| `exchange/transport-rules` | `Get-TransportRule` |
| `exchange/connectors` (split to inbound/outbound) | `Get-InboundConnector` + `Get-OutboundConnector` |
| `exchange/org-config` | `Get-OrganizationConfig` |
| `exchange/owa-policies` | `Get-OwaMailboxPolicy` |
| `exchange/mobile-device-policies` | `Get-MobileDeviceMailboxPolicy` |
| `exchange/dlp-policies` | `Get-DlpCompliancePolicy` |
| `exchange/retention-policies` (new) | `Get-RetentionPolicy` |
| `exchange/accepted-domains` | `Get-AcceptedDomain` (EXO instead of Graph) |

**File: `src/lib/automationApi.ts`** -- Add these to `EXO_RESOURCE_TYPES`, remove from `POWERSHELL_RESOURCE_TYPES`.

**File: `supabase/functions/email-security/index.ts`** -- Add new `exoPolicyActions` entries with cmdlet names and generic mappers for each new resource type.

#### 2. New Graph API Endpoints (Entra ID)
Add these as new subcategories with real Graph endpoints:

| Resource | Graph Endpoint |
|----------|---------------|
| `entra-id/auth-methods-policy` | `/policies/authenticationMethodsPolicy` |
| `entra-id/cross-tenant-access` | `/policies/crossTenantAccessPolicy` |
| `entra-id/permission-grant-policies` | `/policies/permissionGrantPolicies` |

**File: `src/types/tenant.ts`** -- Add subcategories to `entra-id` category.
**File: `supabase/functions/graph-api/index.ts`** -- Add GRAPH_ENDPOINTS entries.

#### 3. Purview via Graph (already partially there)
Sensitivity labels and retention labels already have Graph endpoints. Add:

| Resource | Graph Endpoint |
|----------|---------------|
| `purview/retention-policies` | `/security/triggers/retentionEvents` (beta) |

`purview/dlp-policies` and `purview/insider-risk` stay as PowerShell-only since they require Security & Compliance PowerShell, not EXO InvokeCommand.

#### 4. Teams -- Keep as PowerShell-only
Teams policies (messaging, meeting, calling, etc.) require the `MicrosoftTeams` PowerShell module, **not** EXO InvokeCommand. These stay in `POWERSHELL_RESOURCE_TYPES` and require Azure Automation. No changes needed.

#### 5. Exchange Subcategory Updates
**File: `src/types/tenant.ts`** -- Add `exchange/retention-policies` subcategory with `exoEndpoint`. Update `exchange/accepted-domains` to use `exoEndpoint` instead of `graphEndpoint` for richer data. Remove incorrect `powershellModule` markers from resources now using EXO.

#### 6. Resource Support Logic
**File: `src/lib/resourceSupport.ts`** -- Already handles `exoEndpoint` -- no changes needed.

### Files Modified
1. `src/types/tenant.ts` -- Add new subcategories (Entra auth policies, Exchange retention), update EXO markers
2. `src/lib/automationApi.ts` -- Move Exchange resources from PowerShell to EXO, add new EXO entries
3. `supabase/functions/email-security/index.ts` -- Add ~8 new InvokeCommand action handlers with generic mappers
4. `supabase/functions/graph-api/index.ts` -- Add 3 new Entra ID Graph endpoints, remove placeholder Exchange endpoints that are now EXO
5. `src/lib/permissionsCheck.ts` -- Add permission requirements for new Entra ID resources

### Permissions Needed (Entra App Registration)
- **No new permissions** for EXO resources (already covered by `Exchange.ManageAsApp` + Exchange Administrator role)
- **New Graph permissions**: `Policy.Read.All` (for auth methods + cross-tenant policies), `Policy.ReadWrite.PermissionGrant` (for permission grant policies)

