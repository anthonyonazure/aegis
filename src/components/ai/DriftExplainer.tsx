import { useState } from 'react';
import { 
  GitCompare, 
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Shield,
  Users,
  FileText,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  Edit3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DriftChange {
  id: string;
  resourceType: string;
  resourceName: string;
  changeType: 'added' | 'modified' | 'removed';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  technicalDescription: string;
  plainEnglish: string;
  securityImpact: string;
  complianceImpact: string;
  affectedUsers: string;
  recommendation: string;
  beforeValue?: string;
  afterValue?: string;
}

interface ActionItem {
  priority: 'immediate' | 'soon' | 'when-possible';
  action: string;
  reason: string;
}

interface DriftExplanation {
  summary: {
    totalChanges: number;
    criticalChanges: number;
    warningChanges: number;
    infoChanges: number;
    overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'none';
    tldr: string;
  };
  changes: DriftChange[];
  patterns?: Array<{
    pattern: string;
    significance: string;
    relatedChanges: string[];
  }>;
  executiveSummary: string;
  technicalSummary: string;
  actionItems: ActionItem[];
  riskScore: number;
  complianceRisk?: {
    frameworks: string[];
    concerns: string[];
  };
}

// Sample drift data for demo
const sampleDriftData = {
  changes: [
    {
      resourceType: 'conditionalAccessPolicy',
      resourceName: 'Require MFA for Admins',
      before: { state: 'enabled', conditions: { users: { includeRoles: ['Global Administrator'] } } },
      after: { state: 'disabled', conditions: { users: { includeRoles: ['Global Administrator'] } } }
    },
    {
      resourceType: 'deviceCompliancePolicy',
      resourceName: 'Windows Security Baseline',
      before: { bitLockerEnabled: true, minimumOsVersion: '10.0.19041' },
      after: { bitLockerEnabled: false, minimumOsVersion: '10.0.18363' }
    },
    {
      resourceType: 'group',
      resourceName: 'External Contractors',
      before: null,
      after: { membershipType: 'dynamic', members: 45 }
    }
  ]
};

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface DriftExplainerProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function DriftExplainer({ selectedTenants }: DriftExplainerProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DriftExplanation | null>(null);

  const analyzeDrift = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-drift-explainer', {
        body: { driftData: sampleDriftData }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast({
        title: 'Analysis Complete',
        description: `Found ${data.summary?.totalChanges || 0} configuration changes`,
      });
    } catch (error) {
      console.error('Drift analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze drift',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'low': return <Info className="w-4 h-4 text-blue-400" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added': return <Plus className="w-4 h-4 text-green-400" />;
      case 'removed': return <Minus className="w-4 h-4 text-red-400" />;
      default: return <Edit3 className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return 'bg-red-500/20 text-red-400';
      case 'soon': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <GitCompare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Drift Explainer</h2>
            <p className="text-muted-foreground">Understand configuration drift in plain English</p>
          </div>
        </div>
        <Button onClick={analyzeDrift} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Explain Drift
            </>
          )}
        </Button>
      </div>

      {!result && !isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompare className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Click "Explain Drift" to analyze recent configuration changes and get plain-English explanations
            </p>
            <Button onClick={analyzeDrift} size="lg">
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
            <p className="text-muted-foreground">Analyzing configuration drift...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Total Changes</p>
                <p className="text-2xl font-bold">{result.summary.totalChanges}</p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-red-500/20 border">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-400">{result.summary.criticalChanges}</p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-yellow-500/20 border">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-400">{result.summary.warningChanges}</p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-blue-500/20 border">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-400">{result.summary.infoChanges}</p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <p className="text-2xl font-bold">{result.riskScore}/100</p>
                <Progress value={result.riskScore} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          {/* TL;DR */}
          <Card className="glass-panel border-primary/30 border">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">TL;DR</p>
                  <p className="text-sm font-medium">{result.summary.tldr}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="changes" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="executive">Executive Summary</TabsTrigger>
              <TabsTrigger value="technical">Technical Details</TabsTrigger>
              <TabsTrigger value="actions">Action Items</TabsTrigger>
            </TabsList>

            <TabsContent value="changes">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Configuration Changes</CardTitle>
                  <CardDescription>Plain-English explanations of what changed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {result.changes?.map((change, i) => (
                        <div key={change.id || i} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getChangeIcon(change.changeType)}
                              <div>
                                <p className="font-medium text-sm">{change.resourceName}</p>
                                <p className="text-xs text-muted-foreground">{change.resourceType}</p>
                              </div>
                            </div>
                            <Badge className={getSeverityColor(change.severity)}>
                              {change.severity}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-primary/10">
                              <p className="text-xs text-muted-foreground mb-1">What This Means</p>
                              <p className="text-sm">{change.plainEnglish}</p>
                            </div>

                            {change.beforeValue && change.afterValue && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 rounded bg-red-500/10">
                                  <p className="text-xs text-red-400 mb-1">Before</p>
                                  <p className="text-xs font-mono">{change.beforeValue}</p>
                                </div>
                                <div className="p-2 rounded bg-green-500/10">
                                  <p className="text-xs text-green-400 mb-1">After</p>
                                  <p className="text-xs font-mono">{change.afterValue}</p>
                                </div>
                              </div>
                            )}

                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="flex items-start gap-2 text-xs">
                                <Shield className="w-3 h-3 text-orange-400 mt-0.5" />
                                <div>
                                  <span className="text-muted-foreground">Security: </span>
                                  {change.securityImpact}
                                </div>
                              </div>
                              <div className="flex items-start gap-2 text-xs">
                                <Users className="w-3 h-3 text-blue-400 mt-0.5" />
                                <div>
                                  <span className="text-muted-foreground">Affected: </span>
                                  {change.affectedUsers}
                                </div>
                              </div>
                            </div>

                            {change.recommendation && (
                              <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Recommendation: </span>
                                  {change.recommendation}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )) || <p className="text-muted-foreground">No changes to display</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="executive">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Executive Summary
                  </CardTitle>
                  <CardDescription>Non-technical overview for stakeholders</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm whitespace-pre-wrap">{result.executiveSummary}</p>
                  </div>

                  {result.complianceRisk && result.complianceRisk.frameworks?.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <p className="text-sm font-medium text-orange-400 mb-2">Compliance Considerations</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {result.complianceRisk.frameworks.map((fw, i) => (
                          <Badge key={i} variant="outline" className="border-orange-500/30 text-orange-400">
                            {fw}
                          </Badge>
                        ))}
                      </div>
                      <ul className="text-xs space-y-1 text-orange-300/80">
                        {result.complianceRisk.concerns?.map((concern, i) => (
                          <li key={i}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="technical">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Technical Summary</CardTitle>
                  <CardDescription>Detailed technical analysis for IT admins</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap font-mono">{result.technicalSummary}</p>
                  </div>

                  {result.patterns && result.patterns.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm font-medium mb-3">Detected Patterns</p>
                      <div className="space-y-3">
                        {result.patterns.map((pattern, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                            <p className="text-sm font-medium">{pattern.pattern}</p>
                            <p className="text-xs text-muted-foreground mt-1">{pattern.significance}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Action Items</CardTitle>
                  <CardDescription>Prioritized list of recommended actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.actionItems?.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-border/50">
                        <Badge className={getPriorityColor(item.priority)}>
                          {item.priority}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )) || <p className="text-muted-foreground">No action items</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
