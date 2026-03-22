import { useState } from 'react';
import { HawkSidebar } from '@/components/hawk/HawkSidebar';
import type { HawkSection } from '@/components/hawk/HawkTypes';
import { OverviewSection } from '@/components/hawk/sections/OverviewSection';
import { ScriptGeneratorSection } from '@/components/hawk/sections/ScriptGeneratorSection';
import { InvestigationWizardSection } from '@/components/hawk/sections/InvestigationWizardSection';
import { CommandReferenceSection } from '@/components/hawk/sections/CommandReferenceSection';
import { OutputGuideSection } from '@/components/hawk/sections/OutputGuideSection';

const sectionComponents: Record<HawkSection, React.ComponentType> = {
  'overview': OverviewSection,
  'script-generator': ScriptGeneratorSection,
  'investigation-wizard': InvestigationWizardSection,
  'command-reference': CommandReferenceSection,
  'output-guide': OutputGuideSection,
};

export const HawkView = () => {
  const [section, setSection] = useState<HawkSection>('overview');
  const SectionComponent = sectionComponents[section];

  return (
    <div className="flex h-full">
      <HawkSidebar activeSection={section} onSectionChange={setSection} />
      <div className="flex-1 overflow-y-auto p-6">
        <SectionComponent />
      </div>
    </div>
  );
};
