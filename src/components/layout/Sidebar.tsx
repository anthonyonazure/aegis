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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TenantSelector } from '@/components/TenantSelector';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'governance', label: 'Governance Center', icon: Gauge },
  { id: 'customers', label: 'Customers', icon: Building2 },
  { id: 'health-dashboard', label: 'Tenant Health', icon: Activity },
  { id: 'secure-score', label: 'Secure Score', icon: Shield },
  { id: 'resources', label: 'Resources', icon: FolderTree },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'import', label: 'Import / Restore', icon: Upload },
  { id: 'policy-templates', label: 'Policy Templates', icon: FileCheck },
  { id: 'policy-deployment', label: 'Policy Deployment', icon: Rocket },
  { id: 'scheduled-deployments', label: 'Scheduled Deployments', icon: CalendarClock },
  { id: 'drift', label: 'Drift Detection', icon: GitCompare },
  { id: 'scheduled-drift', label: 'Scheduled Drift', icon: CalendarClock },
  { id: 'validation', label: 'Validation', icon: ShieldCheck },
  { id: 'compliance', label: 'Compliance', icon: AlertTriangle },
  { id: 'compliance-dashboard', label: 'Compliance Dashboard', icon: BarChart3 },
  { id: 'psa-integrations', label: 'PSA Integrations', icon: Ticket },
  { id: 'schedules', label: 'Scheduled Exports', icon: Calendar },
  { id: 'automated-backups', label: 'Automated Backups', icon: HardDrive },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'billing', label: 'Billing & Usage', icon: BarChart3 },
  { id: 'jobs', label: 'Export Jobs', icon: History },
  { id: 'audit', label: 'Audit Trail', icon: FileText },
  { id: 'permission-health', label: 'Permission Health', icon: HeartPulse },
  { id: 'permissions-reference', label: 'Permissions Reference', icon: FileKey },
  { id: 'documentation', label: 'Documentation', icon: Book },
  { id: 'git', label: 'Git & CI/CD', icon: GitBranch },
  { id: 'auth', label: 'Authentication', icon: Key },
  { id: 'settings', label: 'Settings', icon: Settings },
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
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent",
                isActive 
                  ? "bg-primary/10 text-primary border-l-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          );
        })}
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
