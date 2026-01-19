import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Settings2, 
  Loader2, 
  Shield, 
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Layers,
  Target,
  Clock,
  Lightbulb,
  GitMerge,
  Trash2,
  BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuickWin {
  title: string;
  description: string;
  impact: string;
  effort: string;
  category: string;
  implementation: string;
}

interface SecurityOptimization {
  title: string;
  currentState: string;
  recommendedState: string;
  riskReduction: string;
  priority: string;
  affectedPolicies: string[];
  implementation: {
    steps: string[];
    prerequisites: string[];
    estimatedTime: string;
    rollbackPlan: string;
  };
}

interface OptimizationAnalysis {
  summary: {
    totalOptimizations: number;
    estimatedSecurityImprovement: string;
    estimatedCostSavings: string;
    estimatedPerformanceGain: string;
    overallHealthScore: number;
    optimizedHealthScore: number;
  };
  quickWins: QuickWin[];
  securityOptimizations: SecurityOptimization[];
  performanceOptimizations: Array<{
    title: string;
    currentIssue: string;
    recommendation: string;
    expectedImprovement: string;
    affectedServices: string[];
    implementation: string;
  }>;
  costOptimizations: Array<{
    title: string;
    currentCost: string;
    optimizedCost: string;
    savings: string;
    recommendation: string;
    tradeoffs: string[];
    implementation: string;
  }>;
  policyConflicts: Array<{
    policies: string[];
    conflictType: string;
    description: string;
    resolution: string;
    priority: string;
  }>;
  redundantConfigs: Array<{
    items: string[];
    type: string;
    description: string;
    recommendation: string;
    safeToRemove: boolean;
  }>;
  bestPracticeGaps: Array<{
    area: string;
    currentState: string;
    bestPractice: string;
    gap: string;
    recommendation: string;
    reference: string;
  }>;
  implementationRoadmap: Array<{
    phase: number;
    name: string;
    duration: string;
    items: string[];
    dependencies: string[];
    risks: string[];
  }>;
  beforeAfterComparison: {
    security: { before: number; after: number };
    performance: { before: number; after: number };
    cost: { before: number; after: number };
    compliance: { before: number; after: number };
    usability: { before: number; after: number };
  };
}

