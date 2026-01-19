import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Shield, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingUp,
  Zap,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { runAIAnalysis, getRecentAnalyses, AIAnalysisResult } from '@/lib/aiApi';
import { AIChat } from './AIChat';
import { cn } from '@/lib/utils';

export function TenantAnalyzer() {
  const { toast } = useToast();
  const { selectedTenantId, tenants, isConnected } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<string>('tenant-health');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AIAnalysisResult[]>([]);

  const analysisTypes = [
    { id: 'tenant-health', name: 'Tenant Health', icon: BarChart3, description: 'Overall health assessment' },
    { id: 'compliance', name: 'Compliance Check', icon: FileCheck, description: 'Framework compliance' },
    { id: 'risk-score', name: 'Risk Assessment', icon: Shield, description: 'Security risk analysis' },
    { id: 'cost-forecast', name: 'Cost Analysis', icon: TrendingUp, description: 'Licensing & costs' },
  ];

  const runAnalysis = async () => {
    if (!selectedTenantId) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select a tenant to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    const result = await runAIAnalysis({
      analysisType: analysisType as 'tenant-health' | 'compliance' | 'risk-score' | 'cost-forecast',
      tenantConnectionId: selectedTenantId,
    });

    setIsAnalyzing(false);

    if (result.success && result.result) {
      setAnalysisResult(result.result);
      toast({
        title: 'Analysis Complete',
        description: 'AI analysis has been completed successfully',
      });

      // Refresh recent analyses
      const analyses = await getRecentAnalyses({ tenantConnectionId: selectedTenantId });
      setRecentAnalyses(analyses);
    } else {
      toast({
        title: 'Analysis Failed',
        description: result.error || 'Failed to run analysis',
        variant: 'destructive',
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    if (score >= 40) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  const renderHealthResult = (result: Record<string, unknown>) => {
    const overallScore = result.overallScore as number || 0;
    const categories = result.categories as Record<string, { score: number; issues: string[]; recommendations: string[] }> || {};
    const criticalIssues = result.criticalIssues as string[] || [];
    const quickWins = result.quickWins as string[] || [];
    const summary = result.summary as string || '';

    return (
      <div className="space-y-6">
        {/* Overall Score */}
        <div className="text-center py-6">
          <div className={cn(
            "inline-flex items-center justify-center w-32 h-32 rounded-full",
            getScoreBg(overallScore)
          )}>
            <span className={cn("text-4xl font-bold", getScoreColor(overallScore))}>
              {overallScore}
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">Overall Health Score</p>
        </div>

        {/* Summary */}
        {summary && (
          <Card className="glass-panel border-border/50">
            <CardContent className="pt-4">
              <p className="text-sm text-foreground">{summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Category Scores */}
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(categories).map(([key, value]) => (
            <Card key={key} className="glass-panel border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm capitalize">{key}</CardTitle>
                  <span className={cn("font-bold", getScoreColor(value.score))}>
                    {value.score}%
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={value.score} className="h-2 mb-3" />
                {value.issues.length > 0 && (
                  <div className="space-y-1">
                    {value.issues.slice(0, 3).map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Critical Issues */}
        {criticalIssues.length > 0 && (
          <Card className="glass-panel border-red-500/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Critical Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {criticalIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Quick Wins */}
        {quickWins.length > 0 && (
          <Card className="glass-panel border-green-500/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-green-400">
                <Zap className="w-4 h-4" />
                Quick Wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {quickWins.map((win, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {win}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderRiskResult = (result: Record<string, unknown>) => {
    const overallRisk = result.overallRisk as number || 0;
    const riskLevel = result.riskLevel as string || 'unknown';
    const categoryScores = result.categoryScores as Record<string, number> || {};
    const riskFactors = result.riskFactors as Array<{ factor: string; severity: string; impact: string }> || [];
    const mitigations = result.mitigations as Array<{ action: string; priority: number; effort: string }> || [];

    const riskColors: Record<string, string> = {
      critical: 'text-red-500 bg-red-500/20',
      high: 'text-orange-500 bg-orange-500/20',
      medium: 'text-yellow-500 bg-yellow-500/20',
      low: 'text-green-500 bg-green-500/20',
    };

    return (
      <div className="space-y-6">
        {/* Risk Score */}
        <div className="text-center py-6">
          <div className={cn(
            "inline-flex flex-col items-center justify-center w-32 h-32 rounded-full",
            riskColors[riskLevel]?.split(' ')[1] || 'bg-muted'
          )}>
            <span className={cn("text-4xl font-bold", riskColors[riskLevel]?.split(' ')[0])}>
              {overallRisk}
            </span>
            <Badge className={cn("mt-1", riskColors[riskLevel])}>
              {riskLevel.toUpperCase()}
            </Badge>
          </div>
          <p className="mt-2 text-muted-foreground">Risk Score (lower is better)</p>
        </div>

        {/* Category Scores */}
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(categoryScores).map(([key, value]) => (
            <Card key={key} className="glass-panel border-border/50 text-center p-4">
              <p className="text-xs text-muted-foreground capitalize mb-1">{key}</p>
              <p className={cn("text-2xl font-bold", getScoreColor(100 - value))}>{value}</p>
            </Card>
          ))}
        </div>

        {/* Risk Factors */}
        {riskFactors.length > 0 && (
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Risk Factors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {riskFactors.map((factor, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{factor.factor}</p>
                      <p className="text-xs text-muted-foreground mt-1">{factor.impact}</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      factor.severity === 'high' ? 'border-red-500 text-red-500' :
                      factor.severity === 'medium' ? 'border-yellow-500 text-yellow-500' :
                      'border-green-500 text-green-500'
                    )}>
                      {factor.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mitigations */}
        {mitigations.length > 0 && (
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Recommended Mitigations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mitigations.slice(0, 5).map((mitigation, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                        {mitigation.priority}
                      </span>
                      <span className="text-sm text-foreground">{mitigation.action}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {mitigation.effort} effort
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            AI Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4">
          {/* Analysis Controls */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Tenant Analysis
              </CardTitle>
              <CardDescription>
                Run AI-powered analysis on {selectedTenant?.displayName || 'your tenant'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {analysisTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.id}
                      variant={analysisType === type.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAnalysisType(type.id)}
                      className="flex items-center gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {type.name}
                    </Button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={runAnalysis} 
                  disabled={isAnalyzing || !isConnected}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Run {analysisTypes.find(t => t.id === analysisType)?.name}
                    </>
                  )}
                </Button>
              </div>

              {!isConnected && (
                <p className="text-sm text-muted-foreground mt-2">
                  Connect to a tenant to run analysis
                </p>
              )}
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {analysisTypes.find(t => t.id === analysisType)?.icon && (
                        <span className="text-primary">
                          {(() => {
                            const Icon = analysisTypes.find(t => t.id === analysisType)?.icon;
                            return Icon ? <Icon className="w-5 h-5" /> : null;
                          })()}
                        </span>
                      )}
                      Analysis Results
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={runAnalysis}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-run
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[600px]">
                    {analysisType === 'tenant-health' && renderHealthResult(analysisResult)}
                    {analysisType === 'risk-score' && renderRiskResult(analysisResult)}
                    {(analysisType === 'compliance' || analysisType === 'cost-forecast') && (
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {JSON.stringify(analysisResult, null, 2)}
                      </pre>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          <Card className="glass-panel border-border/50 h-[600px]">
            <AIChat
              featureType="tenant-analyzer"
              title="Tenant Analysis Chat"
              placeholder="Ask me to analyze specific aspects of your tenant..."
              className="h-full"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
