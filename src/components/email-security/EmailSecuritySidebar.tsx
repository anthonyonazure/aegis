import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Layout, Shield, ShieldAlert, Bug, Link2,
  Paperclip, Globe, Sparkles, ChevronDown, ChevronRight,
} from 'lucide-react';
import { EmailSecuritySectionId } from './EmailSecurityTypes';

const iconMap: Record<string, React.ElementType> = {
  layout: Layout,
  shield: Shield,
  'shield-alert': ShieldAlert,
  bug: Bug,
  link: Link2,
  paperclip: Paperclip,
  globe: Globe,
  sparkles: Sparkles,
};

interface SidebarGroup {
  id: string;
  label: string;
  collapsible: boolean;
  items: { id: EmailSecuritySectionId; label: string; icon: string }[];
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
    id: 'protection',
    label: 'Protection Policies',
    collapsible: true,
    items: [
      { id: 'anti-phishing', label: 'Anti-Phishing', icon: 'shield-alert' },
      { id: 'anti-spam', label: 'Anti-Spam', icon: 'shield' },
      { id: 'anti-malware', label: 'Anti-Malware', icon: 'bug' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced Protection',
    collapsible: true,
    items: [
      { id: 'safe-links', label: 'Safe Links', icon: 'link' },
      { id: 'safe-attachments', label: 'Safe Attachments', icon: 'paperclip' },
    ],
  },
  {
    id: 'domain',
    label: 'Domain Security',
    collapsible: true,
    items: [
      { id: 'domain-auth', label: 'SPF / DKIM / DMARC', icon: 'globe' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Analysis',
    collapsible: true,
    items: [
      { id: 'recommendations', label: 'Recommendations', icon: 'sparkles' },
    ],
  },
];

interface EmailSecuritySidebarProps {
  activeSection: EmailSecuritySectionId;
  onSectionChange: (section: EmailSecuritySectionId) => void;
}

export const EmailSecuritySidebar = ({ activeSection, onSectionChange }: EmailSecuritySidebarProps) => {
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
                  const Icon = iconMap[item.icon] || Shield;
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
