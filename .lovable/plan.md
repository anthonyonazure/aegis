

# Plan: Add MISP Threat Intelligence Browser Module

## Summary
Add a new top-level **"Threat Intelligence"** module (sidebar group) with a MISP-inspired local threat intelligence browser. No external MISP server required — all data is embedded as a static catalog of curated threat intelligence: MITRE ATT&CK techniques, common IOC patterns, threat actor profiles, MISP galaxies, and public feed references.

## What It Provides
- Browse threat intelligence organized by MITRE ATT&CK tactics/techniques
- Searchable IOC reference library (IP ranges, domains, file hashes, etc.) from well-known public feeds
- Threat actor profiles (APT groups) with TTPs mapped to ATT&CK
- MISP Galaxy browser (threat actors, tools, ransomware families, sectors)
- Taxonomy reference (TLP, CIRCL, admiralty-scale, etc.)
- Correlation helper: paste an IOC and see which known campaigns/actors match

## File Changes

| File | Change |
|------|--------|
| `src/lib/mispData.ts` | New — static catalog: ATT&CK techniques, threat actors (APT28, Lazarus, etc.), IOC patterns, galaxies, taxonomies, public feed URLs |
| `src/components/misp/MispSidebar.tsx` | New — internal sidebar with sections: Overview, Events/IOCs, ATT&CK Matrix, Threat Actors, Galaxies, Taxonomies, Feeds |
| `src/components/misp/MispTypes.ts` | New — section IDs and data interfaces |
| `src/components/misp/sections/OverviewSection.tsx` | New — dashboard with stats, recent threat highlights, search |
| `src/components/misp/sections/IocBrowserSection.tsx` | New — searchable IOC table with type filters (IP, domain, hash, URL, email), severity badges, copy-to-clipboard |
| `src/components/misp/sections/AttackMatrixSection.tsx` | New — visual MITRE ATT&CK matrix grid (tactics as columns, techniques as cells) with click-to-detail |
| `src/components/misp/sections/ThreatActorsSection.tsx` | New — card grid of APT groups with country, motivation, target sectors, linked techniques |
| `src/components/misp/sections/GalaxiesSection.tsx` | New — browsable galaxy clusters (ransomware, tools, sectors) |
| `src/components/misp/sections/TaxonomiesSection.tsx` | New — reference table of MISP taxonomies (TLP, PAP, etc.) |
| `src/components/misp/sections/FeedsSection.tsx` | New — list of public OSINT feeds with URLs, descriptions, format info |
| `src/components/views/MispView.tsx` | New — main view with sidebar + section routing (same pattern as IntuneView) |
| `src/components/layout/Sidebar.tsx` | Add "Threat Intelligence" group with MISP item |
| `src/pages/Index.tsx` | Register `'misp'` in SIMPLE_VIEWS |

## Data Catalog (`mispData.ts`)

**MITRE ATT&CK** (~50 key techniques across 14 tactics):
- Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, C2, Exfiltration, Impact

**Threat Actors** (~20 profiles):
- APT28, APT29, Lazarus, Turla, Sandworm, FIN7, Hafnium, Volt Typhoon, BlackCat, LockBit, Conti, REvil, etc.

**IOC Patterns** (~30 curated examples):
- Known C2 domains, malware hashes, suspicious IP ranges with context

**Galaxies**: Ransomware families, attack tools (Cobalt Strike, Mimikatz, etc.), targeted sectors

**Taxonomies**: TLP (white/green/amber/red), PAP, Admiralty Scale, OSINT quality

**Public Feeds** (~15): abuse.ch, AlienVault OTX, CIRCL OSINT, Botvrij, etc.

## UI Pattern
Follows the exact same layout as IntuneView/EmailSecurityView: left sidebar for section navigation + right content area with breadcrumbs.

## No database changes needed
All data is static reference content embedded in the frontend.

