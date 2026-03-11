import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Network, 
  Loader2, 
  Shield, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  BarChart3,
  Layers,
  Target,
  Calendar,
  Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CrossTenantAnalysis {
  summary: {
    totalTenants: number;
    averageSecurityScore: number;
    averageComplianceScore: number;
    totalUsers: number;
    totalMonthlyCost: string;
    criticalIssuesCount: number;
    overallHealthGrade: string;
  };
  portfolioHealth: {
    excellent: number;
    good: number;
    needsAttention: number;
    critical: number;
  };
  securityComparison: Array<{
    tenantName: string;
    securityScore: number;
    mfaAdoption: number;
    conditionalAccessPolicies: number;
    riskLevel: string;
    topIssues: string[];
  }>;
  commonIssues: Array<{
    issue: string;
    affectedTenants: number;
    percentageAffected: number;
    severity: string;
    recommendation: string;
    estimatedEffort: string;
  }>;
  configurationDrift: Array<{
    configArea: string;
    consistencyScore: number;
    variations: number;
    recommendedStandard: string;
    tenantsNeedingUpdate: string[];
  }>;
  licenseInsights: {
    totalLicenses: number;
    totalAssigned: number;
    utilizationRate: number;
    estimatedWaste: string;
    optimizationOpportunities: Array<{
      tenant: string;
      issue: string;
      potentialSavings: string;
    }>;
  };
  riskDistribution: {
    byCategory: Array<{
      category: string;
      highRiskTenants: number;
      mediumRiskTenants: number;
      lowRiskTenants: number;
    }>;
    topRisks: Array<{
      risk: string;
      affectedTenants: string[];
      mitigation: string;
    }>;
  };
  trends: Array<{
    metric: string;
    trend: string;
    change: string;
    insight: string;
  }>;
  bestPracticeAdoption: Array<{
    practice: string;
    adoptionRate: number;
    leaders: string[];
    laggards: string[];
  }>;
  recommendations: Array<{
    priority: string;
    recommendation: string;
    impact: string;
    affectedTenants: number;
    estimatedEffort: string;
    category: string;
  }>;
  actionPlan: Array<{
    week: number;
    focus: string;
    actions: string[];
    expectedOutcome: string;
  }>;
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface CrossTenantInsightsProps {
  selectedTenants?: SelectedTenantInfo[];
}

export const CrossTenantInsights: React.FC<CrossTenantInsightsProps> = ({ selectedTenants }) => {
  const [analysis, setAnalysis] = useState<CrossTenantAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveTenantIds = selectedTenants?.map(t => t.id).filter(Boolean) || [];

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend?.toLowerCase()) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const analyzePortfolio = async () => {
    if (effectiveTenantIds.length === 0) {
      toast.error('Please select at least one tenant to analyze');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-cross-tenant-insights', {
        body: { 
          tenantConnectionIds: effectiveTenantIds,
          tenantNames: selectedTenants?.map(t => t.name) || [],
          analysisType: 'comprehensive' 
        }
      });

      if (error) throw error;
      setAnalysis(data);
      toast.success('Cross-tenant analysis complete');
    } catch (error) {
      console.error('Error analyzing tenants:', error);
      toast.error('Failed to analyze tenants');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Cross-Tenant Insights
          </CardTitle>
          <CardDescription>
            Analyze patterns, security posture, and optimization opportunities across your entire tenant portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={analyzePortfolio} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Portfolio...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analyze All Tenants
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.summary.totalTenants}</p>
                    <p className="text-xs text-muted-foreground">Tenants</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.summary.totalUsers.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.summary.averageSecurityScore}</p>
                    <p className="text-xs text-muted-foreground">Avg Security</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.summary.totalMonthlyCost}</p>
                    <p className="text-xs text-muted-foreground">Monthly Cost</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.summary.criticalIssuesCount}</p>
                    <p className="text-xs text-muted-foreground">Critical Issues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center">
                  <Badge className={`text-2xl px-4 py-2 ${getGradeColor(analysis.summary.overallHealthGrade)}`}>
                    {analysis.summary.overallHealthGrade}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">Health Grade</p>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Health Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Portfolio Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-green-600">Excellent</span>
                    <span className="text-sm font-medium">{analysis.portfolioHealth.excellent}</span>
                  </div>
                  <Progress value={(analysis.portfolioHealth.excellent / analysis.summary.totalTenants) * 100} className="h-2 [&>div]:bg-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-blue-600">Good</span>
                    <span className="text-sm font-medium">{analysis.portfolioHealth.good}</span>
                  </div>
                  <Progress value={(analysis.portfolioHealth.good / analysis.summary.totalTenants) * 100} className="h-2 [&>div]:bg-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-yellow-600">Needs Attention</span>
                    <span className="text-sm font-medium">{analysis.portfolioHealth.needsAttention}</span>
                  </div>
                  <Progress value={(analysis.portfolioHealth.needsAttention / analysis.summary.totalTenants) * 100} className="h-2 [&>div]:bg-yellow-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-red-600">Critical</span>
                    <span className="text-sm font-medium">{analysis.portfolioHealth.critical}</span>
                  </div>
                  <Progress value={(analysis.portfolioHealth.critical / analysis.summary.totalTenants) * 100} className="h-2 [&>div]:bg-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="security">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="issues">Common Issues</TabsTrigger>
                  <TabsTrigger value="drift">Config Drift</TabsTrigger>
                  <TabsTrigger value="licenses">Licenses</TabsTrigger>
                  <TabsTrigger value="trends">Trends</TabsTrigger>
                  <TabsTrigger value="recommendations">Actions</TabsTrigger>
                  <TabsTrigger value="plan">Action Plan</TabsTrigger>
                </TabsList>

                <TabsContent value="security" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.securityComparison.map((tenant, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{tenant.tenantName}</span>
                              </div>
                              <Badge className={getSeverityColor(tenant.riskLevel)}>
                                {tenant.riskLevel} risk
                              </Badge>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3 mb-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Security Score</p>
                                <div className="flex items-center gap-2">
                                  <Progress value={tenant.securityScore} className="flex-1 h-2" />
                                  <span className="text-sm font-medium">{tenant.securityScore}</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">MFA Adoption</p>
                                <div className="flex items-center gap-2">
                                  <Progress value={tenant.mfaAdoption} className="flex-1 h-2" />
                                  <span className="text-sm font-medium">{tenant.mfaAdoption}%</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">CA Policies</p>
                                <p className="text-sm font-medium">{tenant.conditionalAccessPolicies}</p>
                              </div>
                            </div>
                            {tenant.topIssues.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tenant.topIssues.map((issue, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {issue}
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

                <TabsContent value="issues" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.commonIssues.map((issue, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{issue.issue}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {issue.recommendation}
                                </p>
                              </div>
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <span className="text-muted-foreground">
                                Affected: <strong>{issue.affectedTenants}</strong> tenants ({issue.percentageAffected}%)
                              </span>
                              <span className="text-muted-foreground">
                                Effort: <strong>{issue.estimatedEffort}</strong>
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="drift" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.configurationDrift.map((drift, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{drift.configArea}</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Consistency:</span>
                                <Progress value={drift.consistencyScore} className="w-20 h-2" />
                                <span className="text-sm font-medium">{drift.consistencyScore}%</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Recommended:</strong> {drift.recommendedStandard}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Variations: {drift.variations}</span>
                              {drift.tenantsNeedingUpdate.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {drift.tenantsNeedingUpdate.slice(0, 3).map((tenant, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {tenant}
                                    </Badge>
                                  ))}
                                  {drift.tenantsNeedingUpdate.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{drift.tenantsNeedingUpdate.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="licenses" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold">{analysis.licenseInsights.totalLicenses.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Total Licenses</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold">{analysis.licenseInsights.totalAssigned.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Assigned</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold">{analysis.licenseInsights.utilizationRate}%</p>
                            <p className="text-xs text-muted-foreground">Utilization</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold text-red-600">{analysis.licenseInsights.estimatedWaste}</p>
                            <p className="text-xs text-muted-foreground">Est. Waste</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Optimization Opportunities</h4>
                        {analysis.licenseInsights.optimizationOpportunities.map((opp, index) => (
                          <Card key={index}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{opp.tenant}</p>
                                  <p className="text-sm text-muted-foreground">{opp.issue}</p>
                                </div>
                                <Badge className="bg-green-100 text-green-700">
                                  Save {opp.potentialSavings}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="trends" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-3 md:grid-cols-2">
                      {analysis.trends.map((trend, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{trend.metric}</h4>
                              <div className="flex items-center gap-1">
                                {getTrendIcon(trend.trend)}
                                <span className="text-sm capitalize">{trend.trend}</span>
                              </div>
                            </div>
                            <p className="text-sm text-primary font-medium">{trend.change}</p>
                            <p className="text-sm text-muted-foreground mt-1">{trend.insight}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Best Practice Adoption</h4>
                      <div className="space-y-3">
                        {analysis.bestPracticeAdoption.map((practice, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{practice.practice}</span>
                                <span className="text-sm">{practice.adoptionRate}% adoption</span>
                              </div>
                              <Progress value={practice.adoptionRate} className="h-2 mb-2" />
                              <div className="flex gap-4 text-xs">
                                <span className="text-green-600">
                                  Leaders: {practice.leaders.join(', ')}
                                </span>
                                <span className="text-orange-600">
                                  Laggards: {practice.laggards.join(', ')}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="recommendations" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.recommendations.map((rec, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getSeverityColor(rec.priority)}>
                                    {rec.priority}
                                  </Badge>
                                  <Badge variant="outline">{rec.category}</Badge>
                                </div>
                                <h4 className="font-medium">{rec.recommendation}</h4>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{rec.impact}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Affects {rec.affectedTenants} tenants</span>
                              <span>Effort: {rec.estimatedEffort}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="plan" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {analysis.actionPlan.map((phase, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Calendar className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-sm">Week {phase.week}: {phase.focus}</CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Actions:</p>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                  {phase.actions.map((action, i) => (
                                    <li key={i}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-sm">
                                  <strong>Expected Outcome:</strong> {phase.expectedOutcome}
                                </p>
                              </div>
                            </div>
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
