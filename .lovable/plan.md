# Performance Optimization Plan

## Problem Summary
The application experiences sluggishness during tenant/policy operations due to:
1. N+1 query pattern in credential checks
2. Redundant API calls from frequent re-renders
3. No caching layer for tenant/customer data
4. Large policy payloads causing UI freezes

---

## Phase 1: Batch Credential Checks ✅ PRIORITY
**File:** `src/lib/database.ts` + `src/contexts/TenantContext.tsx`

### Current Problem
```typescript
// Sequential N+1 queries - BAD
for (const tenant of connectedTenants) {
  tenant.hasCredentials = await hasStoredCredentials(tenant.id);
}
```

### Solution
Create a batch query function:
```typescript
export async function batchCheckCredentials(connectionIds: string[]): Promise<Record<string, boolean>> {
  if (connectionIds.length === 0) return {};
  
  const { data } = await supabase
    .from('tenant_credentials')
    .select('tenant_connection_id')
    .in('tenant_connection_id', connectionIds);
  
  return connectionIds.reduce((acc, id) => {
    acc[id] = data?.some(c => c.tenant_connection_id === id) ?? false;
    return acc;
  }, {} as Record<string, boolean>);
}
```

### Tasks
- [ ] Add `batchCheckCredentials` function to `src/lib/database.ts`
- [ ] Update `loadCustomersAndTenants` in TenantContext to use batch function
- [ ] Remove sequential for-loop

---

## Phase 2: React Query Caching
**New Files:**
- `src/hooks/useTenantData.ts`
- `src/hooks/useCustomerData.ts`

### Solution
Extract data fetching into dedicated React Query hooks with caching:

```typescript
// src/hooks/useTenantData.ts
export function useTenantConnections() {
  return useQuery({
    queryKey: ['tenant-connections'],
    queryFn: async () => {
      const tenants = await getTenantConnections();
      const connectedIds = tenants
        .filter(t => t.status === 'connected')
        .map(t => t.id);
      const credentials = await batchCheckCredentials(connectedIds);
      return tenants.map(t => ({ 
        ...t, 
        hasCredentials: credentials[t.id] ?? false 
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}
```

### Tasks
- [ ] Create `src/hooks/useTenantData.ts` with React Query
- [ ] Create `src/hooks/useCustomerData.ts` with React Query
- [ ] Refactor `TenantContext` to consume these hooks
- [ ] Add query invalidation on connect/disconnect/selectTenant

---

## Phase 3: Optimize TenantContext Re-renders
**File:** `src/contexts/TenantContext.tsx`

### Problems
1. `loadCustomersAndTenants` triggered on every render
2. State updates trigger full context re-renders
3. Missing memoization on context value object

### Solutions

#### 3.1 Memoize Context Value
```typescript
const value = useMemo<TenantContextValue>(() => ({
  ...state,
  isConnecting,
  isRefreshing,
  isLoading,
  connect,
  disconnect,
  refreshToken,
  getValidToken,
  selectCustomer,
  selectTenant,
  loadCustomersAndTenants,
  getTenantsForCustomer,
  getAllConnectedTenants,
}), [
  state, isConnecting, isRefreshing, isLoading,
  connect, disconnect, refreshToken, getValidToken,
  selectCustomer, selectTenant, loadCustomersAndTenants,
  getTenantsForCustomer, getAllConnectedTenants
]);
```

#### 3.2 Ensure Stable Callbacks
All `useCallback` hooks must have proper dependency arrays.

### Tasks
- [ ] Wrap context value in `useMemo`
- [ ] Audit all `useCallback` dependencies
- [ ] Consider splitting into StateContext + ActionsContext (optional)

---

## Phase 4: Virtualize Large Policy Lists
**Files:**
- `src/components/views/PolicyBrowserView.tsx`
- `src/components/PolicyDeployDialog.tsx`

### Problem
Rendering 50+ policies with large JSON payloads (11-31KB each) freezes UI.

### Solution
Use `@tanstack/react-virtual`:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: policies.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 64, // row height
});
```

### Tasks
- [ ] Install `@tanstack/react-virtual`
- [ ] Virtualize policy table in `PolicyBrowserView`
- [ ] Virtualize tenant list in `PolicyDeployDialog`
- [ ] Lazy-load full policy JSON only on expand/select

---

## Phase 5: Additional Optimizations

### 5.1 Lazy Load Policy Details
```typescript
// Only show full JSON when user expands a policy
const [expandedId, setExpandedId] = useState<string | null>(null);
// Render JSON viewer only for expandedId
```

### 5.2 Memoize Expensive Computations
```typescript
const filteredPolicies = useMemo(() => 
  policies.filter(p => p.name.includes(searchTerm)),
  [policies, searchTerm]
);
```

### 5.3 Debounce Search Inputs
```typescript
const debouncedSearch = useDebouncedCallback(setSearchTerm, 300);
```

### Tasks
- [ ] Add lazy loading for policy JSON details
- [ ] Memoize filtered/sorted lists
- [ ] Debounce search/filter inputs

---

## Implementation Order

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Batch credentials | HIGH | LOW | ⭐⭐⭐ |
| 2. React Query cache | HIGH | MEDIUM | ⭐⭐⭐ |
| 3. Context memoization | MEDIUM | LOW | ⭐⭐ |
| 4. List virtualization | MEDIUM | MEDIUM | ⭐⭐ |
| 5. Additional polish | LOW | LOW | ⭐ |

---

## Success Metrics
- [ ] Network tab shows single credential query (not N+1)
- [ ] Tenant/customer data only fetched once per 5 minutes
- [ ] Policy list renders <100ms even with 100+ items
- [ ] React DevTools shows stable context value references

---

## Separate Issue: Deployment Forbidden Error
The screenshot shows a **Graph API permission error**, not a performance issue:
```
"Application must have one of the following scopes: DeviceManagementConfiguration..."
```
This requires adding the `DeviceManagementConfiguration.ReadWrite.All` permission to the Azure App Registration - separate from this performance plan.
