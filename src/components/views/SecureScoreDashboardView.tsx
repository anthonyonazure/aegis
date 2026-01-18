import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Shield, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Building2,
  Target,
  Lightbulb,
  BarChart3,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import {
  TenantSecureScore,
  ScoreHistory,
  AggregatedScoreStats,
  getSecureScores,
  getScoreHistory,
  refreshSecureScores,
  calculateAggregatedStats,
} from '@/lib/secureScoreApi';

const SCORE_COLORS = {
  high: 'hsl(var(--chart-2))',
  medium: 'hsl(var(--chart-4))',
  low: 'hsl(var(--chart-1))',
};

const PIE_COLORS = [
  'hsl(var(--chart-2))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-1))',
];

function getScoreColor(percentage: number): string {
  if (percentage >= 80) return SCORE_COLORS.high;
  if (percentage >= 50) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

function getScoreBadgeVariant(percentage: number): 'default' | 'secondary' | 'destructive' {
  if (percentage >= 80) return 'default';
  if (percentage >= 50) return 'secondary';
  return 'destructive';
}

function ScoreGauge({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const color = getScoreColor(percentage);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function SecureScoreDashboardView() {
  const { selectedCustomerId, customers } = useTenant();
  const [allScores, setAllScores] = useState<TenantSecureScore[]>([]);
  const [scores, setScores] = useState<TenantSecureScore[]>([]);
  const [allHistory, setAllHistory] = useState<ScoreHistory[]>([]);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [stats, setStats] = useState<AggregatedScoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantConnectionIds, setTenantConnectionIds] = useState<string[]>([]);

  const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name;

  // Load tenant connection IDs for the selected customer
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
      
      setTenantConnectionIds((data || []).map(t => t.id));
    };
    
    loadTenantConnections();
  }, [selectedCustomerId]);

  // Filter scores and history when customer selection changes
  useEffect(() => {
    if (selectedCustomerId && tenantConnectionIds.length > 0) {
      const filteredScores = allScores.filter(s => 
        tenantConnectionIds.includes(s.tenantConnectionId)
      );
      setScores(filteredScores);
      setStats(calculateAggregatedStats(filteredScores));
      
      setHistory(allHistory.filter(h => 
        tenantConnectionIds.includes(h.tenantConnectionId)
      ));
    } else {
      setScores(allScores);
      setStats(calculateAggregatedStats(allScores));
      setHistory(allHistory);
    }
  }, [selectedCustomerId, tenantConnectionIds, allScores, allHistory]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scoresData, historyData] = await Promise.all([
        getSecureScores(),
        getScoreHistory(undefined, 30),
      ]);
      setAllScores(scoresData);
      setAllHistory(historyData);
    } catch (error) {
      console.error('Error loading secure score data:', error);
      toast.error('Failed to load secure score data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const result = await refreshSecureScores();
      toast.success(`Refreshed ${result.processed} tenant scores`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} tenants failed to refresh`);
      }
    } catch (error) {
      console.error('Error refreshing scores:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('timed out')) {
        toast.warning(message);
      } else {
        toast.error('Failed to refresh secure scores');
      }
    } finally {
      // Stop the spinner immediately; reload in the background so the button never spins forever.
      setRefreshing(false);
      loadData().catch((e) => console.error('Error reloading secure score data:', e));
    }
  };

  // Prepare chart data
  const trendData = history.reduce((acc: any[], h) => {
    const dateKey = format(h.recordedAt, 'MMM dd');
    const existing = acc.find(a => a.date === dateKey);
    const percentage = h.maxScore > 0 ? (h.score / h.maxScore) * 100 : 0;
    
    if (existing) {
      existing.avgScore = (existing.avgScore * existing.count + percentage) / (existing.count + 1);
      existing.count++;
    } else {
      acc.push({ date: dateKey, avgScore: percentage, count: 1 });
    }
    return acc;
  }, []);

  const distributionData = stats ? [
    { name: 'Above 80%', value: stats.tenantsAbove80, color: PIE_COLORS[0] },
    { name: '50-80%', value: stats.tenantsBetween50And80, color: PIE_COLORS[1] },
    { name: 'Below 50%', value: stats.tenantsBelow50, color: PIE_COLORS[2] },
  ].filter(d => d.value > 0) : [];

  const selectedScore = selectedTenant 
    ? scores.find(s => s.tenantConnectionId === selectedTenant) 
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Microsoft Secure Score Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Aggregated security posture across all connected tenants
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </Button>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing secure scores for customer: <strong>{selectedCustomerName || 'Selected Customer'}</strong>
          </AlertDescription>
        </Alert>
      )}

      {scores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Secure Scores Available</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Connect Microsoft 365 tenants and click "Refresh All" to fetch their secure scores.
            </p>
            <Button onClick={handleRefresh} className="mt-4" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Fetch Secure Scores
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <ScoreGauge percentage={stats?.averagePercentage || 0} size={80} />
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.averageScore.toFixed(1) || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        points average
                      </p>
                    </div>
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Tenants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalTenants || 0}</p>
                      <p className="text-sm text-muted-foreground">monitored</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    High Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.tenantsAbove80 || 0}</p>
                      <p className="text-sm text-muted-foreground">above 80%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.tenantsBelow50 || 0}</p>
                      <p className="text-sm text-muted-foreground">below 50%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="tenants" className="gap-2">
                <Building2 className="h-4 w-4" />
                Tenants
              </TabsTrigger>
              <TabsTrigger value="trends" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Improvement Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Score Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Score Distribution</CardTitle>
                    <CardDescription>Tenants by score range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distributionData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Category Performance</CardTitle>
                    <CardDescription>Average scores by security category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={stats?.categoryBreakdown.slice(0, 6) || []}
                          layout="vertical"
                          margin={{ left: 100 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis 
                            dataKey="category" 
                            type="category" 
                            width={90}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top/Bottom Tenants */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {scores
                        .sort((a, b) => b.scorePercentage - a.scorePercentage)
                        .slice(0, 5)
                        .map((score) => (
                          <div key={score.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: getScoreColor(score.scorePercentage) }}
                              />
                              <span className="font-medium truncate max-w-[200px]">
                                {score.tenantName}
                              </span>
                            </div>
                            <Badge variant={getScoreBadgeVariant(score.scorePercentage)}>
                              {score.scorePercentage.toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                      Needs Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {scores
                        .sort((a, b) => a.scorePercentage - b.scorePercentage)
                        .slice(0, 5)
                        .map((score) => (
                          <div key={score.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: getScoreColor(score.scorePercentage) }}
                              />
                              <span className="font-medium truncate max-w-[200px]">
                                {score.tenantName}
                              </span>
                            </div>
                            <Badge variant={getScoreBadgeVariant(score.scorePercentage)}>
                              {score.scorePercentage.toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tenants">
              <Card>
                <CardHeader>
                  <CardTitle>All Tenant Scores</CardTitle>
                  <CardDescription>
                    Click on a tenant to view detailed security controls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Controls</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scores.map((score) => (
                          <TableRow 
                            key={score.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedTenant(
                              selectedTenant === score.tenantConnectionId 
                                ? null 
                                : score.tenantConnectionId
                            )}
                          >
                            <TableCell className="font-medium">
                              {score.tenantName}
                            </TableCell>
                            <TableCell>
                              {score.customerName || '-'}
                            </TableCell>
                            <TableCell>
                              {score.currentScore.toFixed(1)} / {score.maxScore.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={score.scorePercentage} 
                                  className="w-20 h-2"
                                />
                                <Badge variant={getScoreBadgeVariant(score.scorePercentage)}>
                                  {score.scorePercentage.toFixed(0)}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{score.controlScores.length}</TableCell>
                            <TableCell>
                              {format(score.updatedAt, 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Tenant Detail Panel */}
              {selectedScore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        {selectedScore.tenantName} - Control Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedScore.controlScores.slice(0, 12).map((control, idx) => (
                          <div 
                            key={idx}
                            className="p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-xs">
                                {control.controlCategory}
                              </Badge>
                              <span className="text-sm font-medium">
                                {control.score.toFixed(1)}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {control.controlName}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="trends">
              <Card>
                <CardHeader>
                  <CardTitle>Score Trend (Last 30 Days)</CardTitle>
                  <CardDescription>
                    Average secure score percentage over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg Score']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="avgScore" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No trend data available yet</p>
                          <p className="text-sm">Refresh scores daily to build trend data</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card>
                <CardHeader>
                  <CardTitle>Top Improvement Actions</CardTitle>
                  <CardDescription>
                    Most common improvement recommendations across all tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Tenants Affected</TableHead>
                          <TableHead>Avg Impact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(stats?.topImprovementActions || []).map((action, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium max-w-md">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 mt-1 text-yellow-500 flex-shrink-0" />
                                <span>{action.action}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{action.count} tenants</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-green-600 font-medium">
                                +{action.avgImpact.toFixed(1)} pts
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
