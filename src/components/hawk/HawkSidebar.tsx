import { LayoutDashboard, Terminal, Compass, BookOpen, FileOutput } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HawkSection } from './HawkTypes';

const sections: { id: HawkSection; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'script-generator', label: 'Script Generator', icon: Terminal },
  { id: 'investigation-wizard', label: 'Investigation Wizard', icon: Compass },
  { id: 'command-reference', label: 'Command Reference', icon: BookOpen },
  { id: 'output-guide', label: 'Output Guide', icon: FileOutput },
];

interface HawkSidebarProps {
  activeSection: HawkSection;
  onSectionChange: (s: HawkSection) => void;
}

export const HawkSidebar = ({ activeSection, onSectionChange }: HawkSidebarProps) => (
  <div className="w-56 border-r border-border/50 bg-card/30 p-3 space-y-1 shrink-0">
    <div className="px-3 py-2 mb-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Hawk Forensics</h3>
    </div>
    {sections.map(({ id, label, icon: Icon }) => {
      const active = activeSection === id;
      return (
        <button
          key={id}
          onClick={() => onSectionChange(id)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            active
              ? 'bg-primary/15 text-primary font-medium'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      );
    })}
  </div>
);
