import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Minus, ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';

interface AnalysisResult {
  id: string;
  analysis_type: string;
  score: number | null;
  result: unknown;
  recommendations: unknown;
  created_at: string;
}

const AI_SERVICES = [
  { value: 'security_predictor', label: 'Security Predictor', analysisType: 'security_prediction' },
  { value: 'security_benchmark', label: 'Security Benchmark', analysisType: 'security_benchmark' },
  { value: 'user_risk_profiler', label: 'User Risk Profiler', analysisType: 'user_risk_profile' },
  { value: 'anomaly_detection', label: 'Anomaly Detection', analysisType: 'anomaly_detection' },
  { value: 'compliance_advisor', label: 'Compliance Advisor', analysisType: 'compliance_advice' },
  { value: 'config_optimizer', label: 'Config Optimizer', analysisType: 'config_optimization' },
  { value: 'license_optimizer', label: 'License Optimizer', analysisType: 'license_optimization' },
  { value: 'drift_explainer', label: 'Drift Explainer', analysisType: 'drift_explanation' },
  { value: 'tenant_analyzer', label: 'Tenant Analyzer', analysisType: 'tenant_analysis' },
  { value: 'copilot_advisor', label: 'Copilot Readiness Advisor', analysisType: 'copilot_readiness' },
];

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

interface AITrendViewerProps {
  initialService?: string;
  onBack?: () => void;
}

export function AITrendViewer({ initialService, onBack }: AITrendViewerProps) {
  const { toast } = useToast();
  const [selectedService, setSelectedService] = useState(initialService || 'security_predictor');
  const [timeRange, setTimeRange] = useState('30');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [selectedService, timeRange]);

  async function fetchResults() {
    setLoading(true);
    try {
      const service = AI_SERVICES.find(s => s.value === selectedService);
      const startDate = subDays(new Date(), parseInt(timeRange));
      
      const { data, error } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('analysis_type', service?.analysisType || selectedService)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error('Error fetching results:', err);
      toast({
        title: 'Error',
        description: 'Failed to load trend data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function getServiceLabel(serviceType: string): string {
    return AI_SERVICES.find(s => s.value === serviceType)?.label || serviceType;
  }

  function calculateTrend(): { direction: 'up' | 'down' | 'stable'; percentage: number } {
    if (results.length < 2) return { direction: 'stable', percentage: 0 };
    
    const recentScores = results.slice(-5).filter(r => r.score !== null).map(r => r.score!);
    const olderScores = results.slice(0, 5).filter(r => r.score !== null).map(r => r.score!);
    
    if (recentScores.length === 0 || olderScores.length === 0) {
      return { direction: 'stable', percentage: 0 };
    }
    
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 2) return { direction: 'stable', percentage: 0 };
    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(change),
    };
  }

  function getChartData() {
    return results.map(r => ({
      date: format(new Date(r.created_at), 'MMM d'),
      score: r.score,
      fullDate: format(new Date(r.created_at), 'MMM d, yyyy h:mm a'),
    }));
  }

  function getLatestResult(): AnalysisResult | null {
    return results.length > 0 ? results[results.length - 1] : null;
  }

  const trend = calculateTrend();
  const chartData = getChartData();
  const latestResult = getLatestResult();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              AI Analysis Trends
            </h2>
            <p className="text-muted-foreground">Track performance over time</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_SERVICES.map((service) => (
                <SelectItem key={service.value} value={service.value}>
                  {service.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No trend data available</p>
            <p className="text-sm">Run the {getServiceLabel(selectedService)} to start collecting data</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Latest Score</CardDescription>
                <CardTitle className="text-3xl">
                  {latestResult?.score !== null ? `${latestResult?.score}%` : 'N/A'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {latestResult?.created_at 
                    ? format(new Date(latestResult.created_at), 'MMM d, yyyy')
                    : '-'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Trend</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {trend.direction === 'up' && (
                    <>
                      <TrendingUp className="h-6 w-6 text-green-500" />
                      <span className="text-green-500">+{trend.percentage.toFixed(1)}%</span>
                    </>
                  )}
                  {trend.direction === 'down' && (
                    <>
                      <TrendingDown className="h-6 w-6 text-red-500" />
                      <span className="text-red-500">-{trend.percentage.toFixed(1)}%</span>
                    </>
                  )}
                  {trend.direction === 'stable' && (
                    <>
                      <Minus className="h-6 w-6 text-muted-foreground" />
                      <span>Stable</span>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Compared to earlier period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Data Points</CardDescription>
                <CardTitle className="text-3xl">{results.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  In the last {timeRange} days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{getServiceLabel(selectedService)} Score Over Time</CardTitle>
              <CardDescription>
                Tracking {results.length} analysis results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      className="text-xs fill-muted-foreground"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium">{payload[0].payload.fullDate}</p>
                              <p className="text-lg font-bold text-primary">
                                Score: {payload[0].value}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      name="Score"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Latest Recommendations */}
          {latestResult?.recommendations && Array.isArray(latestResult.recommendations) && latestResult.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Recommendations</CardTitle>
                <CardDescription>
                  From analysis on {latestResult?.created_at ? format(new Date(latestResult.created_at), 'MMM d, yyyy') : '-'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {latestResult.recommendations.slice(0, 5).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                      <span className="text-sm">{String(rec)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
