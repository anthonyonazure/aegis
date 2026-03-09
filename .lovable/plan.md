

# Fix: Secure Score Dashboard shows only 1 tenant due to customer filter

## Problem
The Secure Score Dashboard inherits the global `selectedCustomerId` from the tenant selector in the sidebar. When a specific customer is selected (currently "ATL"), the dashboard filters scores to only that customer's tenants (1 of 5). There is no way to view all tenants at once from within the dashboard.

## Solution
Add a local customer filter dropdown directly on the Secure Score Dashboard with an "All Customers" default option. This overrides the global sidebar selection for this view only, so users can see all tenants or filter by customer without changing their global context.

## Changes

### 1. `src/components/views/SecureScoreDashboardView.tsx`
- Add a local `filterCustomerId` state, defaulting to `null` (all customers)
- Replace usage of `selectedCustomerId` from context with the local filter state
- Add a `<Select>` dropdown in the dashboard header (next to the Refresh button) with options: "All Customers" + each customer name
- When "All Customers" is selected, show all scores unfiltered
- Keep the existing filter logic but drive it from the local state instead of global context

The rest of the component (charts, tabs, tenant list, trend data) remains unchanged -- it already handles both filtered and unfiltered states correctly.

