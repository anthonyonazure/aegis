

## Plan: Add Permissions Setup Guide to Email Security UI

### What
Add a new "Setup Guide" section to the Email Security sidebar that walks users through configuring `Exchange.ManageAsApp` permission and assigning the Exchange Administrator role to their service principal.

### Changes

**1. Update `EmailSecurityTypes.ts`**
- Add `'setup-guide'` to `EmailSecuritySectionId` union type.

**2. Update `EmailSecuritySidebar.tsx`**
- Add a new sidebar group "Configuration" with a "Setup Guide" item (using a `Settings` or `BookOpen` icon).
- Add the icon to `iconMap`.

**3. Create `src/components/email-security/sections/SetupGuideSection.tsx`**
- Step-by-step walkthrough with 3 collapsible steps:
  1. **Register Exchange.ManageAsApp permission** — Instructions to go to Azure AD > App Registrations > API Permissions > "APIs my organization uses" > search "Office 365 Exchange Online" > Application permissions > `Exchange.ManageAsApp`. Include the manifest JSON fallback with the resource ID and permission GUID.
  2. **Grant Admin Consent** — Click "Grant admin consent" on the API Permissions page.
  3. **Assign Exchange Administrator role** — Navigate to Entra ID > Roles and administrators > Exchange Administrator > Add assignments > switch filter to "Enterprise applications" / "Service principals". Include the PowerShell fallback script.
- Each step has a copyable code/JSON block where relevant.
- A "Verify Connection" button at the bottom that calls `fetchData` on the overview endpoint to test if EXO policies load.

**4. Update `EmailSecurityView.tsx`**
- Import `SetupGuideSection`, add case to `renderSection` switch, add breadcrumb mapping.

