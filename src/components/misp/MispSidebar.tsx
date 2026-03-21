import { cn } from '@/lib/utils';
import { MispSectionId } from './MispTypes';
import {
  LayoutDashboard,
  Search,
  Grid3X3,
  Users,
  Globe,
  Tags,
  Rss,
} from 'lucide-react';

interface MispSidebarProps {
  activeSection: MispSectionId;
  onSectionChange: (section: MispSectionId) => void;
}

const sections: { id: MispSectionId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ioc-browser', label: 'IOC Browser', icon: Search, group: 'Intelligence' },
  { id: 'attack-matrix', label: 'ATT&CK Matrix', icon: Grid3X3, group: 'Intelligence' },
  { id: 'threat-actors', label: 'Threat Actors', icon: Users, group: 'Intelligence' },
  { id: 'galaxies', label: 'Galaxies', icon: Globe, group: 'Reference' },
  { id: 'taxonomies', label: 'Taxonomies', icon: Tags, group: 'Reference' },
  { id: 'feeds', label: 'OSINT Feeds', icon: Rss, group: 'Reference' },
];

export const MispSidebar = ({ activeSection, onSectionChange }: MispSidebarProps) => {
  let lastGroup = '';

  return (
    <div className="w-56 border-r border-border/50 bg-muted/30 p-3 flex flex-col gap-1 shrink-0">
      {sections.map((section) => {
        const showGroup = section.group && section.group !== lastGroup;
        if (section.group) lastGroup = section.group;
        const Icon = section.icon;
        return (
          <div key={section.id}>
            {showGroup && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-1 px-2">
                {section.group}
              </p>
            )}
            <button
              onClick={() => onSectionChange(section.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                activeSection === section.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{section.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
