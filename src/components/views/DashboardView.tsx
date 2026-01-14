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
  FolderTree
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RESOURCE_CATEGORIES } from '@/types/tenant';
import { getIcon } from '@/lib/icons';
import { supabase } from '@/integrations/supabase/client';

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
}

export const DashboardView = ({ 
  onNavigate, 
  isConnected = false,
  selectedResourcesCount = 0,
  selectedFormatsCount = 0,
  hasGitConfig = false
}: DashboardViewProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalExports: 0,
    successfulExports: 0,
    scheduledExports: 0,
    activeWebhooks: 0,
    driftDetections: 0,
    complianceChecks: 0,
    lastExportDate: null,
    importJobs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [
        exportsResult,
        schedulesResult,
        webhooksResult,
        driftResult,
        complianceResult,
        importsResult
      ] = await Promise.all([
        supabase.from('export_jobs').select('id, status, completed_at').eq('user_id', user.id).order('completed_at', { ascending: false }),
        supabase.from('scheduled_exports').select('id, is_active').eq('user_id', user.id),
        supabase.from('webhook_configs').select('id, is_active').eq('user_id', user.id),
        supabase.from('drift_detections').select('id').eq('user_id', user.id),
        supabase.from('compliance_results').select('id').eq('user_id', user.id),
        supabase.from('import_jobs').select('id').eq('user_id', user.id)
      ]);

      const exports = exportsResult.data || [];
      const schedules = schedulesResult.data || [];
      const webhooks = webhooksResult.data || [];
      const drifts = driftResult.data || [];
      const compliance = complianceResult.data || [];
      const imports = importsResult.data || [];

      setStats({
        totalExports: exports.length,
        successfulExports: exports.filter(e => e.status === 'completed').length,
        scheduledExports: schedules.filter(s => s.is_active).length,
        activeWebhooks: webhooks.filter(w => w.is_active).length,
        driftDetections: drifts.length,
        complianceChecks: compliance.length,
        lastExportDate: exports[0]?.completed_at || null,
        importJobs: imports.length
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const step2Complete = selectedResourcesCount > 0;
  const step3Complete = selectedFormatsCount > 0;
  const step4Complete = hasGitConfig;

  const statCards = [
    { label: 'Total Exports', value: stats.totalExports.toString(), icon: Download, trend: `${stats.successfulExports} successful` },
    { label: 'Scheduled Jobs', value: stats.scheduledExports.toString(), icon: Calendar, trend: 'Active schedules' },
    { label: 'Active Webhooks', value: stats.activeWebhooks.toString(), icon: Webhook, trend: 'Configured endpoints' },
    { 
      label: 'Connection', 
      value: isConnected ? 'Online' : 'Offline', 
      icon: isConnected ? CheckCircle2 : AlertCircle, 
      trend: isConnected ? 'Ready to export' : 'Setup required' 
    },
  ];

  const featureCards = [
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
      stats: '4 export formats',
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
      id: 'drift', 
      title: 'Drift Detection', 
      description: 'Compare current tenant state against baseline exports to detect configuration changes.',
      icon: GitCompare,
      stats: `${stats.driftDetections} detections run`,
      color: 'warning'
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

        {/* Sidebar - Quick Start & Activity */}
        <div className="space-y-4">
          {/* Quick Start */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Start</CardTitle>
              <CardDescription>Get up and running</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('auth')}
                  className="w-full flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isConnected ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
                  }`}>
                    {isConnected ? '✓' : '1'}
                  </div>
                  <span className={isConnected ? 'text-success' : 'text-foreground'}>
                    Connect tenant
                  </span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => onNavigate('resources')}
                  className="w-full flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step2Complete ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {step2Complete ? '✓' : '2'}
                  </div>
                  <span className={step2Complete ? 'text-success' : 'text-foreground'}>
                    Select resources
                    {step2Complete && <span className="text-muted-foreground ml-1">({selectedResourcesCount})</span>}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => onNavigate('export')}
                  className="w-full flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step3Complete ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {step3Complete ? '✓' : '3'}
                  </div>
                  <span className={step3Complete ? 'text-success' : 'text-foreground'}>
                    Choose formats
                    {step3Complete && <span className="text-muted-foreground ml-1">({selectedFormatsCount})</span>}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
                <button
                  onClick={() => onNavigate('git')}
                  className="w-full flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step4Complete ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {step4Complete ? '✓' : '4'}
                  </div>
                  <span className={step4Complete ? 'text-success' : 'text-foreground'}>
                    Configure Git
                  </span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
              </div>
              <Button className="w-full mt-4" onClick={() => onNavigate(isConnected ? 'resources' : 'auth')}>
                {isConnected ? 'Start Export' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

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
