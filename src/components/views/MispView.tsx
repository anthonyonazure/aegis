import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { MispSidebar } from '@/components/misp/MispSidebar';
import { MispSectionId } from '@/components/misp/MispTypes';
import { OverviewSection } from '@/components/misp/sections/OverviewSection';
import { IocBrowserSection } from '@/components/misp/sections/IocBrowserSection';
import { AttackMatrixSection } from '@/components/misp/sections/AttackMatrixSection';
import { ThreatActorsSection } from '@/components/misp/sections/ThreatActorsSection';
import { GalaxiesSection } from '@/components/misp/sections/GalaxiesSection';
import { TaxonomiesSection } from '@/components/misp/sections/TaxonomiesSection';
import { FeedsSection } from '@/components/misp/sections/FeedsSection';
import { Shield } from 'lucide-react';

const breadcrumbMap: Record<MispSectionId, string[]> = {
  overview: ['Threat Intelligence'],
  'ioc-browser': ['Intelligence', 'IOC Browser'],
  'attack-matrix': ['Intelligence', 'ATT&CK Matrix'],
  'threat-actors': ['Intelligence', 'Threat Actors'],
  galaxies: ['Reference', 'Galaxies'],
  taxonomies: ['Reference', 'Taxonomies'],
  feeds: ['Reference', 'OSINT Feeds'],
};

export const MispView = () => {
  const [activeSection, setActiveSection] = useState<MispSectionId>('overview');
  const breadcrumbs = breadcrumbMap[activeSection] || ['Threat Intelligence'];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <OverviewSection />;
      case 'ioc-browser': return <IocBrowserSection />;
      case 'attack-matrix': return <AttackMatrixSection />;
      case 'threat-actors': return <ThreatActorsSection />;
      case 'galaxies': return <GalaxiesSection />;
      case 'taxonomies': return <TaxonomiesSection />;
      case 'feeds': return <FeedsSection />;
      default: return <OverviewSection />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Shield className="w-4 h-4 text-primary" />
        <span className="text-muted-foreground">Home</span>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-2">
            <span className="text-muted-foreground">›</span>
            <span className={idx === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>{crumb}</span>
          </span>
        ))}
      </div>
      <Card className="border-border/50 overflow-hidden">
        <div className="flex min-h-[calc(100vh-200px)]">
          <MispSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
          <div className="flex-1 p-6 overflow-auto">{renderSection()}</div>
        </div>
      </Card>
    </div>
  );
};
