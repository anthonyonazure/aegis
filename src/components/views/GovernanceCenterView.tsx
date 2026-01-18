import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Users,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Activity,
  XCircle,
  Zap,
  ExternalLink,
  ChevronRight,
  Lock,
  Key,
  UserCheck,
  ShieldAlert,
  FileCheck,
  Gauge,
  Target,
  BarChart3,
  PieChart,
  AlertCircle,
  Lightbulb,
  Wrench
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface GovernanceStats {
  totalTenants: number;
  healthyTenants: number;
  avgComplianceScore: number;
  avgSecureScore: number;
  licenseUtilization: number;
  activeAlerts: number;
  pendingActions: number;
  totalUsers: number;
  adminUsers: number;
  guestUsers: number;
  mfaEnabled: number;
  riskyUsers: number;
  totalLicenses: number;
  assignedLicenses: number;
  unusedLicenses: number;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'security' | 'compliance' | 'identity' | 'licensing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actionType: 'policy' | 'config' | 'review' | 'remediate';
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const CATEGORY_ICONS = {
  security: Shield,
  compliance: FileCheck,
  identity: Users,
  licensing: CreditCard,
};

// Mock action items - in production these would come from analysis
const MOCK_ACTIONS: ActionItem[] = [
  {
    id: '1',
    title: 'Enable MFA for all admin accounts',
    description: '3 admin accounts do not have MFA enabled, exposing privileged access to potential compromise.',
    category: 'security',
    severity: 'critical',
    impact: 'Prevents 99.9% of account compromise attacks',
    effort: 'low',
    actionType: 'policy',
  },
  {
    id: '2',
    title: 'Review Conditional Access policies',
    description: '2 tenants have no Conditional Access policies configured.',
    category: 'security',
    severity: 'high',
    impact: 'Enforces security controls based on user, device, and location',
    effort: 'medium',
    actionType: 'config',
  },
  {
    id: '3',
    title: 'Remove stale guest accounts',
    description: '47 guest users have not signed in for over 90 days.',
    category: 'identity',
    severity: 'medium',
    impact: 'Reduces attack surface and maintains clean directory',
    effort: 'low',
    actionType: 'remediate',
  },
  {
    id: '4',
    title: 'Optimize license assignments',
    description: '23 E5 licenses assigned to users who only use basic features.',
    category: 'licensing',
    severity: 'low',
    impact: 'Potential savings of $3,450/month',
    effort: 'medium',
    actionType: 'review',
  },
  {
    id: '5',
    title: 'Address compliance gaps for ISO 27001',
    description: '5 controls are not met in the latest compliance scan.',
    category: 'compliance',
    severity: 'high',
    impact: 'Required for ISO 27001 certification',
    effort: 'high',
    actionType: 'remediate',
  },
  {
    id: '6',
    title: 'Block legacy authentication',
    description: 'Legacy authentication protocols are still allowed in 4 tenants.',
    category: 'security',
    severity: 'high',
    impact: 'Legacy auth bypasses MFA and is a common attack vector',
    effort: 'low',
    actionType: 'policy',
  },
  {
    id: '7',
    title: 'Review privileged role holders',
    description: '12 users have Global Administrator role - consider using PIM.',
    category: 'identity',
    severity: 'medium',
    impact: 'Reduces standing privilege and improves security posture',
    effort: 'medium',
    actionType: 'review',
  },
  {
    id: '8',
    title: 'Reclaim unused licenses',
    description: '34 licenses assigned to inactive users (no sign-in 60+ days).',
    category: 'licensing',
    severity: 'medium',
    impact: 'Potential savings of $1,870/month',
    effort: 'low',
    actionType: 'remediate',
  },
];

const CHART_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

export function GovernanceCenterView() {
  const { toast } = useToast();
  const { selectedCustomerId, customers } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GovernanceStats>({
    totalTenants: 0,
    healthyTenants: 0,
    avgComplianceScore: 0,
    avgSecureScore: 0,
    licenseUtilization: 0,
    activeAlerts: 0,
    pendingActions: 0,
    totalUsers: 0,
    adminUsers: 0,
    guestUsers: 0,
    mfaEnabled: 0,
    riskyUsers: 0,
    totalLicenses: 0,
    assignedLicenses: 0,
    unusedLicenses: 0,
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadGovernanceData();
  }, [selectedCustomerId]);

  const loadGovernanceData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load tenant connections
      let tenantQuery = supabase
        .from('tenant_connections')
        .select('*')
        .eq('user_id', user.id);
      
      if (selectedCustomerId) {
        tenantQuery = tenantQuery.eq('customer_id', selectedCustomerId);
      }
      
      const { data: tenants } = await tenantQuery;

      // Load compliance results for scores
      const { data: complianceData } = await supabase
        .from('compliance_results')
        .select('passed_count, total_checks')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Load billing usage for license info
      const { data: billingData } = await supabase
        .from('billing_usage')
        .select('total_users, total_resources')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false })
        .limit(1);

      // Calculate stats
      const totalTenants = tenants?.length || 0;
      const healthyTenants = tenants?.filter(t => t.health_status === 'healthy').length || 0;
      
      // Calculate compliance score from results
      const avgComplianceScore = complianceData?.length 
        ? Math.round(complianceData.reduce((sum, c) => {
            const score = c.total_checks && c.total_checks > 0 
              ? (c.passed_count / c.total_checks) * 100 
              : 0;
            return sum + score;
          }, 0) / complianceData.length)
        : 75; // Default demo value
      
      // Mock secure score for demo
      const avgSecureScore = 68; // Demo value

      // Mock some data for demo purposes
      const totalUsers = billingData?.[0]?.total_users || Math.floor(Math.random() * 500) + 100;
      const totalLicenses = Math.floor(totalUsers * 1.2);
      const assignedLicenses = totalUsers;
      
      setStats({
        totalTenants,
        healthyTenants,
        avgComplianceScore,
        avgSecureScore,
        licenseUtilization: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0,
        activeAlerts: Math.floor(Math.random() * 10) + 2,
        pendingActions: MOCK_ACTIONS.length,
        totalUsers,
        adminUsers: Math.floor(totalUsers * 0.05),
        guestUsers: Math.floor(totalUsers * 0.15),
        mfaEnabled: Math.floor(totalUsers * 0.85),
        riskyUsers: Math.floor(Math.random() * 5),
        totalLicenses,
        assignedLicenses,
        unusedLicenses: totalLicenses - assignedLicenses,
      });
    } catch (error) {
      console.error('Failed to load governance data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load governance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const actionsByCategory = useMemo(() => {
    return {
      security: MOCK_ACTIONS.filter(a => a.category === 'security'),
      compliance: MOCK_ACTIONS.filter(a => a.category === 'compliance'),
      identity: MOCK_ACTIONS.filter(a => a.category === 'identity'),
      licensing: MOCK_ACTIONS.filter(a => a.category === 'licensing'),
    };
  }, []);

  const criticalActions = useMemo(() => {
    return MOCK_ACTIONS.filter(a => a.severity === 'critical' || a.severity === 'high');
  }, []);

  const complianceChartData = [
    { name: 'Passed', value: stats.avgComplianceScore, fill: '#22c55e' },
    { name: 'Failed', value: 100 - stats.avgComplianceScore, fill: '#ef4444' },
  ];

  const identityChartData = [
    { name: 'MFA Enabled', value: stats.mfaEnabled, fill: '#22c55e' },
    { name: 'MFA Disabled', value: stats.totalUsers - stats.mfaEnabled, fill: '#f59e0b' },
    { name: 'Risky', value: stats.riskyUsers, fill: '#ef4444' },
  ];

  const licensingChartData = [
    { name: 'Assigned', value: stats.assignedLicenses, fill: '#3b82f6' },
    { name: 'Unused', value: stats.unusedLicenses, fill: '#6b7280' },
  ];

  const handleActionClick = (action: ActionItem) => {
    toast({
      title: 'Action Initiated',
      description: `Starting remediation for: ${action.title}`,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Governance Center</h1>
          <p className="text-muted-foreground">
            Unified view of compliance, security, identity, and licensing across your tenants
          </p>
        </div>
        <Button variant="outline" onClick={loadGovernanceData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTenants}</p>
                  <p className="text-xs text-muted-foreground">Managed Tenants</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {stats.healthyTenants} healthy
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getScoreBg(stats.avgComplianceScore)}`}>
                  <FileCheck className={`w-5 h-5 ${getScoreColor(stats.avgComplianceScore)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(stats.avgComplianceScore)}`}>
                    {stats.avgComplianceScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Compliance</p>
                </div>
              </div>
              <Progress value={stats.avgComplianceScore} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getScoreBg(stats.avgSecureScore)}`}>
                  <Shield className={`w-5 h-5 ${getScoreColor(stats.avgSecureScore)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(stats.avgSecureScore)}`}>
                    {stats.avgSecureScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Secure Score</p>
                </div>
              </div>
              <Progress value={stats.avgSecureScore} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.licenseUtilization}%</p>
                  <p className="text-xs text-muted-foreground">License Utilization</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.unusedLicenses} unused licenses
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-orange-500/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{stats.pendingActions}</p>
                  <p className="text-xs text-muted-foreground">Pending Actions</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {criticalActions.length} critical/high
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Priority Actions Alert */}
      {criticalActions.length > 0 && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/5">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Priority Actions Required</AlertTitle>
          <AlertDescription>
            {criticalActions.length} critical or high priority actions need your attention. 
            Review the Actions tab to remediate security and compliance risks.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <Gauge className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <FileCheck className="w-4 h-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="identity" className="gap-2">
            <Users className="w-4 h-4" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="licensing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Licensing
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Governance Overview
                </CardTitle>
                <CardDescription>Key metrics across all governance areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.totalUsers}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.adminUsers}</p>
                    <p className="text-sm text-muted-foreground">Admins</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.guestUsers}</p>
                    <p className="text-sm text-muted-foreground">Guests</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.totalLicenses}</p>
                    <p className="text-sm text-muted-foreground">Licenses</p>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Compliance Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">Compliance Score</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={complianceChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {complianceChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className={`text-2xl font-bold ${getScoreColor(stats.avgComplianceScore)}`}>
                      {stats.avgComplianceScore}%
                    </p>
                  </div>

                  {/* Identity Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">MFA Coverage</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={identityChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {identityChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-2xl font-bold text-green-500">
                      {stats.totalUsers > 0 ? Math.round((stats.mfaEnabled / stats.totalUsers) * 100) : 0}%
                    </p>
                  </div>

                  {/* License Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">License Usage</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={licensingChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {licensingChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-2xl font-bold text-blue-500">
                      {stats.licenseUtilization}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Priority Actions
                </CardTitle>
                <CardDescription>Top items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {criticalActions.slice(0, 5).map((action) => {
                      const Icon = CATEGORY_ICONS[action.category];
                      return (
                        <div
                          key={action.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleActionClick(action)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${SEVERITY_COLORS[action.severity]}`}>
                              <Icon className="w-3 h-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{action.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {action.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {action.effort} effort
                                </Badge>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Compliance Status by Framework</CardTitle>
                <CardDescription>Compliance scores across different regulatory frameworks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'CIS Microsoft 365', score: 78 },
                    { name: 'ISO 27001', score: 65 },
                    { name: 'SOC 2 Type II', score: 82 },
                    { name: 'GDPR', score: 71 },
                    { name: 'HIPAA', score: 58 },
                  ].map((framework) => (
                    <div key={framework.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{framework.name}</span>
                        <span className={`text-sm font-bold ${getScoreColor(framework.score)}`}>
                          {framework.score}%
                        </span>
                      </div>
                      <Progress value={framework.score} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Compliance Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {actionsByCategory.compliance.map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Wrench className="w-3 h-3 mr-1" />
                          Remediate
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(stats.avgSecureScore)}`}>
                    {stats.avgSecureScore}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Average Secure Score</p>
                  <Progress value={stats.avgSecureScore} className="mt-4" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">MFA Coverage</span>
                    <Badge variant={stats.mfaEnabled / stats.totalUsers > 0.9 ? 'default' : 'destructive'}>
                      {Math.round((stats.mfaEnabled / stats.totalUsers) * 100)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Risky Users</span>
                    <Badge variant={stats.riskyUsers === 0 ? 'default' : 'destructive'}>
                      {stats.riskyUsers}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Admin Accounts</span>
                    <Badge variant="outline">{stats.adminUsers}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Alerts</span>
                    <Badge variant={stats.activeAlerts === 0 ? 'default' : 'secondary'}>
                      {stats.activeAlerts}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Security Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {actionsByCategory.security.map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Zap className="w-3 h-3 mr-1" />
                          Fix Now
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Identity Tab */}
        <TabsContent value="identity" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Regular Users', value: stats.totalUsers - stats.adminUsers - stats.guestUsers, fill: '#3b82f6' },
                          { name: 'Admins', value: stats.adminUsers, fill: '#ef4444' },
                          { name: 'Guests', value: stats.guestUsers, fill: '#6b7280' },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Identity Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Total Users</span>
                    </div>
                    <span className="font-bold">{stats.totalUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-red-500" />
                      <span className="text-sm">Privileged Users</span>
                    </div>
                    <span className="font-bold">{stats.adminUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">MFA Enabled</span>
                    </div>
                    <span className="font-bold">{stats.mfaEnabled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">Stale Accounts (est.)</span>
                    </div>
                    <span className="font-bold">{Math.floor(stats.totalUsers * 0.08)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Identity Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {actionsByCategory.identity.map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Wrench className="w-3 h-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Licensing Tab */}
        <TabsContent value="licensing" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>License Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-blue-500">{stats.licenseUtilization}%</div>
                  <p className="text-sm text-muted-foreground">Utilization Rate</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Licenses</span>
                    <span className="font-bold">{stats.totalLicenses}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Assigned</span>
                    <span className="font-bold text-green-500">{stats.assignedLicenses}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unused</span>
                    <span className="font-bold text-muted-foreground">{stats.unusedLicenses}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Optimization</CardTitle>
                <CardDescription>Potential savings opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-500">Potential Monthly Savings</span>
                    </div>
                    <p className="text-3xl font-bold text-green-500">$5,320</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on license optimization recommendations
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <ul className="space-y-1">
                      <li>• {stats.unusedLicenses} unused licenses to reclaim</li>
                      <li>• 23 users eligible for downgrade</li>
                      <li>• 5 duplicate assignments detected</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Licensing Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {actionsByCategory.licensing.map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                        <p className="text-xs text-green-500 mt-1">{action.impact}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Target className="w-3 h-3 mr-1" />
                          Optimize
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
