

# Plan: Add Endpoint Analytics Remediation Scripts Library to Intune Manager

## Summary
Add a new **"Remediation"** blade inside the Intune Manager that provides a browsable, searchable library of ~90 community remediation scripts from JayRHa's repository. Each script entry includes detection + remediation PowerShell code, categorized by purpose, with copy-to-clipboard and deploy-to-tenant functionality.

## Approach
All scripts are embedded as a static data catalog in a single TypeScript file -- no database needed. The UI is a new Intune section with category filtering, search, and script viewer with copy/deploy actions.

## Changes

### 1. `src/lib/remediationScriptsCatalog.ts` (new)
Static catalog of all ~90 scripts, each with:
- `id`, `name`, `description`, `category` (Security, Maintenance, Cleanup, Network, Office, Detection, Configuration)
- `detectionScript` and `remediationScript` (PowerShell code strings)
- `runAs` (System/User), `runAs32Bit` (boolean)
- `source` URL back to GitHub

Categories:
| Category | Examples |
|---|---|
| **Security** | BlackLotus-Mitigation, Enforce-BitLocker, Enforce-CredentialGuard, Disable-SMBv1, Disable-LegacyTLS, Get-LSA-Protection, Enable-SignatureValidation, Enforce-SMB-Signing, Enforce-WindowsFirewall, Enforce-DOH |
| **Cleanup** | Clear-BrowserCache, Clear-TeamsCache, Clear-OutlookCache, Clear-DnsCache, Clear-DownloadFolder, Clear-TempFiles-Advanced, Clear-FontCache, Clear-WindowsUpdateCache, Get-CleanUpDisk, Invoke-ClearRecycleBin, Remove-BloatwareAdvanced, Remove-ConsumerApps, Profile-cleanup |
| **Maintenance** | Check-DiskHealth, Defrag-SSD-Trim, Disk-Repair, Fix-WMI-Repository, Fix-SearchIndex, Reset-PrintSpooler, Reset-SoftwareDistributionFolder, Reset-StartMenu, Reset-NotificationCenter, Reset-OneDriveSync, Reset-OutlookProfile, Restart-Service-Generic, Restart-Windows-Search-Service |
| **Network** | Reset-NetworkStack, Remove-ProxySettings, Remove-StaticRoutes, Remove-SavedWifiProfiles, Run-ConnectionTest, Detect-VPNSplitTunnel, Set-MTU-Optimal, Make-Speedtest |
| **Office & Apps** | Fix-OfficeActivation, Reinstall-Office, Add-Winget-App, Invoke-TeamsInstallation, Invoke-TeamsReinstallation, Remove-ReinstallMSI, Get-OfficeTelemetry, Fix-FileAssociations, Set-DefaultBrowser |
| **Detection & Monitoring** | Detect-AdminUsers, Detect-Autologon, Detect-BlueScreenHistory, Detect-Browser-Passwords, Detect-CertificateExpiry, Detect-DriverIssues, Detect-SCCM, Detect-SuspiciousScheduledTasks, Get-BatteryHealth, Collect-EventLogErrors, Monitor-DiskSpace-Trend, Check-PNPDevices |
| **Configuration** | Activate-Numlock, AutomaticTimezone, BlockAADWorkplaceJoin, Change-Registry-Key-Generic, Change-MultipleRegistryKeys, Create-LocalAdmin, Disable-Coinstaller, Disable-Fastboot, Disable-StartMenuWebSearch, Enable-DarkMode, Enable-DotNet-35, Enable-RDP, Enable-DNSOperationalLogs, Set-Cached-Logon-Count-0, Set-CanaryToken-RegistryKey, Set-Service-Generic, Rotate-LocalAdminPassword, Optimize-StartupPrograms |
| **Windows Updates** | Install-WindowsUpdates, Clear-WindowsUpdateCache, Reset-WindowsUpdate, Restart-Windows-Update-Service, Toast-RebootMessage, Show-MessageCenterMessage |
| **Data & Backup** | Copy-FilesToBlobStorage, Profile-Backup, Get-BitlockerRecoveryKey, OneDrive-Folder-Always-Offline |
| **Defender** | Get-CloudDeliveredProtection, Get-NetworkProtection, Get-PUA-Protection, Get-RealTimeBehaviour, Get-RealTimeProtection |

For the initial implementation, I will include representative detection/remediation script stubs (comments describing what the script does + key logic) rather than the full verbatim scripts from GitHub, with links to the source repo for full code. This keeps the bundle size reasonable while providing real value.

### 2. `src/components/intune/sections/RemediationSection.tsx` (new)
- Category filter tabs/chips across the top
- Search bar filtering by name/description
- Card grid or table listing scripts with name, description, category badge, runAs badge
- Click to expand/open a detail view showing:
  - Detection script in a code block with copy button
  - Remediation script in a code block with copy button
  - "Deploy to Tenant" button that calls Graph API to create the remediation script via `POST /deviceManagement/deviceHealthScripts`
  - Link to GitHub source

### 3. `src/components/intune/IntuneTypes.ts`
- Add `'remediation'` to `IntuneSectionId` union type

### 4. `src/components/intune/IntuneSidebar.tsx`
- Add `'remediation'` item under the "Manage devices" group with icon `'wrench'` (add `Wrench` to iconMap)

### 5. `src/components/views/IntuneView.tsx`
- Add breadcrumb mapping: `remediation: ['Manage devices', 'Remediation']`
- Add case in `renderSection()` to render `<RemediationSection />`

### 6. Deploy to tenant (optional Graph API call)
The "Deploy" button will use the existing `graph-api` edge function to `POST /deviceManagement/deviceHealthScripts` with the detection and remediation scripts. This requires `DeviceManagementConfiguration.ReadWrite.All` permission (already covered by existing tenant connections).

## No database changes needed
Scripts are static content embedded in the frontend bundle.

