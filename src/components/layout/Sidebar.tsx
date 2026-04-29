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
  Mail,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TenantSelector } from '@/components/TenantSelector';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
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
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Main overview with key metrics and recent activity' },
      { id: 'governance', label: 'Governance Center', icon: Gauge, description: 'Centralized governance dashboard and metrics' },
      { id: 'nl-query', label: 'AI Query', icon: Search, isAI: true, description: 'Ask natural language questions about your tenant data' },
      { id: 'ai-chat', label: 'AI Chat', icon: MessageCircle, isAI: true, description: 'Interactive AI assistant for policy and configuration help' },
      { id: 'cross-tenant-insights', label: 'Cross-Tenant Insights', icon: GitPullRequestDraft, isAI: true, description: 'Compare and analyze data across multiple tenants' },
      { id: 'customers', label: 'Customers', icon: Building2, description: 'Manage customer organizations and tenant assignments' },
    ],
  },
  {
    title: 'Intune',
    items: [
      { id: 'intune', label: 'Intune Manager', icon: Monitor, description: 'Manage Intune devices, policies, and configurations' },
      { id: 'dude', label: 'DUDE Sync', icon: RefreshCw, description: 'Automate device group membership based on user groups' },
    ],
  },
  {
    title: 'Email Security',
    items: [
      { id: 'email-security', label: 'Email Security', icon: Mail, description: 'Review EOP policies, anti-phishing, and domain authentication' },
    ],
  },
  {
    title: 'Threat Intelligence',
    items: [
      { id: 'misp', label: 'MISP Browser', icon: Shield, description: 'Browse curated threat intelligence: MITRE ATT&CK techniques, IOCs, threat actor profiles, MISP galaxies, and OSINT feeds — all locally embedded, no external MISP server required.' },
      { id: 'hawk', label: 'Hawk Forensics', icon: Search, description: 'M365 incident response toolkit — generate Hawk PowerShell scripts, follow investigation playbooks, and reference the full command catalog.' },
    ],
  },
  {
    title: 'Tenant Health',
    items: [
      { id: 'health-dashboard', label: 'Health Dashboard', icon: Activity, description: 'Monitor tenant health status and issues' },
      { id: 'tenant-analyzer', label: 'Tenant Analyzer', icon: BarChart3, isAI: true, description: 'AI-powered analysis of tenant configuration and security' },
      { id: 'secure-score', label: 'Secure Score', icon: Shield, description: 'View and track Microsoft Secure Score recommendations' },
      { id: 'security-predictor', label: 'Security Predictor', icon: Eye, isAI: true, description: 'AI predictions of future security posture and risks' },
      { id: 'security-benchmark', label: 'Security Benchmark', icon: Award, isAI: true, description: 'Compare your security against industry standards' },
      { id: 'permission-health', label: 'Permission Health', icon: HeartPulse, description: 'Check API permissions and access health' },
      { id: 'copilot-agents', label: 'Copilot Agents', icon: Bot, description: 'Manage and deploy Copilot agents and plugins' },
      { id: 'copilot-advisor', label: 'Copilot Advisor', icon: Brain, isAI: true, description: 'AI guidance for Copilot readiness and optimization' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { id: 'resources', label: 'Resources', icon: FolderTree, description: 'Browse and manage all tenant resources' },
      { id: 'policy-browser', label: 'Policy Browser', icon: Eye, description: 'View and search through all policies' },
      { id: 'config-optimizer', label: 'Config Optimizer', icon: SlidersHorizontal, isAI: true, description: 'AI recommendations to optimize configurations' },
      { id: 'migration-planner', label: 'Migration Planner', icon: ArrowRightLeft, isAI: true, description: 'AI-assisted planning for tenant migrations' },
      { id: 'export', label: 'Export', icon: Download, description: 'Export tenant data and configurations' },
      { id: 'import', label: 'Import / Restore', icon: Upload, description: 'Import or restore configurations from backup' },
      { id: 'jobs', label: 'Export Jobs', icon: History, description: 'View history of export and import operations' },
    ],
  },
  {
    title: 'Policy Management',
    items: [
      { id: 'policy-templates', label: 'Policy Templates', icon: FileCheck, description: 'Browse and apply policy templates' },
      { id: 'policy-generator', label: 'Policy Generator', icon: Wand2, isAI: true, description: 'AI-powered policy creation and customization' },
      { id: 'remediation-scripts', label: 'Remediation Scripts', icon: Wrench, isAI: true, description: 'Generate scripts to fix configuration issues' },
      { id: 'change-impact', label: 'Change Impact', icon: GitCompare, isAI: true, description: 'AI analysis of impact before making changes' },
      { id: 'policy-deployment', label: 'Policy Deployment', icon: Rocket, description: 'Deploy policies to multiple tenants' },
      { id: 'scheduled-deployments', label: 'Scheduled Deployments', icon: CalendarClock, description: 'Schedule policy deployments for later' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'anomaly-detection', label: 'Anomaly Detection', icon: Radar, isAI: true, description: 'AI-powered detection of unusual configuration changes' },
      { id: 'incident-responder', label: 'Incident Responder', icon: AlertOctagon, isAI: true, description: 'AI-guided incident response and remediation' },
      { id: 'user-risk-profiler', label: 'User Risk Profiler', icon: UserCheck, isAI: true, description: 'AI analysis of user security risk profiles' },
      { id: 'drift', label: 'Drift Detection', icon: GitCompare, description: 'Detect configuration drift from baselines' },
      { id: 'drift-explainer', label: 'Drift Explainer', icon: MessageSquareText, isAI: true, description: 'AI explanations of detected configuration drift' },
      { id: 'scheduled-drift', label: 'Scheduled Drift', icon: CalendarClock, description: 'Schedule automated drift detection runs' },
      { id: 'validation', label: 'Validation', icon: ShieldCheck, description: 'Validate configurations against best practices' },
      { id: 'compliance', label: 'Compliance Checks', icon: AlertTriangle, description: 'Run compliance verification checks' },
      { id: 'compliance-advisor', label: 'Compliance Advisor', icon: Scale, isAI: true, description: 'AI recommendations for compliance improvements' },
      { id: 'compliance-dashboard', label: 'Compliance Dashboard', icon: BarChart3, description: 'Compliance status dashboard and reports' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { id: 'ai-schedules', label: 'AI Schedules & Trends', icon: CalendarClock, isAI: true, description: 'AI-powered scheduled analysis and trend detection' },
      { id: 'schedules', label: 'Scheduled Exports', icon: Calendar, description: 'Schedule automated data exports' },
      { id: 'automated-backups', label: 'Automated Backups', icon: HardDrive, description: 'Configure automatic backup schedules' },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook, description: 'Manage webhook integrations and notifications' },
      { id: 'psa-integrations', label: 'PSA Integrations', icon: Ticket, description: 'Connect with PSA tools like ConnectWise' },
    ],
  },
  {
    title: 'Reporting',
    items: [
      { id: 'reports', label: 'Reports', icon: FileText, description: 'Generate and view reports' },
      { id: 'executive-report', label: 'Executive Report', icon: ClipboardList, isAI: true, description: 'AI-generated executive summary reports' },
      { id: 'license-optimizer', label: 'License Optimizer', icon: Wallet, isAI: true, description: 'AI recommendations for license optimization' },
      { id: 'cost-predictor', label: 'Cost Predictor', icon: Calculator, isAI: true, description: 'AI-powered cost forecasting and budgeting' },
      { id: 'billing', label: 'Billing & Usage', icon: BarChart3, description: 'View billing and usage metrics' },
      { id: 'audit', label: 'Audit Trail', icon: FileText, description: 'Review audit logs and activity history' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'permissions-reference', label: 'Permissions Reference', icon: FileKey, description: 'Reference guide for API permissions' },
      { id: 'permissions-checklist', label: 'Permissions Checklist', icon: ClipboardList, description: 'Check configured vs missing permissions per resource category' },
      { id: 'documentation', label: 'Documentation', icon: Book, description: 'Access help documentation and guides' },
      { id: 'git', label: 'Git & CI/CD', icon: GitBranch, description: 'Manage Git integration and CI/CD pipelines' },
      { id: 'auth', label: 'Authentication', icon: Key, description: 'Configure authentication and credentials' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Application settings and preferences' },
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
              <h1 className="font-semibold text-sm text-foreground tracking-tight">Aegis</h1>
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
                
                 const tooltipText = item.isAI ? `${item.description} (AI-powered)` : item.description;
                 
                 return (
                  <Tooltip key={item.id} delayDuration={300}>
                    <TooltipTrigger asChild>
                      <motion.button
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
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-medium text-xs">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
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
