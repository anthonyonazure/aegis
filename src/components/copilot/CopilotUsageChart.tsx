import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp,
  Loader2,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { fetchUsageAnalytics, UsageAnalytics } from '@/lib/copilotApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopilotUsageChartProps {
  tenantConnectionId: string;
  tenantName: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

export const CopilotUsageChart = ({ tenantConnectionId, tenantName }: CopilotUsageChartProps) => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<'D7' | 'D30' | 'D90'>('D30');

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsageAnalytics(tenantConnectionId, period);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load usage analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [tenantConnectionId, period]);

  const chartData = analytics?.topFeatures.map(f => ({
    name: f.name,
    usage: f.usage,
  })) || [];

  const pieData = analytics?.topFeatures.map(f => ({
    name: f.name,
    value: f.usage,
  })) || [];

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Copilot Usage Analytics
            </CardTitle>
            <CardDescription>
              Track adoption and usage patterns for {tenantName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: 'D7' | 'D30' | 'D90') => setPeriod(v)}>
              <SelectTrigger className="w-[130px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="D7">Last 7 days</SelectItem>
                <SelectItem value="D30">Last 30 days</SelectItem>
                <SelectItem value="D90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadAnalytics} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !analytics ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : analytics ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Total Users</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{analytics.totalUsers}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Active Users</span>
                </div>
                <div className="text-2xl font-bold text-green-400">{analytics.activeUsers}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">Total Queries</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{analytics.totalQueries.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Adoption Rate</span>
                </div>
                <div className="text-2xl font-bold text-primary">{analytics.adoptionRate.toFixed(1)}%</div>
              </div>
            </div>

            {/* Adoption Progress */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Copilot Adoption</span>
                <Badge variant="outline">{analytics.activeUsers} / {analytics.totalUsers} users</Badge>
              </div>
              <Progress value={analytics.adoptionRate} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.adoptionRate.toFixed(1)}% of licensed users are actively using Copilot
              </p>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Bar Chart - Usage by App */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium text-foreground mb-4">Usage by Application</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart - Distribution */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium text-foreground mb-4">Feature Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name }) => name}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Features List */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <h4 className="font-medium text-foreground mb-4">Top Used Features</h4>
              <div className="space-y-3">
                {analytics.topFeatures.slice(0, 5).map((feature, index) => (
                  <div key={feature.name} className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-foreground">{feature.name}</span>
                    <Badge variant="outline">{feature.usage} users</Badge>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No analytics data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
