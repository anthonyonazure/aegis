import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  PiggyBank,
  Calculator,
  BarChart3,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  ArrowRight,
  Lightbulb,
  Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

interface CostPredictorProps {
  tenantData?: Record<string, unknown>;
}

export function CostPredictor({ tenantData }: CostPredictorProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());
  const { tenants, connectionId, tenantName } = useTenant();

  // Load last analysis on mount
  useEffect(() => {
    const loadLastAnalysis = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('cost-predictor');
        if (lastAnalysis?.result) {
          setAnalysis(lastAnalysis.result);
        }
      } catch (error) {
        console.error('Failed to load last analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastAnalysis();
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-cost-predictor', {
        body: {
          tenantData: tenantData || { 
            tenantId: connectionId,
            tenantName: tenantName 
          },
          historicalCosts: [],
          growthRate: 5
        }
      });

      if (error) throw error;
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        
        // Save to database for persistence
        await saveAnalysisResult({
          analysisType: 'cost-predictor',
          result: data.analysis,
          tenantConnectionId: connectionId || undefined,
        });

        toast.success('Cost analysis completed');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Cost prediction error:', error);
      toast.error('Failed to analyze costs');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleOpportunity = (id: string) => {
    const newExpanded = new Set(expandedOpportunities);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedOpportunities(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-destructive" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  const summary = analysis?.summary as Record<string, unknown> | undefined;
  const licenseAnalysis = analysis?.licenseAnalysis as Record<string, unknown> | undefined;
  const savingsOpportunities = analysis?.savingsOpportunities as Array<Record<string, unknown>> | undefined;
  const costForecast = analysis?.costForecast as Record<string, unknown> | undefined;
  const copilotROI = analysis?.copilotROI as Record<string, unknown> | undefined;
  const budgetRecommendations = analysis?.budgetRecommendations as Array<Record<string, unknown>> | undefined;
  const actionPlan = analysis?.actionPlan as Record<string, unknown> | undefined;

  if (!analysis) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            AI Cost Predictor
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Predict license costs, identify savings opportunities, and get budget forecasts powered by AI analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={runAnalysis} disabled={isAnalyzing} size="lg" className="gap-2">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Costs...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Analyze Costs & Predict Savings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Monthly Cost</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {formatCurrency(summary?.currentMonthlyCost as number || 0)}
              {getTrendIcon(summary?.costTrend as string)}
            </CardTitle>
          </CardHeader>
          <CardContent>
                        <p className="text-xs text-muted-foreground">
                          Annual: {formatCurrency(Number(summary?.annualCost) || 0)}
                        </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardDescription>Potential Monthly Savings</CardDescription>
            <CardTitle className="text-2xl text-green-600 flex items-center gap-2">
              {formatCurrency(summary?.potentialMonthlySavings as number || 0)}
              <PiggyBank className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatPercent(summary?.savingsPercentage as number || 0)} of current spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>License Utilization</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercent(licenseAnalysis?.utilizationRate as number || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={licenseAnalysis?.utilizationRate as number || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {Number(licenseAnalysis?.unusedLicenses) || 0} unused licenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost Risk Level</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Badge variant={getRiskColor(summary?.riskLevel as string)}>
                {(summary?.riskLevel as string)?.toUpperCase() || 'N/A'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on usage patterns & trends
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="savings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="savings" className="gap-1">
            <PiggyBank className="h-4 w-4" />
            <span className="hidden sm:inline">Savings</span>
          </TabsTrigger>
          <TabsTrigger value="licenses" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Licenses</span>
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Forecast</span>
          </TabsTrigger>
          <TabsTrigger value="copilot" className="gap-1">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Copilot ROI</span>
          </TabsTrigger>
          <TabsTrigger value="action" className="gap-1">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Action Plan</span>
          </TabsTrigger>
        </TabsList>

        {/* Savings Opportunities */}
        <TabsContent value="savings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Savings Opportunities
              </CardTitle>
              <CardDescription>
                Identified opportunities to reduce costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {savingsOpportunities?.map((opp, index) => (
                    <Collapsible 
                      key={opp.id as string || index}
                      open={expandedOpportunities.has(opp.id as string)}
                      onOpenChange={() => toggleOpportunity(opp.id as string)}
                    >
                      <Card className="border-l-4 border-l-green-500">
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {(opp.category as string)?.replace(/_/g, ' ')}
                                  </Badge>
                                  <Badge variant={getEffortColor(opp.effort as string)}>
                                    {opp.effort as string} effort
                                  </Badge>
                                  <Badge variant={getRiskColor(opp.risk as string)}>
                                    {opp.risk as string} risk
                                  </Badge>
                                </div>
                                <CardTitle className="text-base">{opp.title as string}</CardTitle>
                                <CardDescription className="mt-1">
                                  {opp.description as string}
                                </CardDescription>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(opp.monthlySavings as number)}/mo
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(opp.annualSavings as number)}/yr
                                </p>
                                {expandedOpportunities.has(opp.id as string) ? 
                                  <ChevronDown className="h-4 w-4 mt-2 ml-auto" /> : 
                                  <ChevronRight className="h-4 w-4 mt-2 ml-auto" />
                                }
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="space-y-3 border-t pt-3">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Current Cost</p>
                                  <p className="font-medium">{formatCurrency(opp.currentCost as number)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Optimized Cost</p>
                                  <p className="font-medium text-green-600">{formatCurrency(opp.optimizedCost as number)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Time to Implement</p>
                                  <p className="font-medium">{opp.timeToImplement as string}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Affected Users</p>
                                  <p className="font-medium">{opp.affectedUsers as number}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-2">Implementation Steps:</p>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                  {(opp.implementationSteps as string[])?.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* License Analysis */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>License Breakdown</CardTitle>
              <CardDescription>
                Detailed analysis of license usage and costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {(licenseAnalysis?.licenses as Array<Record<string, unknown>>)?.map((license, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{license.name as string}</CardTitle>
                            <CardDescription className="text-xs">{license.sku as string}</CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(license.totalMonthlyCost as number)}/mo</p>
                            {(license.unusedMonthlyCost as number) > 0 && (
                              <p className="text-xs text-destructive">
                                {formatCurrency(license.unusedMonthlyCost as number)} wasted
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Usage: {license.assigned as number} / {license.total as number}</span>
                            <span className="text-muted-foreground">
                              {license.unused as number} unused
                            </span>
                          </div>
                          <Progress 
                            value={((license.assigned as number) / (license.total as number)) * 100} 
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            {license.recommendation as string}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Forecast */}
        <TabsContent value="forecast" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries((costForecast?.scenarios as Record<string, unknown>) || {}).map(([key, scenario]) => {
              const s = scenario as Record<string, unknown>;
              return (
                <Card key={key} className={key === 'moderate' ? 'border-primary' : ''}>
                  <CardHeader>
                    <CardTitle className="capitalize flex items-center gap-2">
                      {key}
                      {key === 'moderate' && <Badge>Recommended</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Growth Rate: {s.growthRate as number}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold mb-3">
                      {formatCurrency(s.annualCost as number)}
                      <span className="text-sm font-normal text-muted-foreground">/year</span>
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Assumptions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {(s.assumptions as string[])?.map((a, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Projections</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {(costForecast?.monthlyProjections as Array<Record<string, unknown>>)?.map((proj, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium">{proj.month as string}</span>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Baseline: </span>
                          <span>{formatCurrency(proj.baselineCost as number)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Optimized: </span>
                          <span className="text-green-600">{formatCurrency(proj.optimizedCost as number)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">With Growth: </span>
                          <span>{formatCurrency(proj.growthAdjustedCost as number)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Copilot ROI */}
        <TabsContent value="copilot" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Copilot Spend</CardDescription>
                <CardTitle className="text-xl">
                  {formatCurrency(copilotROI?.currentCopilotSpend as number || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {Number(copilotROI?.licensedUsers) || 0} licensed users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Adoption Rate</CardDescription>
                <CardTitle className="text-xl">
                  {formatPercent(copilotROI?.adoptionRate as number || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={copilotROI?.adoptionRate as number || 0} className="h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Estimated Value</CardDescription>
                <CardTitle className="text-xl text-green-600">
                  {formatCurrency(copilotROI?.estimatedValueGenerated as number || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Productivity gains
                </p>
              </CardContent>
            </Card>

            <Card className={((copilotROI?.roi as number) || 0) > 0 ? 'border-green-500/30' : 'border-destructive/30'}>
              <CardHeader className="pb-2">
                <CardDescription>ROI</CardDescription>
                <CardTitle className={`text-xl ${((copilotROI?.roi as number) || 0) > 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatPercent(copilotROI?.roi as number || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {((copilotROI?.roi as number) || 0) > 0 ? 'Positive return' : 'Needs improvement'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Copilot Optimization</CardTitle>
              <CardDescription>{String(copilotROI?.optimizationPotential || '')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(copilotROI?.recommendations as string[])?.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Plan */}
        <TabsContent value="action" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Immediate (0-30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(actionPlan?.immediate as Array<Record<string, unknown>>)?.map((action, i) => (
                    <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <p className="font-medium text-sm">{action.action as string}</p>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-green-600">{formatCurrency(action.savings as number)} savings</span>
                        <span className="text-muted-foreground">{action.deadline as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <Clock className="h-5 w-5" />
                  Short-Term (1-3 months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(actionPlan?.shortTerm as Array<Record<string, unknown>>)?.map((action, i) => (
                    <div key={i} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                      <p className="font-medium text-sm">{action.action as string}</p>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-green-600">{formatCurrency(action.savings as number)} savings</span>
                        <span className="text-muted-foreground">{action.deadline as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Target className="h-5 w-5" />
                  Long-Term (3-12 months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(actionPlan?.longTerm as Array<Record<string, unknown>>)?.map((action, i) => (
                    <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <p className="font-medium text-sm">{action.action as string}</p>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-green-600">{formatCurrency(action.savings as number)} savings</span>
                        <span className="text-muted-foreground">{action.deadline as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {budgetRecommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Budget Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {budgetRecommendations.map((rec, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rec.category as string}</span>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                            {rec.priority as string}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rec.rationale as string}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm">
                          {formatCurrency(rec.currentBudget as number)} → {formatCurrency(rec.recommendedBudget as number)}
                        </p>
                        <p className={`text-xs ${(rec.variance as number) < 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {(rec.variance as number) < 0 ? '' : '+'}{formatCurrency(rec.variance as number)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Re-analyze Button */}
      <div className="flex justify-center">
        <Button onClick={runAnalysis} disabled={isAnalyzing} variant="outline" className="gap-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Re-analyzing...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4" />
              Re-analyze Costs
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
