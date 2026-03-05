import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Monitor,
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
  ClipboardList,
  Eye,
  ArrowRightLeft,
  Brain,
  Sparkles,
  Scale,
  Calculator,
  Award,
  AlertOctagon,
  UserCheck,
  SlidersHorizontal,
  MessageCircle,
  GitPullRequestDraft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TenantSelector } from '@/components/TenantSelector';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  isAI?: boolean;
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
      { id: 'nl-query', label: 'AI Query', icon: Search, isAI: true },
      { id: 'ai-chat', label: 'AI Chat', icon: MessageCircle, isAI: true },
      { id: 'cross-tenant-insights', label: 'Cross-Tenant Insights', icon: GitPullRequestDraft, isAI: true },
      { id: 'customers', label: 'Customers', icon: Building2 },
    ],
  },
  {
    title: 'Intune',
    items: [
      { id: 'intune', label: 'Intune Manager', icon: Monitor },
    ],
  },
  {
    title: 'Tenant Health',
    items: [
      { id: 'health-dashboard', label: 'Health Dashboard', icon: Activity },
      { id: 'tenant-analyzer', label: 'Tenant Analyzer', icon: BarChart3, isAI: true },
      { id: 'secure-score', label: 'Secure Score', icon: Shield },
      { id: 'security-predictor', label: 'Security Predictor', icon: Eye, isAI: true },
      { id: 'security-benchmark', label: 'Security Benchmark', icon: Award, isAI: true },
      { id: 'permission-health', label: 'Permission Health', icon: HeartPulse },
      { id: 'copilot-agents', label: 'Copilot Agents', icon: Bot },
      { id: 'copilot-advisor', label: 'Copilot Advisor', icon: Brain, isAI: true },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { id: 'resources', label: 'Resources', icon: FolderTree },
      { id: 'policy-browser', label: 'Policy Browser', icon: Eye },
      { id: 'config-optimizer', label: 'Config Optimizer', icon: SlidersHorizontal, isAI: true },
      { id: 'migration-planner', label: 'Migration Planner', icon: ArrowRightLeft, isAI: true },
      { id: 'export', label: 'Export', icon: Download },
      { id: 'import', label: 'Import / Restore', icon: Upload },
      { id: 'jobs', label: 'Export Jobs', icon: History },
    ],
  },
  {
    title: 'Policy Management',
    items: [
      { id: 'policy-templates', label: 'Policy Templates', icon: FileCheck },
      { id: 'policy-generator', label: 'Policy Generator', icon: Wand2, isAI: true },
      { id: 'remediation-scripts', label: 'Remediation Scripts', icon: Wrench, isAI: true },
      { id: 'change-impact', label: 'Change Impact', icon: GitCompare, isAI: true },
      { id: 'policy-deployment', label: 'Policy Deployment', icon: Rocket },
      { id: 'scheduled-deployments', label: 'Scheduled Deployments', icon: CalendarClock },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'anomaly-detection', label: 'Anomaly Detection', icon: Radar, isAI: true },
      { id: 'incident-responder', label: 'Incident Responder', icon: AlertOctagon, isAI: true },
      { id: 'user-risk-profiler', label: 'User Risk Profiler', icon: UserCheck, isAI: true },
      { id: 'drift', label: 'Drift Detection', icon: GitCompare },
      { id: 'drift-explainer', label: 'Drift Explainer', icon: MessageSquareText, isAI: true },
      { id: 'scheduled-drift', label: 'Scheduled Drift', icon: CalendarClock },
      { id: 'validation', label: 'Validation', icon: ShieldCheck },
      { id: 'compliance', label: 'Compliance Checks', icon: AlertTriangle },
      { id: 'compliance-advisor', label: 'Compliance Advisor', icon: Scale, isAI: true },
      { id: 'compliance-dashboard', label: 'Compliance Dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Automation',
    items: [
      { id: 'ai-schedules', label: 'AI Schedules & Trends', icon: CalendarClock, isAI: true },
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
      { id: 'executive-report', label: 'Executive Report', icon: ClipboardList, isAI: true },
      { id: 'license-optimizer', label: 'License Optimizer', icon: Wallet, isAI: true },
      { id: 'cost-predictor', label: 'Cost Predictor', icon: Calculator, isAI: true },
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
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Tenant Selector */}
      <div className="p-3 border-b border-sidebar-border relative z-10">
        <TenantSelector 
          collapsed={collapsed}
          onNavigateToAuth={() => onTabChange('auth')}
          onNavigateToCustomers={() => onTabChange('customers')}
        />
      </div>

      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between relative z-10">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm text-foreground tracking-tight">PolicyForge</h1>
              <p className="text-[11px] text-muted-foreground">M365 Governance Platform</p>
            </div>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-all duration-200 hover:scale-105"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 relative z-10">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title}>
            {/* Group Header */}
            {!collapsed && (
              <div className="px-4 py-2.5 mt-3 first:mt-0">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.title}
                </span>
              </div>
            )}
            
            {/* Separator for collapsed state */}
            {collapsed && groupIndex > 0 && (
              <Separator className="my-2 mx-2 bg-sidebar-border/50" />
            )}
            
            {/* Group Items */}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                      "hover:bg-sidebar-accent/80 group relative overflow-hidden",
                      isActive 
                        ? "bg-gradient-to-r from-primary/20 to-accent/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div 
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-r-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <div className="relative flex-shrink-0">
                      <Icon className={cn(
                        "w-4 h-4 transition-all duration-200",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      {item.isAI && collapsed && (
                        <Sparkles className="w-2.5 h-2.5 text-accent absolute -top-1 -right-1" />
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium truncate flex-1 text-left">{item.label}</span>
                        {item.isAI && (
                          <span className="ai-badge flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI
                          </span>
                        )}
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Tenant Selector */}
      <div className="p-3 border-t border-sidebar-border relative z-10">
        <TenantSelector 
          onNavigateToAuth={() => onTabChange('auth')}
          onNavigateToCustomers={() => onTabChange('customers')}
          collapsed={collapsed}
        />
      </div>
    </motion.aside>
  );
};
