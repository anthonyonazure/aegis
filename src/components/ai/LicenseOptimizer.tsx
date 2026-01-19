import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingDown, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Target,
  BarChart3,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

interface LicenseType {
  name: string;
  total: number;
  assigned: number;
  monthlyPerUserCost: number;
  totalMonthlyCost: number;
}

interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  currentState: string;
  proposedAction: string;
  estimatedSavings: number;
  affectedUsers: number;
  implementationSteps: string[];
  risks: string[];
  timeToImplement: string;
}

interface QuickWin {
  action: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
}

interface OptimizationResult {
  summary: {
    totalMonthlySpend: number;
    potentialSavings: number;
    savingsPercentage: number;
    optimizationScore: number;
    urgency: 'high' | 'medium' | 'low';
  };
  currentState: {
    totalLicenses: number;
    assignedLicenses: number;
    unassignedLicenses: number;
    utilizationRate: number;
    licensesByType: LicenseType[];
  };
  recommendations: Recommendation[];
  quickWins: QuickWin[];
  longTermStrategy: {
    recommendations: string[];
    projectedAnnualSavings: number;
    timeline: string;
  };
  benchmarks: {
    industryAvgUtilization: number;
    yourUtilization: number;
    industryAvgCostPerUser: number;
    yourCostPerUser: number;
  };
}

export function LicenseOptimizer() {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  // Load last analysis on mount
  useEffect(() => {
    const loadLastAnalysis = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('license-optimizer');
        if (lastAnalysis?.result) {
          setResult(lastAnalysis.result as unknown as OptimizationResult);
        }
      } catch (error) {
        console.error('Failed to load last analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastAnalysis();
  }, []);

  const analyzeAndOptimize = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-license-optimizer', {
        body: {}
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      
      // Save to database for persistence
      await saveAnalysisResult({
        analysisType: 'license-optimizer',
        result: data,
        score: data.summary?.optimizationScore,
      });

      toast({
        title: 'Analysis Complete',
        description: `Found $${data.summary?.potentialSavings?.toLocaleString() || 0}/month in potential savings`,
      });
    } catch (error) {
      console.error('License optimization error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze licenses',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI License Optimizer</h2>
            <p className="text-muted-foreground">Analyze and optimize M365 license costs</p>
          </div>
        </div>
        <Button onClick={analyzeAndOptimize} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze Licenses
            </>
          )}
        </Button>
      </div>

      {!result && !isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingDown className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Optimize</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Click "Analyze Licenses" to scan your M365 license allocations and discover cost-saving opportunities
            </p>
            <Button onClick={analyzeAndOptimize} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing license allocations and finding savings...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Spend</p>
                    <p className="text-2xl font-bold">{formatCurrency(result.summary.totalMonthlySpend)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-green-500/20 border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Potential Savings</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(result.summary.potentialSavings)}</p>
                    <p className="text-xs text-green-400/70">{result.summary.savingsPercentage}% reduction</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-green-400/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Optimization Score</p>
                    <p className="text-2xl font-bold">{result.summary.optimizationScore}/100</p>
                  </div>
                  <Target className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <Progress value={result.summary.optimizationScore} className="mt-2 h-1.5" />
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Utilization Rate</p>
                    <p className="text-2xl font-bold">{result.currentState?.utilizationRate || 0}%</p>
                  </div>
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <Progress value={result.currentState?.utilizationRate || 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Wins */}
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Quick Wins
                </CardTitle>
                <CardDescription>Low-effort, high-impact savings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.quickWins?.slice(0, 5).map((win, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <p className="text-sm">{win.action}</p>
                        <p className={`text-xs ${getEffortColor(win.effort)}`}>
                          {win.effort} effort
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-400 border-green-400/30">
                        {formatCurrency(win.savings)}/mo
                      </Badge>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">No quick wins found</p>}
                </div>
              </CardContent>
            </Card>

            {/* License Breakdown */}
            <Card className="glass-panel border-border/50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  License Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {result.currentState?.licensesByType?.map((license, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{license.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(license.totalMonthlyCost)}/mo
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{license.assigned}/{license.total} assigned</span>
                          <span>{formatCurrency(license.monthlyPerUserCost)}/user</span>
                        </div>
                        <Progress 
                          value={(license.assigned / license.total) * 100} 
                          className="mt-2 h-1"
                        />
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No license data</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Optimization Recommendations</CardTitle>
              <CardDescription>Prioritized actions to reduce license costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.recommendations?.map((rec) => (
                  <Collapsible
                    key={rec.id}
                    open={expandedRec === rec.id}
                    onOpenChange={(open) => setExpandedRec(open ? rec.id : null)}
                  >
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                            <div className="text-left">
                              <p className="text-sm font-medium">{rec.title}</p>
                              <p className="text-xs text-muted-foreground">{rec.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium text-green-400">
                                {formatCurrency(rec.estimatedSavings)}/mo
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.affectedUsers} users
                              </p>
                            </div>
                            {expandedRec === rec.id ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground mb-1">Current State</p>
                              <p className="text-sm">{rec.currentState}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-primary/10">
                              <p className="text-xs text-muted-foreground mb-1">Proposed Action</p>
                              <p className="text-sm">{rec.proposedAction}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Implementation Steps</p>
                            <div className="space-y-2">
                              {rec.implementationSteps?.map((step, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                  {step}
                                </div>
                              ))}
                            </div>
                          </div>

                          {rec.risks?.length > 0 && (
                            <div className="p-3 rounded-lg bg-orange-500/10">
                              <p className="text-xs text-orange-400 mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Risks
                              </p>
                              <ul className="text-sm space-y-1">
                                {rec.risks.map((risk, i) => (
                                  <li key={i} className="text-orange-300/80">• {risk}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Time to implement: {rec.timeToImplement}</span>
                            <Badge variant="outline">{rec.category}</Badge>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )) || <p className="text-sm text-muted-foreground">No recommendations</p>}
              </div>
            </CardContent>
          </Card>

          {/* Long Term Strategy */}
          {result.longTermStrategy && (
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Long-Term Strategy
                </CardTitle>
                <CardDescription>
                  Projected annual savings: {formatCurrency(result.longTermStrategy.projectedAnnualSavings)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.longTermStrategy.recommendations?.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Timeline: {result.longTermStrategy.timeline}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
