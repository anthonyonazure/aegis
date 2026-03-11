import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Activity,
  RefreshCw,
  Loader2,
  Cloud,
  Server,
  ArrowRight,
  Calendar,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  getHealthSummary,
  getRecentHealthChecks,
  getRecentPermissionChanges,
  getHealthTrend,
  PermissionHealthCheck,
  PermissionChange,
  HealthTrend,
} from '@/lib/permissionHealthDatabase';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Filter } from 'lucide-react';

export const PermissionHealthView = () => {
  const { selectedCustomerId, selectedTenantId, customers } = useTenant();
  const selectedCustomerName = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)?.name
    : null;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getHealthSummary>> | null>(null);
  const [recentChecks, setRecentChecks] = useState<PermissionHealthCheck[]>([]);
  const [recentChanges, setRecentChanges] = useState<PermissionChange[]>([]);
  const [trendData, setTrendData] = useState<HealthTrend[]>([]);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, checks, changes, trend] = await Promise.all([
        getHealthSummary(),
        getRecentHealthChecks(10),
        getRecentPermissionChanges(20),
        getHealthTrend(30),
      ]);
      setSummary(summaryData);
      setRecentChecks(checks);
      setRecentChanges(changes);
      setTrendData(trend);
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: 'Failed to load permission health data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const TrendIcon = summary?.trend === 'up' 
    ? TrendingUp 
    : summary?.trend === 'down' 
      ? TrendingDown 
      : Minus;

  const trendColor = summary?.trend === 'up' 
    ? 'text-success' 
    : summary?.trend === 'down' 
      ? 'text-destructive' 
      : 'text-muted-foreground';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permission Health</h1>
          <p className="text-muted-foreground mt-1">
            Monitor API permissions and track changes over time
          </p>
        </div>
        <Button onClick={loadData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Health Score */}
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Score</p>
                <p className={cn(
                  "text-3xl font-bold",
                  (summary?.currentSuccessRate || 0) >= 90 ? "text-success" :
                  (summary?.currentSuccessRate || 0) >= 50 ? "text-warning" : "text-destructive"
                )}>
                  {summary?.currentSuccessRate || 0}%
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                (summary?.currentSuccessRate || 0) >= 90 ? "bg-success/10" :
                (summary?.currentSuccessRate || 0) >= 50 ? "bg-warning/10" : "bg-destructive/10"
              )}>
                <Shield className={cn(
                  "w-6 h-6",
                  (summary?.currentSuccessRate || 0) >= 90 ? "text-success" :
                  (summary?.currentSuccessRate || 0) >= 50 ? "text-warning" : "text-destructive"
                )} />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <TrendIcon className={cn("w-4 h-4", trendColor)} />
              <span className={trendColor}>
                {summary?.trend === 'up' ? 'Improving' : 
                 summary?.trend === 'down' ? 'Declining' : 'Stable'}
              </span>
              <span className="text-muted-foreground">from {summary?.previousSuccessRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Tests This Week */}
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tests (7 days)</p>
                <p className="text-3xl font-bold text-foreground">
                  {summary?.checksLast7Days || 0}
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Permission validation runs
            </p>
          </CardContent>
        </Card>

        {/* Changes Detected */}
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Changes (7 days)</p>
                <p className={cn(
                  "text-3xl font-bold",
                  (summary?.changesLast7Days || 0) > 0 ? "text-warning" : "text-foreground"
                )}>
                  {summary?.changesLast7Days || 0}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                (summary?.changesLast7Days || 0) > 0 ? "bg-warning/10" : "bg-secondary"
              )}>
                <AlertTriangle className={cn(
                  "w-6 h-6",
                  (summary?.changesLast7Days || 0) > 0 ? "text-warning" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Permissions gained or lost
            </p>
          </CardContent>
        </Card>

        {/* Last Check */}
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Check</p>
                <p className="text-lg font-bold text-foreground">
                  {summary?.latestCheck 
                    ? formatDistanceToNow(new Date(summary.latestCheck.created_at), { addSuffix: true })
                    : 'Never'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            {summary?.latestCheck && (
              <p className="text-sm text-muted-foreground mt-2">
                {summary.latestCheck.passed_count}/{summary.latestCheck.total_resources} passed
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg">Health Trend (30 days)</CardTitle>
            <CardDescription>Success rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    formatter={(value: number) => [`${value}%`, 'Success Rate']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="hsl(var(--success))" 
                    fill="url(#successGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p>No data yet. Run a permission test to start tracking.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pass/Fail Breakdown */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg">Latest Results Breakdown</CardTitle>
            <CardDescription>By provider and status</CardDescription>
          </CardHeader>
          <CardContent>
            {summary?.latestCheck ? (
              <div className="space-y-4">
                {/* Graph API */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-purple-500" />
                      <span className="font-medium">Microsoft Graph</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {summary.latestCheck.graph_passed}/{summary.latestCheck.graph_passed + summary.latestCheck.graph_failed}
                    </span>
                  </div>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-secondary">
                    <div 
                      className="bg-success transition-all"
                      style={{ 
                        width: `${(summary.latestCheck.graph_passed / (summary.latestCheck.graph_passed + summary.latestCheck.graph_failed || 1)) * 100}%` 
                      }}
                    />
                    <div 
                      className="bg-destructive transition-all"
                      style={{ 
                        width: `${(summary.latestCheck.graph_failed / (summary.latestCheck.graph_passed + summary.latestCheck.graph_failed || 1)) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Azure */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">Azure ARM</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {summary.latestCheck.azure_passed}/{summary.latestCheck.azure_passed + summary.latestCheck.azure_failed}
                    </span>
                  </div>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-secondary">
                    <div 
                      className="bg-success transition-all"
                      style={{ 
                        width: `${(summary.latestCheck.azure_passed / (summary.latestCheck.azure_passed + summary.latestCheck.azure_failed || 1)) * 100}%` 
                      }}
                    />
                    <div 
                      className="bg-destructive transition-all"
                      style={{ 
                        width: `${(summary.latestCheck.azure_failed / (summary.latestCheck.azure_passed + summary.latestCheck.azure_failed || 1)) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Response Time */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Response Time</span>
                    <span className="font-mono text-sm">
                      {summary.latestCheck.avg_response_time_ms || 0}ms
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Zap className="w-8 h-8 mb-2 opacity-50" />
                <p>No tests run yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Checks */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg">Recent Tests</CardTitle>
            <CardDescription>Latest permission validation runs</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentChecks.length > 0 ? (
                <div className="space-y-3">
                  {recentChecks.map((check) => (
                    <div 
                      key={check.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        {check.failed_count === 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : check.passed_count === 0 ? (
                          <XCircle className="w-5 h-5 text-destructive" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-warning" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {check.passed_count}/{check.total_resources} passed
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(check.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {check.test_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {check.avg_response_time_ms}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p>No tests recorded yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Permission Changes Timeline */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg">Permission Changes</CardTitle>
            <CardDescription>Permissions gained, lost, or recovered</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentChanges.length > 0 ? (
                <div className="space-y-3">
                  {recentChanges.map((change) => (
                    <div 
                      key={change.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg",
                        change.change_type === 'lost' ? "bg-destructive/10" :
                        change.change_type === 'gained' ? "bg-success/10" : "bg-blue-500/10"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-full",
                        change.change_type === 'lost' ? "bg-destructive/20" :
                        change.change_type === 'gained' ? "bg-success/20" : "bg-blue-500/20"
                      )}>
                        {change.change_type === 'lost' ? (
                          <XCircle className="w-4 h-4 text-destructive" />
                        ) : change.change_type === 'gained' ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {change.resource_name}
                          </span>
                          {change.provider === 'azure' ? (
                            <Server className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Cloud className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <span className={cn(
                            change.change_type === 'lost' ? "text-destructive" :
                            change.change_type === 'gained' ? "text-success" : "text-blue-500"
                          )}>
                            {change.change_type === 'lost' ? 'Permission lost' :
                             change.change_type === 'gained' ? 'Permission gained' : 'Permission recovered'}
                          </span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="w-8 h-8 mb-2 opacity-50" />
                  <p>No permission changes detected</p>
                  <p className="text-xs mt-1">Changes appear after running multiple tests</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};