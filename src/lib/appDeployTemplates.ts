export type AppDeployCategory =
  | 'Browsers'
  | 'Productivity'
  | 'Communication'
  | 'Development'
  | 'Security'
  | 'Utilities'
  | 'Custom';

export const appDeployCategories: AppDeployCategory[] = [
  'Browsers',
  'Productivity',
  'Communication',
  'Development',
  'Security',
  'Utilities',
  'Custom',
];

export interface AppDeployTemplate {
  id: string;
  name: string;
  description: string;
  category: AppDeployCategory;
  publisher: string;
  installScript: string;
  uninstallScript: string;
  detectionScript: string;
  requirements: string;
  source: string;
}

const psadtHeader = (appName: string, appVersion: string, appPublisher: string) =>
  `<#
.SYNOPSIS
    PSAppDeployToolkit - ${appName} ${appVersion}
.DESCRIPTION
    Deploys ${appName} using the PSAppDeployToolkit framework.
    https://psappdeploytoolkit.com
#>

[CmdletBinding()]
Param (
    [Parameter(Mandatory = $false)]
    [ValidateSet('Install', 'Uninstall', 'Repair')]
    [String]$DeploymentType = 'Install',
    [Parameter(Mandatory = $false)]
    [ValidateSet('Interactive', 'Silent', 'NonInteractive')]
    [String]$DeployMode = 'Interactive',
    [Parameter(Mandatory = $false)]
    [switch]$AllowRebootPassThru = $false,
    [Parameter(Mandatory = $false)]
    [switch]$TerminalServerMode = $false,
    [Parameter(Mandatory = $false)]
    [switch]$DisableLogging = $false
)

Try {
    ## Set the script execution policy
    Try { Set-ExecutionPolicy -ExecutionPolicy 'ByPass' -Scope 'Process' -Force -ErrorAction 'Stop' } Catch {}

    ##*===============================================
    ##* VARIABLE DECLARATION
    ##*===============================================
    [String]$appVendor = '${appPublisher}'
    [String]$appName = '${appName}'
    [String]$appVersion = '${appVersion}'
    [String]$appArch = 'x64'
    [String]$appLang = 'EN'
    [String]$appRevision = '01'
    [String]$appScriptVersion = '1.0.0'
    [String]$appScriptDate = '2024-01-01'
    [String]$appScriptAuthor = 'IT Admin'

    ## Variables: Install Titles (Balloon Notifications)
    [String]$installTitle = "$appName $appVersion"`;

const psadtFooter = `
    ##*===============================================
    ##* END SCRIPT BODY
    ##*===============================================
}
Catch {
    [Int32]$mainExitCode = 60001
    [String]$mainErrorMessage = "$(Resolve-Error)"
    Write-Log -Message $mainErrorMessage -Severity 3 -Source $appDeployToolkitName
    Show-DialogBox -Text $mainErrorMessage -Icon 'Stop'
    Exit-Script -ExitCode $mainExitCode
}`;

