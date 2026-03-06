

## Why Single-Tenant Only (Current Architecture)

The `TenantContext` stores a **single** active connection: one `connectionId`, one `accessToken`, one `tenantId`. When you select a different tenant, it clears the previous token and replaces it. This was a deliberate simplification — most views query "the active tenant" and wouldn't know which tenant's data to show if multiple were connected.

## Plan: Multi-Tenant Simultaneous Connections

### Approach
Refactor `TenantContext` to maintain a **map of active connections** (keyed by connection ID) while keeping the concept of a "primary/focused" tenant for views that only show one tenant's data.

### Changes

1. **Refactor `TenantContext` state model**
   - Replace single `accessToken`/`connectionId`/`tokenExpiry` with a `Map<string, ActiveConnection>` storing per-tenant tokens
   - Keep `selectedTenantId` as the "focused" tenant for single-tenant views
   - `isConnected` becomes true if **any** tenant is connected
   - Add `activeTenants: ActiveConnection[]` accessor

2. **Update `selectTenant` logic**
   - Instead of clearing the previous connection, **add** the new tenant to the active map
   - Only set it as the "focused" tenant
   - Token refresh timers run independently per connection

3. **Update `selectCustomer` logic**
   - No longer disconnects the active tenant — just changes the focused customer filter

4. **Add `disconnectTenant(connectionId)` method**
   - Removes a specific tenant from the active map
   - Clears its refresh timer

5. **Update `getValidToken` to accept optional `connectionId`**
   - Default: returns token for the focused tenant
   - With ID: returns token for any active tenant (used by cross-tenant features)

6. **Update `TenantSelector` UI**
   - Show a green dot/checkmark next to **all** connected tenants, not just the selected one
   - Add a "Disconnect" action per tenant in the dropdown
   - Bold/highlight the "focused" tenant separately from connected status

7. **Update consuming components**
   - Views using `useTenant().accessToken` continue working (they get the focused tenant's token)
   - Cross-tenant features (backups, benchmarks, insights) can iterate `activeTenants` for multi-tenant operations

### Technical Detail

```text
Current State Shape:
  connectionId: string | null     ← single
  accessToken: string | null      ← single
  tokenExpiry: Date | null        ← single

New State Shape:
  activeConnections: Map<string, {
    connectionId: string
    tenantId: string
    tenantName: string
    accessToken: string
    tokenExpiry: Date
    refreshTimer: NodeJS.Timeout
  }>
  focusedConnectionId: string | null  ← which one views default to
```

### Files to modify
- `src/contexts/TenantContext.tsx` — core refactor
- `src/components/TenantSelector.tsx` — multi-connected UI
- No changes needed for most consuming views (they use the focused tenant's token via the same `getValidToken()` API)

