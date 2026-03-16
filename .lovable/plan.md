

# Plan: Build DUDE (Dynamic User & Device Enumeration) Feature

## What It Does
A management UI and sync engine that automates Intune device group membership based on Entra ID user group membership. Users define mappings (e.g., "Sales-Users" → "Sales-Devices"), and the system resolves all devices owned by users in the source group and syncs them into the target device group via Graph API.

## Database

**New table: `dude_mappings`**
- `id` (uuid PK)
- `user_id` (uuid, NOT NULL) — app user who owns this mapping
- `tenant_connection_id` (uuid FK → tenant_connections) — which tenant
- `enabled` (boolean, default true)
- `user_group_id` (text, NOT NULL) — Entra ID user group object ID
- `user_group_name` (text, NOT NULL) — display name
- `device_group_id` (text, NOT NULL) — Entra ID device group object ID
- `device_group_name` (text, NOT NULL) — display name
- `os_filter` (text, default 'All') — All/Windows/macOS/iOS/Android
- `admin_unit_id` (text, nullable) — optional AU object ID
- `admin_unit_name` (text, nullable)
- `defender_tag` (text, nullable) — optional MDE tag
- `max_removal_percent` (integer, default 25) — blast radius limiter
- `last_sync_at` (timestamptz, nullable)
- `last_sync_status` (text, nullable) — success/error/skipped
- `last_sync_summary` (jsonb, nullable) — added/removed counts
- `created_at` / `updated_at` (timestamptz)

RLS: Users can only CRUD their own rows (`user_id = auth.uid()`).

**New table: `dude_sync_logs`**
- `id`, `user_id`, `mapping_id` (FK → dude_mappings), `tenant_connection_id`
- `status` (text) — success/error/dry-run
- `devices_added` (integer), `devices_removed` (integer), `devices_skipped` (integer)
- `details` (jsonb) — full sync details
- `duration_ms` (integer)
- `created_at`

RLS: Users can only read their own logs.

## New Edge Function: `dude-sync`

**Actions:**
1. **`list-groups`** — Search Entra ID groups by name prefix (for group picker). Uses `GET /groups?$filter=startsWith(displayName,'...')`.
2. **`preview-sync`** (dry run) — For a mapping, resolves transitive user group members → their Intune devices → compares with current device group members. Returns adds/removes without writing.
3. **`execute-sync`** — Same as preview but actually calls `POST /groups/{id}/members/$ref` and `DELETE /groups/{id}/members/{deviceId}/$ref`. Enforces blast radius limiter. Logs result to `dude_sync_logs`.
4. **`bulk-sync`** — Runs execute-sync for all enabled mappings of a tenant.

**Graph API calls used:**
- `GET /groups/{id}/transitiveMembers` (user group → users)
- `GET /users/{id}/managedDevices` (user → Intune devices)
- `GET /groups/{id}/members` (device group → current members)
- `POST /groups/{id}/members/$ref` (add device)
- `DELETE /groups/{id}/members/{id}/$ref` (remove device)

**Required Graph permissions:** `Group.Read.All`, `GroupMember.ReadWrite.All`, `User.Read.All`, `DeviceManagementManagedDevices.Read.All`

## New UI: `DudeManagerView.tsx`

**Layout:** Tabbed view with 3 tabs:

### Mappings Tab
- Table of all mappings with columns: Enabled toggle, User Group, Device Group, OS Filter, Last Sync, Status, Actions
- Add/Edit dialog: group search (typeahead hitting `list-groups` action), OS filter dropdown, optional AU and Defender tag fields, max removal % slider
- Bulk actions: enable/disable selected, delete selected
- Import/Export CSV

### Sync Tab  
- "Preview All" button — dry-run all enabled mappings showing what would change
- "Sync Now" button — execute sync for all enabled mappings
- Per-mapping sync button with preview
- Progress indicator during sync
- Safety confirmation dialog showing blast radius before executing

### History Tab
- Table of `dude_sync_logs` with status badges, duration, devices added/removed counts
- Expandable rows showing full details JSON
- Filters by date range and status

## File Changes

| File | Change |
|------|--------|
| `supabase migration` | Create `dude_mappings` and `dude_sync_logs` tables with RLS |
| `supabase/functions/dude-sync/index.ts` | New edge function with list-groups, preview-sync, execute-sync, bulk-sync |
| `supabase/config.toml` | N/A (auto-managed) |
| `src/components/views/DudeManagerView.tsx` | New full view component |
| `src/components/layout/Sidebar.tsx` | Add "DUDE Sync" item under Intune group |
| `src/pages/Index.tsx` | Import + register in SIMPLE_VIEWS |
| `src/lib/permissionsCheck.ts` | Add DUDE required permissions entry |

## Sidebar Placement
Under the **Intune** group, as a new item: `{ id: 'dude', label: 'DUDE Sync', icon: RefreshCw, description: 'Automate device group membership based on user groups' }`

