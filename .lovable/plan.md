

# Plan: Add PSAppDeployToolkit (AppDeploy) Feature to Intune Manager

## Summary
Add an **"AppDeploy"** blade inside the Intune Manager that provides a comprehensive PSAppDeployToolkit (PSADT) script template generator and reference library. Users can browse deployment templates by category, generate customized `Invoke-AppDeployToolkit.ps1` scripts for common application deployment scenarios, copy scripts, and deploy them as Win32 apps to Intune via Graph API.

## What PSAppDeployToolkit Is
PSADT is an enterprise-grade PowerShell framework for application deployment via SCCM/Intune. It provides functions for closing apps, showing UI prompts, installing MSIs/EXEs, managing registry, handling reboots, and more -- all wrapped in a consistent deployment template.

## Approach
Static catalog of ~40 app deployment templates organized by category, each containing a pre-built `Invoke-AppDeployToolkit.ps1` script with detection/install/uninstall logic. Same pattern as the Remediation section but tailored for PSADT.

## Changes

### 1. `src/lib/appDeployTemplates.ts` (new)
Static catalog with categories and templates:

| Category | Templates |
|---|---|
| **Browsers** | Chrome, Firefox, Edge (deploy/update) |
| **Productivity** | Microsoft 365 Apps, Adobe Reader, 7-Zip, Notepad++, VLC |
| **Communication** | Teams, Zoom, Slack, Webex |
| **Development** | VS Code, Git, Python, Node.js, PowerShell 7 |
| **Security** | CrowdStrike, SentinelOne, Cisco AnyConnect VPN |
| **Utilities** | Java, .NET Runtime, VC++ Redistributables, Power BI Desktop |
| **Custom** | MSI template, EXE template, Script-only template |

Each template includes:
- `id`, `name`, `description`, `category`, `publisher`
- `installScript` -- full PSADT `Invoke-AppDeployToolkit.ps1` with Pre/Install/Post phases
- `uninstallScript` -- matching uninstall phases
- `detectionScript` -- PowerShell detection rule for Intune
- `requirements` -- min OS, architecture
- `source` link to psappdeploytoolkit.com docs

### 2. `src/components/intune/sections/AppDeploySection.tsx` (new)
UI modeled after RemediationSection:
- Category filter chips + search bar + grid/list toggle
- Card grid showing templates with category badge, publisher
- Click opens detail dialog with 3 tabs: Install Script, Uninstall Script, Detection Rule
- Copy-to-clipboard on each tab
- "Deploy to Tenant" button (placeholder -- same pattern as Remediation)
- Link to PSADT docs
- PSADT function reference quick-lookup sidebar

### 3. `src/components/intune/IntuneTypes.ts`
Add `'app-deploy'` to `IntuneSectionId` union type.

### 4. `src/components/intune/IntuneSidebar.tsx`
Add `'app-deploy'` item under the **Apps** group with icon `'app-window'` (or add a `Package` icon):
```
{ id: 'app-deploy', label: 'AppDeploy', icon: 'app-window' }
```

### 5. `src/components/views/IntuneView.tsx`
- Add breadcrumb: `'app-deploy': ['Apps', 'AppDeploy']`
- Add case in `renderSection()` to render `<AppDeploySection />`
- Import `AppDeploySection`

## No database changes needed
Templates are static content embedded in the frontend.

