import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  RefreshCw,
  Building2,
  Filter,
  Search,
  ArrowUpDown,
  Zap,
  TrendingUp,
  Server,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import {
  getTenantHealthSummaries,
  getHealthStats,
  getRecentHealthActivity,
  subscribeToTenantHealth,
  TenantHealthSummary,
  TenantHealthCheck,
} from '@/lib/healthDatabase';
import { checkTenantHealth, checkBulkTenantHealth, formatHealthDetails } from '@/lib/healthApi';
import { TenantHealthStatus } from '@/types/tenant';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';

const HEALTH_COLORS: Record<TenantHealthStatus, string> = {
  healthy: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  critical: 'hsl(var(--destructive))',
  unknown: 'hsl(var(--muted-foreground))',
};

const HEALTH_ICONS: Record<TenantHealthStatus, React.ElementType> = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertCircle,
  unknown: HelpCircle,
};

export function TenantHealthDashboardView() {
  const { selectedCustomerId, customers: tenantCustomers } = useTenant();
  const [allTenants, setAllTenants] = useState<TenantHealthSummary[]>([]);
  const [tenants, setTenants] = useState<TenantHealthSummary[]>([]);
  const [stats, setStats] = useState({ healthy: 0, warning: 0, critical: 0, unknown: 0, total: 0 });
  const [recentActivity, setRecentActivity] = useState<(TenantHealthCheck & { tenantName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'lastCheck'>('status');

  const selectedCustomerName = tenantCustomers.find(c => c.id === selectedCustomerId)?.name;

  const loadData = useCallback(async () => {
    try {
      const [summaries, healthStats, activity] = await Promise.all([
        getTenantHealthSummaries(),
        getHealthStats(),
        getRecentHealthActivity(20),
      ]);
      setAllTenants(summaries);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error loading health data:', error);
      toast.error('Failed to load health data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter tenants when customer selection changes
  useEffect(() => {
    if (selectedCustomerId) {
      const filtered = allTenants.filter(t => t.customerId === selectedCustomerId);
      setTenants(filtered);
      
      // Recalculate stats for filtered tenants
      setStats({
        healthy: filtered.filter(t => t.healthStatus === 'healthy').length,
        warning: filtered.filter(t => t.healthStatus === 'warning').length,
        critical: filtered.filter(t => t.healthStatus === 'critical').length,
        unknown: filtered.filter(t => t.healthStatus === 'unknown').length,
        total: filtered.length,
      });
    } else {
      setTenants(allTenants);
      // Recalculate stats for all tenants
      setStats({
        healthy: allTenants.filter(t => t.healthStatus === 'healthy').length,
        warning: allTenants.filter(t => t.healthStatus === 'warning').length,
        critical: allTenants.filter(t => t.healthStatus === 'critical').length,
        unknown: allTenants.filter(t => t.healthStatus === 'unknown').length,
        total: allTenants.length,
      });
    }
  }, [selectedCustomerId, allTenants]);

  useEffect(() => {
    loadData();
    
    // Subscribe to real-time health changes
    const unsubscribe = subscribeToTenantHealth(() => {
      // Reload data when changes occur
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Health data refreshed');
  };

  const [checkingTenant, setCheckingTenant] = useState<string | null>(null);

  const handleHealthCheck = async (tenant: TenantHealthSummary) => {
    setCheckingTenant(tenant.tenantConnectionId);
    try {
      const response = await checkTenantHealth(tenant.tenantConnectionId);
      
      if (response.success && response.result) {
        const { healthStatus, details, responseTimeMs } = response.result;
        
        // Show detailed toast based on result
        if (healthStatus === 'healthy') {
          toast.success(`${tenant.displayName || tenant.tenantName} is healthy`, {
            description: `Response time: ${responseTimeMs}ms`,
          });
        } else if (healthStatus === 'warning') {
          toast.warning(`${tenant.displayName || tenant.tenantName} has warnings`, {
            description: details.errorMessage || 'Some permissions may be limited',
          });
        } else if (healthStatus === 'critical') {
          toast.error(`${tenant.displayName || tenant.tenantName} is unreachable`, {
            description: details.errorMessage || 'Check credentials and permissions',
          });
        } else {
          toast.info(`${tenant.displayName || tenant.tenantName} status unknown`, {
            description: details.errorMessage || 'No credentials stored',
          });
        }
        
        await loadData();
      } else {
        toast.error(`Health check failed for ${tenant.displayName || tenant.tenantName}`, {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast.error('Health check failed');
    } finally {
      setCheckingTenant(null);
    }
  };

  const handleBulkHealthCheck = async () => {
    if (tenants.length === 0) {
      toast.info('No tenants to check');
      return;
    }

    setRefreshing(true);
    try {
      const tenantIds = tenants.map(t => t.tenantConnectionId);
      const response = await checkBulkTenantHealth(tenantIds);
      
      if (response.success && response.results) {
        const healthy = response.results.filter(r => r.healthStatus === 'healthy').length;
        const warning = response.results.filter(r => r.healthStatus === 'warning').length;
        const critical = response.results.filter(r => r.healthStatus === 'critical').length;
        
        toast.success(`Bulk health check completed`, {
          description: `${healthy} healthy, ${warning} warnings, ${critical} critical out of ${response.checked} checked`,
        });
        
        await loadData();
      } else {
        toast.error('Bulk health check failed', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Bulk health check failed:', error);
      toast.error('Bulk health check failed');
    } finally {
      setRefreshing(false);
    }
  };

  // Get unique customers for filter
  const customers = [...new Set(tenants.map(t => t.customerName).filter(Boolean))];

  // Filter and sort tenants
  const filteredTenants = tenants
    .filter(t => {
      if (filterStatus !== 'all' && t.healthStatus !== filterStatus) return false;
      if (filterCustomer !== 'all' && t.customerName !== filterCustomer) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          t.tenantName.toLowerCase().includes(query) ||
          t.displayName?.toLowerCase().includes(query) ||
          t.customerName?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.displayName || a.tenantName).localeCompare(b.displayName || b.tenantName);
      }
      if (sortBy === 'status') {
        const order = { critical: 0, warning: 1, unknown: 2, healthy: 3 };
        return order[a.healthStatus] - order[b.healthStatus];
      }
      if (sortBy === 'lastCheck') {
        const aTime = a.lastHealthCheck?.getTime() || 0;
        const bTime = b.lastHealthCheck?.getTime() || 0;
        return bTime - aTime;
      }
      return 0;
    });

  // Prepare chart data
  const pieData = [
    { name: 'Healthy', value: stats.healthy, fill: HEALTH_COLORS.healthy },
    { name: 'Warning', value: stats.warning, fill: HEALTH_COLORS.warning },
    { name: 'Critical', value: stats.critical, fill: HEALTH_COLORS.critical },
    { name: 'Unknown', value: stats.unknown, fill: HEALTH_COLORS.unknown },
  ].filter(d => d.value > 0);

  const barData = customers.slice(0, 10).map(customer => {
    const customerTenants = tenants.filter(t => t.customerName === customer);
    return {
      name: customer || 'Unassigned',
      healthy: customerTenants.filter(t => t.healthStatus === 'healthy').length,
      warning: customerTenants.filter(t => t.healthStatus === 'warning').length,
      critical: customerTenants.filter(t => t.healthStatus === 'critical').length,
    };
  });

  const healthPercentage = stats.total > 0 
    ? Math.round((stats.healthy / stats.total) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Tenant Health Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time status monitoring across all customer tenants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={handleBulkHealthCheck} disabled={refreshing || tenants.length === 0}>
            <Zap className="w-4 h-4 mr-2" />
            Check All
          </Button>
        </div>
      </div>

      {/* Global Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing health data for customer: <strong>{selectedCustomerName || 'Selected Customer'}</strong>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Server className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-panel border-success/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                  <p className="text-3xl font-bold text-success">{stats.healthy}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-panel border-warning/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warning</p>
                  <p className="text-3xl font-bold text-warning">{stats.warning}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-panel border-destructive/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-3xl font-bold text-destructive">{stats.critical}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                  <p className="text-3xl font-bold text-foreground">{healthPercentage}%</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
              <Progress value={healthPercentage} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">All Tenants</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Distribution Pie Chart */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg">Health Distribution</CardTitle>
                <CardDescription>Current status breakdown across all tenants</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No tenant data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health by Customer Bar Chart */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg">Health by Customer</CardTitle>
                <CardDescription>Tenant health status grouped by customer</CardDescription>
              </CardHeader>
              <CardContent>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData} layout="vertical">
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="healthy" stackId="a" fill={HEALTH_COLORS.healthy} name="Healthy" />
                      <Bar dataKey="warning" stackId="a" fill={HEALTH_COLORS.warning} name="Warning" />
                      <Bar dataKey="critical" stackId="a" fill={HEALTH_COLORS.critical} name="Critical" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No customer data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Critical/Warning Tenants */}
          {(stats.critical > 0 || stats.warning > 0) && (
            <Card className="glass-panel border-destructive/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Attention Required
                </CardTitle>
                <CardDescription>Tenants requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {filteredTenants
                    .filter(t => t.healthStatus === 'critical' || t.healthStatus === 'warning')
                    .slice(0, 5)
                    .map(tenant => {
                      const StatusIcon = HEALTH_ICONS[tenant.healthStatus];
                      return (
                        <div
                          key={tenant.tenantConnectionId}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            tenant.healthStatus === 'critical' 
                              ? "bg-destructive/5 border-destructive/30" 
                              : "bg-warning/5 border-warning/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <StatusIcon className={cn(
                              "w-5 h-5",
                              tenant.healthStatus === 'critical' ? "text-destructive" : "text-warning"
                            )} />
                            <div>
                              <p className="font-medium text-foreground">
                                {tenant.displayName || tenant.tenantName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tenant.customerName || 'No customer assigned'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHealthCheck(tenant)}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Recheck
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          {/* Filters */}
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tenants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger className="w-[180px]">
                    <Building2 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map(customer => (
                      <SelectItem key={customer} value={customer || 'unassigned'}>
                        {customer || 'Unassigned'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[150px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">By Status</SelectItem>
                    <SelectItem value="name">By Name</SelectItem>
                    <SelectItem value="lastCheck">By Last Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tenant List */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">
                Tenant Status ({filteredTenants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredTenants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Server className="w-12 h-12 mb-4 opacity-50" />
                      <p>No tenants found</p>
                      <p className="text-sm">Connect tenants to see health status</p>
                    </div>
                  ) : (
                    filteredTenants.map(tenant => {
                      const StatusIcon = HEALTH_ICONS[tenant.healthStatus];
                      return (
                        <motion.div
                          key={tenant.tenantConnectionId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "p-2 rounded-lg",
                              tenant.healthStatus === 'healthy' && "bg-success/10",
                              tenant.healthStatus === 'warning' && "bg-warning/10",
                              tenant.healthStatus === 'critical' && "bg-destructive/10",
                              tenant.healthStatus === 'unknown' && "bg-muted/10"
                            )}>
                              <StatusIcon className={cn(
                                "w-5 h-5",
                                tenant.healthStatus === 'healthy' && "text-success",
                                tenant.healthStatus === 'warning' && "text-warning",
                                tenant.healthStatus === 'critical' && "text-destructive",
                                tenant.healthStatus === 'unknown' && "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {tenant.displayName || tenant.tenantName}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {tenant.customerName && (
                                  <>
                                    <Building2 className="w-3 h-3" />
                                    <span>{tenant.customerName}</span>
                                    {tenant.tenantGroupName && (
                                      <span>/ {tenant.tenantGroupName}</span>
                                    )}
                                  </>
                                )}
                                {tenant.environment && (
                                  <Badge variant="outline" className="text-xs">
                                    {tenant.environment}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <Badge variant={
                                tenant.healthStatus === 'healthy' ? 'default' :
                                tenant.healthStatus === 'warning' ? 'secondary' :
                                tenant.healthStatus === 'critical' ? 'destructive' : 'outline'
                              }>
                                {tenant.healthStatus}
                              </Badge>
                              {tenant.lastHealthCheck && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {formatRelativeTime(tenant.lastHealthCheck)}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleHealthCheck(tenant)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Health Activity
              </CardTitle>
              <CardDescription>Latest health check events across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {recentActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="w-12 h-12 mb-4 opacity-50" />
                      <p>No activity yet</p>
                      <p className="text-sm">Run health checks to see activity</p>
                    </div>
                  ) : (
                    recentActivity.map(activity => {
                      const StatusIcon = HEALTH_ICONS[activity.healthStatus];
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-secondary/20"
                        >
                          <StatusIcon className={cn(
                            "w-4 h-4",
                            activity.healthStatus === 'healthy' && "text-success",
                            activity.healthStatus === 'warning' && "text-warning",
                            activity.healthStatus === 'critical' && "text-destructive",
                            activity.healthStatus === 'unknown' && "text-muted-foreground"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {activity.tenantName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.checkType} check • {activity.responseTimeMs}ms
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {activity.healthStatus}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeTime(activity.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