export const ConfigOptimizer: React.FC = () => {
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState({
    security: true,
    performance: true,
    cost: true,
    compliance: true,
    usability: false
  });

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact?.toLowerCase()) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'cost': return <DollarSign className="h-4 w-4" />;
      case 'compliance': return <CheckCircle className="h-4 w-4" />;
      case 'usability': return <Target className="h-4 w-4" />;
      default: return <Settings2 className="h-4 w-4" />;
    }
  };

  const analyzeConfig = async () => {
    setLoading(true);
    try {
      // Mock configuration data
      const configData = {
        conditionalAccessPolicies: 12,
        securityDefaults: false,
        mfaEnforced: true,
        legacyAuthBlocked: false,
        guestAccessRestricted: false,
        adminMfaRequired: true,
        signInRiskPolicies: 2,
        userRiskPolicies: 1,
        deviceCompliancePolicies: 5,
        appProtectionPolicies: 3,
        dlpPolicies: 4,
        retentionPolicies: 6,
        sensitivityLabels: 8
      };

      const { data, error } = await supabase.functions.invoke('ai-config-optimizer', {
        body: { 
          configData, 
          optimizationGoals: goals,
          tenantContext: {
            userCount: 500,
            licenseType: 'E5',
            industry: 'Financial Services'
          }
        }
      });

      if (error) throw error;
      setAnalysis(data);
      toast.success('Configuration analysis complete');
    } catch (error) {
      console.error('Error analyzing config:', error);
      toast.error('Failed to analyze configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Goal Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuration Optimizer
          </CardTitle>
          <CardDescription>
            Analyze your M365 configuration and get AI-powered optimization recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Optimization Goals</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {Object.entries(goals).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setGoals(prev => ({ ...prev, [key]: checked as boolean }))
                      }
                    />
                    <Label htmlFor={key} className="capitalize cursor-pointer">
                      {key}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={analyzeConfig} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Analyze & Optimize
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {analysis.summary.totalOptimizations}
                  </p>
                  <p className="text-sm text-muted-foreground">Optimizations Found</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {analysis.summary.estimatedSecurityImprovement}
                  </p>
                  <p className="text-sm text-muted-foreground">Security Improvement</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {analysis.summary.estimatedCostSavings}
                  </p>
                  <p className="text-sm text-muted-foreground">Est. Cost Savings</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {analysis.summary.estimatedPerformanceGain}
                  </p>
                  <p className="text-sm text-muted-foreground">Performance Gain</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold">{analysis.summary.overallHealthScore}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold text-green-600">
                    {analysis.summary.optimizedHealthScore}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-1">Health Score</p>
              </CardContent>
            </Card>
          </div>

          {/* Before/After Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Impact Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                {Object.entries(analysis.beforeAfterComparison).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <span className="text-xs text-green-600">
                        +{value.after - value.before}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-12">Before</span>
                        <Progress value={value.before} className="h-2 flex-1" />
                        <span className="text-xs w-8">{value.before}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-12">After</span>
                        <Progress value={value.after} className="h-2 flex-1 [&>div]:bg-green-500" />
                        <span className="text-xs w-8">{value.after}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="quickwins">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="quickwins">Quick Wins</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
                  <TabsTrigger value="gaps">Best Practices</TabsTrigger>
                  <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                </TabsList>

                <TabsContent value="quickwins" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-3 md:grid-cols-2">
                      {analysis.quickWins.map((win, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(win.category)}
                                <CardTitle className="text-sm">{win.title}</CardTitle>
                              </div>
                              <div className="flex gap-1">
                                <Badge className={getImpactColor(win.impact)} variant="outline">
                                  {win.impact} impact
                                </Badge>
                                <Badge variant="outline">{win.effort} effort</Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">{win.description}</p>
                            <div className="p-2 bg-muted rounded text-sm">
                              <strong>How to implement:</strong> {win.implementation}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="security" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {analysis.securityOptimizations.map((opt, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                {opt.title}
                              </CardTitle>
                              <Badge className={getPriorityColor(opt.priority)}>
                                {opt.priority}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="p-3 bg-red-50 rounded border border-red-200">
                                <p className="text-xs font-medium text-red-700">Current State</p>
                                <p className="text-sm mt-1">{opt.currentState}</p>
                              </div>
                              <div className="p-3 bg-green-50 rounded border border-green-200">
                                <p className="text-xs font-medium text-green-700">Recommended State</p>
                                <p className="text-sm mt-1">{opt.recommendedState}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-green-600">
                                Risk Reduction: {opt.riskReduction}
                              </Badge>
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {opt.implementation.estimatedTime}
                              </Badge>
                            </div>
                            {opt.affectedPolicies.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Affected Policies:</p>
                                <div className="flex flex-wrap gap-1">
                                  {opt.affectedPolicies.map((policy, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {policy}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="border-t pt-3">
                              <p className="text-xs font-medium mb-2">Implementation Steps:</p>
                              <ol className="list-decimal list-inside text-sm space-y-1">
                                {opt.implementation.steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="performance" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.performanceOptimizations.map((opt, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Zap className="h-4 w-4 text-yellow-500" />
                              {opt.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Current Issue</p>
                              <p className="text-sm">{opt.currentIssue}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Recommendation</p>
                              <p className="text-sm">{opt.recommendation}</p>
                            </div>
                            <Badge variant="outline" className="text-green-600">
                              Expected: {opt.expectedImprovement}
                            </Badge>
                            {opt.affectedServices.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {opt.affectedServices.map((service, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {service}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="cost" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.costOptimizations.map((opt, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              {opt.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex gap-4">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Current</p>
                                <p className="font-semibold">{opt.currentCost}</p>
                              </div>
                              <ArrowRight className="h-4 w-4 mt-4 text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Optimized</p>
                                <p className="font-semibold text-green-600">{opt.optimizedCost}</p>
                              </div>
                              <div className="text-center ml-auto">
                                <p className="text-xs text-muted-foreground">Savings</p>
                                <p className="font-semibold text-green-600">{opt.savings}</p>
                              </div>
                            </div>
                            <p className="text-sm">{opt.recommendation}</p>
                            {opt.tradeoffs.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-orange-600 mb-1">Tradeoffs:</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {opt.tradeoffs.map((tradeoff, i) => (
                                    <li key={i}>{tradeoff}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="conflicts" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <GitMerge className="h-4 w-4" />
                          Policy Conflicts
                        </h3>
                        {analysis.policyConflicts.map((conflict, index) => (
                          <Card key={index} className="border-orange-200">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex flex-wrap gap-1">
                                  {conflict.policies.map((policy, i) => (
                                    <Badge key={i} variant="outline">{policy}</Badge>
                                  ))}
                                </div>
                                <Badge className={getPriorityColor(conflict.priority)}>
                                  {conflict.priority}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{conflict.conflictType}</p>
                              <p className="text-sm text-muted-foreground mt-1">{conflict.description}</p>
                              <div className="mt-2 p-2 bg-green-50 rounded">
                                <p className="text-sm"><strong>Resolution:</strong> {conflict.resolution}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Redundant Configurations
                        </h3>
                        {analysis.redundantConfigs.map((config, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{config.type}</Badge>
                                {config.safeToRemove && (
                                  <Badge className="bg-green-100 text-green-700">Safe to Remove</Badge>
                                )}
                              </div>
                              <p className="text-sm">{config.description}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {config.items.map((item, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                                ))}
                              </div>
                              <p className="text-sm mt-2 text-muted-foreground">
                                <strong>Recommendation:</strong> {config.recommendation}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="gaps" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.bestPracticeGaps.map((gap, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              {gap.area}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="p-2 bg-muted rounded">
                                <p className="text-xs font-medium">Current State</p>
                                <p className="text-sm">{gap.currentState}</p>
                              </div>
                              <div className="p-2 bg-primary/10 rounded">
                                <p className="text-xs font-medium">Best Practice</p>
                                <p className="text-sm">{gap.bestPractice}</p>
                              </div>
                            </div>
                            <div className="p-2 bg-orange-50 rounded border border-orange-200">
                              <p className="text-xs font-medium text-orange-700">Gap</p>
                              <p className="text-sm">{gap.gap}</p>
                            </div>
                            <p className="text-sm">
                              <strong>Recommendation:</strong> {gap.recommendation}
                            </p>
                            {gap.reference && (
                              <p className="text-xs text-muted-foreground">
                                Reference: {gap.reference}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="roadmap" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {analysis.implementationRoadmap.map((phase, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Phase {phase.phase}: {phase.name}
                              </CardTitle>
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {phase.duration}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-xs font-medium mb-1">Items to Implement:</p>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                {phase.items.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            {phase.dependencies.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Dependencies:</p>
                                <div className="flex flex-wrap gap-1">
                                  {phase.dependencies.map((dep, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{dep}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {phase.risks.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-orange-600 mb-1">Risks:</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {phase.risks.map((risk, i) => (
                                    <li key={i}>{risk}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
