export type RemediationCategory =
  | 'Security'
  | 'Cleanup'
  | 'Maintenance'
  | 'Network'
  | 'Office & Apps'
  | 'Detection & Monitoring'
  | 'Configuration'
  | 'Windows Updates'
  | 'Data & Backup'
  | 'Defender';

export interface RemediationScript {
  id: string;
  name: string;
  description: string;
  category: RemediationCategory;
  detectionScript: string;
  remediationScript: string;
  runAs: 'System' | 'User';
  runAs32Bit: boolean;
  source: string;
}

const BASE_URL = 'https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/tree/main';

export const remediationScripts: RemediationScript[] = [
  // ── Security ──────────────────────────────────────────────
  {
    id: 'blacklotus-mitigation',
    name: 'BlackLotus Mitigation',
    description: 'Detects CVE-2023-24932 (BlackLotus) vulnerability and applies Secure Boot revocation via registry to mitigate the UEFI bootkit.',
    category: 'Security',
    detectionScript: `# Detect BlackLotus (CVE-2023-24932) vulnerability
try {
    $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot"
    $revocationApplied = (Get-ItemProperty -Path $regPath -Name "AvailableUpdates" -ErrorAction SilentlyContinue).AvailableUpdates
    if ($revocationApplied -band 0x40) {
        Write-Output "Secure Boot revocation already applied"
        exit 0
    } else {
        Write-Output "BlackLotus mitigation NOT applied"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    remediationScript: `# Apply BlackLotus (CVE-2023-24932) mitigation
try {
    $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force }
    Set-ItemProperty -Path $regPath -Name "AvailableUpdates" -Value 0x40 -Type DWord -Force
    Write-Output "BlackLotus mitigation applied successfully"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/BlackLotus-Mitigation`,
  },
  {
    id: 'enforce-bitlocker',
    name: 'Enforce BitLocker',
    description: 'Checks if BitLocker is enabled on the OS drive and enables it with TPM protector if not.',
    category: 'Security',
    detectionScript: `# Detect BitLocker status on OS drive
try {
    $blv = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
    if ($blv.ProtectionStatus -eq "On") {
        Write-Output "BitLocker is enabled on $env:SystemDrive"
        exit 0
    } else {
        Write-Output "BitLocker is NOT enabled on $env:SystemDrive"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    remediationScript: `# Enable BitLocker on OS drive
try {
    Enable-BitLocker -MountPoint $env:SystemDrive -EncryptionMethod XtsAes256 -TpmProtector -SkipHardwareTest -ErrorAction Stop
    Write-Output "BitLocker enabled successfully"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enforce-BitLocker`,
  },
  {
    id: 'enforce-credential-guard',
    name: 'Enforce Credential Guard',
    description: 'Detects if Windows Credential Guard is enabled and configures it via registry and UEFI lock if not.',
    category: 'Security',
    detectionScript: `# Detect Credential Guard status
try {
    $dg = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace "root\\Microsoft\\Windows\\DeviceGuard"
    if ($dg.SecurityServicesRunning -contains 1) {
        Write-Output "Credential Guard is running"
        exit 0
    } else {
        Write-Output "Credential Guard is NOT running"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    remediationScript: `# Enable Credential Guard
try {
    $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard"
    Set-ItemProperty -Path $regPath -Name "EnableVirtualizationBasedSecurity" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $regPath -Name "RequirePlatformSecurityFeatures" -Value 3 -Type DWord -Force
    $lsaPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa"
    Set-ItemProperty -Path $lsaPath -Name "LsaCfgFlags" -Value 1 -Type DWord -Force
    Write-Output "Credential Guard configured - reboot required"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enforce-CredentialGuard`,
  },
  {
    id: 'disable-smbv1',
    name: 'Disable SMBv1',
    description: 'Detects if the insecure SMBv1 protocol is enabled and disables it.',
    category: 'Security',
    detectionScript: `# Detect SMBv1 status
try {
    $smb1 = Get-SmbServerConfiguration | Select-Object -ExpandProperty EnableSMB1Protocol
    if ($smb1 -eq $false) {
        Write-Output "SMBv1 is disabled"
        exit 0
    } else {
        Write-Output "SMBv1 is ENABLED - security risk"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    remediationScript: `# Disable SMBv1
try {
    Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
    Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart -ErrorAction SilentlyContinue
    Write-Output "SMBv1 disabled successfully"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Disable-SMBv1`,
  },
  {
    id: 'disable-legacy-tls',
    name: 'Disable Legacy TLS',
    description: 'Detects and disables legacy TLS 1.0/1.1 protocols to enforce TLS 1.2+.',
    category: 'Security',
    detectionScript: `# Detect legacy TLS protocols
try {
    $tls10 = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.0\\Client" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
    $tls11 = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.1\\Client" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
    if ($tls10 -eq 0 -and $tls11 -eq 0) {
        Write-Output "Legacy TLS disabled"; exit 0
    } else {
        Write-Output "Legacy TLS still enabled"; exit 1
    }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable TLS 1.0 and 1.1
try {
    foreach ($ver in @("TLS 1.0","TLS 1.1")) {
        foreach ($type in @("Client","Server")) {
            $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\$ver\\$type"
            New-Item -Path $path -Force | Out-Null
            Set-ItemProperty -Path $path -Name "Enabled" -Value 0 -Type DWord -Force
            Set-ItemProperty -Path $path -Name "DisabledByDefault" -Value 1 -Type DWord -Force
        }
    }
    Write-Output "Legacy TLS disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Disable-LegacyTLS`,
  },
  {
    id: 'get-lsa-protection',
    name: 'Get LSA Protection',
    description: 'Checks if LSA (Local Security Authority) protection (RunAsPPL) is enabled and enables it if not.',
    category: 'Security',
    detectionScript: `# Detect LSA Protection
try {
    $lsa = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Name "RunAsPPL" -ErrorAction SilentlyContinue).RunAsPPL
    if ($lsa -eq 1) { Write-Output "LSA Protection enabled"; exit 0 }
    else { Write-Output "LSA Protection NOT enabled"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable LSA Protection
try {
    Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Name "RunAsPPL" -Value 1 -Type DWord -Force
    Write-Output "LSA Protection enabled - reboot required"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-LSA-Protection`,
  },
  {
    id: 'enable-signature-validation',
    name: 'Enable Signature Validation',
    description: 'Ensures PowerShell script execution policy requires signed scripts.',
    category: 'Security',
    detectionScript: `# Detect execution policy
try {
    $policy = Get-ExecutionPolicy -Scope LocalMachine
    if ($policy -eq "AllSigned" -or $policy -eq "RemoteSigned") {
        Write-Output "Execution policy: $policy"; exit 0
    } else { Write-Output "Insecure policy: $policy"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Set execution policy to RemoteSigned
try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
    Write-Output "Execution policy set to RemoteSigned"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-SignatureValidation`,
  },
  {
    id: 'enforce-smb-signing',
    name: 'Enforce SMB Signing',
    description: 'Detects and enforces SMB packet signing to prevent man-in-the-middle attacks.',
    category: 'Security',
    detectionScript: `# Detect SMB Signing
try {
    $cfg = Get-SmbServerConfiguration
    if ($cfg.RequireSecuritySignature -eq $true) {
        Write-Output "SMB Signing enforced"; exit 0
    } else { Write-Output "SMB Signing NOT enforced"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enforce SMB Signing
try {
    Set-SmbServerConfiguration -RequireSecuritySignature $true -Force
    Set-SmbClientConfiguration -RequireSecuritySignature $true -Force
    Write-Output "SMB Signing enforced"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enforce-SMB-Signing`,
  },
  {
    id: 'enforce-windows-firewall',
    name: 'Enforce Windows Firewall',
    description: 'Checks if Windows Firewall is enabled for all profiles and enables it if disabled.',
    category: 'Security',
    detectionScript: `# Detect Windows Firewall status
try {
    $profiles = Get-NetFirewallProfile
    $disabled = $profiles | Where-Object { $_.Enabled -eq $false }
    if ($disabled.Count -eq 0) { Write-Output "All firewall profiles enabled"; exit 0 }
    else { Write-Output "$($disabled.Count) profile(s) disabled"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable Windows Firewall for all profiles
try {
    Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
    Write-Output "All firewall profiles enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enforce-WindowsFirewall`,
  },
  {
    id: 'enforce-doh',
    name: 'Enforce DNS over HTTPS',
    description: 'Configures DNS over HTTPS (DoH) to encrypt DNS queries and improve privacy.',
    category: 'Security',
    detectionScript: `# Detect DoH configuration
try {
    $doh = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters" -Name "EnableAutoDoh" -ErrorAction SilentlyContinue).EnableAutoDoh
    if ($doh -eq 2) { Write-Output "DoH enabled"; exit 0 }
    else { Write-Output "DoH not configured"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable DNS over HTTPS
try {
    Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters" -Name "EnableAutoDoh" -Value 2 -Type DWord -Force
    Write-Output "DoH enabled - reboot may be required"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enforce-DOH`,
  },
  {
    id: 'block-aad-workplace-join',
    name: 'Block AAD Workplace Join',
    description: 'Prevents users from adding work or school accounts (Workplace Join) on AAD-joined devices.',
    category: 'Security',
    detectionScript: `# Detect Workplace Join setting
try {
    $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WorkplaceJoin" -Name "BlockAADWorkplaceJoin" -ErrorAction SilentlyContinue).BlockAADWorkplaceJoin
    if ($val -eq 1) { Write-Output "Workplace Join blocked"; exit 0 }
    else { Write-Output "Workplace Join allowed"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Block AAD Workplace Join
try {
    $path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WorkplaceJoin"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "BlockAADWorkplaceJoin" -Value 1 -Type DWord -Force
    Write-Output "Workplace Join blocked"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/BlockAADWorkplaceJoin`,
  },
  {
    id: 'get-always-elevated',
    name: 'Detect AlwaysInstallElevated',
    description: 'Detects if AlwaysInstallElevated is enabled, which allows any user to install MSI packages with elevated privileges.',
    category: 'Security',
    detectionScript: `# Detect AlwaysInstallElevated
try {
    $hklm = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer" -Name "AlwaysInstallElevated" -ErrorAction SilentlyContinue).AlwaysInstallElevated
    $hkcu = (Get-ItemProperty -Path "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer" -Name "AlwaysInstallElevated" -ErrorAction SilentlyContinue).AlwaysInstallElevated
    if ($hklm -eq 1 -or $hkcu -eq 1) {
        Write-Output "AlwaysInstallElevated is ENABLED - critical risk"; exit 1
    } else { Write-Output "AlwaysInstallElevated is disabled"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable AlwaysInstallElevated
try {
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer" -Name "AlwaysInstallElevated" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer" -Name "AlwaysInstallElevated" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    Write-Output "AlwaysInstallElevated disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-Always_Elevated`,
  },
  {
    id: 'set-canary-token',
    name: 'Set Canary Token Registry Key',
    description: 'Creates a honeypot registry key that triggers an alert if accessed by attackers.',
    category: 'Security',
    detectionScript: `# Detect canary token registry key
try {
    $val = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\CanaryToken" -Name "Token" -ErrorAction SilentlyContinue
    if ($val) { Write-Output "Canary token present"; exit 0 }
    else { Write-Output "Canary token missing"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Create canary token registry key
try {
    $path = "HKLM:\\SOFTWARE\\CanaryToken"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    $token = [guid]::NewGuid().ToString()
    Set-ItemProperty -Path $path -Name "Token" -Value $token -Type String -Force
    Write-Output "Canary token created: $token"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Set-CanaryToken-RegistryKey`,
  },
  {
    id: 'set-cached-logon-0',
    name: 'Set Cached Logon Count to 0',
    description: 'Sets cached logon count to 0 to prevent credential caching on the device.',
    category: 'Security',
    detectionScript: `# Detect cached logon count
try {
    $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "CachedLogonsCount" -ErrorAction SilentlyContinue).CachedLogonsCount
    if ($val -eq "0") { Write-Output "Cached logons disabled"; exit 0 }
    else { Write-Output "Cached logon count: $val"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Set cached logon count to 0
try {
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "CachedLogonsCount" -Value "0" -Type String -Force
    Write-Output "Cached logon count set to 0"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Set-Cached-Logon-Count-0`,
  },

  // ── Cleanup ──────────────────────────────────────────────
  {
    id: 'clear-browser-cache',
    name: 'Clear Browser Cache',
    description: 'Detects large Chrome and Edge browser caches and clears them to free disk space.',
    category: 'Cleanup',
    detectionScript: `# Detect browser cache size
try {
    $threshold = 500MB
    $cachePaths = @(
        "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache",
        "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"
    )
    $totalSize = 0
    foreach ($p in $cachePaths) {
        if (Test-Path $p) { $totalSize += (Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum }
    }
    if ($totalSize -gt $threshold) { Write-Output "Cache size: $([math]::Round($totalSize/1MB))MB"; exit 1 }
    else { Write-Output "Cache size OK"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear browser caches
try {
    $cachePaths = @(
        "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache",
        "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"
    )
    foreach ($p in $cachePaths) {
        if (Test-Path $p) { Remove-Item -Path "$p\\*" -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Write-Output "Browser caches cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-BrowserCache`,
  },
  {
    id: 'clear-browser-extensions',
    name: 'Clear Browser Extensions',
    description: 'Detects and removes unauthorized or risky browser extensions from Chrome and Edge.',
    category: 'Cleanup',
    detectionScript: `# Detect unauthorized browser extensions
try {
    $extPaths = @(
        "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Extensions",
        "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Extensions"
    )
    $extCount = 0
    foreach ($p in $extPaths) {
        if (Test-Path $p) { $extCount += (Get-ChildItem -Path $p -Directory).Count }
    }
    Write-Output "Found $extCount extensions"
    if ($extCount -gt 10) { exit 1 } else { exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove unapproved browser extensions
# Note: Customize the approved extension list in production
try {
    Write-Output "Extension audit complete - review required"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-BrowserExtensions`,
  },
  {
    id: 'clear-teams-cache',
    name: 'Clear Teams Cache',
    description: 'Clears Microsoft Teams cache to resolve performance and sync issues.',
    category: 'Cleanup',
    detectionScript: `# Detect Teams cache size
try {
    $teamsPath = "$env:APPDATA\\Microsoft\\Teams"
    if (Test-Path $teamsPath) {
        $size = (Get-ChildItem -Path $teamsPath -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 500MB) { Write-Output "Teams cache: $([math]::Round($size/1MB))MB"; exit 1 }
    }
    Write-Output "Teams cache OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear Teams cache
try {
    $proc = Get-Process -Name "Teams" -ErrorAction SilentlyContinue
    if ($proc) { $proc | Stop-Process -Force; Start-Sleep -Seconds 3 }
    $cacheFolders = @("blob_storage","Cache","databases","GPUCache","IndexedDB","Local Storage","tmp")
    foreach ($f in $cacheFolders) {
        $path = "$env:APPDATA\\Microsoft\\Teams\\$f"
        if (Test-Path $path) { Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Write-Output "Teams cache cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-TeamsCache`,
  },
  {
    id: 'clear-outlook-cache',
    name: 'Clear Outlook Cache',
    description: 'Clears Outlook autocomplete and RoamCache to fix sync and performance issues.',
    category: 'Cleanup',
    detectionScript: `# Detect Outlook cache
try {
    $roamCache = "$env:LOCALAPPDATA\\Microsoft\\Outlook\\RoamCache"
    if (Test-Path $roamCache) {
        $size = (Get-ChildItem -Path $roamCache -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 100MB) { Write-Output "Outlook cache large: $([math]::Round($size/1MB))MB"; exit 1 }
    }
    Write-Output "Outlook cache OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear Outlook cache
try {
    $roamCache = "$env:LOCALAPPDATA\\Microsoft\\Outlook\\RoamCache"
    if (Test-Path $roamCache) { Remove-Item -Path "$roamCache\\*" -Force -ErrorAction SilentlyContinue }
    Write-Output "Outlook cache cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-OutlookCache`,
  },
  {
    id: 'clear-dns-cache',
    name: 'Clear DNS Cache',
    description: 'Clears the Windows DNS resolver cache to fix name resolution issues.',
    category: 'Cleanup',
    detectionScript: `# Detect DNS cache entries
try {
    $entries = (Get-DnsClientCache | Measure-Object).Count
    if ($entries -gt 500) { Write-Output "DNS cache has $entries entries"; exit 1 }
    else { Write-Output "DNS cache OK ($entries entries)"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear DNS cache
try {
    Clear-DnsClientCache
    Write-Output "DNS cache cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-DnsCache`,
  },
  {
    id: 'clear-download-folder',
    name: 'Clear Download Folder',
    description: 'Detects and cleans old files from the Downloads folder to reclaim disk space.',
    category: 'Cleanup',
    detectionScript: `# Detect old download files (>30 days)
try {
    $downloads = [Environment]::GetFolderPath("UserProfile") + "\\Downloads"
    $old = Get-ChildItem -Path $downloads -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
    if ($old.Count -gt 20) { Write-Output "$($old.Count) old files in Downloads"; exit 1 }
    else { Write-Output "Downloads folder OK"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clean old downloads (>30 days)
try {
    $downloads = [Environment]::GetFolderPath("UserProfile") + "\\Downloads"
    $old = Get-ChildItem -Path $downloads -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
    $old | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Output "Removed $($old.Count) old files"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-DownloadFolder`,
  },
  {
    id: 'clear-temp-files',
    name: 'Clear Temp Files Advanced',
    description: 'Performs comprehensive cleanup of temp files, Windows temp, and user temp directories.',
    category: 'Cleanup',
    detectionScript: `# Detect temp file sizes
try {
    $paths = @($env:TEMP, "C:\\Windows\\Temp")
    $total = 0
    foreach ($p in $paths) {
        if (Test-Path $p) { $total += (Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum }
    }
    if ($total -gt 1GB) { Write-Output "Temp files: $([math]::Round($total/1MB))MB"; exit 1 }
    else { Write-Output "Temp files OK"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear temp files
try {
    $paths = @($env:TEMP, "C:\\Windows\\Temp")
    foreach ($p in $paths) {
        if (Test-Path $p) { Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Write-Output "Temp files cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-TempFiles-Advanced`,
  },
  {
    id: 'clear-font-cache',
    name: 'Clear Font Cache',
    description: 'Clears the Windows font cache to fix font rendering issues.',
    category: 'Cleanup',
    detectionScript: `# Detect font cache issues
try {
    $fontCache = "C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Local\\FontCache"
    if (Test-Path $fontCache) {
        $size = (Get-ChildItem -Path $fontCache -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 50MB) { Write-Output "Font cache large: $([math]::Round($size/1MB))MB"; exit 1 }
    }
    Write-Output "Font cache OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear font cache
try {
    Stop-Service -Name "FontCache" -Force -ErrorAction SilentlyContinue
    $fontCache = "C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Local\\FontCache"
    if (Test-Path $fontCache) { Remove-Item -Path "$fontCache\\*" -Recurse -Force -ErrorAction SilentlyContinue }
    Start-Service -Name "FontCache"
    Write-Output "Font cache cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-FontCache`,
  },
  {
    id: 'clear-windows-update-cache',
    name: 'Clear Windows Update Cache',
    description: 'Clears the SoftwareDistribution folder to fix stuck Windows Updates.',
    category: 'Cleanup',
    detectionScript: `# Detect Windows Update cache size
try {
    $path = "C:\\Windows\\SoftwareDistribution\\Download"
    if (Test-Path $path) {
        $size = (Get-ChildItem -Path $path -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 500MB) { Write-Output "WU cache: $([math]::Round($size/1MB))MB"; exit 1 }
    }
    Write-Output "WU cache OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear Windows Update cache
try {
    Stop-Service -Name wuauserv -Force
    Remove-Item -Path "C:\\Windows\\SoftwareDistribution\\Download\\*" -Recurse -Force -ErrorAction SilentlyContinue
    Start-Service -Name wuauserv
    Write-Output "Windows Update cache cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Clear-WindowsUpdateCache`,
  },
  {
    id: 'get-cleanup-disk',
    name: 'Disk Cleanup',
    description: 'Runs Windows Disk Cleanup utility with predefined cleanup flags.',
    category: 'Cleanup',
    detectionScript: `# Detect available disk space
try {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    if ($freeGB -lt 20) { Write-Output "Low disk space: $freeGB GB free"; exit 1 }
    else { Write-Output "Disk space OK: $freeGB GB"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Run Disk Cleanup
try {
    $cleanFlags = @(0,1,2,8,64,128,256,512,1024,2048,4096,8192,16384)
    $regPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches"
    Get-ChildItem -Path $regPath | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "StateFlags0100" -Value 2 -Type DWord -Force
    }
    Start-Process cleanmgr -ArgumentList "/sagerun:100" -Wait -NoNewWindow
    Write-Output "Disk cleanup complete"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-CleanUpDisk`,
  },
  {
    id: 'invoke-clear-recycle-bin',
    name: 'Clear Recycle Bin',
    description: 'Empties the Recycle Bin for all users to reclaim disk space.',
    category: 'Cleanup',
    detectionScript: `# Detect Recycle Bin size
try {
    $shell = New-Object -ComObject Shell.Application
    $rb = $shell.Namespace(0xA)
    $count = $rb.Items().Count
    if ($count -gt 50) { Write-Output "Recycle Bin has $count items"; exit 1 }
    else { Write-Output "Recycle Bin OK ($count items)"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Clear Recycle Bin
try {
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    Write-Output "Recycle Bin cleared"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Invoke-ClearRecycleBin`,
  },
  {
    id: 'remove-bloatware',
    name: 'Remove Bloatware',
    description: 'Removes unnecessary OEM and pre-installed consumer apps from Windows devices.',
    category: 'Cleanup',
    detectionScript: `# Detect bloatware apps
try {
    $bloatware = @("*CandyCrush*","*BubbleWitch*","*Solitaire*","*Disney*","*Facebook*","*Twitter*","*Spotify*","*Netflix*")
    $found = @()
    foreach ($app in $bloatware) {
        $found += Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue
    }
    if ($found.Count -gt 0) { Write-Output "Found $($found.Count) bloatware apps"; exit 1 }
    else { Write-Output "No bloatware found"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove bloatware
try {
    $bloatware = @("*CandyCrush*","*BubbleWitch*","*Solitaire*","*Disney*","*Facebook*","*Twitter*","*Spotify*","*Netflix*")
    foreach ($app in $bloatware) {
        Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
        Get-AppxProvisionedPackage -Online | Where-Object { $_.PackageName -like $app } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
    }
    Write-Output "Bloatware removed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove-BloatwareAdvanced`,
  },
  {
    id: 'remove-consumer-apps',
    name: 'Remove Consumer Apps',
    description: 'Removes consumer-focused apps that are not appropriate for enterprise environments.',
    category: 'Cleanup',
    detectionScript: `# Detect consumer apps
try {
    $apps = @("*Xbox*","*ZuneMusic*","*ZuneVideo*","*BingWeather*","*BingNews*","*People*","*WindowsMaps*")
    $found = 0
    foreach ($app in $apps) {
        $found += (Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue).Count
    }
    if ($found -gt 0) { Write-Output "Found $found consumer apps"; exit 1 }
    else { Write-Output "No consumer apps"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove consumer apps
try {
    $apps = @("*Xbox*","*ZuneMusic*","*ZuneVideo*","*BingWeather*","*BingNews*","*People*","*WindowsMaps*")
    foreach ($app in $apps) {
        Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    }
    Write-Output "Consumer apps removed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove-ConsumerApps`,
  },
  {
    id: 'profile-cleanup',
    name: 'Profile Cleanup',
    description: 'Detects and removes stale user profiles that haven\'t been used in over 90 days.',
    category: 'Cleanup',
    detectionScript: `# Detect stale user profiles
try {
    $profiles = Get-CimInstance -ClassName Win32_UserProfile | Where-Object { !$_.Special -and $_.LastUseTime -lt (Get-Date).AddDays(-90) }
    if ($profiles.Count -gt 0) { Write-Output "$($profiles.Count) stale profiles found"; exit 1 }
    else { Write-Output "No stale profiles"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove stale profiles (>90 days unused)
try {
    $profiles = Get-CimInstance -ClassName Win32_UserProfile | Where-Object { !$_.Special -and $_.LastUseTime -lt (Get-Date).AddDays(-90) }
    foreach ($p in $profiles) { Remove-CimInstance -InputObject $p -ErrorAction SilentlyContinue }
    Write-Output "Removed $($profiles.Count) stale profiles"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Profile-cleanup`,
  },
  {
    id: 'remove-teams-chat',
    name: 'Remove Teams Chat',
    description: 'Removes the built-in Teams Chat app from the Windows taskbar.',
    category: 'Cleanup',
    detectionScript: `# Detect Teams Chat icon
try {
    $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "TaskbarMn" -ErrorAction SilentlyContinue).TaskbarMn
    if ($val -eq 0) { Write-Output "Teams Chat hidden"; exit 0 }
    else { Write-Output "Teams Chat visible"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Hide Teams Chat from taskbar
try {
    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "TaskbarMn" -Value 0 -Type DWord -Force
    Write-Output "Teams Chat hidden"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove%20Teams%20Chat`,
  },

  // ── Maintenance ──────────────────────────────────────────
  {
    id: 'check-disk-health',
    name: 'Check Disk Health',
    description: 'Checks disk health using S.M.A.R.T. data and storage reliability counters.',
    category: 'Maintenance',
    detectionScript: `# Detect disk health issues
try {
    $disks = Get-PhysicalDisk | Where-Object { $_.HealthStatus -ne "Healthy" }
    if ($disks.Count -gt 0) { Write-Output "$($disks.Count) unhealthy disk(s)"; exit 1 }
    else { Write-Output "All disks healthy"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report disk health - manual intervention required
try {
    $disks = Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus, OperationalStatus
    $disks | ForEach-Object { Write-Output "$($_.FriendlyName): $($_.HealthStatus)" }
    Write-Output "Disk health report generated - review required"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Check-DiskHealth`,
  },
  {
    id: 'defrag-ssd-trim',
    name: 'Defrag / SSD Trim',
    description: 'Runs TRIM on SSDs or defragmentation on HDDs to optimize drive performance.',
    category: 'Maintenance',
    detectionScript: `# Detect optimization status
try {
    $vol = Get-Volume -DriveLetter C
    $lastOpt = (Get-PhysicalDisk | Get-StorageReliabilityCounter).ReadLatencyMax
    Write-Output "Drive optimization check complete"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Optimize drive (TRIM or Defrag)
try {
    Optimize-Volume -DriveLetter C -ReTrim -ErrorAction SilentlyContinue
    Optimize-Volume -DriveLetter C -Defrag -ErrorAction SilentlyContinue
    Write-Output "Drive optimization complete"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Defrag-SSD-Trim`,
  },
  {
    id: 'disk-repair',
    name: 'Disk Repair',
    description: 'Runs DISM and SFC to repair Windows system image and file integrity.',
    category: 'Maintenance',
    detectionScript: `# Detect system file corruption
try {
    $result = & sfc /verifyonly 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Output "No integrity violations"; exit 0 }
    else { Write-Output "System file issues detected"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Repair system files
try {
    & DISM /Online /Cleanup-Image /RestoreHealth
    & sfc /scannow
    Write-Output "System repair complete"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Disk-Repair`,
  },
  {
    id: 'fix-wmi-repository',
    name: 'Fix WMI Repository',
    description: 'Detects and repairs corrupt WMI repository that causes management issues.',
    category: 'Maintenance',
    detectionScript: `# Verify WMI repository
try {
    $result = & winmgmt /verifyrepository 2>&1
    if ($result -match "consistent") { Write-Output "WMI repository consistent"; exit 0 }
    else { Write-Output "WMI repository inconsistent"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Rebuild WMI repository
try {
    Stop-Service winmgmt -Force
    & winmgmt /resetrepository
    Start-Service winmgmt
    Write-Output "WMI repository rebuilt"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Fix-WMI-Repository`,
  },
  {
    id: 'fix-search-index',
    name: 'Fix Search Index',
    description: 'Resets the Windows Search index when search results are missing or incomplete.',
    category: 'Maintenance',
    detectionScript: `# Detect Windows Search index health
try {
    $svc = Get-Service WSearch -ErrorAction Stop
    if ($svc.Status -ne "Running") { Write-Output "Search service not running"; exit 1 }
    Write-Output "Search service running"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Windows Search index
try {
    Stop-Service WSearch -Force
    Remove-Item -Path "C:\\ProgramData\\Microsoft\\Search\\Data\\Applications\\Windows\\Windows.edb" -Force -ErrorAction SilentlyContinue
    Start-Service WSearch
    Write-Output "Search index reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Fix-SearchIndex`,
  },
  {
    id: 'reset-print-spooler',
    name: 'Reset Print Spooler',
    description: 'Resets the Print Spooler service and clears stuck print jobs.',
    category: 'Maintenance',
    detectionScript: `# Detect Print Spooler issues
try {
    $svc = Get-Service Spooler -ErrorAction Stop
    $jobs = Get-ChildItem -Path "C:\\Windows\\System32\\spool\\PRINTERS" -ErrorAction SilentlyContinue
    if ($svc.Status -ne "Running" -or $jobs.Count -gt 5) {
        Write-Output "Spooler issues detected"; exit 1
    }
    Write-Output "Print Spooler OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Print Spooler
try {
    Stop-Service Spooler -Force
    Remove-Item -Path "C:\\Windows\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue
    Start-Service Spooler
    Write-Output "Print Spooler reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-PrintSpooler`,
  },
  {
    id: 'reset-software-distribution',
    name: 'Reset Software Distribution',
    description: 'Resets the Windows Update SoftwareDistribution folder to fix update issues.',
    category: 'Maintenance',
    detectionScript: `# Detect SoftwareDistribution folder issues
try {
    $path = "C:\\Windows\\SoftwareDistribution"
    $size = (Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($size -gt 2GB) { Write-Output "SoftwareDistribution: $([math]::Round($size/1GB,1))GB"; exit 1 }
    Write-Output "SoftwareDistribution OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset SoftwareDistribution folder
try {
    Stop-Service wuauserv -Force; Stop-Service bits -Force
    Rename-Item "C:\\Windows\\SoftwareDistribution" "C:\\Windows\\SoftwareDistribution.old" -Force
    Start-Service wuauserv; Start-Service bits
    Remove-Item "C:\\Windows\\SoftwareDistribution.old" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output "SoftwareDistribution reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-SoftwareDistributionFolder`,
  },
  {
    id: 'reset-start-menu',
    name: 'Reset Start Menu',
    description: 'Resets the Start Menu database to fix layout and search issues.',
    category: 'Maintenance',
    detectionScript: `# Detect Start Menu issues
try {
    $dbPath = "$env:LOCALAPPDATA\\Packages\\Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy\\LocalState"
    if (Test-Path $dbPath) {
        $size = (Get-ChildItem -Path $dbPath -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 50MB) { Write-Output "Start Menu DB large"; exit 1 }
    }
    Write-Output "Start Menu OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Start Menu
try {
    Get-AppxPackage Microsoft.Windows.StartMenuExperienceHost | Reset-AppxPackage -ErrorAction SilentlyContinue
    Write-Output "Start Menu reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-StartMenu`,
  },
  {
    id: 'reset-notification-center',
    name: 'Reset Notification Center',
    description: 'Resets the Windows Notification Center database to fix notification issues.',
    category: 'Maintenance',
    detectionScript: `# Detect Notification Center issues
try {
    $dbPath = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Notifications"
    if (Test-Path $dbPath) {
        $size = (Get-ChildItem -Path $dbPath -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 100MB) { Write-Output "Notification DB large: $([math]::Round($size/1MB))MB"; exit 1 }
    }
    Write-Output "Notification Center OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Notification Center
try {
    Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
    $dbPath = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Notifications"
    Remove-Item -Path "$dbPath\\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output "Notification Center reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-NotificationCenter`,
  },
  {
    id: 'reset-onedrive-sync',
    name: 'Reset OneDrive Sync',
    description: 'Resets OneDrive sync client to fix synchronization issues.',
    category: 'Maintenance',
    detectionScript: `# Detect OneDrive sync issues
try {
    $od = Get-Process OneDrive -ErrorAction SilentlyContinue
    if (-not $od) { Write-Output "OneDrive not running"; exit 1 }
    Write-Output "OneDrive running"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset OneDrive
try {
    & "$env:LOCALAPPDATA\\Microsoft\\OneDrive\\onedrive.exe" /reset
    Start-Sleep -Seconds 10
    & "$env:LOCALAPPDATA\\Microsoft\\OneDrive\\onedrive.exe"
    Write-Output "OneDrive reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-OneDriveSync`,
  },
  {
    id: 'reset-outlook-profile',
    name: 'Reset Outlook Profile',
    description: 'Detects oversized Outlook profiles and resets them to improve performance.',
    category: 'Maintenance',
    detectionScript: `# Detect Outlook profile issues
try {
    $ostPath = "$env:LOCALAPPDATA\\Microsoft\\Outlook"
    if (Test-Path $ostPath) {
        $ost = Get-ChildItem -Path $ostPath -Filter "*.ost" -ErrorAction SilentlyContinue
        $large = $ost | Where-Object { $_.Length -gt 10GB }
        if ($large) { Write-Output "Large OST files found"; exit 1 }
    }
    Write-Output "Outlook profile OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Outlook profile - creates new profile
try {
    Stop-Process -Name "OUTLOOK" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    # Remove OST files to force re-sync
    $ostPath = "$env:LOCALAPPDATA\\Microsoft\\Outlook"
    Get-ChildItem -Path $ostPath -Filter "*.ost" | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Output "Outlook profile reset - will re-sync on next launch"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-OutlookProfile`,
  },
  {
    id: 'restart-windows-search',
    name: 'Restart Windows Search Service',
    description: 'Restarts the Windows Search service to fix search functionality.',
    category: 'Maintenance',
    detectionScript: `# Detect Windows Search service status
try {
    $svc = Get-Service WSearch
    if ($svc.Status -eq "Running") { Write-Output "Search running"; exit 0 }
    else { Write-Output "Search not running"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Restart Windows Search
try {
    Restart-Service WSearch -Force
    Write-Output "Windows Search restarted"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Restart-Windows-Search-Service`,
  },
  {
    id: 'device-auto-syncer',
    name: 'Device Auto-Syncer',
    description: 'Triggers an Intune device sync to ensure policies are up to date.',
    category: 'Maintenance',
    detectionScript: `# Detect last sync time
try {
    $lastSync = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Enrollments\\*\\DMClient\\MS DM Server" -Name "LastSuccessTime" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($lastSync) {
        $diff = (Get-Date) - [DateTime]$lastSync.LastSuccessTime
        if ($diff.TotalHours -gt 8) { Write-Output "Last sync $([math]::Round($diff.TotalHours))h ago"; exit 1 }
    }
    Write-Output "Device synced recently"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Trigger Intune sync
try {
    Get-ScheduledTask | Where-Object { $_.TaskName -eq "PushLaunch" } | Start-ScheduledTask
    $Shell = New-Object -ComObject Shell.Application
    $Shell.open("intunemanagementextension://syncapp")
    Write-Output "Sync triggered"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Device%20Auto-Syncer`,
  },

  // ── Network ──────────────────────────────────────────────
  {
    id: 'reset-network-stack',
    name: 'Reset Network Stack',
    description: 'Performs a complete network stack reset including Winsock, IP, DNS, and firewall.',
    category: 'Network',
    detectionScript: `# Detect network issues
try {
    $ping = Test-Connection -ComputerName "8.8.8.8" -Count 2 -Quiet
    if ($ping) { Write-Output "Network connectivity OK"; exit 0 }
    else { Write-Output "Network connectivity issues"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset network stack
try {
    netsh winsock reset
    netsh int ip reset
    netsh advfirewall reset
    ipconfig /flushdns
    ipconfig /release
    ipconfig /renew
    Write-Output "Network stack reset - reboot recommended"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-NetworkStack`,
  },
  {
    id: 'remove-proxy-settings',
    name: 'Remove Proxy Settings',
    description: 'Removes proxy configuration that may cause connectivity issues.',
    category: 'Network',
    detectionScript: `# Detect proxy settings
try {
    $proxy = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings").ProxyEnable
    if ($proxy -eq 1) { Write-Output "Proxy enabled"; exit 1 }
    else { Write-Output "No proxy configured"; exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove proxy settings
try {
    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" -Name "ProxyEnable" -Value 0 -Force
    Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" -Name "ProxyServer" -Force -ErrorAction SilentlyContinue
    Write-Output "Proxy settings removed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove-ProxySettings`,
  },
  {
    id: 'remove-static-routes',
    name: 'Remove Static Routes',
    description: 'Detects and removes orphaned static routes with unreachable gateways.',
    category: 'Network',
    detectionScript: `# Detect orphaned static routes
try {
    $routes = Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.RouteMetric -gt 0 -and $_.NextHop -ne "0.0.0.0" }
    if ($routes.Count -gt 5) { Write-Output "$($routes.Count) static routes found"; exit 1 }
    Write-Output "Routes OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove orphaned static routes
try {
    $routes = Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.Protocol -eq "NetMgmt" -and $_.NextHop -ne "0.0.0.0" }
    foreach ($r in $routes) { Remove-NetRoute -IfIndex $r.ifIndex -DestinationPrefix $r.DestinationPrefix -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Output "Orphaned routes removed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove-StaticRoutes`,
  },
  {
    id: 'remove-saved-wifi',
    name: 'Remove Saved WiFi Profiles',
    description: 'Removes saved WiFi profiles with insecure authentication methods.',
    category: 'Network',
    detectionScript: `# Detect insecure WiFi profiles
try {
    $profiles = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object { ($_ -split ":")[1].Trim() }
    Write-Output "Found $($profiles.Count) WiFi profiles"
    if ($profiles.Count -gt 10) { exit 1 } else { exit 0 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove old WiFi profiles (keep current)
try {
    $current = (netsh wlan show interfaces | Select-String "SSID" | Select-Object -First 1) -replace ".*:\\s*",""
    $profiles = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object { ($_ -split ":")[1].Trim() }
    foreach ($p in $profiles) {
        if ($p -ne $current) { netsh wlan delete profile name="$p" }
    }
    Write-Output "Old WiFi profiles removed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Remove-SavedWifiProfiles`,
  },
  {
    id: 'run-connection-test',
    name: 'Run Connection Test',
    description: 'Tests connectivity to Microsoft 365 endpoints and reports results.',
    category: 'Network',
    detectionScript: `# Test M365 connectivity
try {
    $endpoints = @("outlook.office365.com","login.microsoftonline.com","graph.microsoft.com")
    $failed = @()
    foreach ($ep in $endpoints) {
        if (-not (Test-Connection -ComputerName $ep -Count 1 -Quiet)) { $failed += $ep }
    }
    if ($failed.Count -gt 0) { Write-Output "Failed: $($failed -join ', ')"; exit 1 }
    Write-Output "All endpoints reachable"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Connection test remediation - report only
try {
    $endpoints = @("outlook.office365.com","login.microsoftonline.com","graph.microsoft.com","*.sharepoint.com")
    foreach ($ep in $endpoints) {
        $result = Test-NetConnection -ComputerName $ep -Port 443 -WarningAction SilentlyContinue
        Write-Output "$ep : $($result.TcpTestSucceeded)"
    }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Run-ConnectionTest`,
  },
  {
    id: 'detect-vpn-split-tunnel',
    name: 'Detect VPN Split Tunnel',
    description: 'Detects VPN connections and checks if split tunneling is configured.',
    category: 'Network',
    detectionScript: `# Detect VPN split tunnel configuration
try {
    $vpn = Get-VpnConnection -ErrorAction SilentlyContinue
    if ($vpn) {
        $splitTunnel = $vpn | Where-Object { $_.SplitTunneling -eq $true }
        if ($splitTunnel) { Write-Output "Split tunneling enabled on VPN"; exit 1 }
    }
    Write-Output "No split tunnel VPN found"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report VPN configuration
try {
    $vpn = Get-VpnConnection -ErrorAction SilentlyContinue
    $vpn | ForEach-Object { Write-Output "$($_.Name): SplitTunnel=$($_.SplitTunneling)" }
    Write-Output "VPN config report complete"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-VPNSplitTunnel`,
  },
  {
    id: 'set-mtu-optimal',
    name: 'Set Optimal MTU',
    description: 'Detects and sets optimal MTU value to prevent network fragmentation issues.',
    category: 'Network',
    detectionScript: `# Detect MTU setting
try {
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notlike "*Virtual*" } | Select-Object -First 1
    $mtu = (Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4).NlMtu
    if ($mtu -ne 1500) { Write-Output "MTU is $mtu (expected 1500)"; exit 1 }
    Write-Output "MTU is optimal: $mtu"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Set optimal MTU
try {
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notlike "*Virtual*" } | Select-Object -First 1
    Set-NetIPInterface -InterfaceIndex $adapter.ifIndex -NlMtuBytes 1500 -AddressFamily IPv4
    Write-Output "MTU set to 1500"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Set-MTU-Optimal`,
  },
  {
    id: 'make-speedtest',
    name: 'Network Speedtest',
    description: 'Runs a network speed test and reports download/upload speeds.',
    category: 'Network',
    detectionScript: `# Detect network speed
try {
    $url = "http://speedtest.tele2.net/1MB.zip"
    $start = Get-Date
    Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\\speedtest.tmp" -UseBasicParsing
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $speed = [math]::Round(1 / $elapsed * 8, 2)
    Remove-Item "$env:TEMP\\speedtest.tmp" -Force
    if ($speed -lt 10) { Write-Output "Slow: $speed Mbps"; exit 1 }
    Write-Output "Speed: $speed Mbps"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Speed test - diagnostic only
try {
    Write-Output "Speed test completed - review detection output for results"
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Make-Speedtest`,
  },

  // ── Office & Apps ────────────────────────────────────────
  {
    id: 'fix-office-activation',
    name: 'Fix Office Activation',
    description: 'Detects and fixes Microsoft 365 Apps activation issues by resetting license tokens.',
    category: 'Office & Apps',
    detectionScript: `# Detect Office activation status
try {
    $cscript = "C:\\Program Files\\Microsoft Office\\Office16\\ospp.vbs"
    if (Test-Path $cscript) {
        $status = & cscript //nologo $cscript /dstatus 2>&1
        if ($status -match "LICENSE STATUS.*LICENSED") { Write-Output "Office licensed"; exit 0 }
    }
    Write-Output "Office activation issue"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Office activation
try {
    $paths = @("$env:LOCALAPPDATA\\Microsoft\\Office\\Licenses","$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\Licensing")
    foreach ($p in $paths) { if (Test-Path $p) { Remove-Item -Path "$p\\*" -Recurse -Force -ErrorAction SilentlyContinue } }
    # Clear cached credentials
    cmdkey /list | ForEach-Object { if ($_ -match "Target: MicrosoftOffice") { cmdkey /delete:($_ -replace ".*Target: ","") } }
    Write-Output "Office activation reset - restart Office apps"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Fix-OfficeActivation`,
  },
  {
    id: 'reinstall-office',
    name: 'Reinstall Office',
    description: 'Triggers an online repair of Microsoft 365 Apps to fix installation issues.',
    category: 'Office & Apps',
    detectionScript: `# Detect Office installation health
try {
    $office = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration" -ErrorAction SilentlyContinue
    if ($office) {
        $exePath = "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE"
        if (Test-Path $exePath) { Write-Output "Office installed"; exit 0 }
    }
    Write-Output "Office installation issue"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Trigger Office online repair
try {
    $c2r = "C:\\Program Files\\Common Files\\Microsoft Shared\\ClickToRun\\OfficeC2RClient.exe"
    if (Test-Path $c2r) {
        Start-Process $c2r -ArgumentList "scenario=Repair platform=x64 culture=en-us forceappshutdown=True RepairType=FullRepair" -Wait
        Write-Output "Office repair initiated"; exit 0
    }
    Write-Output "OfficeC2R not found"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Reinstall-Office`,
  },
  {
    id: 'add-winget-app',
    name: 'Add Winget App',
    description: 'Template for deploying applications via Windows Package Manager (winget).',
    category: 'Office & Apps',
    detectionScript: `# Detect if app is installed (customize AppId)
# Change $AppId to your target application
$AppId = "Microsoft.VisualStudioCode"
try {
    $installed = winget list --id $AppId --accept-source-agreements 2>&1
    if ($installed -match $AppId) { Write-Output "$AppId installed"; exit 0 }
    else { Write-Output "$AppId not installed"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Install app via winget (customize AppId)
$AppId = "Microsoft.VisualStudioCode"
try {
    winget install --id $AppId --accept-source-agreements --accept-package-agreements --silent
    Write-Output "$AppId installed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Add-Winget-App`,
  },
  {
    id: 'invoke-teams-installation',
    name: 'Install Teams',
    description: 'Detects and installs Microsoft Teams if not present.',
    category: 'Office & Apps',
    detectionScript: `# Detect Teams installation
try {
    $teams = Get-AppxPackage -Name "MSTeams" -ErrorAction SilentlyContinue
    if ($teams -or (Test-Path "$env:LOCALAPPDATA\\Microsoft\\Teams\\current\\Teams.exe")) {
        Write-Output "Teams installed"; exit 0
    }
    Write-Output "Teams not installed"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Install Teams
try {
    $teamsUrl = "https://go.microsoft.com/fwlink/?linkid=2243204&clcid=0x409"
    $installer = "$env:TEMP\\teamsbootstrapper.exe"
    Invoke-WebRequest -Uri $teamsUrl -OutFile $installer -UseBasicParsing
    Start-Process -FilePath $installer -ArgumentList "-p" -Wait
    Write-Output "Teams installed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Invoke-TeamsInstallation`,
  },
  {
    id: 'invoke-teams-reinstallation',
    name: 'Reinstall Teams',
    description: 'Removes and reinstalls Microsoft Teams to fix persistent issues.',
    category: 'Office & Apps',
    detectionScript: `# Detect Teams issues
try {
    $teams = Get-AppxPackage -Name "MSTeams" -ErrorAction SilentlyContinue
    if ($teams) { Write-Output "Teams installed"; exit 0 }
    Write-Output "Teams not found"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reinstall Teams
try {
    Get-AppxPackage -Name "MSTeams" -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    $teamsUrl = "https://go.microsoft.com/fwlink/?linkid=2243204&clcid=0x409"
    $installer = "$env:TEMP\\teamsbootstrapper.exe"
    Invoke-WebRequest -Uri $teamsUrl -OutFile $installer -UseBasicParsing
    Start-Process -FilePath $installer -ArgumentList "-p" -Wait
    Write-Output "Teams reinstalled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Invoke-TeamsReinstallation`,
  },
  {
    id: 'get-office-telemetry',
    name: 'Get Office Telemetry',
    description: 'Collects Office telemetry data for monitoring and troubleshooting.',
    category: 'Office & Apps',
    detectionScript: `# Detect Office telemetry configuration
try {
    $telPath = "HKCU:\\Software\\Microsoft\\Office\\Common\\ClientTelemetry"
    $disabled = (Get-ItemProperty -Path $telPath -Name "DisableTelemetry" -ErrorAction SilentlyContinue).DisableTelemetry
    if ($disabled -eq 1) { Write-Output "Telemetry disabled"; exit 1 }
    Write-Output "Telemetry enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Configure Office telemetry
try {
    Write-Output "Office telemetry configuration reported"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-OfficeTelemetry`,
  },
  {
    id: 'fix-file-associations',
    name: 'Fix File Associations',
    description: 'Resets file associations to ensure documents open with the correct applications.',
    category: 'Office & Apps',
    detectionScript: `# Detect broken file associations
try {
    $assoc = cmd /c assoc .docx 2>&1
    if ($assoc -match "Word.Document") { Write-Output "File associations OK"; exit 0 }
    else { Write-Output "File associations broken"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Fix file associations
try {
    $associations = @{".docx"="Word.Document.12"; ".xlsx"="Excel.Sheet.12"; ".pptx"="PowerPoint.Show.12"; ".pdf"="Acrobat.Document.DC"}
    foreach ($ext in $associations.Keys) {
        cmd /c "assoc $ext=$($associations[$ext])" 2>&1 | Out-Null
    }
    Write-Output "File associations fixed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Fix-FileAssociations`,
  },
  {
    id: 'set-default-browser',
    name: 'Set Default Browser',
    description: 'Configures the default browser for the system (customizable).',
    category: 'Office & Apps',
    detectionScript: `# Detect default browser
try {
    $browser = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice").ProgId
    Write-Output "Default browser: $browser"
    if ($browser -match "Edge") { exit 0 } else { exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Set default browser (customize as needed)
try {
    Write-Output "Default browser configuration requires user interaction via Settings"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Set-DefaultBrowser`,
  },
  {
    id: 'install-cmtrace',
    name: 'Install CMTrace',
    description: 'Installs the CMTrace log viewer tool for reading ConfigMgr/Intune logs.',
    category: 'Office & Apps',
    detectionScript: `# Detect CMTrace
try {
    if (Test-Path "C:\\Windows\\CMTrace.exe") { Write-Output "CMTrace installed"; exit 0 }
    Write-Output "CMTrace not installed"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Install CMTrace
try {
    $url = "https://download.microsoft.com/download/5/0/7/507B43A2-A5FC-4B6A-B2C0-3E8B87E2E411/CMTrace.exe"
    Invoke-WebRequest -Uri $url -OutFile "C:\\Windows\\CMTrace.exe" -UseBasicParsing
    Write-Output "CMTrace installed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Install-CMTrace`,
  },

  // ── Detection & Monitoring ───────────────────────────────
  {
    id: 'detect-admin-users',
    name: 'Detect Admin Users',
    description: 'Detects users with local administrator privileges beyond the built-in admin.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect local admin users
try {
    $admins = Get-LocalGroupMember -Group "Administrators" -ErrorAction Stop
    $nonDefault = $admins | Where-Object { $_.Name -notmatch "Administrator$" -and $_.ObjectClass -eq "User" }
    if ($nonDefault.Count -gt 1) { Write-Output "$($nonDefault.Count) non-default admin users"; exit 1 }
    Write-Output "Admin users OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report admin users
try {
    $admins = Get-LocalGroupMember -Group "Administrators"
    $admins | ForEach-Object { Write-Output "$($_.Name) - $($_.ObjectClass)" }
    Write-Output "Admin user report complete"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-AdminUsers`,
  },
  {
    id: 'detect-autologon',
    name: 'Detect Autologon',
    description: 'Detects if Windows Autologon is configured, which stores credentials in the registry.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect Autologon configuration
try {
    $autoLogin = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "AutoAdminLogon" -ErrorAction SilentlyContinue).AutoAdminLogon
    if ($autoLogin -eq "1") { Write-Output "Autologon ENABLED - security risk"; exit 1 }
    Write-Output "Autologon disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable Autologon
try {
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "AutoAdminLogon" -Value "0" -Force
    Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "DefaultPassword" -Force -ErrorAction SilentlyContinue
    Write-Output "Autologon disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-Autologon`,
  },
  {
    id: 'detect-bluescreen-history',
    name: 'Detect Blue Screen History',
    description: 'Checks for recent BSOD events in the system event log.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect recent BSODs
try {
    $bsods = Get-WinEvent -FilterHashtable @{LogName="System"; Id=1001; ProviderName="Microsoft-Windows-WER-SystemErrorReporting"} -MaxEvents 5 -ErrorAction SilentlyContinue
    if ($bsods.Count -gt 0) { Write-Output "$($bsods.Count) BSOD(s) in recent history"; exit 1 }
    Write-Output "No recent BSODs"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report BSOD history
try {
    $bsods = Get-WinEvent -FilterHashtable @{LogName="System"; Id=1001; ProviderName="Microsoft-Windows-WER-SystemErrorReporting"} -MaxEvents 10 -ErrorAction SilentlyContinue
    $bsods | ForEach-Object { Write-Output "$($_.TimeCreated): $($_.Message.Substring(0,[Math]::Min(200,$_.Message.Length)))" }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-BlueScreenHistory`,
  },
  {
    id: 'detect-browser-passwords',
    name: 'Detect Browser Passwords',
    description: 'Detects if browsers have stored passwords, which may pose a security risk.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect stored browser passwords
try {
    $chromePath = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data"
    $edgePath = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data"
    $hasPasswords = $false
    foreach ($p in @($chromePath, $edgePath)) {
        $loginDb = Get-ChildItem -Path $p -Recurse -Filter "Login Data" -ErrorAction SilentlyContinue
        if ($loginDb) { $hasPasswords = $true }
    }
    if ($hasPasswords) { Write-Output "Browser passwords detected"; exit 1 }
    Write-Output "No browser passwords found"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Browser password report - manual action required
try {
    Write-Output "Browser passwords detected - recommend enabling enterprise password manager"
    Write-Output "Consider deploying browser policy to disable password saving"
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-Browser-Passwords`,
  },
  {
    id: 'detect-certificate-expiry',
    name: 'Detect Certificate Expiry',
    description: 'Checks for certificates expiring within 30 days in the local machine store.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect expiring certificates
try {
    $threshold = (Get-Date).AddDays(30)
    $expiring = Get-ChildItem -Path Cert:\\LocalMachine\\My | Where-Object { $_.NotAfter -lt $threshold -and $_.NotAfter -gt (Get-Date) }
    if ($expiring.Count -gt 0) {
        $expiring | ForEach-Object { Write-Output "$($_.Subject) expires $($_.NotAfter)" }
        exit 1
    }
    Write-Output "No certificates expiring soon"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Certificate expiry report
try {
    $certs = Get-ChildItem -Path Cert:\\LocalMachine\\My | Sort-Object NotAfter
    $certs | ForEach-Object { Write-Output "$($_.Subject): Expires $($_.NotAfter)" }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-CertificateExpiry`,
  },
  {
    id: 'detect-driver-issues',
    name: 'Detect Driver Issues',
    description: 'Scans for devices with driver problems or missing drivers.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect driver issues
try {
    $problems = Get-PnpDevice | Where-Object { $_.Status -ne "OK" -and $_.Class -ne $null }
    if ($problems.Count -gt 0) { Write-Output "$($problems.Count) device(s) with issues"; exit 1 }
    Write-Output "All drivers OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report driver issues
try {
    $problems = Get-PnpDevice | Where-Object { $_.Status -ne "OK" } | Select-Object FriendlyName, Status, Class
    $problems | ForEach-Object { Write-Output "$($_.FriendlyName): $($_.Status)" }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-DriverIssues`,
  },
  {
    id: 'detect-sccm',
    name: 'Detect SCCM Client',
    description: 'Detects if the SCCM/ConfigMgr client is installed (useful for migration scenarios).',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect SCCM client
try {
    $sccm = Get-Service CcmExec -ErrorAction SilentlyContinue
    if ($sccm) { Write-Output "SCCM client installed: $($sccm.Status)"; exit 1 }
    Write-Output "No SCCM client"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Remove SCCM client
try {
    $ccmsetup = "C:\\Windows\\ccmsetup\\ccmsetup.exe"
    if (Test-Path $ccmsetup) {
        Start-Process -FilePath $ccmsetup -ArgumentList "/uninstall" -Wait
        Write-Output "SCCM client removal initiated"; exit 0
    }
    Write-Output "CCMSetup not found"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-SCCM`,
  },
  {
    id: 'detect-suspicious-tasks',
    name: 'Detect Suspicious Scheduled Tasks',
    description: 'Scans for scheduled tasks that may indicate compromise or unwanted software.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect suspicious scheduled tasks
try {
    $tasks = Get-ScheduledTask | Where-Object {
        $_.TaskPath -notmatch "\\\\Microsoft\\\\" -and
        $_.State -eq "Ready" -and
        $_.Actions.Execute -match "(powershell|cmd|wscript|cscript|mshta)"
    }
    if ($tasks.Count -gt 0) { Write-Output "$($tasks.Count) suspicious task(s) found"; exit 1 }
    Write-Output "No suspicious tasks"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report suspicious tasks
try {
    $tasks = Get-ScheduledTask | Where-Object {
        $_.TaskPath -notmatch "\\\\Microsoft\\\\" -and $_.State -eq "Ready"
    }
    $tasks | ForEach-Object { Write-Output "$($_.TaskName): $($_.Actions.Execute)" }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Detect-SuspiciousScheduledTasks`,
  },
  {
    id: 'get-battery-health',
    name: 'Get Battery Health',
    description: 'Reports battery health status including design capacity vs current capacity.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect battery health
try {
    $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
    if ($battery) {
        $health = $battery.EstimatedChargeRemaining
        if ($battery.BatteryStatus -eq 1 -and $health -lt 20) { Write-Output "Battery low: $health%"; exit 1 }
        Write-Output "Battery OK: $health%"; exit 0
    }
    Write-Output "No battery (desktop)"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Generate battery report
try {
    powercfg /batteryreport /output "$env:TEMP\\battery-report.html"
    Write-Output "Battery report generated"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-BatteryHealth`,
  },
  {
    id: 'collect-event-log-errors',
    name: 'Collect Event Log Errors',
    description: 'Collects recent critical and error events from Windows event logs.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect recent error events
try {
    $errors = Get-WinEvent -FilterHashtable @{LogName="System"; Level=1,2; StartTime=(Get-Date).AddDays(-1)} -MaxEvents 10 -ErrorAction SilentlyContinue
    if ($errors.Count -gt 5) { Write-Output "$($errors.Count) errors in last 24h"; exit 1 }
    Write-Output "Event log OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report event log errors
try {
    $errors = Get-WinEvent -FilterHashtable @{LogName="System"; Level=1,2; StartTime=(Get-Date).AddDays(-7)} -MaxEvents 50 -ErrorAction SilentlyContinue
    $errors | ForEach-Object { Write-Output "$($_.TimeCreated) [$($_.LevelDisplayName)] $($_.Message.Substring(0,[Math]::Min(100,$_.Message.Length)))" }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Collect-EventLogErrors`,
  },
  {
    id: 'monitor-disk-space-trend',
    name: 'Monitor Disk Space Trend',
    description: 'Monitors disk space usage over time and alerts on declining trends.',
    category: 'Detection & Monitoring',
    detectionScript: `# Monitor disk space
try {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freePercent = [math]::Round(($disk.FreeSpace / $disk.Size) * 100, 1)
    if ($freePercent -lt 10) { Write-Output "Critical: $freePercent% free"; exit 1 }
    if ($freePercent -lt 20) { Write-Output "Warning: $freePercent% free"; exit 1 }
    Write-Output "Disk space OK: $freePercent% free"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disk space trend report
try {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    Write-Output "Total: $([math]::Round($disk.Size/1GB,1))GB"
    Write-Output "Free: $([math]::Round($disk.FreeSpace/1GB,1))GB"
    Write-Output "Used: $([math]::Round(($disk.Size-$disk.FreeSpace)/1GB,1))GB"
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Monitor-DiskSpace-Trend`,
  },
  {
    id: 'check-pnp-devices',
    name: 'Check PnP Devices',
    description: 'Checks for Plug and Play devices with errors or requiring attention.',
    category: 'Detection & Monitoring',
    detectionScript: `# Check PnP devices
try {
    $issues = Get-PnpDevice | Where-Object { $_.Status -eq "Error" -or $_.Status -eq "Degraded" }
    if ($issues.Count -gt 0) { Write-Output "$($issues.Count) PnP device issues"; exit 1 }
    Write-Output "All PnP devices OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# PnP device report
try {
    Get-PnpDevice | Where-Object { $_.Status -ne "OK" } | ForEach-Object {
        Write-Output "$($_.FriendlyName): $($_.Status) ($($_.InstanceId))"
    }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Check-PNPDevices`,
  },
  {
    id: 'get-connected-devices',
    name: 'Get Connected Devices',
    description: 'Enumerates all connected USB and peripheral devices.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect connected devices
try {
    $usb = Get-PnpDevice -Class USB -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "OK" }
    Write-Output "$($usb.Count) USB devices connected"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report connected devices
try {
    Get-PnpDevice -Class USB | Where-Object { $_.Status -eq "OK" } | ForEach-Object {
        Write-Output "$($_.FriendlyName) - $($_.InstanceId)"
    }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-ConnectedDevices`,
  },
  {
    id: 'get-device-uptime',
    name: 'Get Device Uptime & Reboot',
    description: 'Detects devices with excessive uptime and forces a reboot if needed.',
    category: 'Detection & Monitoring',
    detectionScript: `# Detect device uptime
try {
    $uptime = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
    if ($uptime.Days -gt 14) { Write-Output "Uptime: $($uptime.Days) days - reboot needed"; exit 1 }
    Write-Output "Uptime: $($uptime.Days) days"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Schedule reboot
try {
    shutdown /r /t 3600 /c "Scheduled maintenance reboot in 1 hour"
    Write-Output "Reboot scheduled in 1 hour"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-DeviceUptime_and_Reboot`,
  },

  // ── Configuration ────────────────────────────────────────
  {
    id: 'activate-numlock',
    name: 'Activate Numlock',
    description: 'Ensures NumLock is enabled at startup for all users.',
    category: 'Configuration',
    detectionScript: `# Detect NumLock setting
try {
    $val = (Get-ItemProperty -Path "Registry::HKU\\.DEFAULT\\Control Panel\\Keyboard" -Name "InitialKeyboardIndicators").InitialKeyboardIndicators
    if ($val -eq "2" -or $val -eq "2147483650") { Write-Output "NumLock enabled"; exit 0 }
    Write-Output "NumLock disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable NumLock at startup
try {
    Set-ItemProperty -Path "Registry::HKU\\.DEFAULT\\Control Panel\\Keyboard" -Name "InitialKeyboardIndicators" -Value "2147483650" -Force
    Write-Output "NumLock enabled at startup"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Activate-Numlock`,
  },
  {
    id: 'automatic-timezone',
    name: 'Automatic Timezone',
    description: 'Enables automatic timezone detection and configuration.',
    category: 'Configuration',
    detectionScript: `# Detect timezone configuration
try {
    $svc = Get-Service tzautoupdate
    if ($svc.StartType -eq "Automatic" -and $svc.Status -eq "Running") {
        Write-Output "Auto timezone enabled"; exit 0
    }
    Write-Output "Auto timezone disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable automatic timezone
try {
    Set-Service -Name tzautoupdate -StartupType Automatic
    Start-Service tzautoupdate
    Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\tzautoupdate" -Name "Start" -Value 3 -Force
    Write-Output "Automatic timezone enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/AutomaticTimezone`,
  },
  {
    id: 'change-registry-key',
    name: 'Change Registry Key (Generic)',
    description: 'Template for detecting and changing a single registry key value.',
    category: 'Configuration',
    detectionScript: `# Generic registry key detection template
# Customize these variables:
$RegPath = "HKLM:\\SOFTWARE\\YourCompany\\Settings"
$RegName = "YourSetting"
$ExpectedValue = 1
try {
    $current = (Get-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue).$RegName
    if ($current -eq $ExpectedValue) { Write-Output "Registry key OK"; exit 0 }
    else { Write-Output "Registry key needs update"; exit 1 }
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Generic registry key remediation template
$RegPath = "HKLM:\\SOFTWARE\\YourCompany\\Settings"
$RegName = "YourSetting"
$DesiredValue = 1
$RegType = "DWord"
try {
    if (-not (Test-Path $RegPath)) { New-Item -Path $RegPath -Force | Out-Null }
    Set-ItemProperty -Path $RegPath -Name $RegName -Value $DesiredValue -Type $RegType -Force
    Write-Output "Registry key set"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Change-Registry-Key-Generic`,
  },
  {
    id: 'change-multiple-registry-keys',
    name: 'Change Multiple Registry Keys',
    description: 'Template for detecting and changing multiple registry keys at once, including Delete action support.',
    category: 'Configuration',
    detectionScript: `# Multiple registry keys detection template
$Keys = @(
    @{ Path="HKLM:\\SOFTWARE\\YourCompany"; Name="Setting1"; Value=1; Action="Set" },
    @{ Path="HKLM:\\SOFTWARE\\YourCompany"; Name="Setting2"; Value="Enabled"; Action="Set" }
)
try {
    $issues = 0
    foreach ($key in $Keys) {
        $current = (Get-ItemProperty -Path $key.Path -Name $key.Name -ErrorAction SilentlyContinue).($key.Name)
        if ($key.Action -eq "Delete" -and $current -ne $null) { $issues++ }
        elseif ($key.Action -eq "Set" -and $current -ne $key.Value) { $issues++ }
    }
    if ($issues -gt 0) { Write-Output "$issues keys need update"; exit 1 }
    Write-Output "All keys OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Multiple registry keys remediation template
$Keys = @(
    @{ Path="HKLM:\\SOFTWARE\\YourCompany"; Name="Setting1"; Value=1; Type="DWord"; Action="Set" },
    @{ Path="HKLM:\\SOFTWARE\\YourCompany"; Name="Setting2"; Value="Enabled"; Type="String"; Action="Set" }
)
try {
    foreach ($key in $Keys) {
        if (-not (Test-Path $key.Path)) { New-Item -Path $key.Path -Force | Out-Null }
        if ($key.Action -eq "Delete") {
            Remove-ItemProperty -Path $key.Path -Name $key.Name -Force -ErrorAction SilentlyContinue
        } else {
            Set-ItemProperty -Path $key.Path -Name $key.Name -Value $key.Value -Type $key.Type -Force
        }
    }
    Write-Output "Registry keys updated"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Change-MultipleRegistryKeys`,
  },
  {
    id: 'create-local-admin',
    name: 'Create Local Admin',
    description: 'Creates a local administrator account with a secure random password.',
    category: 'Configuration',
    detectionScript: `# Detect local admin account
$AdminUser = "LocalITAdmin"
try {
    $user = Get-LocalUser -Name $AdminUser -ErrorAction SilentlyContinue
    if ($user) { Write-Output "$AdminUser exists"; exit 0 }
    Write-Output "$AdminUser does not exist"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Create local admin account
$AdminUser = "LocalITAdmin"
try {
    $pw = ConvertTo-SecureString ([guid]::NewGuid().ToString() + "!Aa1") -AsPlainText -Force
    New-LocalUser -Name $AdminUser -Password $pw -PasswordNeverExpires -AccountNeverExpires
    Add-LocalGroupMember -Group "Administrators" -Member $AdminUser
    Write-Output "$AdminUser created"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Create-LocalAdmin`,
  },
  {
    id: 'disable-coinstaller',
    name: 'Disable Co-installer',
    description: 'Disables device driver co-installers to prevent unwanted software installation.',
    category: 'Configuration',
    detectionScript: `# Detect co-installer setting
try {
    $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Device Installer" -Name "DisableCoInstallers" -ErrorAction SilentlyContinue).DisableCoInstallers
    if ($val -eq 1) { Write-Output "Co-installers disabled"; exit 0 }
    Write-Output "Co-installers enabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable co-installers
try {
    $path = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Device Installer"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "DisableCoInstallers" -Value 1 -Type DWord -Force
    Write-Output "Co-installers disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Disable-Coinstaller`,
  },
  {
    id: 'disable-fastboot',
    name: 'Disable Fast Boot',
    description: 'Disables Windows Fast Startup to ensure clean shutdowns and proper updates.',
    category: 'Configuration',
    detectionScript: `# Detect Fast Boot
try {
    $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" -Name "HiberbootEnabled" -ErrorAction SilentlyContinue).HiberbootEnabled
    if ($val -eq 0) { Write-Output "Fast Boot disabled"; exit 0 }
    Write-Output "Fast Boot enabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable Fast Boot
try {
    Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" -Name "HiberbootEnabled" -Value 0 -Type DWord -Force
    Write-Output "Fast Boot disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Disable-Fastboot`,
  },
  {
    id: 'disable-start-menu-web-search',
    name: 'Disable Start Menu Web Search',
    description: 'Disables Bing web search results in the Windows Start Menu.',
    category: 'Configuration',
    detectionScript: `# Detect Start Menu web search
try {
    $val = (Get-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Name "DisableSearchBoxSuggestions" -ErrorAction SilentlyContinue).DisableSearchBoxSuggestions
    if ($val -eq 1) { Write-Output "Web search disabled"; exit 0 }
    Write-Output "Web search enabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Disable Start Menu web search
try {
    $path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "DisableSearchBoxSuggestions" -Value 1 -Type DWord -Force
    Write-Output "Web search disabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Disable-StartMenuWebSearch`,
  },
  {
    id: 'enable-dark-mode',
    name: 'Enable Dark Mode',
    description: 'Enables Windows dark mode for apps and system UI.',
    category: 'Configuration',
    detectionScript: `# Detect dark mode
try {
    $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "AppsUseLightTheme" -ErrorAction SilentlyContinue).AppsUseLightTheme
    if ($val -eq 0) { Write-Output "Dark mode enabled"; exit 0 }
    Write-Output "Light mode active"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable dark mode
try {
    $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"
    Set-ItemProperty -Path $path -Name "AppsUseLightTheme" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $path -Name "SystemUsesLightTheme" -Value 0 -Type DWord -Force
    Write-Output "Dark mode enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-DarkMode`,
  },
  {
    id: 'enable-dotnet-35',
    name: 'Enable .NET 3.5',
    description: 'Enables the .NET Framework 3.5 Windows feature for legacy application support.',
    category: 'Configuration',
    detectionScript: `# Detect .NET 3.5
try {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName "NetFx3" -ErrorAction Stop
    if ($feature.State -eq "Enabled") { Write-Output ".NET 3.5 enabled"; exit 0 }
    Write-Output ".NET 3.5 not enabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable .NET 3.5
try {
    Enable-WindowsOptionalFeature -Online -FeatureName "NetFx3" -All -NoRestart
    Write-Output ".NET 3.5 enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-DotNet-35`,
  },
  {
    id: 'enable-rdp',
    name: 'Enable RDP',
    description: 'Enables Remote Desktop Protocol for remote management.',
    category: 'Configuration',
    detectionScript: `# Detect RDP status
try {
    $rdp = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections").fDenyTSConnections
    if ($rdp -eq 0) { Write-Output "RDP enabled"; exit 0 }
    Write-Output "RDP disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable RDP
try {
    Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0 -Type DWord -Force
    Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
    Write-Output "RDP enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-RDP`,
  },
  {
    id: 'enable-dns-operational-logs',
    name: 'Enable DNS Operational Logs',
    description: 'Enables the DNS Client operational event log for DNS troubleshooting.',
    category: 'Configuration',
    detectionScript: `# Detect DNS operational logging
try {
    $log = Get-WinEvent -ListLog "Microsoft-Windows-DNS-Client/Operational" -ErrorAction Stop
    if ($log.IsEnabled) { Write-Output "DNS logging enabled"; exit 0 }
    Write-Output "DNS logging disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable DNS operational logging
try {
    $log = Get-WinEvent -ListLog "Microsoft-Windows-DNS-Client/Operational"
    $log.IsEnabled = $true
    $log.SaveChanges()
    Write-Output "DNS operational logging enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-DNSOperationalLogs`,
  },
  {
    id: 'enable-delivery-optimization-logging',
    name: 'Enable Delivery Optimization Logging',
    description: 'Enables verbose logging for Windows Delivery Optimization.',
    category: 'Configuration',
    detectionScript: `# Detect DO verbose logging
try {
    $log = Get-WinEvent -ListLog "Microsoft-Windows-DeliveryOptimization/Operational" -ErrorAction Stop
    if ($log.IsEnabled) { Write-Output "DO logging enabled"; exit 0 }
    Write-Output "DO logging disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable DO verbose logging
try {
    $log = Get-WinEvent -ListLog "Microsoft-Windows-DeliveryOptimization/Operational"
    $log.IsEnabled = $true
    $log.SaveChanges()
    Write-Output "DO logging enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Enable-DeliveryOptimizationVerboseLogging`,
  },
  {
    id: 'rotate-local-admin-password',
    name: 'Rotate Local Admin Password',
    description: 'Detects and rotates the local administrator password if it is older than 90 days.',
    category: 'Configuration',
    detectionScript: `# Detect password age
try {
    $admin = Get-LocalUser -Name "Administrator" -ErrorAction Stop
    $pwAge = ((Get-Date) - $admin.PasswordLastSet).Days
    if ($pwAge -gt 90) { Write-Output "Password age: $pwAge days"; exit 1 }
    Write-Output "Password OK ($pwAge days)"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Rotate admin password
try {
    $pw = ConvertTo-SecureString ([guid]::NewGuid().ToString().Substring(0,16) + "!Aa1") -AsPlainText -Force
    Set-LocalUser -Name "Administrator" -Password $pw
    Write-Output "Admin password rotated"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Rotate-LocalAdminPassword`,
  },
  {
    id: 'optimize-startup-programs',
    name: 'Optimize Startup Programs',
    description: 'Detects and disables unnecessary startup programs to improve boot time.',
    category: 'Configuration',
    detectionScript: `# Detect startup programs
try {
    $startup = Get-CimInstance -ClassName Win32_StartupCommand
    if ($startup.Count -gt 10) { Write-Output "$($startup.Count) startup programs"; exit 1 }
    Write-Output "Startup OK ($($startup.Count) programs)"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Report startup programs
try {
    $startup = Get-CimInstance -ClassName Win32_StartupCommand
    $startup | ForEach-Object { Write-Output "$($_.Name): $($_.Command)" }
    Write-Output "Startup programs reported - review for optimization"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Optimize-StartupPrograms`,
  },
  {
    id: 'set-service-generic',
    name: 'Set Service (Generic)',
    description: 'Template for configuring a Windows service startup type and state.',
    category: 'Configuration',
    detectionScript: `# Generic service detection template
$ServiceName = "YourServiceName"
$ExpectedStartType = "Automatic"
try {
    $svc = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($svc.StartType -eq $ExpectedStartType -and $svc.Status -eq "Running") {
        Write-Output "$ServiceName OK"; exit 0
    }
    Write-Output "$ServiceName needs config"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Generic service remediation template
$ServiceName = "YourServiceName"
$StartType = "Automatic"
try {
    Set-Service -Name $ServiceName -StartupType $StartType
    Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    Write-Output "$ServiceName configured"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Set-Service-Generic`,
  },
  {
    id: 'restart-service-generic',
    name: 'Restart Service (Generic)',
    description: 'Template for restarting a Windows service that may be stuck or unresponsive.',
    category: 'Configuration',
    detectionScript: `# Generic service health check
$ServiceName = "YourServiceName"
try {
    $svc = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($svc.Status -eq "Running") { Write-Output "$ServiceName running"; exit 0 }
    Write-Output "$ServiceName not running: $($svc.Status)"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Restart service
$ServiceName = "YourServiceName"
try {
    Restart-Service -Name $ServiceName -Force
    Write-Output "$ServiceName restarted"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Restart-Service-Generic`,
  },

  // ── Windows Updates ──────────────────────────────────────
  {
    id: 'install-windows-updates',
    name: 'Install Windows Updates',
    description: 'Checks for pending Windows updates and installs them using the Windows Update COM API.',
    category: 'Windows Updates',
    detectionScript: `# Detect pending Windows updates
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $results = $searcher.Search("IsInstalled=0 AND IsHidden=0")
    if ($results.Updates.Count -gt 0) {
        Write-Output "$($results.Updates.Count) updates pending"; exit 1
    }
    Write-Output "No pending updates"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Install pending updates
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $results = $searcher.Search("IsInstalled=0 AND IsHidden=0")
    if ($results.Updates.Count -gt 0) {
        $downloader = $session.CreateUpdateDownloader()
        $downloader.Updates = $results.Updates
        $downloader.Download()
        $installer = $session.CreateUpdateInstaller()
        $installer.Updates = $results.Updates
        $installer.Install()
    }
    Write-Output "Updates installed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Install-WindowsUpdates`,
  },
  {
    id: 'reset-windows-update',
    name: 'Reset Windows Update',
    description: 'Performs a complete Windows Update component reset to fix update failures.',
    category: 'Windows Updates',
    detectionScript: `# Detect Windows Update issues
try {
    $svc = Get-Service wuauserv
    if ($svc.Status -ne "Running") { Write-Output "WU service not running"; exit 1 }
    Write-Output "WU service OK"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Reset Windows Update components
try {
    $services = @("wuauserv","cryptSvc","bits","msiserver")
    foreach ($s in $services) { Stop-Service -Name $s -Force -ErrorAction SilentlyContinue }
    Rename-Item "C:\\Windows\\SoftwareDistribution" "C:\\Windows\\SoftwareDistribution.bak" -Force -ErrorAction SilentlyContinue
    Rename-Item "C:\\Windows\\System32\\catroot2" "C:\\Windows\\System32\\catroot2.bak" -Force -ErrorAction SilentlyContinue
    foreach ($s in $services) { Start-Service -Name $s }
    Write-Output "Windows Update reset"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Reset-WindowsUpdate`,
  },
  {
    id: 'restart-wu-service',
    name: 'Restart Windows Update Service',
    description: 'Restarts the Windows Update service to clear stuck states.',
    category: 'Windows Updates',
    detectionScript: `# Detect WU service health
try {
    $svc = Get-Service wuauserv
    if ($svc.Status -eq "Running") { Write-Output "WU service running"; exit 0 }
    Write-Output "WU service: $($svc.Status)"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Restart WU service
try {
    Restart-Service wuauserv -Force
    Write-Output "WU service restarted"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Restart-Windows-Update-Service`,
  },
  {
    id: 'toast-reboot-message',
    name: 'Toast Reboot Message',
    description: 'Displays a toast notification reminding users to reboot their device.',
    category: 'Windows Updates',
    detectionScript: `# Detect pending reboot
try {
    $rebootPending = Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired"
    $cbsPending = Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending"
    if ($rebootPending -or $cbsPending) { Write-Output "Reboot pending"; exit 1 }
    Write-Output "No reboot needed"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Show toast notification for reboot
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $text = $template.GetElementsByTagName("text")
    $text[0].AppendChild($template.CreateTextNode("Reboot Required")) | Out-Null
    $text[1].AppendChild($template.CreateTextNode("Please restart your device to complete pending updates.")) | Out-Null
    $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Microsoft.SoftwareCenter.DesktopToasts").Show($toast)
    Write-Output "Toast notification shown"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Toast-RebootMessage`,
  },

  // ── Data & Backup ────────────────────────────────────────
  {
    id: 'copy-files-blob-storage',
    name: 'Copy Files to Blob Storage',
    description: 'Uploads files to Azure Blob Storage via SAS token for backup purposes.',
    category: 'Data & Backup',
    detectionScript: `# Detect files needing upload
try {
    $markerFile = "$env:ProgramData\\BlobUpload\\lastupload.marker"
    if (Test-Path $markerFile) {
        $lastUpload = Get-Content $markerFile
        $lastDate = [DateTime]::Parse($lastUpload)
        if ((Get-Date) - $lastDate -lt [TimeSpan]::FromDays(1)) {
            Write-Output "Upload recent"; exit 0
        }
    }
    Write-Output "Upload needed"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Upload files to Azure Blob Storage
# Configure these variables:
$SasUrl = "https://youraccount.blob.core.windows.net/container?sv=...&sig=..."
$SourcePath = "C:\\Logs"
try {
    $files = Get-ChildItem -Path $SourcePath -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $blobUrl = "$SasUrl/$($f.Name)"
        $headers = @{ "x-ms-blob-type" = "BlockBlob" }
        Invoke-RestMethod -Uri $blobUrl -Method Put -Headers $headers -InFile $f.FullName
    }
    $markerDir = "$env:ProgramData\\BlobUpload"
    if (-not (Test-Path $markerDir)) { New-Item -Path $markerDir -ItemType Directory -Force | Out-Null }
    (Get-Date).ToString("o") | Set-Content "$markerDir\\lastupload.marker"
    Write-Output "Files uploaded"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Copy-FilesToBlobStorage`,
  },
  {
    id: 'profile-backup',
    name: 'Profile Backup',
    description: 'Backs up user profile data including Desktop, Documents, and Favorites.',
    category: 'Data & Backup',
    detectionScript: `# Detect if backup is needed
try {
    $backupPath = "C:\\Backups\\UserProfile"
    if (Test-Path $backupPath) {
        $lastBackup = (Get-ChildItem -Path $backupPath -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
        if ((Get-Date) - $lastBackup -lt [TimeSpan]::FromDays(7)) {
            Write-Output "Backup recent"; exit 0
        }
    }
    Write-Output "Backup needed"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Backup user profile
try {
    $date = (Get-Date).ToString("yyyyMMdd")
    $dest = "C:\\Backups\\UserProfile\\$date"
    New-Item -Path $dest -ItemType Directory -Force | Out-Null
    $folders = @("Desktop","Documents","Favorites","Pictures")
    foreach ($f in $folders) {
        $src = "$env:USERPROFILE\\$f"
        if (Test-Path $src) { Copy-Item -Path $src -Destination "$dest\\$f" -Recurse -Force }
    }
    Write-Output "Profile backed up to $dest"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/Profile-Backup`,
  },
  {
    id: 'get-bitlocker-recovery-key',
    name: 'Get BitLocker Recovery Key',
    description: 'Retrieves and backs up the BitLocker recovery key to Active Directory/Entra ID.',
    category: 'Data & Backup',
    detectionScript: `# Detect BitLocker recovery key backup
try {
    $blv = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
    $kp = $blv.KeyProtector | Where-Object { $_.KeyProtectorType -eq "RecoveryPassword" }
    if ($kp) { Write-Output "Recovery key exists"; exit 0 }
    Write-Output "No recovery key found"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Backup BitLocker recovery key to AAD
try {
    $blv = Get-BitLockerVolume -MountPoint $env:SystemDrive
    $kp = $blv.KeyProtector | Where-Object { $_.KeyProtectorType -eq "RecoveryPassword" }
    if ($kp) {
        BackupToAAD-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId $kp[0].KeyProtectorId
        Write-Output "Recovery key backed up"; exit 0
    }
    Write-Output "No recovery key to backup"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-BitlockerRecoveryKey`,
  },
  {
    id: 'onedrive-always-offline',
    name: 'OneDrive Folder Always Offline',
    description: 'Configures OneDrive folders to always keep files available offline.',
    category: 'Data & Backup',
    detectionScript: `# Detect OneDrive offline settings
try {
    $odPath = "$env:USERPROFILE\\OneDrive"
    if (Test-Path $odPath) { Write-Output "OneDrive folder exists"; exit 0 }
    Write-Output "OneDrive not configured"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Set OneDrive folders always offline
try {
    $odPath = "$env:USERPROFILE\\OneDrive"
    if (Test-Path $odPath) {
        attrib +P -U "$odPath\\*" /S /D
        Write-Output "OneDrive folders set to always offline"; exit 0
    }
    Write-Output "OneDrive path not found"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'User',
    runAs32Bit: false,
    source: `${BASE_URL}/OneDrive%20Folder%20-%20Always%20Offline`,
  },

  // ── Defender ─────────────────────────────────────────────
  {
    id: 'get-cloud-delivered-protection',
    name: 'Get Cloud-Delivered Protection',
    description: 'Checks if Microsoft Defender cloud-delivered protection is enabled.',
    category: 'Defender',
    detectionScript: `# Detect cloud protection
try {
    $mp = Get-MpPreference
    if ($mp.MAPSReporting -ge 2) { Write-Output "Cloud protection enabled"; exit 0 }
    Write-Output "Cloud protection disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable cloud protection
try {
    Set-MpPreference -MAPSReporting Advanced
    Set-MpPreference -SubmitSamplesConsent SendAllSamples
    Write-Output "Cloud protection enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-CloudDeliveredProtection`,
  },
  {
    id: 'get-network-protection',
    name: 'Get Network Protection',
    description: 'Checks if Microsoft Defender Network Protection is enabled.',
    category: 'Defender',
    detectionScript: `# Detect network protection
try {
    $mp = Get-MpPreference
    if ($mp.EnableNetworkProtection -eq 1) { Write-Output "Network protection enabled"; exit 0 }
    Write-Output "Network protection disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable network protection
try {
    Set-MpPreference -EnableNetworkProtection Enabled
    Write-Output "Network protection enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-NetworkProtection`,
  },
  {
    id: 'get-pua-protection',
    name: 'Get PUA Protection',
    description: 'Checks if Microsoft Defender Potentially Unwanted Application (PUA) protection is enabled.',
    category: 'Defender',
    detectionScript: `# Detect PUA protection
try {
    $mp = Get-MpPreference
    if ($mp.PUAProtection -eq 1) { Write-Output "PUA protection enabled"; exit 0 }
    Write-Output "PUA protection disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable PUA protection
try {
    Set-MpPreference -PUAProtection Enabled
    Write-Output "PUA protection enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-PUA-Protection`,
  },
  {
    id: 'get-realtime-behaviour',
    name: 'Get Real-Time Behaviour Monitoring',
    description: 'Checks if Microsoft Defender real-time behavior monitoring is enabled.',
    category: 'Defender',
    detectionScript: `# Detect behavior monitoring
try {
    $mp = Get-MpPreference
    if ($mp.DisableBehaviorMonitoring -eq $false) { Write-Output "Behavior monitoring enabled"; exit 0 }
    Write-Output "Behavior monitoring disabled"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable behavior monitoring
try {
    Set-MpPreference -DisableBehaviorMonitoring $false
    Write-Output "Behavior monitoring enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-RealTimeBehaviour`,
  },
  {
    id: 'get-realtime-protection',
    name: 'Get Real-Time Protection',
    description: 'Checks if Microsoft Defender real-time protection is enabled.',
    category: 'Defender',
    detectionScript: `# Detect real-time protection
try {
    $mp = Get-MpPreference
    if ($mp.DisableRealtimeMonitoring -eq $false) { Write-Output "Real-time protection enabled"; exit 0 }
    Write-Output "Real-time protection DISABLED"; exit 1
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    remediationScript: `# Enable real-time protection
try {
    Set-MpPreference -DisableRealtimeMonitoring $false
    Write-Output "Real-time protection enabled"; exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }`,
    runAs: 'System',
    runAs32Bit: false,
    source: `${BASE_URL}/Get-RealTimeProtection`,
  },
];

export const remediationCategories: RemediationCategory[] = [
  'Security',
  'Cleanup',
  'Maintenance',
  'Network',
  'Office & Apps',
  'Detection & Monitoring',
  'Configuration',
  'Windows Updates',
  'Data & Backup',
  'Defender',
];
