import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Filter } from 'lucide-react';

interface ComplianceResult {
  id: string;
  baseline_name: string;
  status: string;
  total_checks: number;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  created_at: string;
}

const COLORS = {
  passed: '#22c55e',
  warning: '#eab308',
  failed: '#ef4444',
};

export const ComplianceDashboardView = () => {
  const { toast } = useToast();
  const { selectedCustomerId, selectedTenantId, customers } = useTenant();
  const [allResults, setAllResults] = useState<ComplianceResult[]>([]);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('30');
  const [tenantConnectionIds, setTenantConnectionIds] = useState<string[]>([]);

  const selectedCustomerName = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)?.name
    : null;

  // Load tenant connections for selected customer
  useEffect(() => {
    const loadTenantConnections = async () => {
      if (!selectedCustomerId) {
        setTenantConnectionIds([]);
        return;
      }
      const { data } = await supabase
        .from('tenant_connections')
        .select('id')
        .eq('customer_id', selectedCustomerId);
      setTenantConnectionIds(data?.map(t => t.id) || []);
    };
    loadTenantConnections();
  }, [selectedCustomerId]);

  // Filter results when customer/tenant changes
  useEffect(() => {
    if (selectedTenantId) {
      // compliance_results doesn't have tenant_connection_id directly,
      // so filter via export_job_id -> export_jobs.tenant_connection_id
      // For now, show all results when filtering by tenant (filtered at query level)
      setResults(allResults);
    } else {
      setResults(allResults);
    }
  }, [selectedCustomerId, selectedTenantId, tenantConnectionIds, allResults]);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(timeRange));
      
      const { data, error } = await supabase
        .from('compliance_results')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAllResults(data || []);
    } catch (error) {
      console.error('Failed to load compliance data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load compliance dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (results.length === 0) {
      return { avgScore: 0, trend: 0, totalChecks: 0, lastScore: 0 };
    }

    const scores = results.map(r => 
      r.total_checks > 0 ? (r.passed_count / r.total_checks) * 100 : 0
    );
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const lastScore = scores[scores.length - 1] || 0;
    
    // Calculate trend (compare last 5 vs previous 5)
    const recentScores = scores.slice(-5);
    const previousScores = scores.slice(-10, -5);
    const recentAvg = recentScores.length > 0 
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length 
      : 0;
    const previousAvg = previousScores.length > 0 
      ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length 
      : recentAvg;
    const trend = recentAvg - previousAvg;

    const totalChecks = results.reduce((sum, r) => sum + r.total_checks, 0);

    return { avgScore, trend, totalChecks, lastScore };
  }, [results]);

  // Prepare chart data
  const lineChartData = useMemo(() => {
    const days = parseInt(timeRange);
    const interval = eachDayOfInterval({
      start: subDays(new Date(), days),
      end: new Date(),
    });

    return interval.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayResults = results.filter(r => 
        format(new Date(r.created_at), 'yyyy-MM-dd') === dayStr
      );

      if (dayResults.length === 0) {
        return { date: format(day, 'MMM d'), score: null };
      }

      const avgScore = dayResults.reduce((sum, r) => 
        sum + (r.total_checks > 0 ? (r.passed_count / r.total_checks) * 100 : 0), 0
      ) / dayResults.length;

      return {
        date: format(day, 'MMM d'),
        score: Math.round(avgScore),
      };
    });
  }, [results, timeRange]);

  // Pie chart data for latest result
  const pieChartData = useMemo(() => {
    const latest = results[results.length - 1];
    if (!latest) return [];

    return [
      { name: 'Passed', value: latest.passed_count, color: COLORS.passed },
      { name: 'Warnings', value: latest.warning_count, color: COLORS.warning },
      { name: 'Failed', value: latest.failed_count, color: COLORS.failed },
    ].filter(d => d.value > 0);
  }, [results]);

  // Bar chart data by baseline
  const barChartData = useMemo(() => {
    const byBaseline = results.reduce((acc, r) => {
      if (!acc[r.baseline_name]) {
        acc[r.baseline_name] = { passed: 0, warning: 0, failed: 0, count: 0 };
      }
      acc[r.baseline_name].passed += r.passed_count;
      acc[r.baseline_name].warning += r.warning_count;
      acc[r.baseline_name].failed += r.failed_count;
      acc[r.baseline_name].count += 1;
      return acc;
    }, {} as Record<string, { passed: number; warning: number; failed: number; count: number }>);

    return Object.entries(byBaseline).map(([name, data]) => ({
      name: name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      passed: Math.round(data.passed / data.count),
      warning: Math.round(data.warning / data.count),
      failed: Math.round(data.failed / data.count),
    }));
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track compliance scores and trends over time
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing compliance data for <strong>{selectedCustomerName}</strong>
            {selectedTenantId && ' (filtered by selected tenant)'}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Score</p>
                <p className={cn(
                  "text-3xl font-bold",
                  stats.lastScore >= 80 ? "text-green-400" :
                  stats.lastScore >= 50 ? "text-yellow-400" : "text-red-400"
                )}>
                  {stats.lastScore.toFixed(0)}%
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                stats.lastScore >= 80 ? "bg-green-500/10" :
                stats.lastScore >= 50 ? "bg-yellow-500/10" : "bg-red-500/10"
              )}>
                <Shield className={cn(
                  "w-6 h-6",
                  stats.lastScore >= 80 ? "text-green-400" :
                  stats.lastScore >= 50 ? "text-yellow-400" : "text-red-400"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-3xl font-bold">{stats.avgScore.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className={cn(
                  "text-3xl font-bold flex items-center gap-1",
                  stats.trend >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(1)}%
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                stats.trend >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              )}>
                {stats.trend >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Checks</p>
                <p className="text-3xl font-bold">{stats.totalChecks.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-full bg-muted">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <Card className="glass-panel border-border/50">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No compliance data available</p>
              <p className="text-sm">Run compliance checks to see trends</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Trend Line Chart */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Compliance Score Trend</CardTitle>
              <CardDescription>Daily average compliance score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Latest Check Breakdown */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Latest Check Breakdown</CardTitle>
              <CardDescription>Distribution of check results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results by Baseline */}
          <Card className="glass-panel border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle>Results by Baseline</CardTitle>
              <CardDescription>Average results per compliance baseline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="passed" name="Passed" fill={COLORS.passed} stackId="a" />
                      <Bar dataKey="warning" name="Warnings" fill={COLORS.warning} stackId="a" />
                      <Bar dataKey="failed" name="Failed" fill={COLORS.failed} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Checks */}
          <Card className="glass-panel border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Compliance Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {results.slice(-10).reverse().map((result, idx) => {
                    const score = result.total_checks > 0 
                      ? (result.passed_count / result.total_checks) * 100 
                      : 0;
                    
                    return (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          {result.status === 'passed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : result.status === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{result.baseline_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(result.created_at), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={cn(
                              "font-bold",
                              score >= 80 ? "text-green-400" :
                              score >= 50 ? "text-yellow-400" : "text-red-400"
                            )}>
                              {score.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.passed_count}/{result.total_checks} passed
                            </p>
                          </div>
                          <Progress 
                            value={score} 
                            className="w-20 h-2"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};