
# Implementation Plan: Enhanced Export Naming & Cross-Tenant Policy Import

## Overview

This plan addresses two key features:
1. **Smart Export Naming**: Include customer/tenant name along with date and time in export filenames
2. **Cross-Tenant Policy Import**: Upload policies from one tenant to deploy to another tenant (e.g., export custom CA policies from your master tenant and deploy them to your clients)

---

## Part 1: Enhanced Export Naming

### Current Behavior
- Policy Browser exports: `m365-policies-YYYY-MM-DD.zip`
- Full exports (Jobs): `m365-export-YYYY-MM-DD.zip`

### New Naming Convention
```
{CustomerName}_{TenantName}_{YYYY-MM-DD}_{HH-mm-ss}.zip
```

**Examples:**
- `Contoso_Production-Tenant_2026-01-28_14-30-45.zip`
- `Acme-Corp_Dev-Environment_2026-01-28_09-15-22.zip`

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/views/PolicyBrowserView.tsx` | Update filename generation to include tenant/customer name and time |
| `src/lib/exportUtils.ts` | Update `downloadExportAsZip` to include source info in filename |
| `src/lib/saveFile.ts` | Add utility function to sanitize filenames |

### Implementation Details

**1. Create filename sanitization utility** (`src/lib/saveFile.ts`):
```typescript
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

export function buildExportFilename(
  customerName?: string,
  tenantName?: string,
  prefix = 'm365-export'
): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  const parts = [prefix];
  if (customerName) parts.push(sanitizeFilename(customerName));
  if (tenantName) parts.push(sanitizeFilename(tenantName));
  parts.push(`${date}_${time}`);
  
  return `${parts.join('_')}.zip`;
}
```

**2. Update PolicyBrowserView.tsx**:
- Extract customer name from loaded export source or current context
- Pass customer/tenant info to filename builder
- Update both bulk export and single-file export functions

**3. Update exportUtils.ts**:
- Fetch customer/tenant names from the export job's tenant connection
- Use new naming convention for ZIP downloads

---

## Part 2: Cross-Tenant Policy Import from Policy Browser

### User Flow

```text
                                    +-----------------------+
                                    |  Policy Browser View  |
                                    +-----------------------+
                                              |
                    +-------------------------+-------------------------+
                    |                                                   |
           [Load from Live Tenant]                           [Load from Export Job]
                    |                                                   |
                    v                                                   v
           Select policies to export                         Select policies to import
                    |                                                   |
                    +-----------------> [Select Policies] <-------------+
                                              |
                    +-------------------------+-------------------------+
                    |                                                   |
            [Export to Disk]                                  [Deploy to Tenant]
                    |                                                   |
                    v                                                   v
            Save ZIP file                               +---------------------------+
                                                        | Select Target Tenant      |
                                                        | (from different customer) |
                                                        +---------------------------+
                                                                    |
                                                                    v
                                                        +---------------------------+
                                                        | Preview Changes           |
                                                        | - What will be created    |
                                                        | - What already exists     |
                                                        +---------------------------+
                                                                    |
                                                                    v
                                                        +---------------------------+
                                                        | Confirm & Deploy          |
                                                        +---------------------------+
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/views/PolicyBrowserView.tsx` | Modify | Add "Deploy to Tenant" button and flow |
| `src/components/PolicyDeployDialog.tsx` | Create | Dialog for selecting target tenant and previewing deployment |
| `src/lib/policyDeployment.ts` | Create | Client-side logic for policy deployment |
| `supabase/functions/deploy-policy/index.ts` | Modify | Add support for bulk CA policy deployment |

### Implementation Details

**1. Add Deploy Button to Policy Browser** (`PolicyBrowserView.tsx`):
- New "Deploy to Tenant" button next to "Export" button
- Only enabled when policies are selected
- Opens deployment dialog

**2. Create PolicyDeployDialog Component**:
```typescript
interface PolicyDeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPolicies: Map<string, PolicyItem>;
  sourceInfo: {
    tenantName?: string;
    customerName?: string;
  };
}
```

**Dialog Features:**
- **Target Tenant Selector**: Dropdown showing all connected tenants grouped by customer
- **Cross-tenant warning**: Visual indicator when deploying across customers
- **Dry Run Preview**: Shows what will be created vs. what already exists
- **Deployment Options**:
  - Skip existing (only create new)
  - Overwrite existing
  - Rename duplicates (append suffix)
- **Progress indicator**: Real-time deployment progress

**3. Create policyDeployment.ts utility**:
```typescript
export interface DeploymentTarget {
  tenantConnectionId: string;
  tenantName: string;
  customerName?: string;
}

export interface DeploymentOptions {
  skipExisting: boolean;
  overwriteExisting: boolean;
  renameDuplicates: boolean;
  dryRun: boolean;
}

export interface DeploymentResult {
  success: boolean;
  created: number;
  skipped: number;
  updated: number;
  failed: number;
  errors: string[];
  changes: PolicyChange[];
}

export async function deployPoliciesToTenant(
  policies: PolicyItem[],
  targetTenantConnectionId: string,
  options: DeploymentOptions
): Promise<DeploymentResult>
```

**4. Update deploy-policy edge function**:
- Add new action type for bulk policy import: `action: 'import-policies'`
- Accept array of policy data with resource types
- Support dry-run mode for preview
- Return detailed change list

### Database Considerations
- No new tables required
- Reuse existing `policy_deployments` and `deployment_results` tables for tracking
- Add `source_tenant_connection_id` to metadata for cross-tenant audit trail

---

## Technical Details

### Supported Policy Types for Cross-Tenant Import
Based on the existing `graph-api` edge function, these resource types support import:

| Category | Resource Type | Import Support |
|----------|---------------|----------------|
| Conditional Access | CA Policies | Yes |
| Conditional Access | Named Locations | Yes |
| Intune | Device Configurations | Yes |
| Intune | Compliance Policies | Yes |
| Intune | Autopilot Profiles | Yes |
| Intune | PowerShell Scripts | Yes |
| Entra ID | Groups | Yes |
| Entra ID | Admin Units | Yes |
| Entra ID | App Registrations | Yes |

### Security Considerations
- Validate user has access to both source and target tenants
- Store source tenant info in deployment audit log
- Verify credentials exist for target tenant before deployment
- Remove tenant-specific IDs and read-only properties before import

### UI/UX Considerations
- Clear visual distinction between "Export to Disk" and "Deploy to Tenant"
- Cross-tenant warnings with customer/tenant names prominently displayed
- Confirmation dialogs with policy counts and target information
- Progress feedback during deployment

---

## Implementation Order

1. **Phase 1: Export Naming** (simpler, foundational)
   - Add filename utilities to `saveFile.ts`
   - Update PolicyBrowserView export naming
   - Update exportUtils download naming

2. **Phase 2: Cross-Tenant Deploy UI**
   - Create PolicyDeployDialog component
   - Add "Deploy to Tenant" button to PolicyBrowserView
   - Implement target tenant selector with customer grouping

3. **Phase 3: Deployment Backend**
   - Create policyDeployment.ts utility
   - Update deploy-policy edge function for bulk imports
   - Add dry-run preview capability

4. **Phase 4: Testing & Polish**
   - Test cross-tenant CA policy deployment flow
   - Add error handling and edge cases
   - Polish UI feedback and confirmations

---

## Summary

This implementation will allow you to:
1. **Export with meaningful names** like `Contoso_Prod-Tenant_2026-01-28_14-30-45.zip`
2. **Deploy your master CA policies** to any connected client tenant
3. **Preview changes** before deployment with dry-run mode
4. **Track cross-tenant deployments** in the audit log
