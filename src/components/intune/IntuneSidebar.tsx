import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Monitor, Smartphone, Tablet, Laptop, Apple, 
  AppWindow, Settings2, ShieldCheck, FileCode, 
  RefreshCw, Shield, BarChart3, ChevronDown, 
  ChevronRight, Layout, Cog, Wrench
} from 'lucide-react';
import { IntuneSectionId } from './IntuneTypes';

const iconMap: Record<string, React.ElementType> = {
  monitor: Monitor,
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  apple: Apple,
  'app-window': AppWindow,
  settings: Settings2,
  'shield-check': ShieldCheck,
  'file-code': FileCode,
  'refresh-cw': RefreshCw,
  shield: Shield,
  'bar-chart': BarChart3,
  layout: Layout,
  cog: Cog,
  wrench: Wrench,
};

interface SidebarGroup {
  id: string;
  label: string;
  collapsible: boolean;
  items: { id: IntuneSectionId; label: string; icon: string }[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    id: 'main',
    label: '',
    collapsible: false,
    items: [
      { id: 'overview', label: 'Overview', icon: 'layout' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    collapsible: true,
    items: [
      { id: 'all-devices', label: 'All devices', icon: 'monitor' },
      { id: 'windows', label: 'Windows', icon: 'laptop' },
      { id: 'macos', label: 'macOS', icon: 'apple' },
      { id: 'ios', label: 'iOS/iPadOS', icon: 'tablet' },
      { id: 'android', label: 'Android', icon: 'smartphone' },
    ],
  },
  {
    id: 'apps',
    label: 'Apps',
    collapsible: true,
    items: [
      { id: 'all-apps', label: 'All apps', icon: 'app-window' },
      { id: 'app-configs', label: 'App configuration', icon: 'cog' },
    ],
  },
  {
    id: 'device-onboarding',
    label: 'Device onboarding',
    collapsible: true,
    items: [
      { id: 'enrollment', label: 'Enrollment', icon: 'settings' },
      { id: 'autopilot', label: 'Windows Autopilot', icon: 'settings' },
    ],
  },
  {
    id: 'manage-devices',
    label: 'Manage devices',
    collapsible: true,
    items: [
      { id: 'configuration', label: 'Configuration', icon: 'settings' },
      { id: 'compliance', label: 'Compliance', icon: 'shield-check' },
      { id: 'scripts', label: 'Scripts', icon: 'file-code' },
      { id: 'remediation', label: 'Remediation', icon: 'wrench' },
    ],
  },
  {
    id: 'manage-updates',
    label: 'Manage updates',
    collapsible: true,
    items: [
      { id: 'update-rings', label: 'Update rings', icon: 'refresh-cw' },
    ],
  },
  {
    id: 'security',
    label: 'Endpoint security',
    collapsible: true,
    items: [
      { id: 'endpoint-security', label: 'Security policies', icon: 'shield' },
    ],
  },
  {
    id: 'reporting',
    label: 'Reports',
    collapsible: true,
    items: [
      { id: 'reports', label: 'Reports', icon: 'bar-chart' },
    ],
  },
];

interface IntuneSidebarProps {
  activeSection: IntuneSectionId;
  onSectionChange: (section: IntuneSectionId) => void;
}

export const IntuneSidebar = ({ activeSection, onSectionChange }: IntuneSidebarProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(sidebarGroups.filter(g => g.collapsible).map(g => g.id))
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div className="w-56 border-r border-border/50 bg-muted/20 flex-shrink-0 overflow-y-auto">
      <div className="py-2">
        {sidebarGroups.map((group) => (
          <div key={group.id}>
            {group.label && group.collapsible && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-1 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {group.label}
              </button>
            )}
            {(!group.collapsible || expandedGroups.has(group.id)) && (
              <div className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon] || Monitor;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
                        isActive
                          ? "bg-primary/15 text-primary font-medium border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
