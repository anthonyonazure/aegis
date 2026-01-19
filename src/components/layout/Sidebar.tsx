import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderTree, 
  Download, 
  Settings, 
  GitBranch,
  History,
  Key,
  ChevronLeft,
  ChevronRight,
  Shield,
  Upload,
  ShieldCheck,
  GitCompare,
  FileText,
  AlertTriangle,
  Calendar,
  Webhook,
  BarChart3,
  Building2,
  FileCheck,
  Activity,
  Rocket,
  CalendarClock,
  Ticket,
  HardDrive,
  HeartPulse,
  FileKey,
  Gauge,
  Book,
  Bot,
  Wand2,
  Radar,
  Search,
  Wrench,
  Wallet,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TenantSelector } from '@/components/TenantSelector';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'governance', label: 'Governance Center', icon: Gauge },
      { id: 'nl-query', label: 'AI Query', icon: Search },
      { id: 'customers', label: 'Customers', icon: Building2 },
    ],
  },
  {
    title: 'Tenant Health',
    items: [
      { id: 'health-dashboard', label: 'Health Dashboard', icon: Activity },
      { id: 'secure-score', label: 'Secure Score', icon: Shield },
      { id: 'permission-health', label: 'Permission Health', icon: HeartPulse },
      { id: 'copilot-agents', label: 'Copilot Agents', icon: Bot },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { id: 'resources', label: 'Resources', icon: FolderTree },
      { id: 'export', label: 'Export', icon: Download },
      { id: 'import', label: 'Import / Restore', icon: Upload },
      { id: 'jobs', label: 'Export Jobs', icon: History },
    ],
  },
  {
    title: 'Policy Management',
    items: [
      { id: 'policy-templates', label: 'Policy Templates', icon: FileCheck },
      { id: 'policy-generator', label: 'AI Policy Generator', icon: Wand2 },
      { id: 'remediation-scripts', label: 'Remediation Scripts', icon: Wrench },
      { id: 'policy-deployment', label: 'Policy Deployment', icon: Rocket },
      { id: 'scheduled-deployments', label: 'Scheduled Deployments', icon: CalendarClock },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'anomaly-detection', label: 'Anomaly Detection', icon: Radar },
      { id: 'drift', label: 'Drift Detection', icon: GitCompare },
      { id: 'drift-explainer', label: 'Drift Explainer', icon: MessageSquareText },
      { id: 'scheduled-drift', label: 'Scheduled Drift', icon: CalendarClock },
      { id: 'validation', label: 'Validation', icon: ShieldCheck },
      { id: 'compliance', label: 'Compliance Checks', icon: AlertTriangle },
      { id: 'compliance-dashboard', label: 'Compliance Dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Automation',
    items: [
      { id: 'schedules', label: 'Scheduled Exports', icon: Calendar },
      { id: 'automated-backups', label: 'Automated Backups', icon: HardDrive },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook },
      { id: 'psa-integrations', label: 'PSA Integrations', icon: Ticket },
    ],
  },
  {
    title: 'Reporting',
    items: [
      { id: 'reports', label: 'Reports', icon: FileText },
      { id: 'license-optimizer', label: 'License Optimizer', icon: Wallet },
      { id: 'billing', label: 'Billing & Usage', icon: BarChart3 },
      { id: 'audit', label: 'Audit Trail', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'permissions-reference', label: 'Permissions Reference', icon: FileKey },
      { id: 'documentation', label: 'Documentation', icon: Book },
      { id: 'git', label: 'Git & CI/CD', icon: GitBranch },
      { id: 'auth', label: 'Authentication', icon: Key },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isConnected?: boolean;
}

export const Sidebar = ({ activeTab, onTabChange, isConnected = false }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Tenant Selector */}
      <div className="p-3 border-b border-sidebar-border">
        <TenantSelector 
          collapsed={collapsed}
          onNavigateToAuth={() => onTabChange('auth')}
          onNavigateToCustomers={() => onTabChange('customers')}
        />
      </div>

      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm text-foreground">M365 Export</h1>
              <p className="text-xs text-muted-foreground">MSP Platform</p>
            </div>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title}>
            {/* Group Header */}
            {!collapsed && (
              <div className="px-4 py-2 mt-2 first:mt-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </span>
              </div>
            )}
            
            {/* Separator for collapsed state */}
            {collapsed && groupIndex > 0 && (
              <Separator className="my-2 mx-2 bg-sidebar-border" />
            )}
            
            {/* Group Items */}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                      "hover:bg-sidebar-accent group",
                      isActive 
                        ? "bg-primary/10 text-primary border-l-2 border-primary ml-0.5" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={cn(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Connection Status */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "status-dot",
                isConnected ? "status-dot-success" : "status-dot-warning"
              )} />
              <span className="text-xs font-medium text-foreground">
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isConnected 
                ? 'Ready to export tenant configuration'
                : 'Connect to a tenant to begin exporting'
              }
            </p>
          </div>
        </div>
      )}
    </motion.aside>
  );
};
