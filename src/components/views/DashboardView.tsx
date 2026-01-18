import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { 
  Server, 
  FileJson, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Zap,
  Download,
  Upload,
  GitCompare,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Webhook,
  History,
  GitBranch,
  BarChart3,
  FileText,
  FolderTree,
  Building2,
  Rocket,
  CalendarClock,
  Activity,
  Ticket,
  RotateCcw,
  Shield,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RESOURCE_CATEGORIES } from '@/types/tenant';
import { getIcon } from '@/lib/icons';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  isConnected?: boolean;
  selectedResourcesCount?: number;
  selectedFormatsCount?: number;
  hasGitConfig?: boolean;
}

interface DashboardStats {
  totalExports: number;
  successfulExports: number;
  scheduledExports: number;
  activeWebhooks: number;
  driftDetections: number;
  complianceChecks: number;
  lastExportDate: string | null;
  importJobs: number;
  totalCustomers: number;
  totalTenants: number;
  policyDeployments: number;
  scheduledDeployments: number;
  scheduledDriftConfigs: number;
  psaIntegrations: number;
  psaTickets: number;
  reportsGenerated: number;
}

export const DashboardView = ({ 
  onNavigate, 
  isConnected = false,
  selectedResourcesCount = 0,
  selectedFormatsCount = 0,
  hasGitConfig = false
}: DashboardViewProps) => {
  const { selectedCustomerId, selectedTenantId, customers } = useTenant();
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  
  const [stats, setStats] = useState<DashboardStats>({
    totalExports: 0,
    successfulExports: 0,
    scheduledExports: 0,
    activeWebhooks: 0,
    driftDetections: 0,
    complianceChecks: 0,
    lastExportDate: null,
    importJobs: 0,
    totalCustomers: 0,
    totalTenants: 0,
    policyDeployments: 0,
    scheduledDeployments: 0,
    scheduledDriftConfigs: 0,
    psaIntegrations: 0,
    psaTickets: 0,
    reportsGenerated: 0
  });
  const [loading, setLoading] = useState(true);

  // Reload stats when customer/tenant selection changes
  useEffect(() => {
    loadStats();
  }, [selectedCustomerId, selectedTenantId]);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get tenant IDs for the selected customer (if any)
      let tenantIds: Set<string> = new Set();
      if (selectedCustomerId) {
        const { data: tenantConnections } = await supabase
          .from('tenant_connections')
          .select('id')
          .eq('customer_id', selectedCustomerId);
        tenantIds = new Set((tenantConnections || []).map(t => t.id));
      }

      // Fetch all data first
      // Note: Only some tables have tenant_connection_id column
      const [
        exportsResult,
        schedulesResult,
        webhooksResult,
        driftResult,
        complianceResult,
        importsResult,
        customersResult,
        tenantsResult,
        policyDeploymentsResult,
        scheduledDeploymentsResult,
        scheduledDriftResult,
        psaIntegrationsResult,
        psaTicketsResult,
        reportsResult
      ] = await Promise.all([
        supabase.from('export_jobs').select('id, status, completed_at, tenant_connection_id').eq('user_id', user.id).order('completed_at', { ascending: false }),
        supabase.from('scheduled_exports').select('id, is_active, tenant_connection_id').eq('user_id', user.id),
        supabase.from('webhook_configs').select('id, is_active').eq('user_id', user.id),
        supabase.from('drift_detections').select('id, tenant_connection_id').eq('user_id', user.id),
        supabase.from('compliance_results').select('id').eq('user_id', user.id),
        supabase.from('import_jobs').select('id, tenant_connection_id').eq('user_id', user.id),
        supabase.from('customers').select('id').eq('user_id', user.id),
        supabase.from('tenant_connections').select('id, customer_id').eq('user_id', user.id),
        supabase.from('policy_deployments').select('id, status').eq('user_id', user.id),
        supabase.from('scheduled_deployment_configs').select('id, is_active, target_customer_id').eq('user_id', user.id),
        supabase.from('scheduled_drift_configs').select('id, is_active, target_customer_id').eq('user_id', user.id),
        supabase.from('psa_integrations').select('id, is_active').eq('user_id', user.id),
        supabase.from('psa_tickets').select('id').eq('user_id', user.id),
        supabase.from('reports').select('id').eq('user_id', user.id)
      ]);

      let exports = exportsResult.data || [];
      let schedules = schedulesResult.data || [];
      const webhooks = webhooksResult.data || [];
      let drifts = driftResult.data || [];
      const compliance = complianceResult.data || [];
      let imports = importsResult.data || [];
      let customersData = customersResult.data || [];
      let tenants = tenantsResult.data || [];
      const policyDeployments = policyDeploymentsResult.data || [];
      let scheduledDeployments = scheduledDeploymentsResult.data || [];
      let scheduledDrift = scheduledDriftResult.data || [];
      const psaIntegrations = psaIntegrationsResult.data || [];
      const psaTickets = psaTicketsResult.data || [];
      const reports = reportsResult.data || [];

      // Apply filtering if a specific tenant is selected
      // Only filter tables that have tenant_connection_id column
      if (selectedTenantId) {
        exports = exports.filter(e => e.tenant_connection_id === selectedTenantId);
        schedules = schedules.filter(s => s.tenant_connection_id === selectedTenantId);
        drifts = drifts.filter(d => d.tenant_connection_id === selectedTenantId);
        imports = imports.filter(i => i.tenant_connection_id === selectedTenantId);
        tenants = tenants.filter(t => t.id === selectedTenantId);
      } else if (selectedCustomerId && tenantIds.size > 0) {
        // Apply filtering if a customer is selected (show all tenants for that customer)
        exports = exports.filter(e => e.tenant_connection_id && tenantIds.has(e.tenant_connection_id));
        schedules = schedules.filter(s => s.tenant_connection_id && tenantIds.has(s.tenant_connection_id));
        drifts = drifts.filter(d => d.tenant_connection_id && tenantIds.has(d.tenant_connection_id));
        imports = imports.filter(i => i.tenant_connection_id && tenantIds.has(i.tenant_connection_id));
        tenants = tenants.filter(t => t.customer_id === selectedCustomerId);
        scheduledDeployments = scheduledDeployments.filter(s => s.target_customer_id === selectedCustomerId);
        scheduledDrift = scheduledDrift.filter(s => s.target_customer_id === selectedCustomerId);
        customersData = customersData.filter(c => c.id === selectedCustomerId);
      }

      setStats({
        totalExports: exports.length,
        successfulExports: exports.filter(e => e.status === 'completed').length,
        scheduledExports: schedules.filter(s => s.is_active).length,
        activeWebhooks: webhooks.filter(w => w.is_active).length,
        driftDetections: drifts.length,
        complianceChecks: compliance.length,
        lastExportDate: exports[0]?.completed_at || null,
        importJobs: imports.length,
        totalCustomers: customersData.length,
        totalTenants: tenants.length,
        policyDeployments: policyDeployments.length,
        scheduledDeployments: scheduledDeployments.filter(s => s.is_active).length,
        scheduledDriftConfigs: scheduledDrift.filter(s => s.is_active).length,
        psaIntegrations: psaIntegrations.filter(p => p.is_active).length,
        psaTickets: psaTickets.length,
        reportsGenerated: reports.length
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };


  const statCards = [
    { label: 'Customers', value: stats.totalCustomers.toString(), icon: Building2, trend: `${stats.totalTenants} tenants` },
    { label: 'Policy Deployments', value: stats.policyDeployments.toString(), icon: Rocket, trend: `${stats.scheduledDeployments} scheduled` },
    { label: 'PSA Tickets', value: stats.psaTickets.toString(), icon: Ticket, trend: `${stats.psaIntegrations} integrations` },
    { 
      label: 'Connection', 
      value: isConnected ? 'Online' : 'Offline', 
      icon: isConnected ? CheckCircle2 : AlertCircle, 
      trend: isConnected ? 'Ready to export' : 'Setup required' 
    },
  ];

  const featureCards = [
    { 
      id: 'customers', 
      title: 'Customer Management', 
      description: 'Manage MSP customer organizations and organize tenants into groups.',
      icon: Building2,
      stats: `${stats.totalCustomers} customers, ${stats.totalTenants} tenants`,
      color: 'primary'
    },
    { 
      id: 'tenant-health', 
      title: 'Tenant Health', 
      description: 'Monitor tenant connection health, API status, and license usage.',
      icon: Activity,
      stats: `${stats.totalTenants} tenants monitored`,
      color: 'success'
    },
    { 
      id: 'resources', 
      title: 'Resource Explorer', 
      description: 'Browse and select M365 resources across 8 categories including Entra ID, Intune, and more.',
      icon: FolderTree,
      stats: `${RESOURCE_CATEGORIES.length} categories available`,
      color: 'primary'
    },
    { 
      id: 'export', 
      title: 'Export Configuration', 
      description: 'Export tenant settings to JSON, Terraform, Bicep, or PowerShell formats.',
      icon: Download,
      stats: `${stats.totalExports} exports, 4 formats`,
      color: 'primary'
    },
    { 
      id: 'import', 
      title: 'Import & Restore', 
      description: 'Restore configurations from previous exports or migrate between tenants.',
      icon: Upload,
      stats: `${stats.importJobs} imports completed`,
      color: 'primary'
    },
    { 
      id: 'policy-templates', 
      title: 'Policy Templates', 
      description: 'Create reusable policy templates for consistent deployments across tenants.',
      icon: Shield,
      stats: 'Baseline management',
      color: 'primary'
    },
    { 
      id: 'policy-deployment', 
      title: 'Policy Deployment', 
      description: 'Deploy policy templates to tenants with dry-run preview and rollback support.',
      icon: Rocket,
      stats: `${stats.policyDeployments} deployments`,
      color: 'primary'
    },
    { 
      id: 'scheduled-deployments', 
      title: 'Scheduled Deployments', 
      description: 'Automate policy deployments on a schedule with cron expressions.',
      icon: CalendarClock,
      stats: `${stats.scheduledDeployments} active schedules`,
      color: 'primary'
    },
    { 
      id: 'drift', 
      title: 'Drift Detection', 
      description: 'Compare current tenant state against baseline exports to detect configuration changes.',
      icon: GitCompare,
      stats: `${stats.driftDetections} detections run`,
      color: 'warning'
    },
    { 
      id: 'scheduled-drift', 
      title: 'Scheduled Drift', 
      description: 'Automate drift detection across tenants with scheduled checks.',
      icon: CalendarClock,
      stats: `${stats.scheduledDriftConfigs} active schedules`,
      color: 'warning'
    },
    { 
      id: 'compliance', 
      title: 'Compliance Checks', 
      description: 'Run compliance checks against industry baselines like CIS and Microsoft Security.',
      icon: AlertTriangle,
      stats: `${stats.complianceChecks} checks run`,
      color: 'destructive'
    },
    { 
      id: 'compliance-dashboard', 
      title: 'Compliance Dashboard', 
      description: 'Visualize compliance trends, scores, and breakdowns over time.',
      icon: BarChart3,
      stats: 'Analytics & trends',
      color: 'primary'
    },
    { 
      id: 'validation', 
      title: 'Validation', 
      description: 'Validate exported configurations against schema rules and best practices.',
      icon: ShieldCheck,
      stats: 'Schema validation',
      color: 'success'
    },
    { 
      id: 'psa-integrations', 
      title: 'PSA Integrations', 
      description: 'Connect to HaloPSA, Autotask, or ConnectWise for automated ticketing.',
      icon: Ticket,
      stats: `${stats.psaIntegrations} integrations, ${stats.psaTickets} tickets`,
      color: 'primary'
    },
    { 
      id: 'schedules', 
      title: 'Scheduled Exports', 
      description: 'Automate recurring exports with flexible scheduling options.',
      icon: Calendar,
      stats: `${stats.scheduledExports} active schedules`,
      color: 'primary'
    },
    { 
      id: 'webhooks', 
      title: 'Webhooks', 
      description: 'Configure webhook notifications for export events with retry and signature verification.',
      icon: Webhook,
      stats: `${stats.activeWebhooks} active webhooks`,
      color: 'primary'
    },
    { 
      id: 'reports', 
      title: 'Reports', 
      description: 'Generate and download PDF reports for compliance, drift, and tenant status.',
      icon: FileText,
      stats: `${stats.reportsGenerated} reports generated`,
      color: 'primary'
    },
    { 
      id: 'jobs', 
      title: 'Export Jobs', 
      description: 'Monitor export job history, download results, and track progress.',
      icon: History,
      stats: `${stats.totalExports} total jobs`,
      color: 'primary'
    },
    { 
      id: 'git', 
      title: 'Git & CI/CD', 
      description: 'Integrate with GitHub, Azure DevOps, or GitLab for version control and automation.',
      icon: GitBranch,
      stats: hasGitConfig ? 'Configured' : 'Not configured',
      color: 'primary'
    },
    { 
      id: 'audit', 
      title: 'Audit Trail', 
      description: 'Track all actions and changes with detailed audit logging.',
      icon: FileText,
      stats: 'Full activity log',
      color: 'primary'
    },
  ];

  const formatLastExport = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Customer/Tenant Filter Indicator */}
      {(selectedCustomerId || selectedTenantId) && (
        <Alert>
          <Filter className="h-4 w-4" />
          <AlertDescription>
            {selectedCustomer ? (
              <>
                Dashboard stats filtered for <strong>{selectedCustomer.name}</strong>.
                Clear the selection in the sidebar to see all data.
              </>
            ) : (
              <>Dashboard stats filtered. Clear the selection to see all data.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Microsoft 365 Tenant Export & Backup Tool
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button onClick={() => onNavigate('auth')} className="gap-2">
            <Zap className="w-4 h-4" />
            {isConnected ? 'Manage Connection' : 'Connect Tenant'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass-panel glow-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {loading ? '...' : stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Feature Cards - 3 columns */}
        <div className="lg:col-span-3">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Features</CardTitle>
                  <CardDescription>All available tools and capabilities</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.id}
                      className="group p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-all duration-200 border border-transparent hover:border-primary/20"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => onNavigate(feature.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {feature.title}
                            </p>
                            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {feature.description}
                          </p>
                          <p className="text-xs text-primary/80 mt-2">
                            {feature.stats}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Activity */}
        <div className="space-y-4">

          {/* Last Export */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Last Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {loading ? '...' : formatLastExport(stats.lastExportDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalExports > 0 ? `${stats.successfulExports} successful exports` : 'No exports yet'}
                  </p>
                </div>
              </div>
              {stats.totalExports > 0 && (
                <Button variant="outline" className="w-full mt-4" onClick={() => onNavigate('jobs')}>
                  View All Jobs
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Resource Categories Quick Stats */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Resource Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {RESOURCE_CATEGORIES.slice(0, 4).map((category) => {
                  const Icon = getIcon(category.icon);
                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => onNavigate('resources')}
                    >
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground flex-1">{category.name}</span>
                      <span className="text-xs text-muted-foreground">{category.subcategories.length}</span>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => onNavigate('resources')}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
