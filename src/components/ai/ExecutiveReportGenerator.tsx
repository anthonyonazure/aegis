import { useState } from 'react';
import { 
  FileText, 
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ReportMetric {
  name: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  benchmark?: string;
}

interface ReportSection {
  title: string;
  summary: string;
  metrics: ReportMetric[];
  insights: string[];
  recommendations: string[];
}

interface Risk {
  category: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface ComplianceFramework {
  name: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  score: number;
  gaps: string[];
}

interface ExecutiveReport {
  reportMetadata: {
    title: string;
    generatedAt: string;
    reportingPeriod: string;
    preparedFor?: string;
    confidentiality?: string;
  };
  executiveSummary: {
    overview: string;
    keyFindings: string[];
    overallHealthScore: number;
    trend: 'improving' | 'stable' | 'declining';
    criticalActions?: string[];
  };
  sections: ReportSection[];
  riskAssessment?: {
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    risks: Risk[];
  };
  complianceStatus?: {
    frameworks: ComplianceFramework[];
  };
  recommendations?: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface ExecutiveReportGeneratorProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function ExecutiveReportGenerator({ selectedTenants }: ExecutiveReportGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [reportType, setReportType] = useState('governance');
  const [audience, setAudience] = useState('executive');

  const effectiveTenantIds = selectedTenants?.map(t => t.id).filter(Boolean) || [];

  const generateReport = async () => {
    if (effectiveTenantIds.length === 0) {
      toast({
        title: 'No Tenants Selected',
        description: 'Please select at least one tenant for the report',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    setReport(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-executive-report', {
        body: { 
          reportType, 
          audience,
          tenantConnectionIds: effectiveTenantIds,
          tenantNames: selectedTenants?.map(t => t.name) || [],
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setReport(data);
      toast({
        title: 'Report Generated',
        description: 'Your executive report is ready for review',
      });
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-500/20 text-green-400';
      case 'partial': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Executive Report Generator</h2>
            <p className="text-muted-foreground">AI-powered governance reports for stakeholders</p>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Report Configuration</CardTitle>
          <CardDescription>Select report type and target audience</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="governance">Governance Overview</SelectItem>
                  <SelectItem value="security">Security Posture</SelectItem>
                  <SelectItem value="compliance">Compliance Status</SelectItem>
                  <SelectItem value="licensing">License Optimization</SelectItem>
                  <SelectItem value="quarterly">Quarterly Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Audience</label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive Leadership</SelectItem>
                  <SelectItem value="board">Board of Directors</SelectItem>
                  <SelectItem value="technical">IT Leadership</SelectItem>
                  <SelectItem value="compliance">Compliance Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isGenerating && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating your executive report...</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Report Header */}
          <Card className="glass-panel border-border/50">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">{report.reportMetadata.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.reportMetadata.reportingPeriod} • Generated {new Date(report.reportMetadata.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Health Score</p>
                    <p className="text-3xl font-bold">{report.executiveSummary.overallHealthScore}</p>
                  </div>
                  <div className="w-20 h-20 relative">
                    <svg className="w-20 h-20 -rotate-90">
                      <circle
                        cx="40" cy="40" r="36"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted/30"
                      />
                      <circle
                        cx="40" cy="40" r="36"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(report.executiveSummary.overallHealthScore / 100) * 226} 226`}
                        className="text-primary"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Executive Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm whitespace-pre-wrap">{report.executiveSummary.overview}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3">Key Findings</h4>
                    <div className="space-y-2">
                      {report.executiveSummary.keyFindings?.map((finding, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                          <Target className="w-4 h-4 text-primary mt-0.5" />
                          <p className="text-sm">{finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {report.executiveSummary.criticalActions && report.executiveSummary.criticalActions.length > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Critical Actions Required
                      </h4>
                      <ul className="space-y-1">
                        {report.executiveSummary.criticalActions.map((action, i) => (
                          <li key={i} className="text-sm text-red-300/80">• {action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics">
              <div className="space-y-4">
                {report.sections?.map((section, i) => (
                  <Card key={i} className="glass-panel border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        {section.metrics?.map((metric, j) => (
                          <div key={j} className="p-4 rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">{metric.name}</span>
                              {getTrendIcon(metric.trend)}
                            </div>
                            <p className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                              {metric.value}
                            </p>
                            {metric.benchmark && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Benchmark: {metric.benchmark}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {section.insights && section.insights.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Key Insights</p>
                          <div className="space-y-1">
                            {section.insights.map((insight, j) => (
                              <p key={j} className="text-sm flex items-start gap-2">
                                <BarChart3 className="w-3 h-3 text-primary mt-1" />
                                {insight}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="risks">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Assessment
                  </CardTitle>
                  {report.riskAssessment && (
                    <Badge className={getRiskColor(report.riskAssessment.overallRiskLevel)}>
                      Overall: {report.riskAssessment.overallRiskLevel.toUpperCase()}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4 pr-4">
                      {report.riskAssessment?.risks?.map((risk, i) => (
                        <div key={i} className="p-4 rounded-lg border border-border/50">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Badge variant="outline" className="mb-2">{risk.category}</Badge>
                              <p className="text-sm font-medium">{risk.description}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Likelihood: </span>
                              <Badge variant="outline" className={getRiskColor(risk.likelihood)}>
                                {risk.likelihood}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Impact: </span>
                              <Badge variant="outline" className={getRiskColor(risk.impact)}>
                                {risk.impact}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 p-2 rounded bg-muted/30">
                            <p className="text-xs text-muted-foreground">Mitigation:</p>
                            <p className="text-sm">{risk.mitigation}</p>
                          </div>
                        </div>
                      )) || <p className="text-muted-foreground">No risks identified</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {report.complianceStatus?.frameworks?.map((fw, i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-primary" />
                            <span className="font-medium">{fw.name}</span>
                          </div>
                          <Badge className={getComplianceColor(fw.status)}>
                            {fw.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                          <Progress value={fw.score} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{fw.score}%</span>
                        </div>
                        {fw.gaps && fw.gaps.length > 0 && (
                          <div className="p-2 rounded bg-orange-500/10">
                            <p className="text-xs text-orange-400 mb-1">Gaps to Address:</p>
                            <ul className="text-xs space-y-1">
                              {fw.gaps.map((gap, j) => (
                                <li key={j} className="text-orange-300/80">• {gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )) || <p className="text-muted-foreground">No compliance data available</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Recommended Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {report.recommendations?.immediate && report.recommendations.immediate.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-red-400">
                        <Clock className="w-4 h-4" />
                        Immediate (Next 7 Days)
                      </h4>
                      <div className="space-y-2">
                        {report.recommendations.immediate.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10">
                            <CheckCircle2 className="w-4 h-4 text-red-400 mt-0.5" />
                            <p className="text-sm">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.recommendations?.shortTerm && report.recommendations.shortTerm.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-yellow-400">
                        <Clock className="w-4 h-4" />
                        Short-Term (Next 30 Days)
                      </h4>
                      <div className="space-y-2">
                        {report.recommendations.shortTerm.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10">
                            <CheckCircle2 className="w-4 h-4 text-yellow-400 mt-0.5" />
                            <p className="text-sm">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.recommendations?.longTerm && report.recommendations.longTerm.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-400">
                        <Target className="w-4 h-4" />
                        Long-Term (Next Quarter)
                      </h4>
                      <div className="space-y-2">
                        {report.recommendations.longTerm.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10">
                            <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5" />
                            <p className="text-sm">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
