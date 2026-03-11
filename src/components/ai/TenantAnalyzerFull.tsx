import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Shield,
  DollarSign,
  Users,
  MessageSquare,
  FileCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TenantAnalysis {
  summary: {
    overallHealthScore: number;
    healthGrade: string;
    executiveSummary: string;
    keyFindings: string[];
    criticalIssues: number;
    warnings: number;
    optimizations: number;
  };
  securityAnalysis: {
    score: number;
    findings: Array<{
      category: string;
      finding: string;
      severity: string;
      recommendation: string;
      impact: string;
    }>;
    strengths: string[];
    gaps: string[];
  };
  licensingAnalysis: {
    score: number;
    totalCost: number;
    potentialSavings: number;
    utilizationRate: number;
    findings: Array<{
      issue: string;
      recommendation: string;
      estimatedSavings: number;
    }>;
    optimizations: string[];
  };
  identityAnalysis: {
    score: number;
    userCount: number;
    adminCount: number;
    guestCount: number;
    mfaCoverage: number;
    findings: Array<{
      issue: string;
      severity: string;
      recommendation: string;
    }>;
  };
  collaborationAnalysis: {
    score: number;
    teamsAdoption: number;
    sharePointUsage: number;
    exchangeHealth: number;
    findings: string[];
    recommendations: string[];
  };
  complianceAnalysis: {
    score: number;
    frameworks: string[];
    gaps: Array<{
      framework: string;
      requirement: string;
      gap: string;
      remediation: string;
    }>;
    strengths: string[];
  };
  performanceAnalysis: {
    score: number;
    bottlenecks: string[];
    optimizations: Array<{
      area: string;
      issue: string;
      recommendation: string;
      expectedImprovement: string;
    }>;
  };
  prioritizedActions: Array<{
    priority: number;
    action: string;
    category: string;
    effort: string;
    impact: string;
    timeline: string;
    estimatedCost: string;
  }>;
  trendAnalysis: {
    securityTrend: string;
    costTrend: string;
    adoptionTrend: string;
    projections: string[];
  };
  benchmarks: {
    industryComparison: string;
    percentile: number;
    comparisonNotes: string[];
  };
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface TenantAnalyzerFullProps {
  selectedTenants?: SelectedTenantInfo[];
}

export const TenantAnalyzerFull = ({ selectedTenants }: TenantAnalyzerFullProps) => {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<TenantAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState('comprehensive');
  const [expandedSections, setExpandedSections] = useState<string[]>(['security']);

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const tenantData = {
        users: { total: 500, admins: 15, guests: 50, mfaEnabled: 460 },
        licenses: { 
          E5: { total: 100, assigned: 85 },
          E3: { total: 300, assigned: 280 },
          E1: { total: 150, assigned: 120 }
        },
        security: {
          secureScore: 72,
          conditionalAccessPolicies: 12,
          dlpPolicies: 8,
          mfaEnforced: true,
          legacyAuthBlocked: false
        },
        collaboration: {
          teamsChannels: 250,
          sharePointSites: 85,
          oneDriveUsage: 92
        },
        compliance: {
          auditLogEnabled: true,
          retentionPolicies: 3,
          sensitivityLabels: 5
        }
      };

      const { data, error } = await supabase.functions.invoke('ai-tenant-analyzer', {
        body: { tenantData, analysisType }
      });

      if (error) throw error;

      setAnalysis(data);
      toast({
        title: 'Analysis Complete',
        description: `Tenant health score: ${data.summary?.overallHealthScore}%`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze tenant',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A': 'text-green-400',
      'B': 'text-blue-400',
      'C': 'text-yellow-400',
      'D': 'text-orange-400',
      'F': 'text-red-400'
    };
    return colors[grade] || 'text-muted-foreground';
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-blue-500/20 text-blue-400'
    };
    return colors[severity] || 'bg-muted text-muted-foreground';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
      case 'growing':
      case 'decreasing':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining':
      case 'increasing':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const ScoreCard = ({ title, score, icon: Icon }: { title: string; score: number; icon: React.ElementType }) => (
    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="text-2xl font-bold text-foreground mb-1">{score}%</div>
      <Progress value={score} className="h-1.5" />
    </div>
  );

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>AI Tenant Analyzer</CardTitle>
              <CardDescription>
                Comprehensive M365 tenant configuration analysis
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="security">Security Focus</SelectItem>
                <SelectItem value="cost">Cost Focus</SelectItem>
                <SelectItem value="compliance">Compliance Focus</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runAnalysis} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {analysis ? 'Re-analyze' : 'Analyze Tenant'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!analysis && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ready to analyze your tenant?</p>
            <p className="text-sm">Get comprehensive insights into your M365 configuration</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing tenant configuration...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </div>
        )}

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Header */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Tenant Health Overview</h3>
                  <p className="text-sm text-muted-foreground">{analysis.summary.executiveSummary}</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-foreground">{analysis.summary.overallHealthScore}%</div>
                  <div className={cn("text-2xl font-bold", getGradeColor(analysis.summary.healthGrade))}>
                    Grade: {analysis.summary.healthGrade}
                  </div>
                </div>
              </div>
              <Progress value={analysis.summary.overallHealthScore} className="h-3 mb-4" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <div className="text-2xl font-bold text-red-400">{analysis.summary.criticalIssues}</div>
                  <div className="text-xs text-muted-foreground">Critical Issues</div>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <div className="text-2xl font-bold text-yellow-400">{analysis.summary.warnings}</div>
                  <div className="text-xs text-muted-foreground">Warnings</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <div className="text-2xl font-bold text-green-400">{analysis.summary.optimizations}</div>
                  <div className="text-xs text-muted-foreground">Optimizations</div>
                </div>
              </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreCard title="Security" score={analysis.securityAnalysis.score} icon={Shield} />
              <ScoreCard title="Licensing" score={analysis.licensingAnalysis.score} icon={DollarSign} />
              <ScoreCard title="Identity" score={analysis.identityAnalysis.score} icon={Users} />
              <ScoreCard title="Collaboration" score={analysis.collaborationAnalysis.score} icon={MessageSquare} />
            </div>

            <Tabs defaultValue="actions" className="w-full">
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="licensing">Licensing</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="mt-4 space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Prioritized Actions
                </h4>
                {analysis.prioritizedActions.map((action, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {action.priority}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{action.action}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline">{action.category}</Badge>
                            <Badge className={action.effort === 'low' ? 'bg-green-500/20 text-green-400' : action.effort === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                              {action.effort} effort
                            </Badge>
                            <Badge className={action.impact === 'high' ? 'bg-green-500/20 text-green-400' : action.impact === 'low' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}>
                              {action.impact} impact
                            </Badge>
                            <span className="text-xs text-muted-foreground">{action.estimatedCost}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{action.timeline}</span>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="security" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Security Analysis
                  </h4>
                  <Badge variant="outline">{analysis.securityAnalysis.score}% Score</Badge>
                </div>
                
                <div className="space-y-3">
                  {analysis.securityAnalysis.findings.map((finding, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{finding.category}</Badge>
                          <Badge className={getSeverityBadge(finding.severity)}>{finding.severity}</Badge>
                        </div>
                      </div>
                      <p className="font-medium text-foreground mb-1">{finding.finding}</p>
                      <p className="text-sm text-muted-foreground mb-2">{finding.recommendation}</p>
                      <p className="text-xs text-green-400">Impact: {finding.impact}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <h5 className="font-medium text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Strengths
                    </h5>
                    <ul className="space-y-1">
                      {analysis.securityAnalysis.strengths.map((strength, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <h5 className="font-medium text-red-400 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Gaps
                    </h5>
                    <ul className="space-y-1">
                      {analysis.securityAnalysis.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {gap}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="licensing" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-foreground">${analysis.licensingAnalysis.totalCost.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Monthly Cost</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <div className="text-2xl font-bold text-green-400">${analysis.licensingAnalysis.potentialSavings.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Potential Savings</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-foreground">{analysis.licensingAnalysis.utilizationRate}%</div>
                    <div className="text-xs text-muted-foreground">Utilization Rate</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.licensingAnalysis.findings.map((finding, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{finding.issue}</p>
                          <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
                        </div>
                        <Badge className="bg-green-500/20 text-green-400">
                          Save ${finding.estimatedSavings.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="identity" className="mt-4 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-foreground">{analysis.identityAnalysis.userCount}</div>
                    <div className="text-xs text-muted-foreground">Total Users</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-orange-400">{analysis.identityAnalysis.adminCount}</div>
                    <div className="text-xs text-muted-foreground">Admins</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-blue-400">{analysis.identityAnalysis.guestCount}</div>
                    <div className="text-xs text-muted-foreground">Guests</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-2xl font-bold text-green-400">{analysis.identityAnalysis.mfaCoverage}%</div>
                    <div className="text-xs text-muted-foreground">MFA Coverage</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.identityAnalysis.findings.map((finding, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={getSeverityBadge(finding.severity)}>{finding.severity}</Badge>
                      </div>
                      <p className="font-medium text-foreground">{finding.issue}</p>
                      <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="mt-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className="text-sm text-muted-foreground">Frameworks:</span>
                  {analysis.complianceAnalysis.frameworks.map((framework, i) => (
                    <Badge key={i} variant="outline">{framework}</Badge>
                  ))}
                </div>

                <div className="space-y-3">
                  {analysis.complianceAnalysis.gaps.map((gap, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{gap.framework}</Badge>
                        <span className="text-sm font-medium text-foreground">{gap.requirement}</span>
                      </div>
                      <p className="text-sm text-red-400 mb-1">Gap: {gap.gap}</p>
                      <p className="text-sm text-green-400">Remediation: {gap.remediation}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="trends" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Security Trend</span>
                      {getTrendIcon(analysis.trendAnalysis.securityTrend)}
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">{analysis.trendAnalysis.securityTrend}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Cost Trend</span>
                      {getTrendIcon(analysis.trendAnalysis.costTrend)}
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">{analysis.trendAnalysis.costTrend}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Adoption Trend</span>
                      {getTrendIcon(analysis.trendAnalysis.adoptionTrend)}
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">{analysis.trendAnalysis.adoptionTrend}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <h5 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Industry Benchmark
                  </h5>
                  <div className="flex items-center gap-4 mb-3">
                    <Badge className={
                      analysis.benchmarks.industryComparison === 'above' ? 'bg-green-500/20 text-green-400' :
                      analysis.benchmarks.industryComparison === 'below' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }>
                      {analysis.benchmarks.industryComparison} average
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {analysis.benchmarks.percentile}th percentile
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.benchmarks.comparisonNotes.map((note, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {note}</li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