export const appDeployTemplates: AppDeployTemplate[] = [
  // ===== BROWSERS =====
  {
    id: 'chrome-deploy',
    name: 'Google Chrome',
    description: 'Deploy or update Google Chrome Enterprise (MSI) with PSADT. Closes running instances, installs silently, and sets as default browser.',
    category: 'Browsers',
    publisher: 'Google',
    installScript: `${psadtHeader('Google Chrome', '131.0', 'Google LLC')}

    ##*===============================================
    ##* PRE-INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Pre-Installation'

    ## Show welcome message, close Chrome if running, allow up to 3 deferrals
    Show-InstallationWelcome -CloseApps 'chrome' -AllowDefer -DeferTimes 3 -CheckDiskSpace -PersistPrompt
    Show-InstallationProgress -StatusMessage "Installing Google Chrome. Please wait..."

    ##*===============================================
    ##* INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Installation'

    ## Install Chrome Enterprise MSI
    Execute-MSI -Action 'Install' -Path 'GoogleChromeStandaloneEnterprise64.msi' -Parameters '/QN /norestart'

    ##*===============================================
    ##* POST-INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Post-Installation'

    ## Disable Chrome auto-update (managed via Intune)
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Google\\Update' -Name 'UpdateDefault' -Value 0 -Type DWord
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Google\\Update' -Name 'AutoUpdateCheckPeriodMinutes' -Value 0 -Type DWord

    Show-InstallationPrompt -Message "Google Chrome has been successfully installed." -ButtonRightText 'OK' -Icon Information
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Google Chrome', '131.0', 'Google LLC')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'chrome' -PersistPrompt

    [String]$installPhase = 'Uninstallation'
    Execute-MSI -Action 'Uninstall' -Path '{ProductCode}' -Parameters '/QN /norestart'
    ## Alternative: Remove-MSIApplications -Name 'Google Chrome'

    [String]$installPhase = 'Post-Uninstallation'
    Remove-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Google' -Recurse
${psadtFooter}`,
    detectionScript: `# Detection Script - Google Chrome
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Google Chrome*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10 1809+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'firefox-deploy',
    name: 'Mozilla Firefox',
    description: 'Deploy Mozilla Firefox ESR with PSADT. Handles profile migration, closes running instances, installs with enterprise policies.',
    category: 'Browsers',
    publisher: 'Mozilla',
    installScript: `${psadtHeader('Mozilla Firefox', '128.0 ESR', 'Mozilla')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'firefox' -AllowDefer -DeferTimes 3 -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'Firefox Setup 128.0esr.exe' -Parameters '/S /MaintenanceService=false' -WindowStyle Hidden -WaitForMsiExec

    [String]$installPhase = 'Post-Installation'
    ## Deploy enterprise policies.json
    Copy-File -Path "$dirFiles\\policies.json" -Destination "$envProgramFiles\\Mozilla Firefox\\distribution\\policies.json"
    ## Disable auto-update (managed via Intune)
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Mozilla\\Firefox' -Name 'DisableAppUpdate' -Value 1 -Type DWord
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Mozilla Firefox', '128.0 ESR', 'Mozilla')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'firefox'

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path "$envProgramFiles\\Mozilla Firefox\\uninstall\\helper.exe" -Parameters '/S' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Mozilla Firefox
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Mozilla Firefox*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10 1809+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'edge-deploy',
    name: 'Microsoft Edge',
    description: 'Deploy or update Microsoft Edge for Business with enterprise policies and managed update channels.',
    category: 'Browsers',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Microsoft Edge', '131.0', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'msedge' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'MicrosoftEdgeEnterpriseX64.msi' -Parameters '/QN /norestart DONOTCREATEDESKTOPSHORTCUT=true'

    [String]$installPhase = 'Post-Installation'
    ## Configure Edge update channel to Stable
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Microsoft\\EdgeUpdate' -Name 'UpdateDefault' -Value 1 -Type DWord
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Microsoft Edge', '131.0', 'Microsoft')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'msedge'

    [String]$installPhase = 'Uninstallation'
    Execute-MSI -Action 'Uninstall' -Path '{ProductCode}' -Parameters '/QN /norestart'
${psadtFooter}`,
    detectionScript: `# Detection Script - Microsoft Edge
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Microsoft Edge*" }
if ($app -and [version]$app.DisplayVersion -ge [version]"131.0") { Write-Host "Installed"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10 1809+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== PRODUCTIVITY =====
  {
    id: 'm365-deploy',
    name: 'Microsoft 365 Apps',
    description: 'Deploy Microsoft 365 Apps for Enterprise using the Office Deployment Tool (ODT) wrapped in PSADT. Supports configuration XML customization.',
    category: 'Productivity',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Microsoft 365 Apps', '2024', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'winword,excel,powerpnt,outlook,onenote,mspub,msaccess,lync,groove' -AllowDefer -DeferTimes 3 -PersistPrompt
    Show-InstallationProgress -StatusMessage "Installing Microsoft 365 Apps. This may take 15-30 minutes..."

    [String]$installPhase = 'Installation'
    ## Run ODT setup with configuration XML
    Execute-Process -Path 'setup.exe' -Parameters '/configure configuration.xml' -WindowStyle Hidden -WaitForMsiExec

    [String]$installPhase = 'Post-Installation'
    ## Wait for Office ClickToRun to finish
    Start-Sleep -Seconds 30
    ## Verify installation
    $officeInstalled = Test-Path "$envProgramFiles\\Microsoft Office\\root\\Office16\\WINWORD.EXE"
    If (-not $officeInstalled) { Write-Log -Message "Office installation may still be in progress" -Severity 2 }
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Microsoft 365 Apps', '2024', 'Microsoft')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'winword,excel,powerpnt,outlook,onenote' -PersistPrompt

    [String]$installPhase = 'Uninstallation'
    ## Use ODT with remove-all configuration
    Execute-Process -Path 'setup.exe' -Parameters '/configure remove-all.xml' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Microsoft 365 Apps
$office = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\O365ProPlusRetail*" -ErrorAction SilentlyContinue
if ($office) { Write-Host "Installed: $($office.DisplayVersion)"; exit 0 }
$c2r = Test-Path "$env:ProgramFiles\\Microsoft Office\\root\\Office16\\WINWORD.EXE"
if ($c2r) { Write-Host "Installed"; exit 0 }
exit 1`,
    requirements: 'Windows 10 1809+ (x64), 4GB RAM, 10GB disk',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'adobe-reader-deploy',
    name: 'Adobe Acrobat Reader DC',
    description: 'Deploy Adobe Acrobat Reader DC with enterprise customization, auto-update disabled, and telemetry opt-out.',
    category: 'Productivity',
    publisher: 'Adobe',
    installScript: `${psadtHeader('Adobe Acrobat Reader DC', '2024.001', 'Adobe')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'AcroRd32,Acrobat' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'AcroRdrDC2400120379_en_US.exe' -Parameters '/sAll /rs /msi EULA_ACCEPT=YES DISABLEDESKTOPSHORTCUT=1 UPDATE_MODE=0' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Disable auto-update
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Adobe\\Acrobat Reader\\DC\\FeatureLockDown' -Name 'bUpdater' -Value 0 -Type DWord
    ## Disable telemetry
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Adobe\\Acrobat Reader\\DC\\FeatureLockDown' -Name 'bUsageMeasurement' -Value 0 -Type DWord
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Adobe Acrobat Reader DC', '2024.001', 'Adobe')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'AcroRd32,Acrobat'

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Adobe Acrobat Reader'
${psadtFooter}`,
    detectionScript: `# Detection Script - Adobe Acrobat Reader DC
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Adobe Acrobat Reader*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10 1809+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: '7zip-deploy',
    name: '7-Zip',
    description: 'Deploy 7-Zip file archiver with file association configuration and silent MSI installation.',
    category: 'Productivity',
    publisher: 'Igor Pavlov',
    installScript: `${psadtHeader('7-Zip', '24.08', 'Igor Pavlov')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps '7zFM,7zG' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path '7z2408-x64.msi' -Parameters '/QN /norestart'

    [String]$installPhase = 'Post-Installation'
    ## Register file associations
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\7-Zip' -Name 'Path' -Value "$envProgramFiles\\7-Zip\\"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('7-Zip', '24.08', 'Igor Pavlov')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name '7-Zip'
${psadtFooter}`,
    detectionScript: `# Detection Script - 7-Zip
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "7-Zip*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'notepadpp-deploy',
    name: 'Notepad++',
    description: 'Deploy Notepad++ text editor with plugin support and file association setup.',
    category: 'Productivity',
    publisher: 'Don Ho',
    installScript: `${psadtHeader('Notepad++', '8.7', 'Don Ho')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'notepad++' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'npp.8.7.Installer.x64.exe' -Parameters '/S' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Disable auto-update check
    $configPath = "$envProgramFiles\\Notepad++\\config.xml"
    If (Test-Path $configPath) {
        (Get-Content $configPath) -replace 'noUpdate="no"', 'noUpdate="yes"' | Set-Content $configPath
    }
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Notepad++', '8.7', 'Don Ho')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path "$envProgramFiles\\Notepad++\\uninstall.exe" -Parameters '/S' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Notepad++
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Notepad++*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'vlc-deploy',
    name: 'VLC Media Player',
    description: 'Deploy VLC media player with codec associations and auto-update disabled.',
    category: 'Productivity',
    publisher: 'VideoLAN',
    installScript: `${psadtHeader('VLC Media Player', '3.0.21', 'VideoLAN')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'vlc' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'vlc-3.0.21-win64.exe' -Parameters '/L=1033 /S' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\VideoLAN\\VLC' -Name 'DisableCheckUpdate' -Value 1 -Type DWord
${psadtFooter}`,
    uninstallScript: `${psadtHeader('VLC Media Player', '3.0.21', 'VideoLAN')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path "$envProgramFiles\\VideoLAN\\VLC\\uninstall.exe" -Parameters '/S' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - VLC
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "VLC media player*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== COMMUNICATION =====
  {
    id: 'teams-deploy',
    name: 'Microsoft Teams (New)',
    description: 'Deploy the new Microsoft Teams client using the MSIX bootstrapper with machine-wide installation.',
    category: 'Communication',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Microsoft Teams', '24.x', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'ms-teams' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    ## Install Teams MSIX bootstrapper for machine-wide install
    Execute-Process -Path 'teamsbootstrapper.exe' -Parameters '-p -o "$dirFiles\\MSTeams-x64.msix"' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Microsoft Teams (new) installed successfully"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Microsoft Teams', '24.x', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path 'teamsbootstrapper.exe' -Parameters '-x' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Microsoft Teams (New)
$teamsPackage = Get-AppxPackage -AllUsers -Name "MSTeams" -ErrorAction SilentlyContinue
if ($teamsPackage) { Write-Host "Installed: $($teamsPackage.Version)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10 1809+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'zoom-deploy',
    name: 'Zoom Workplace',
    description: 'Deploy Zoom Workplace client with auto-update disabled and SSO pre-configuration.',
    category: 'Communication',
    publisher: 'Zoom',
    installScript: `${psadtHeader('Zoom Workplace', '6.x', 'Zoom Video Communications')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'Zoom' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'ZoomInstallerFull.msi' -Parameters '/QN /norestart ZoomAutoUpdate=0 ZNoDesktopShortCut=true'

    [String]$installPhase = 'Post-Installation'
    ## Disable auto-update
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\Policies\\Zoom\\Zoom Meetings\\General' -Name 'EnableClientAutoUpdate' -Value 0 -Type DWord
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Zoom Workplace', '6.x', 'Zoom Video Communications')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Zoom Workplace'
${psadtFooter}`,
    detectionScript: `# Detection Script - Zoom Workplace
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Zoom Workplace*" -or $_.DisplayName -like "Zoom(64-bit)*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'slack-deploy',
    name: 'Slack',
    description: 'Deploy Slack for Windows (machine-wide MSI) with auto-update policies.',
    category: 'Communication',
    publisher: 'Salesforce',
    installScript: `${psadtHeader('Slack', '4.x', 'Salesforce')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'slack' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'Slack-x64.msi' -Parameters '/QN /norestart'

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Slack installed successfully"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Slack', '4.x', 'Salesforce')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Slack'
${psadtFooter}`,
    detectionScript: `# Detection Script - Slack
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Slack*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'webex-deploy',
    name: 'Cisco Webex',
    description: 'Deploy Cisco Webex client with enterprise configuration and auto-update management.',
    category: 'Communication',
    publisher: 'Cisco',
    installScript: `${psadtHeader('Cisco Webex', '44.x', 'Cisco Systems')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'CiscoCollabHost,WebexHost' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'Webex.msi' -Parameters '/QN /norestart ALLUSERS=1 AUTOUPGRADEENABLED=0'

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Cisco Webex installed successfully"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Cisco Webex', '44.x', 'Cisco Systems')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Webex'
${psadtFooter}`,
    detectionScript: `# Detection Script - Cisco Webex
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Webex*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== DEVELOPMENT =====
  {
    id: 'vscode-deploy',
    name: 'Visual Studio Code',
    description: 'Deploy VS Code with extensions pre-configuration, PATH registration, and context menu integration.',
    category: 'Development',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Visual Studio Code', '1.96', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'Code' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'VSCodeSetup-x64.exe' -Parameters '/VERYSILENT /NORESTART /MERGETASKS="!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath"' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Disable auto-update (managed via Intune)
    $settingsDir = "$envProgramFiles\\Microsoft VS Code\\resources\\app\\product.json"
    Write-Log -Message "VS Code installed. Extensions can be deployed via Intune scripts."
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Visual Studio Code', '1.96', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path "$envProgramFiles\\Microsoft VS Code\\unins000.exe" -Parameters '/VERYSILENT /NORESTART' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Visual Studio Code
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Microsoft Visual Studio Code*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'git-deploy',
    name: 'Git for Windows',
    description: 'Deploy Git for Windows with PATH configuration, default editor setting, and credential manager.',
    category: 'Development',
    publisher: 'Git',
    installScript: `${psadtHeader('Git for Windows', '2.47', 'The Git Development Community')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'git,git-bash' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'Git-2.47.0-64-bit.exe' -Parameters '/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\\reg\\shellhere,assoc,assoc_sh"' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Configure Git credential manager
    Execute-Process -Path "$envProgramFiles\\Git\\cmd\\git.exe" -Parameters 'config --system credential.helper manager' -WindowStyle Hidden -IgnoreExitCodes '1'
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Git for Windows', '2.47', 'The Git Development Community')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path "$envProgramFiles\\Git\\unins000.exe" -Parameters '/VERYSILENT /NORESTART' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Git for Windows
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Git*" -and $_.Publisher -like "*Git*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'python-deploy',
    name: 'Python',
    description: 'Deploy Python with pip, PATH registration, and py launcher for all users.',
    category: 'Development',
    publisher: 'Python Software Foundation',
    installScript: `${psadtHeader('Python', '3.12', 'Python Software Foundation')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'python-3.12.0-amd64.exe' -Parameters '/quiet InstallAllUsers=1 PrependPath=1 Include_test=0 Include_launcher=1' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Upgrade pip
    Execute-Process -Path "$envProgramFiles\\Python312\\python.exe" -Parameters '-m pip install --upgrade pip' -WindowStyle Hidden -IgnoreExitCodes '*'
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Python', '3.12', 'Python Software Foundation')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path 'python-3.12.0-amd64.exe' -Parameters '/uninstall /quiet' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Python
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Python 3.*" -and $_.Publisher -like "*Python*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'nodejs-deploy',
    name: 'Node.js LTS',
    description: 'Deploy Node.js LTS with npm and PATH configuration for all users.',
    category: 'Development',
    publisher: 'OpenJS Foundation',
    installScript: `${psadtHeader('Node.js', '22 LTS', 'OpenJS Foundation')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'node' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'node-v22.0.0-x64.msi' -Parameters '/QN /norestart ADDLOCAL=ALL'

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Node.js LTS installed with npm"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Node.js', '22 LTS', 'OpenJS Foundation')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Node.js'
${psadtFooter}`,
    detectionScript: `# Detection Script - Node.js
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Node.js*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'pwsh7-deploy',
    name: 'PowerShell 7',
    description: 'Deploy PowerShell 7 with system PATH, Explorer context menu integration, and remoting enabled.',
    category: 'Development',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('PowerShell 7', '7.4', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'pwsh' -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'PowerShell-7.4.0-win-x64.msi' -Parameters '/QN /norestart ADD_EXPLORER_CONTEXT_MENU_OPENPOWERSHELL=1 ADD_FILE_CONTEXT_MENU_RUNPOWERSHELL=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1 USE_MU=1 ENABLE_MU=1 ADD_PATH=1'
${psadtFooter}`,
    uninstallScript: `${psadtHeader('PowerShell 7', '7.4', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'PowerShell 7'
${psadtFooter}`,
    detectionScript: `# Detection Script - PowerShell 7
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "PowerShell 7*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== SECURITY =====
  {
    id: 'crowdstrike-deploy',
    name: 'CrowdStrike Falcon Sensor',
    description: 'Deploy CrowdStrike Falcon sensor with CID token, anti-tamper, and proxy configuration support.',
    category: 'Security',
    publisher: 'CrowdStrike',
    installScript: `${psadtHeader('CrowdStrike Falcon', '7.x', 'CrowdStrike')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CheckDiskSpace
    Show-InstallationProgress -StatusMessage "Installing CrowdStrike Falcon Sensor..."

    [String]$installPhase = 'Installation'
    ## Replace YOUR_CID_HERE with your actual Customer ID
    Execute-Process -Path 'WindowsSensor.exe' -Parameters '/install /quiet /norestart CID=YOUR_CID_HERE' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    ## Verify sensor is running
    $service = Get-Service -Name 'CSFalconService' -ErrorAction SilentlyContinue
    If ($service -and $service.Status -eq 'Running') {
        Write-Log -Message "CrowdStrike Falcon sensor is running"
    } Else {
        Write-Log -Message "CrowdStrike Falcon sensor may not have started" -Severity 2
    }
${psadtFooter}`,
    uninstallScript: `${psadtHeader('CrowdStrike Falcon', '7.x', 'CrowdStrike')}

    [String]$installPhase = 'Uninstallation'
    ## Requires maintenance token for uninstall
    Execute-Process -Path 'WindowsSensor.exe' -Parameters '/uninstall /quiet MAINTENANCE_TOKEN=YOUR_TOKEN' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - CrowdStrike Falcon
$service = Get-Service -Name 'CSFalconService' -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq 'Running') {
    $app = Get-ItemProperty "HKLM:\\SOFTWARE\\CrowdStrike\\*" -ErrorAction SilentlyContinue
    Write-Host "CrowdStrike Falcon is running"; exit 0
}
exit 1`,
    requirements: 'Windows 10+ (x64), Admin rights',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'sentinelone-deploy',
    name: 'SentinelOne Agent',
    description: 'Deploy SentinelOne endpoint protection agent with site token and policy configuration.',
    category: 'Security',
    publisher: 'SentinelOne',
    installScript: `${psadtHeader('SentinelOne', '24.x', 'SentinelOne')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    ## Replace SITE_TOKEN with your actual site token
    Execute-MSI -Action 'Install' -Path 'SentinelOneInstaller_x64.msi' -Parameters '/QN /norestart SITE_TOKEN="YOUR_SITE_TOKEN"'

    [String]$installPhase = 'Post-Installation'
    $service = Get-Service -Name 'SentinelAgent' -ErrorAction SilentlyContinue
    If ($service) { Write-Log -Message "SentinelOne agent service found: $($service.Status)" }
${psadtFooter}`,
    uninstallScript: `${psadtHeader('SentinelOne', '24.x', 'SentinelOne')}

    [String]$installPhase = 'Uninstallation'
    ## Requires passphrase for uninstall
    Execute-Process -Path 'SentinelCleaner.exe' -Parameters '/quiet /norestart' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - SentinelOne
$service = Get-Service -Name 'SentinelAgent' -ErrorAction SilentlyContinue
if ($service) { Write-Host "SentinelOne is installed"; exit 0 }
exit 1`,
    requirements: 'Windows 10+ (x64), Admin rights',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'anyconnect-deploy',
    name: 'Cisco AnyConnect VPN',
    description: 'Deploy Cisco AnyConnect Secure Mobility Client with pre-configured VPN profiles.',
    category: 'Security',
    publisher: 'Cisco',
    installScript: `${psadtHeader('Cisco AnyConnect', '5.x', 'Cisco Systems')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'vpnui,vpnagentd' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'anyconnect-win-5.0-predeploy-k9.msi' -Parameters '/QN /norestart'

    [String]$installPhase = 'Post-Installation'
    ## Deploy VPN profile XML
    $profileDir = "$envProgramData\\Cisco\\Cisco AnyConnect Secure Mobility Client\\Profile"
    New-Folder -Path $profileDir
    Copy-File -Path "$dirFiles\\VPNProfile.xml" -Destination "$profileDir\\VPNProfile.xml"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Cisco AnyConnect', '5.x', 'Cisco Systems')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Cisco AnyConnect'
${psadtFooter}`,
    detectionScript: `# Detection Script - Cisco AnyConnect
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Cisco AnyConnect*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== UTILITIES =====
  {
    id: 'java-deploy',
    name: 'Java Runtime (JRE)',
    description: 'Deploy Java Runtime Environment with auto-update disabled and security baseline configuration.',
    category: 'Utilities',
    publisher: 'Oracle',
    installScript: `${psadtHeader('Java Runtime', '8u401', 'Oracle')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'java,javaw,javaws,iexplore' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'jre-8u401-windows-x64.msi' -Parameters '/QN /norestart SPONSORS=0 AUTO_UPDATE=0 WEB_JAVA=1 WEB_JAVA_SECURITY_LEVEL=H WEB_ANALYTICS=0 EULA=0 REBOOT=0'

    [String]$installPhase = 'Post-Installation'
    ## Disable auto-update
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\JavaSoft\\Java Update\\Policy' -Name 'EnableJavaUpdate' -Value 0 -Type DWord
    ## Remove old Java versions
    Remove-MSIApplications -Name 'Java' -FilterApplication (,('DisplayVersion', '8.0.401', 'Exact')) -ExcludeFromUninstall (,('DisplayName', 'Java 8 Update 401', 'Contains'))
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Java Runtime', '8u401', 'Oracle')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Java 8'
${psadtFooter}`,
    detectionScript: `# Detection Script - Java
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Java 8*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'dotnet-runtime-deploy',
    name: '.NET Desktop Runtime',
    description: 'Deploy .NET Desktop Runtime for running WPF and WinForms applications.',
    category: 'Utilities',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('.NET Desktop Runtime', '8.0', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-Process -Path 'windowsdesktop-runtime-8.0.0-win-x64.exe' -Parameters '/install /quiet /norestart' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message ".NET Desktop Runtime 8.0 installed"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('.NET Desktop Runtime', '8.0', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path 'windowsdesktop-runtime-8.0.0-win-x64.exe' -Parameters '/uninstall /quiet /norestart' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - .NET Desktop Runtime
$dotnet = dotnet --list-runtimes 2>$null | Where-Object { $_ -like "Microsoft.WindowsDesktop.App 8.*" }
if ($dotnet) { Write-Host "Installed: $dotnet"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'vcredist-deploy',
    name: 'Visual C++ Redistributables',
    description: 'Deploy all Visual C++ Redistributable packages (2015-2022) required by many applications.',
    category: 'Utilities',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Visual C++ Redistributables', '2015-2022', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationProgress -StatusMessage "Installing Visual C++ Redistributables..."

    [String]$installPhase = 'Installation'
    ## Install VC++ 2015-2022 x64
    Execute-Process -Path 'vc_redist.x64.exe' -Parameters '/install /quiet /norestart' -WindowStyle Hidden
    ## Install VC++ 2015-2022 x86
    Execute-Process -Path 'vc_redist.x86.exe' -Parameters '/install /quiet /norestart' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Visual C++ Redistributables installed (x86 + x64)"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Visual C++ Redistributables', '2015-2022', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Microsoft Visual C++ 2015-2022 Redistributable'
${psadtFooter}`,
    detectionScript: `# Detection Script - VC++ Redistributables
$vcx64 = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Microsoft Visual C++ 2015-2022 Redistributable (x64)*" }
if ($vcx64) { Write-Host "Installed: $($vcx64.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x86/x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'powerbi-deploy',
    name: 'Power BI Desktop',
    description: 'Deploy Power BI Desktop with auto-update disabled for managed environments.',
    category: 'Utilities',
    publisher: 'Microsoft',
    installScript: `${psadtHeader('Power BI Desktop', '2024', 'Microsoft')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'PBIDesktop' -AllowDefer -DeferTimes 3
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    Execute-MSI -Action 'Install' -Path 'PBIDesktopSetup_x64.msi' -Parameters '/QN /norestart ACCEPT_EULA=1 DISABLE_UPDATE_NOTIFICATION=1 ENABLECXP=0'

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Power BI Desktop installed"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Power BI Desktop', '2024', 'Microsoft')}

    [String]$installPhase = 'Uninstallation'
    Remove-MSIApplications -Name 'Microsoft Power BI Desktop'
${psadtFooter}`,
    detectionScript: `# Detection Script - Power BI Desktop
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "Microsoft Power BI Desktop*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }
else { exit 1 }`,
    requirements: 'Windows 10+ (x64), 2GB RAM',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== CUSTOM TEMPLATES =====
  {
    id: 'custom-msi',
    name: 'Custom MSI Template',
    description: 'Generic PSADT template for deploying any MSI-based application. Replace placeholders with your app details.',
    category: 'Custom',
    publisher: 'Template',
    installScript: `${psadtHeader('YOUR_APP_NAME', '1.0', 'YOUR_PUBLISHER')}

    ##*===============================================
    ##* PRE-INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Pre-Installation'

    ## Show welcome message, close apps, verify disk space
    Show-InstallationWelcome -CloseApps 'YOUR_PROCESS_NAME' -AllowDefer -DeferTimes 3 -CheckDiskSpace -PersistPrompt
    Show-InstallationProgress

    ##*===============================================
    ##* INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Installation'

    ## <== Replace with your MSI filename ==>
    Execute-MSI -Action 'Install' -Path 'YOUR_APP.msi' -Parameters '/QN /norestart'

    ##*===============================================
    ##* POST-INSTALLATION
    ##*===============================================
    [String]$installPhase = 'Post-Installation'

    ## Add any post-install registry changes, file copies, etc.
    ## Set-RegistryKey -Key 'HKLM\\SOFTWARE\\YourApp' -Name 'Setting' -Value '1' -Type String
    ## Copy-File -Path "$dirFiles\\config.xml" -Destination "$envProgramFiles\\YourApp\\config.xml"

    Show-InstallationPrompt -Message "$appName has been successfully installed." -ButtonRightText 'OK' -Icon Information
${psadtFooter}`,
    uninstallScript: `${psadtHeader('YOUR_APP_NAME', '1.0', 'YOUR_PUBLISHER')}

    [String]$installPhase = 'Pre-Uninstallation'
    Show-InstallationWelcome -CloseApps 'YOUR_PROCESS_NAME'

    [String]$installPhase = 'Uninstallation'
    ## Option 1: Uninstall by product code
    ## Execute-MSI -Action 'Uninstall' -Path '{YOUR-PRODUCT-CODE-GUID}'
    ## Option 2: Uninstall by name match
    Remove-MSIApplications -Name 'YOUR_APP_NAME'
${psadtFooter}`,
    detectionScript: `# Detection Script - Custom MSI App
# Option 1: Registry detection
$app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
    Where-Object { $_.DisplayName -like "YOUR_APP_NAME*" }
if ($app) { Write-Host "Installed: $($app.DisplayVersion)"; exit 0 }

# Option 2: File detection
# if (Test-Path "$env:ProgramFiles\\YourApp\\app.exe") { exit 0 }

exit 1`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'custom-exe',
    name: 'Custom EXE Template',
    description: 'Generic PSADT template for deploying EXE-based installers with silent switches.',
    category: 'Custom',
    publisher: 'Template',
    installScript: `${psadtHeader('YOUR_APP_NAME', '1.0', 'YOUR_PUBLISHER')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationWelcome -CloseApps 'YOUR_PROCESS_NAME' -AllowDefer -DeferTimes 3 -CheckDiskSpace
    Show-InstallationProgress

    [String]$installPhase = 'Installation'
    ## Common silent switches: /S, /silent, /quiet, /VERYSILENT, --silent
    Execute-Process -Path 'YOUR_INSTALLER.exe' -Parameters '/S' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "$appName installed successfully"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('YOUR_APP_NAME', '1.0', 'YOUR_PUBLISHER')}

    [String]$installPhase = 'Uninstallation'
    ## Find and run the uninstaller
    Execute-Process -Path "$envProgramFiles\\YOUR_APP\\uninstall.exe" -Parameters '/S' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Custom EXE App
# Option 1: File-based detection
if (Test-Path "$env:ProgramFiles\\YOUR_APP\\app.exe") {
    $version = (Get-Item "$env:ProgramFiles\\YOUR_APP\\app.exe").VersionInfo.ProductVersion
    Write-Host "Installed: $version"; exit 0
}

# Option 2: Registry detection
# $app = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
#     Where-Object { $_.DisplayName -like "YOUR_APP*" }
# if ($app) { exit 0 }

exit 1`,
    requirements: 'Windows 10+ (x64)',
    source: 'https://psappdeploytoolkit.com',
  },
  {
    id: 'custom-script-only',
    name: 'Script-Only Template',
    description: 'PSADT template for script-based deployments without an installer (registry changes, file copies, configurations).',
    category: 'Custom',
    publisher: 'Template',
    installScript: `${psadtHeader('Custom Configuration', '1.0', 'IT Admin')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationProgress -StatusMessage "Applying configuration changes..."

    [String]$installPhase = 'Installation'
    ## Example: Set registry keys
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\YourOrg\\Settings' -Name 'ConfigApplied' -Value 1 -Type DWord
    Set-RegistryKey -Key 'HKLM\\SOFTWARE\\YourOrg\\Settings' -Name 'Version' -Value '1.0' -Type String

    ## Example: Copy configuration files
    ## Copy-File -Path "$dirFiles\\config.xml" -Destination "$envProgramData\\YourApp\\config.xml"

    ## Example: Create scheduled task
    ## Execute-Process -Path 'schtasks.exe' -Parameters '/create /tn "YourTask" /tr "powershell.exe -File C:\\Scripts\\task.ps1" /sc daily /st 02:00 /ru SYSTEM'

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Configuration applied successfully"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Custom Configuration', '1.0', 'IT Admin')}

    [String]$installPhase = 'Uninstallation'
    ## Reverse the configuration changes
    Remove-RegistryKey -Key 'HKLM\\SOFTWARE\\YourOrg\\Settings'
    ## Remove-File -Path "$envProgramData\\YourApp\\config.xml"
${psadtFooter}`,
    detectionScript: `# Detection Script - Script-Only Configuration
# Check if configuration has been applied
$configApplied = Get-ItemProperty "HKLM:\\SOFTWARE\\YourOrg\\Settings" -Name 'ConfigApplied' -ErrorAction SilentlyContinue
if ($configApplied -and $configApplied.ConfigApplied -eq 1) {
    Write-Host "Configuration applied"; exit 0
}
exit 1`,
    requirements: 'Windows 10+',
    source: 'https://psappdeploytoolkit.com',
  },

  // ===== MORE UTILITIES =====
  {
    id: 'winget-template',
    name: 'Winget App Template',
    description: 'PSADT template that uses Windows Package Manager (winget) to install any app from the winget repository.',
    category: 'Custom',
    publisher: 'Template',
    installScript: `${psadtHeader('Winget App', '1.0', 'Winget')}

    [String]$installPhase = 'Pre-Installation'
    Show-InstallationProgress -StatusMessage "Installing application via winget..."

    ## Ensure winget is available
    $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
    If (-not $wingetPath) {
        ## Install winget from msstore if not present
        Write-Log -Message "winget not found, attempting to resolve..." -Severity 2
        Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction Stop
    }

    [String]$installPhase = 'Installation'
    ## Replace 'App.PackageId' with the winget package ID
    ## Find IDs with: winget search "app name"
    Execute-Process -Path 'winget' -Parameters 'install --id "App.PackageId" --silent --accept-package-agreements --accept-source-agreements --scope machine' -WindowStyle Hidden

    [String]$installPhase = 'Post-Installation'
    Write-Log -Message "Application installed via winget"
${psadtFooter}`,
    uninstallScript: `${psadtHeader('Winget App', '1.0', 'Winget')}

    [String]$installPhase = 'Uninstallation'
    Execute-Process -Path 'winget' -Parameters 'uninstall --id "App.PackageId" --silent' -WindowStyle Hidden
${psadtFooter}`,
    detectionScript: `# Detection Script - Winget-installed App
# Check via winget list
$result = winget list --id "App.PackageId" --accept-source-agreements 2>$null
if ($result -match "App.PackageId") { Write-Host "Installed"; exit 0 }
exit 1`,
    requirements: 'Windows 10 1809+ with App Installer',
    source: 'https://psappdeploytoolkit.com',
  },
];
