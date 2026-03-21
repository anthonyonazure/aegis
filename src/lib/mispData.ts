// ── MITRE ATT&CK ──

export interface AttackTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  platforms: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  actors: string[];
}

export const ATTACK_TACTICS = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
] as const;

export const attackTechniques: AttackTechnique[] = [
  // Reconnaissance
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', description: 'Adversaries may execute active reconnaissance scans to gather information that can be used during targeting.', platforms: ['PRE'], severity: 'low', actors: ['APT28', 'APT29'] },
  { id: 'T1589', name: 'Gather Victim Identity Information', tactic: 'Reconnaissance', description: 'Adversaries may gather information about the victim\'s identity that can be used during targeting.', platforms: ['PRE'], severity: 'low', actors: ['Lazarus', 'APT29'] },
  { id: 'T1590', name: 'Gather Victim Network Information', tactic: 'Reconnaissance', description: 'Adversaries may gather information about the victim\'s networks for targeting.', platforms: ['PRE'], severity: 'low', actors: ['Turla', 'Sandworm'] },
  // Resource Development
  { id: 'T1583', name: 'Acquire Infrastructure', tactic: 'Resource Development', description: 'Adversaries may buy, lease, or rent infrastructure for use during targeting.', platforms: ['PRE'], severity: 'medium', actors: ['APT28', 'Sandworm'] },
  { id: 'T1588', name: 'Obtain Capabilities', tactic: 'Resource Development', description: 'Adversaries may buy or steal capabilities for use in operations.', platforms: ['PRE'], severity: 'medium', actors: ['Lazarus', 'FIN7'] },
  // Initial Access
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access', description: 'Adversaries may send phishing messages to gain access to victim systems.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'high', actors: ['APT28', 'APT29', 'Lazarus', 'FIN7'] },
  { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', description: 'Adversaries may attempt to exploit a weakness in an Internet-facing host or system.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'critical', actors: ['Hafnium', 'Sandworm', 'Volt Typhoon'] },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access', description: 'Adversaries may obtain and abuse credentials of existing accounts.', platforms: ['Windows', 'Linux', 'macOS', 'Azure AD'], severity: 'high', actors: ['APT29', 'Volt Typhoon'] },
  { id: 'T1133', name: 'External Remote Services', tactic: 'Initial Access', description: 'Adversaries may leverage external-facing remote services to initially access a network.', platforms: ['Windows', 'Linux'], severity: 'high', actors: ['APT28', 'Sandworm'] },
  // Execution
  { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution', description: 'Adversaries may abuse command and script interpreters to execute commands.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'high', actors: ['APT28', 'Lazarus', 'FIN7'] },
  { id: 'T1204', name: 'User Execution', tactic: 'Execution', description: 'An adversary may rely upon specific actions by a user to gain execution.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'medium', actors: ['APT29', 'FIN7'] },
  { id: 'T1047', name: 'WMI', tactic: 'Execution', description: 'Adversaries may abuse WMI to execute malicious commands and payloads.', platforms: ['Windows'], severity: 'high', actors: ['APT29', 'Turla'] },
  // Persistence
  { id: 'T1547', name: 'Boot or Logon Autostart Execution', tactic: 'Persistence', description: 'Adversaries may configure system settings to automatically execute a program during boot or logon.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'high', actors: ['APT28', 'Lazarus'] },
  { id: 'T1053', name: 'Scheduled Task/Job', tactic: 'Persistence', description: 'Adversaries may abuse task scheduling to facilitate initial or recurring execution.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'medium', actors: ['APT29', 'Sandworm'] },
  { id: 'T1136', name: 'Create Account', tactic: 'Persistence', description: 'Adversaries may create an account to maintain access to victim systems.', platforms: ['Windows', 'Linux', 'macOS', 'Azure AD'], severity: 'high', actors: ['Hafnium', 'APT29'] },
  // Privilege Escalation
  { id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation', description: 'Adversaries may exploit software vulnerabilities to escalate privileges.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'critical', actors: ['Sandworm', 'Hafnium'] },
  { id: 'T1548', name: 'Abuse Elevation Control Mechanism', tactic: 'Privilege Escalation', description: 'Adversaries may circumvent mechanisms designed to control elevated privileges.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'high', actors: ['APT28', 'Turla'] },
  // Defense Evasion
  { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion', description: 'Adversaries may attempt to make payloads difficult to discover or analyze.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'medium', actors: ['APT29', 'Lazarus', 'FIN7'] },
  { id: 'T1070', name: 'Indicator Removal', tactic: 'Defense Evasion', description: 'Adversaries may delete or modify artifacts generated to remove evidence.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'high', actors: ['APT28', 'Sandworm'] },
  { id: 'T1562', name: 'Impair Defenses', tactic: 'Defense Evasion', description: 'Adversaries may maliciously modify components of a victim environment to hinder defenses.', platforms: ['Windows', 'macOS', 'Linux'], severity: 'critical', actors: ['Sandworm', 'Turla'] },
  // Credential Access
  { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access', description: 'Adversaries may attempt to dump credentials from the OS to obtain login information.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'critical', actors: ['APT28', 'APT29', 'Lazarus'] },
  { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', description: 'Adversaries may use brute force techniques to gain access to accounts.', platforms: ['Windows', 'Linux', 'macOS', 'Azure AD'], severity: 'high', actors: ['APT28', 'Sandworm'] },
  { id: 'T1557', name: 'Adversary-in-the-Middle', tactic: 'Credential Access', description: 'Adversaries may attempt to position themselves between two or more networked devices to intercept traffic.', platforms: ['Windows', 'Linux'], severity: 'high', actors: ['APT28'] },
  // Discovery
  { id: 'T1087', name: 'Account Discovery', tactic: 'Discovery', description: 'Adversaries may attempt to get a listing of accounts on a system or within an environment.', platforms: ['Windows', 'Linux', 'macOS', 'Azure AD'], severity: 'low', actors: ['APT29', 'Turla'] },
  { id: 'T1082', name: 'System Information Discovery', tactic: 'Discovery', description: 'An adversary may attempt to get detailed information about the OS and hardware.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'low', actors: ['Lazarus', 'APT28'] },
  // Lateral Movement
  { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement', description: 'Adversaries may use valid accounts to interact with remote machines using remote services.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['APT29', 'Volt Typhoon'] },
  { id: 'T1570', name: 'Lateral Tool Transfer', tactic: 'Lateral Movement', description: 'Adversaries may transfer tools or files between systems within a compromised environment.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'medium', actors: ['APT28', 'Lazarus'] },
  // Collection
  { id: 'T1560', name: 'Archive Collected Data', tactic: 'Collection', description: 'An adversary may compress and/or encrypt data collected prior to exfiltration.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'medium', actors: ['APT29', 'Turla'] },
  { id: 'T1114', name: 'Email Collection', tactic: 'Collection', description: 'Adversaries may target user email to collect sensitive information.', platforms: ['Windows', 'Office 365'], severity: 'high', actors: ['APT29', 'Hafnium'] },
  // Command and Control
  { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control', description: 'Adversaries may communicate using OSI application layer protocols to avoid detection.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['APT28', 'APT29', 'Turla'] },
  { id: 'T1573', name: 'Encrypted Channel', tactic: 'Command and Control', description: 'Adversaries may employ a known encryption algorithm to conceal C2 traffic.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'medium', actors: ['APT29', 'Lazarus'] },
  { id: 'T1105', name: 'Ingress Tool Transfer', tactic: 'Command and Control', description: 'Adversaries may transfer tools or files from an external system into a compromised environment.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'medium', actors: ['Sandworm', 'FIN7'] },
  // Exfiltration
  { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', description: 'Adversaries may steal data by exfiltrating it over an existing C2 channel.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['APT29', 'Turla'] },
  { id: 'T1567', name: 'Exfiltration Over Web Service', tactic: 'Exfiltration', description: 'Adversaries may use an existing, legitimate external Web service to exfiltrate data.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['APT29', 'Lazarus'] },
  // Impact
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact', description: 'Adversaries may encrypt data on target systems to interrupt availability.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'critical', actors: ['Sandworm', 'BlackCat', 'LockBit', 'Conti', 'REvil'] },
  { id: 'T1489', name: 'Service Stop', tactic: 'Impact', description: 'Adversaries may stop or disable services on a system to render those services unavailable.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['Sandworm'] },
  { id: 'T1529', name: 'System Shutdown/Reboot', tactic: 'Impact', description: 'Adversaries may shutdown/reboot systems to interrupt access or aid in destruction.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'high', actors: ['Sandworm'] },
  { id: 'T1485', name: 'Data Destruction', tactic: 'Impact', description: 'Adversaries may destroy data and files on specific systems or in large numbers to interrupt availability.', platforms: ['Windows', 'Linux', 'macOS'], severity: 'critical', actors: ['Sandworm'] },
];

// ── Threat Actors ──

export interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  country: string;
  motivation: string;
  targetSectors: string[];
  description: string;
  techniques: string[];
  active: boolean;
  firstSeen: string;
}

export const threatActors: ThreatActor[] = [
  { id: 'apt28', name: 'APT28', aliases: ['Fancy Bear', 'Sofacy', 'Strontium'], country: 'Russia', motivation: 'Espionage', targetSectors: ['Government', 'Military', 'Media', 'Energy'], description: 'Russian military intelligence (GRU) cyber unit targeting Western governments and NATO members.', techniques: ['T1566', 'T1059', 'T1078', 'T1003', 'T1071'], active: true, firstSeen: '2004' },
  { id: 'apt29', name: 'APT29', aliases: ['Cozy Bear', 'Nobelium', 'Midnight Blizzard'], country: 'Russia', motivation: 'Espionage', targetSectors: ['Government', 'Technology', 'Think Tanks'], description: 'Russian foreign intelligence service (SVR) group behind the SolarWinds supply chain attack.', techniques: ['T1566', 'T1078', 'T1027', 'T1071', 'T1114'], active: true, firstSeen: '2008' },
  { id: 'lazarus', name: 'Lazarus Group', aliases: ['Hidden Cobra', 'Zinc', 'Diamond Sleet'], country: 'North Korea', motivation: 'Financial / Espionage', targetSectors: ['Finance', 'Cryptocurrency', 'Defense', 'Entertainment'], description: 'North Korean state-sponsored group known for destructive attacks and cryptocurrency theft.', techniques: ['T1566', 'T1059', 'T1547', 'T1003', 'T1486'], active: true, firstSeen: '2009' },
  { id: 'turla', name: 'Turla', aliases: ['Snake', 'Venomous Bear', 'Uroburos'], country: 'Russia', motivation: 'Espionage', targetSectors: ['Government', 'Diplomatic', 'Military', 'Research'], description: 'Sophisticated Russian espionage group with advanced persistent capabilities.', techniques: ['T1071', 'T1560', 'T1087', 'T1562'], active: true, firstSeen: '1996' },
  { id: 'sandworm', name: 'Sandworm', aliases: ['Voodoo Bear', 'Iridium', 'Seashell Blizzard'], country: 'Russia', motivation: 'Sabotage / Espionage', targetSectors: ['Energy', 'Government', 'Critical Infrastructure'], description: 'Russian GRU unit responsible for NotPetya, Industroyer, and attacks on Ukrainian infrastructure.', techniques: ['T1190', 'T1486', 'T1489', 'T1529', 'T1485'], active: true, firstSeen: '2009' },
  { id: 'fin7', name: 'FIN7', aliases: ['Carbanak', 'Carbon Spider'], country: 'Russia', motivation: 'Financial', targetSectors: ['Retail', 'Hospitality', 'Finance'], description: 'Financially motivated threat group specializing in POS malware and business email compromise.', techniques: ['T1566', 'T1059', 'T1204', 'T1027'], active: true, firstSeen: '2013' },
  { id: 'hafnium', name: 'Hafnium', aliases: ['Silk Typhoon'], country: 'China', motivation: 'Espionage', targetSectors: ['Defense', 'Education', 'Law', 'NGOs'], description: 'Chinese state-sponsored group behind the Microsoft Exchange Server (ProxyLogon) attacks.', techniques: ['T1190', 'T1136', 'T1114'], active: true, firstSeen: '2021' },
  { id: 'volt-typhoon', name: 'Volt Typhoon', aliases: ['Bronze Silhouette', 'Vanguard Panda'], country: 'China', motivation: 'Pre-positioning / Espionage', targetSectors: ['Critical Infrastructure', 'Telecommunications', 'Government'], description: 'Chinese state-sponsored group focused on pre-positioning for potential disruption of US critical infrastructure.', techniques: ['T1190', 'T1078', 'T1021'], active: true, firstSeen: '2021' },
  { id: 'blackcat', name: 'BlackCat', aliases: ['ALPHV', 'Noberus'], country: 'Unknown', motivation: 'Financial (Ransomware)', targetSectors: ['Healthcare', 'Finance', 'Critical Infrastructure'], description: 'Ransomware-as-a-Service group using Rust-based ransomware with triple extortion tactics.', techniques: ['T1486', 'T1059', 'T1078'], active: false, firstSeen: '2021' },
  { id: 'lockbit', name: 'LockBit', aliases: ['ABCD Ransomware'], country: 'Unknown', motivation: 'Financial (Ransomware)', targetSectors: ['Manufacturing', 'Healthcare', 'Government', 'Finance'], description: 'Most prolific RaaS operation known for fast encryption and automated lateral movement.', techniques: ['T1486', 'T1059', 'T1078', 'T1190'], active: true, firstSeen: '2019' },
  { id: 'conti', name: 'Conti', aliases: ['Wizard Spider (partial)'], country: 'Russia', motivation: 'Financial (Ransomware)', targetSectors: ['Healthcare', 'Government', 'Education'], description: 'Major ransomware group that dissolved in 2022, with members splitting into other groups.', techniques: ['T1486', 'T1059', 'T1021'], active: false, firstSeen: '2020' },
  { id: 'revil', name: 'REvil', aliases: ['Sodinokibi', 'Pinchy Spider'], country: 'Russia', motivation: 'Financial (Ransomware)', targetSectors: ['IT Services', 'Manufacturing', 'Legal'], description: 'RaaS group behind high-profile supply chain attacks including Kaseya VSA.', techniques: ['T1486', 'T1190', 'T1059'], active: false, firstSeen: '2019' },
  { id: 'mustang-panda', name: 'Mustang Panda', aliases: ['Bronze President', 'RedDelta'], country: 'China', motivation: 'Espionage', targetSectors: ['Government', 'NGOs', 'Religious organizations'], description: 'China-aligned APT that uses spear-phishing with politically-themed lures targeting Southeast Asia and Europe.', techniques: ['T1566', 'T1059', 'T1547', 'T1071'], active: true, firstSeen: '2017' },
  { id: 'kimsuky', name: 'Kimsuky', aliases: ['Velvet Chollima', 'Emerald Sleet'], country: 'North Korea', motivation: 'Espionage', targetSectors: ['Think Tanks', 'Nuclear', 'Government', 'Media'], description: 'North Korean espionage group targeting Korean peninsula policy experts and nuclear/defense sectors.', techniques: ['T1566', 'T1059', 'T1078', 'T1114'], active: true, firstSeen: '2012' },
  { id: 'scattered-spider', name: 'Scattered Spider', aliases: ['Muddled Libra', 'Star Fraud'], country: 'International', motivation: 'Financial', targetSectors: ['Telecommunications', 'Technology', 'Hospitality'], description: 'Young English-speaking group known for SIM swapping and social engineering attacks on major enterprises.', techniques: ['T1566', 'T1078', 'T1136', 'T1021'], active: true, firstSeen: '2022' },
];

// ── IOCs ──

export interface IOCEntry {
  id: string;
  type: 'ip' | 'domain' | 'hash-md5' | 'hash-sha256' | 'url' | 'email';
  value: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  associatedActors: string[];
  lastSeen: string;
}

export const iocEntries: IOCEntry[] = [
  { id: 'ioc-1', type: 'domain', value: 'evildomain.xyz', description: 'Known APT28 C2 infrastructure', severity: 'critical', source: 'CIRCL OSINT', associatedActors: ['APT28'], lastSeen: '2025-12' },
  { id: 'ioc-2', type: 'ip', value: '185.141.63.0/24', description: 'Bulletproof hosting range used by multiple threat actors', severity: 'high', source: 'abuse.ch', associatedActors: ['Lazarus', 'FIN7'], lastSeen: '2026-01' },
  { id: 'ioc-3', type: 'hash-sha256', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Cobalt Strike beacon payload', severity: 'critical', source: 'VirusTotal', associatedActors: ['APT29', 'FIN7'], lastSeen: '2025-11' },
  { id: 'ioc-4', type: 'domain', value: 'updatesvc-microsoft.com', description: 'Typosquatted Microsoft update domain for phishing', severity: 'high', source: 'PhishTank', associatedActors: ['APT28'], lastSeen: '2025-10' },
  { id: 'ioc-5', type: 'ip', value: '91.234.99.42', description: 'Sandworm C2 server', severity: 'critical', source: 'CERT-UA', associatedActors: ['Sandworm'], lastSeen: '2026-02' },
  { id: 'ioc-6', type: 'hash-sha256', value: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', description: 'LockBit 3.0 ransomware binary', severity: 'critical', source: 'abuse.ch', associatedActors: ['LockBit'], lastSeen: '2026-01' },
  { id: 'ioc-7', type: 'url', value: 'https://login-microsoftonline.tk/auth', description: 'Credential harvesting page mimicking Microsoft login', severity: 'high', source: 'PhishTank', associatedActors: ['Scattered Spider'], lastSeen: '2025-12' },
  { id: 'ioc-8', type: 'email', value: 'hr-department@corp-update.com', description: 'Spear-phishing sender address used in BEC campaigns', severity: 'medium', source: 'CIRCL OSINT', associatedActors: ['FIN7'], lastSeen: '2025-09' },
  { id: 'ioc-9', type: 'domain', value: 'cdn-cloudflare-api.net', description: 'Impersonating Cloudflare CDN for malware delivery', severity: 'high', source: 'Botvrij', associatedActors: ['APT29'], lastSeen: '2025-11' },
  { id: 'ioc-10', type: 'ip', value: '103.224.182.0/24', description: 'IP range linked to Volt Typhoon living-off-the-land operations', severity: 'high', source: 'Microsoft Threat Intelligence', associatedActors: ['Volt Typhoon'], lastSeen: '2026-01' },
  { id: 'ioc-11', type: 'hash-md5', value: 'd41d8cd98f00b204e9800998ecf8427e', description: 'Mimikatz variant hash', severity: 'critical', source: 'VirusTotal', associatedActors: ['APT28', 'APT29'], lastSeen: '2025-10' },
  { id: 'ioc-12', type: 'domain', value: 'sharepoint-download.xyz', description: 'Phishing domain impersonating SharePoint', severity: 'high', source: 'OSINT feeds', associatedActors: ['Kimsuky'], lastSeen: '2025-12' },
  { id: 'ioc-13', type: 'ip', value: '45.77.65.211', description: 'C2 for BlackCat/ALPHV ransomware operations', severity: 'critical', source: 'FBI Flash', associatedActors: ['BlackCat'], lastSeen: '2025-08' },
  { id: 'ioc-14', type: 'url', value: 'https://docs-google.support/view?id=share', description: 'Fake Google Docs link used in credential phishing', severity: 'medium', source: 'AlienVault OTX', associatedActors: ['Mustang Panda'], lastSeen: '2025-11' },
  { id: 'ioc-15', type: 'domain', value: 'windowsdefender-update.com', description: 'Fake Windows Defender update site distributing malware', severity: 'high', source: 'MalwareBazaar', associatedActors: ['Turla'], lastSeen: '2025-10' },
  { id: 'ioc-16', type: 'ip', value: '194.26.29.0/24', description: 'Hosting range for Conti leak site mirrors', severity: 'medium', source: 'abuse.ch', associatedActors: ['Conti'], lastSeen: '2024-06' },
  { id: 'ioc-17', type: 'hash-sha256', value: 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2', description: 'REvil/Sodinokibi ransomware dropper', severity: 'critical', source: 'MalwareBazaar', associatedActors: ['REvil'], lastSeen: '2024-01' },
  { id: 'ioc-18', type: 'email', value: 'support@secure-verify-id.com', description: 'Social engineering email used in SIM swap campaigns', severity: 'medium', source: 'OSINT feeds', associatedActors: ['Scattered Spider'], lastSeen: '2026-01' },
  { id: 'ioc-19', type: 'domain', value: 'teams-microsoft-auth.com', description: 'Fake Teams authentication portal', severity: 'high', source: 'Microsoft Threat Intelligence', associatedActors: ['Midnight Blizzard'], lastSeen: '2026-02' },
  { id: 'ioc-20', type: 'ip', value: '198.51.100.0/24', description: 'Known bulletproof hosting for ransomware C2', severity: 'high', source: 'abuse.ch', associatedActors: ['LockBit', 'BlackCat'], lastSeen: '2025-12' },
];

// ── Galaxies ──

export interface GalaxyCluster {
  id: string;
  galaxy: string;
  name: string;
  description: string;
  synonyms: string[];
  meta?: Record<string, string>;
}

export const galaxyClusters: GalaxyCluster[] = [
  // Ransomware
  { id: 'g-1', galaxy: 'Ransomware', name: 'LockBit 3.0', description: 'Third generation of LockBit RaaS with StealBit data exfiltration and bug bounty program.', synonyms: ['LockBit Black'] },
  { id: 'g-2', galaxy: 'Ransomware', name: 'BlackCat/ALPHV', description: 'First Rust-based RaaS with triple extortion (encryption, data leak, DDoS).', synonyms: ['ALPHV', 'Noberus'] },
  { id: 'g-3', galaxy: 'Ransomware', name: 'Cl0p', description: 'Ransomware group exploiting zero-days in file transfer solutions (MOVEit, GoAnywhere).', synonyms: ['TA505 affiliate', 'FIN11'] },
  { id: 'g-4', galaxy: 'Ransomware', name: 'Akira', description: 'Emerging ransomware group targeting SMBs with retro-themed leak site.', synonyms: [] },
  { id: 'g-5', galaxy: 'Ransomware', name: 'Play', description: 'Ransomware group using intermittent encryption for speed, targeting Latin American organizations.', synonyms: ['PlayCrypt'] },
  // Tools
  { id: 'g-6', galaxy: 'Tool', name: 'Cobalt Strike', description: 'Commercial adversary simulation framework widely abused by threat actors for C2 operations.', synonyms: ['CS Beacon'] },
  { id: 'g-7', galaxy: 'Tool', name: 'Mimikatz', description: 'Open-source credential extraction tool for Windows. Dumps NTLM hashes, Kerberos tickets.', synonyms: [] },
  { id: 'g-8', galaxy: 'Tool', name: 'Impacket', description: 'Python classes for working with network protocols, widely used for lateral movement.', synonyms: [] },
  { id: 'g-9', galaxy: 'Tool', name: 'Brute Ratel', description: 'Red team C2 framework that evades EDR, increasingly adopted by threat actors.', synonyms: ['BRc4'] },
  { id: 'g-10', galaxy: 'Tool', name: 'Sliver', description: 'Open-source, cross-platform C2 framework used as a Cobalt Strike alternative.', synonyms: [] },
  { id: 'g-11', galaxy: 'Tool', name: 'BloodHound', description: 'Active Directory attack path analysis tool used by both red teams and threat actors.', synonyms: [] },
  // Sectors
  { id: 'g-12', galaxy: 'Sector', name: 'Healthcare', description: 'Healthcare organizations are heavily targeted due to sensitive patient data and critical operations.', synonyms: [] },
  { id: 'g-13', galaxy: 'Sector', name: 'Critical Infrastructure', description: 'Energy, water, transportation systems targeted for sabotage and pre-positioning.', synonyms: ['ICS', 'OT'] },
  { id: 'g-14', galaxy: 'Sector', name: 'Financial Services', description: 'Banks, fintech, and cryptocurrency exchanges targeted for direct financial theft.', synonyms: ['Banking', 'Finance'] },
  { id: 'g-15', galaxy: 'Sector', name: 'Government', description: 'Government agencies targeted for espionage, intelligence collection, and influence operations.', synonyms: ['Public Sector'] },
  // Mitre Software
  { id: 'g-16', galaxy: 'Malware', name: 'Emotet', description: 'Modular banking trojan turned malware loader, distributed via spam campaigns.', synonyms: ['Heodo', 'Geodo'] },
  { id: 'g-17', galaxy: 'Malware', name: 'QakBot', description: 'Banking trojan and initial access broker providing entry for ransomware operations.', synonyms: ['QBot', 'Pinkslipbot'] },
  { id: 'g-18', galaxy: 'Malware', name: 'TrickBot', description: 'Modular banking trojan with worm capabilities, closely linked to Conti ransomware.', synonyms: [] },
  { id: 'g-19', galaxy: 'Malware', name: 'IcedID', description: 'Banking trojan acting as initial access broker for ransomware groups.', synonyms: ['BokBot'] },
  { id: 'g-20', galaxy: 'Malware', name: 'SystemBC', description: 'Proxy malware used as a backdoor by multiple ransomware affiliates.', synonyms: [] },
];

// ── Taxonomies ──

export interface TaxonomyEntry {
  taxonomy: string;
  tag: string;
  description: string;
  color: string;
  numerical?: number;
}

export const taxonomies: TaxonomyEntry[] = [
  // TLP
  { taxonomy: 'TLP', tag: 'TLP:RED', description: 'Not for disclosure, restricted to participants only.', color: '#FF2B2B' },
  { taxonomy: 'TLP', tag: 'TLP:AMBER+STRICT', description: 'Limited disclosure, recipients only — not their organizations.', color: '#FFC000' },
  { taxonomy: 'TLP', tag: 'TLP:AMBER', description: 'Limited disclosure, restricted to participants\' organizations.', color: '#FFC000' },
  { taxonomy: 'TLP', tag: 'TLP:GREEN', description: 'Limited disclosure, restricted to the community.', color: '#33FF00' },
  { taxonomy: 'TLP', tag: 'TLP:CLEAR', description: 'Disclosure is not limited. Public information.', color: '#FFFFFF' },
  // PAP
  { taxonomy: 'PAP', tag: 'PAP:RED', description: 'Non-detectable actions only. No external queries/lookups.', color: '#FF2B2B' },
  { taxonomy: 'PAP', tag: 'PAP:AMBER', description: 'Passive detection only. No active countermeasures.', color: '#FFC000' },
  { taxonomy: 'PAP', tag: 'PAP:GREEN', description: 'Active detection allowed. Can be used in detection rules.', color: '#33FF00' },
  { taxonomy: 'PAP', tag: 'PAP:CLEAR', description: 'Any action allowed. Can share freely and block.', color: '#FFFFFF' },
  // Admiralty Scale (Source Reliability)
  { taxonomy: 'Admiralty Scale', tag: 'A — Completely reliable', description: 'No doubt of authenticity, trustworthiness, competency; history of complete reliability.', color: '#22C55E', numerical: 1 },
  { taxonomy: 'Admiralty Scale', tag: 'B — Usually reliable', description: 'Minor doubt; history of valid information most of the time.', color: '#4ADE80', numerical: 2 },
  { taxonomy: 'Admiralty Scale', tag: 'C — Fairly reliable', description: 'Doubt of reliability; provided valid information in the past.', color: '#FACC15', numerical: 3 },
  { taxonomy: 'Admiralty Scale', tag: 'D — Not usually reliable', description: 'Significant doubt; history of invalid information.', color: '#FB923C', numerical: 4 },
  { taxonomy: 'Admiralty Scale', tag: 'E — Unreliable', description: 'Lacking in authenticity, trustworthiness; history of invalid information.', color: '#EF4444', numerical: 5 },
  { taxonomy: 'Admiralty Scale', tag: 'F — Reliability cannot be judged', description: 'No basis exists for evaluating reliability.', color: '#94A3B8', numerical: 6 },
  // OSINT Quality
  { taxonomy: 'OSINT Quality', tag: 'Confirmed', description: 'Confirmed by independent sources; consistent with other information.', color: '#22C55E' },
  { taxonomy: 'OSINT Quality', tag: 'Probably True', description: 'Not confirmed; logical in itself; consistent with other information.', color: '#4ADE80' },
  { taxonomy: 'OSINT Quality', tag: 'Possibly True', description: 'Not confirmed; reasonably logical; agrees with some other information.', color: '#FACC15' },
  { taxonomy: 'OSINT Quality', tag: 'Doubtful', description: 'Not confirmed; possible but not logical; no other information on the subject.', color: '#FB923C' },
  { taxonomy: 'OSINT Quality', tag: 'Improbable', description: 'Not confirmed; not logical in itself; contradicted by other information.', color: '#EF4444' },
];

// ── Feeds ──

export interface OsintFeed {
  id: string;
  name: string;
  url: string;
  provider: string;
  description: string;
  format: string;
  category: string;
  free: boolean;
}

export const osintFeeds: OsintFeed[] = [
  { id: 'f-1', name: 'abuse.ch URLhaus', url: 'https://urlhaus.abuse.ch/', provider: 'abuse.ch', description: 'Sharing malicious URLs used for malware distribution.', format: 'CSV / JSON API', category: 'Malware URLs', free: true },
  { id: 'f-2', name: 'abuse.ch MalwareBazaar', url: 'https://bazaar.abuse.ch/', provider: 'abuse.ch', description: 'Malware sample sharing platform with YARA matching.', format: 'API / MISP Feed', category: 'Malware Samples', free: true },
  { id: 'f-3', name: 'abuse.ch Feodo Tracker', url: 'https://feodotracker.abuse.ch/', provider: 'abuse.ch', description: 'Tracking botnet C2 infrastructure (Emotet, Dridex, TrickBot).', format: 'CSV / JSON', category: 'Botnet C2', free: true },
  { id: 'f-4', name: 'AlienVault OTX', url: 'https://otx.alienvault.com/', provider: 'AT&T Cybersecurity', description: 'Open Threat Exchange — community threat intelligence sharing platform.', format: 'STIX / JSON API', category: 'Multi-type', free: true },
  { id: 'f-5', name: 'CIRCL OSINT Feed', url: 'https://www.circl.lu/services/misp-feed/', provider: 'CIRCL (Luxembourg)', description: 'MISP-format feed curated by the Luxembourg CERT.', format: 'MISP JSON', category: 'Multi-type', free: true },
  { id: 'f-6', name: 'Botvrij', url: 'https://www.botvrij.eu/', provider: 'Botvrij.eu', description: 'Open source IOCs for detecting botnets and malware.', format: 'MISP / CSV', category: 'IOCs', free: true },
  { id: 'f-7', name: 'PhishTank', url: 'https://phishtank.org/', provider: 'OpenDNS', description: 'Community-driven anti-phishing verification database.', format: 'XML / CSV / JSON', category: 'Phishing', free: true },
  { id: 'f-8', name: 'Emerging Threats (ET Open)', url: 'https://rules.emergingthreats.net/', provider: 'Proofpoint', description: 'Open ruleset for IDS/IPS (Suricata, Snort) with threat intelligence.', format: 'Suricata rules', category: 'Network Signatures', free: true },
  { id: 'f-9', name: 'MISP Default Feeds', url: 'https://www.misp-project.org/feeds/', provider: 'MISP Project', description: 'Default MISP feeds including CIRCL OSINT, Botvrij, abuse.ch.', format: 'MISP JSON', category: 'Multi-type', free: true },
  { id: 'f-10', name: 'VirusTotal', url: 'https://www.virustotal.com/', provider: 'Google / Chronicle', description: 'Multi-AV scanner and threat intelligence platform.', format: 'JSON API', category: 'File/URL Analysis', free: false },
  { id: 'f-11', name: 'Shodan', url: 'https://www.shodan.io/', provider: 'Shodan', description: 'Internet-wide device and service discovery engine.', format: 'JSON API', category: 'Attack Surface', free: false },
  { id: 'f-12', name: 'GreyNoise', url: 'https://www.greynoise.io/', provider: 'GreyNoise Intelligence', description: 'Identifies IPs mass-scanning the internet vs targeted attacks.', format: 'JSON API', category: 'IP Intelligence', free: false },
  { id: 'f-13', name: 'CISA Known Exploited Vulnerabilities', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', provider: 'CISA', description: 'Authoritative catalog of vulnerabilities actively exploited in the wild.', format: 'JSON / CSV', category: 'Vulnerabilities', free: true },
  { id: 'f-14', name: 'Threatfox', url: 'https://threatfox.abuse.ch/', provider: 'abuse.ch', description: 'Platform for sharing IOCs associated with malware.', format: 'CSV / JSON / MISP', category: 'IOCs', free: true },
];

// ── Stats helpers ──

export const getMispStats = () => ({
  totalTechniques: attackTechniques.length,
  totalActors: threatActors.length,
  activeActors: threatActors.filter(a => a.active).length,
  totalIOCs: iocEntries.length,
  criticalIOCs: iocEntries.filter(i => i.severity === 'critical').length,
  totalGalaxies: galaxyClusters.length,
  totalFeeds: osintFeeds.length,
  freeFeeds: osintFeeds.filter(f => f.free).length,
  totalTaxonomies: new Set(taxonomies.map(t => t.taxonomy)).size,
});
