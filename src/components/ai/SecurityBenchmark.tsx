import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  BarChart3,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  Award,
  Layers,
  Map,
  Flame
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Professional Services',
  'Media & Entertainment',
  'Energy & Utilities'
];

const COMPANY_SIZES = [
  { value: 'small', label: 'Small (1-50 employees)' },
  { value: 'medium', label: 'Medium (51-500 employees)' },
  { value: 'large', label: 'Large (501-5000 employees)' },
  { value: 'enterprise', label: 'Enterprise (5000+ employees)' }
];

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface SecurityBenchmarkProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function SecurityBenchmark({ selectedTenants }: SecurityBenchmarkProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [industry, setIndustry] = useState('Technology');
  const [companySize, setCompanySize] = useState('medium');
  const { connectionId, tenantName } = useTenant();

  const effectiveConnectionId = selectedTenants?.[0]?.id || connectionId;
  const effectiveTenantName = selectedTenants?.[0]?.name || tenantName;

  const runBenchmark = async () => {
    if (!effectiveConnectionId) {
      toast.error('Please select a tenant first');
      return;
    }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-security-benchmark', {
        body: {
          tenantConnectionId: effectiveConnectionId,
          tenantData: { 
            tenantId: effectiveConnectionId,
            tenantName: effectiveTenantName 
          },
          industry,
          companySize
        }
      });

      if (error) throw error;
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        toast.success('Security benchmark completed');
      } else {
        throw new Error(data.error || 'Benchmark failed');
      }
    } catch (error) {
      console.error('Security benchmark error:', error);
      toast.error('Failed to run benchmark');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatPercent = (value: number) => `${value}%`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'above': return 'text-green-600';
      case 'below': return 'text-destructive';
      default: return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'above': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'below': return <ArrowDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getMaturityLabel = (level: string) => {
    const labels: Record<string, string> = {
      initial: 'Level 1 - Initial',
      developing: 'Level 2 - Developing',
      defined: 'Level 3 - Defined',
      managed: 'Level 4 - Managed',
      optimized: 'Level 5 - Optimized'
    };
    return labels[level] || level;
  };

  const summary = analysis?.summary as Record<string, unknown> | undefined;
  const categoryScores = analysis?.categoryScores as Record<string, Record<string, unknown>> | undefined;
  const industryComparison = analysis?.industryComparison as Record<string, unknown> | undefined;
  const controlsAnalysis = analysis?.controlsAnalysis as Array<Record<string, unknown>> | undefined;
  const maturityAssessment = analysis?.maturityAssessment as Record<string, unknown> | undefined;
  const peerComparison = analysis?.peerComparison as Record<string, unknown> | undefined;
  const improvementRoadmap = analysis?.improvementRoadmap as Array<Record<string, unknown>> | undefined;
  const riskHeatmap = analysis?.riskHeatmap as Array<Record<string, unknown>> | undefined;
  const quickWins = analysis?.quickWins as Array<Record<string, unknown>> | undefined;

  if (!analysis) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            AI Security Benchmark
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Compare your security posture against industry benchmarks and peer organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 max-w-md mx-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">Industry</label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Size</label>
              <Select value={companySize} onValueChange={setCompanySize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-center pt-2">
            <Button onClick={runBenchmark} disabled={isAnalyzing} size="lg" className="gap-2">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Benchmark...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Run Security Benchmark
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>Overall Score</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {Number(summary?.overallScore) || 0}
              <span className="text-lg text-muted-foreground">/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Number(summary?.overallScore) || 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Industry Percentile</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              Top {100 - (Number(summary?.industryPercentile) || 50)}%
              {(Number(summary?.industryPercentile) || 50) > 70 ? 
                <TrendingUp className="h-5 w-5 text-green-600" /> : 
                <TrendingDown className="h-5 w-5 text-destructive" />
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Compared to {industry} sector
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Maturity Level</CardDescription>
            <CardTitle className="text-lg">
              {getMaturityLabel(summary?.securityMaturityLevel as string)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(level => (
                <div 
                  key={level} 
                  className={`h-2 flex-1 rounded ${
                    level <= (Number(maturityAssessment?.currentLevel) || 2) 
                      ? 'bg-primary' 
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risk Exposure</CardDescription>
            <CardTitle className="text-xl">
              <Badge className={getRiskColor(summary?.riskExposure as string)}>
                {String(summary?.riskExposure || 'medium').toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Trend: {summary?.trend as string}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Compliance Readiness</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercent(Number(summary?.complianceReadiness) || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Number(summary?.complianceReadiness) || 0} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="categories" className="gap-1">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </TabsTrigger>
          <TabsTrigger value="controls" className="gap-1">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Controls</span>
          </TabsTrigger>
          <TabsTrigger value="peers" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Peers</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1">
            <Flame className="h-4 w-4" />
            <span className="hidden sm:inline">Risks</span>
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Roadmap</span>
          </TabsTrigger>
          <TabsTrigger value="quickwins" className="gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Wins</span>
          </TabsTrigger>
        </TabsList>

        {/* Category Scores */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryScores && Object.entries(categoryScores).map(([key, category]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                    {getStatusIcon(category.status as string)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold">{Number(category.score)}</p>
                      <p className="text-xs text-muted-foreground">Your Score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium text-muted-foreground">{Number(category.benchmark)}</p>
                      <p className="text-xs text-muted-foreground">Benchmark</p>
                    </div>
                  </div>
                  <Progress value={Number(category.score)} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className={getStatusColor(category.status as string)}>
                      {Number(category.gap) > 0 ? '+' : ''}{Number(category.gap)} vs benchmark
                    </span>
                    <span className="text-muted-foreground">
                      {Number(category.percentile)}th percentile
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    {(category.keyFindings as string[])?.slice(0, 2).map((finding, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span className="mt-1">•</span>
                        {finding}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Industry Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Industry Comparison: {industryComparison?.industry as string}</CardTitle>
              <CardDescription>
                Based on {Number(industryComparison?.sampleSize)} organizations • Your rank: {industryComparison?.yourRank as string}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-medium text-green-600 mb-2">Top Performers</p>
                  <p className="text-2xl font-bold">{Number((industryComparison?.topPerformers as Record<string, unknown>)?.avgScore)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Avg Score</p>
                  <ul className="mt-3 space-y-1">
                    {((industryComparison?.topPerformers as Record<string, unknown>)?.characteristics as string[])?.map((c, i) => (
                      <li key={i} className="text-xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm font-medium text-yellow-600 mb-2">Industry Average</p>
                  <p className="text-2xl font-bold">{Number((industryComparison?.industryAverage as Record<string, unknown>)?.avgScore)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Avg Score</p>
                  <ul className="mt-3 space-y-1">
                    {((industryComparison?.industryAverage as Record<string, unknown>)?.commonWeaknesses as string[])?.map((w, i) => (
                      <li key={i} className="text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-600" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm font-medium text-red-600 mb-2">Bottom Performers</p>
                  <p className="text-2xl font-bold">{Number((industryComparison?.bottomPerformers as Record<string, unknown>)?.avgScore)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Avg Score</p>
                  <ul className="mt-3 space-y-1">
                    {((industryComparison?.bottomPerformers as Record<string, unknown>)?.risks as string[])?.map((r, i) => (
                      <li key={i} className="text-xs flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-600" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Controls Analysis */}
        <TabsContent value="controls">
          <Card>
            <CardHeader>
              <CardTitle>Security Controls Analysis</CardTitle>
              <CardDescription>Status of key security controls vs industry adoption</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {controlsAnalysis?.map((control, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{control.control as string}</span>
                          <Badge variant="outline" className="text-xs">{control.category as string}</Badge>
                          <Badge variant={control.criticality === 'critical' ? 'destructive' : control.criticality === 'high' ? 'secondary' : 'outline'}>
                            {control.criticality as string}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{control.recommendation as string}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-center">
                          <Badge variant={control.yourStatus === 'implemented' ? 'default' : control.yourStatus === 'partial' ? 'secondary' : 'destructive'}>
                            {control.yourStatus as string}
                          </Badge>
                        </div>
                        <div className="text-right w-24">
                          <p className="text-sm font-medium">{Number(control.industryAdoption)}%</p>
                          <p className="text-xs text-muted-foreground">adoption</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Peer Comparison */}
        <TabsContent value="peers">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Strengths vs Peers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(peerComparison?.strengthsVsPeers as string[])?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5">
                      <ArrowUp className="h-4 w-4 text-green-600 mt-0.5" />
                      <span className="text-sm">{s}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Weaknesses vs Peers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(peerComparison?.weaknessesVsPeers as string[])?.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5">
                      <ArrowDown className="h-4 w-4 text-destructive mt-0.5" />
                      <span className="text-sm">{w}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Unique Advantages
                </CardTitle>
                <CardDescription>Areas where you outperform similar organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {(peerComparison?.uniqueAdvantages as string[])?.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                      <span className="text-sm">{a}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Heatmap */}
        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle>Risk Heatmap</CardTitle>
              <CardDescription>Security risks by likelihood and impact</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {riskHeatmap?.map((risk, i) => {
                    const likelihood = risk.likelihood as string;
                    const impact = risk.impact as string;
                    const riskLevel = likelihood === 'high' && impact === 'high' ? 'critical' :
                                     likelihood === 'high' || impact === 'high' ? 'high' :
                                     likelihood === 'medium' && impact === 'medium' ? 'medium' : 'low';
                    return (
                      <Card key={i} className={`border-l-4 ${
                        riskLevel === 'critical' ? 'border-l-red-500' :
                        riskLevel === 'high' ? 'border-l-orange-500' :
                        riskLevel === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'
                      }`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{risk.area as string}</CardTitle>
                            <div className="flex gap-2">
                              <Badge variant="outline">Likelihood: {likelihood}</Badge>
                              <Badge variant="outline">Impact: {impact}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2 md:grid-cols-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Current Mitigation:</p>
                              <p>{risk.currentMitigation as string}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Recommended Action:</p>
                              <p className="font-medium">{risk.recommendedAction as string}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Improvement Roadmap */}
        <TabsContent value="roadmap">
          <div className="space-y-4">
            {improvementRoadmap?.map((phase, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {i + 1}
                        </div>
                        {phase.phase as string}
                      </CardTitle>
                      <CardDescription>{phase.duration as string}</CardDescription>
                    </div>
                    <Badge className="bg-green-500">
                      +{Number(phase.expectedScoreImprovement)} points
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium mb-2">Objectives</p>
                      <ul className="space-y-1">
                        {(phase.objectives as string[])?.map((obj, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex items-start gap-1">
                            <Target className="h-3 w-3 mt-1 flex-shrink-0" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Investments</p>
                      <ul className="space-y-1">
                        {(phase.investments as string[])?.map((inv, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex items-start gap-1">
                            <span>•</span>
                            {inv}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Milestones</p>
                      <ul className="space-y-1">
                        {(phase.milestones as string[])?.map((ms, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex items-start gap-1">
                            <CheckCircle2 className="h-3 w-3 mt-1 flex-shrink-0 text-primary" />
                            {ms}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Quick Wins */}
        <TabsContent value="quickwins">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Wins
              </CardTitle>
              <CardDescription>Low-effort, high-impact improvements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {quickWins?.map((win, i) => (
                  <Card key={i} className="border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{win.action as string}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Impact</p>
                            <p className="font-medium text-green-600">+{Number(win.scoreImpact)} pts</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Effort</p>
                            <Badge variant="outline">{win.effort as string}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Timeframe</p>
                          <p className="text-sm">{win.timeframe as string}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Re-run Button */}
      <div className="flex justify-center">
        <Button onClick={runBenchmark} disabled={isAnalyzing} variant="outline" className="gap-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Re-running...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4" />
              Re-run Benchmark
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
