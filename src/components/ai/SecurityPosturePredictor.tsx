import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Loader2,
  Shield,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  Eye,
  Sparkles,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

interface Prediction {
  id: string;
  timeframe: '7-day' | '30-day' | '90-day';
  category: string;
  prediction: string;
  probability: number;
  potentialImpact: 'critical' | 'high' | 'medium' | 'low';
  indicators: string[];
  preventiveActions: string[];
  monitoringPoints: string[];
}

interface RiskTrajectoryPoint {
  predictedScore: number;
  confidence: number;
  mainFactors: string[];
}

interface EmergingThreat {
  threat: string;
  relevance: 'high' | 'medium' | 'low';
  timeToImpact: string;
  preparationSteps: string[];
}

interface VulnerabilityForecast {
  area: string;
  currentExposure: string;
  predictedExposure: string;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  recommendation: string;
}

interface PrioritizedAction {
  priority: number;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  deadline: string;
}

interface SecurityPrediction {
  currentPosture: {
    overallScore: number;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    trend: 'improving' | 'stable' | 'declining';
    confidenceLevel: number;
  };
  predictions: Prediction[];
  riskTrajectory?: {
    next7Days: RiskTrajectoryPoint;
    next30Days: RiskTrajectoryPoint;
    next90Days: RiskTrajectoryPoint;
  };
  emergingThreats?: EmergingThreat[];
  vulnerabilityForecast?: VulnerabilityForecast[];
  attackSurfaceAnalysis?: {
    currentSurface: string;
    projectedChange: string;
    hotspots: string[];
    recommendations: string[];
  };
  prioritizedActions?: PrioritizedAction[];
}

export function SecurityPosturePredictor() {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<SecurityPrediction | null>(null);

  // Load last analysis on mount
  useEffect(() => {
    const loadLastAnalysis = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('security-predictor');
        if (lastAnalysis?.result) {
          setResult(lastAnalysis.result as unknown as SecurityPrediction);
        }
      } catch (error) {
        console.error('Failed to load last analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastAnalysis();
  }, []);

  const analyzeAndPredict = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-security-predictor', {
        body: {}
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      
      // Save to database for persistence
      await saveAnalysisResult({
        analysisType: 'security-predictor',
        result: data,
        score: data.currentPosture?.overallScore,
      });

      toast({
        title: 'Prediction Complete',
        description: 'Security posture forecast is ready',
      });
    } catch (error) {
      console.error('Prediction error:', error);
      toast({
        title: 'Prediction Failed',
        description: error instanceof Error ? error.message : 'Failed to predict security posture',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Activity className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Security Posture Predictor</h2>
            <p className="text-muted-foreground">AI-powered security risk forecasting</p>
          </div>
        </div>
        <Button onClick={analyzeAndPredict} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Predict Risks
            </>
          )}
        </Button>
      </div>

      {!result && !isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Eye className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Predict</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Click "Predict Risks" to analyze security trends and forecast future posture
            </p>
            <Button onClick={analyzeAndPredict} size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Start Prediction
            </Button>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing security trends and predicting risks...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Current Posture Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Security Score</p>
                    <p className="text-3xl font-bold">{result.currentPosture.overallScore}</p>
                  </div>
                  <div className="w-16 h-16 relative">
                    <svg className="w-16 h-16 -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none"
                        strokeDasharray={`${(result.currentPosture.overallScore / 100) * 176} 176`}
                        className="text-primary" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Risk Level</p>
                <Badge className={`${getRiskColor(result.currentPosture.riskLevel)} text-lg px-3 py-1`}>
                  {result.currentPosture.riskLevel.toUpperCase()}
                </Badge>
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Trend</p>
                <div className="flex items-center gap-2">
                  {getTrendIcon(result.currentPosture.trend)}
                  <span className="text-lg font-medium capitalize">{result.currentPosture.trend}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Confidence</p>
                <p className="text-2xl font-bold">{result.currentPosture.confidenceLevel}%</p>
                <Progress value={result.currentPosture.confidenceLevel} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          {/* Risk Trajectory */}
          {result.riskTrajectory && (
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Risk Trajectory Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: 'Next 7 Days', data: result.riskTrajectory.next7Days },
                    { label: 'Next 30 Days', data: result.riskTrajectory.next30Days },
                    { label: 'Next 90 Days', data: result.riskTrajectory.next90Days }
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">{item.label}</span>
                        <Badge variant="outline">{item.data.confidence}% conf.</Badge>
                      </div>
                      <p className="text-3xl font-bold mb-2">{item.data.predictedScore}</p>
                      <div className="space-y-1">
                        {item.data.mainFactors?.slice(0, 2).map((factor, j) => (
                          <p key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                            <ChevronRight className="w-3 h-3 mt-0.5" />
                            {factor}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="predictions" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
              <TabsTrigger value="threats">Emerging Threats</TabsTrigger>
              <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
              <TabsTrigger value="actions">Priority Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="predictions">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Risk Predictions</CardTitle>
                  <CardDescription>AI-forecasted security events</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {result.predictions?.map((pred, i) => (
                        <div key={pred.id || i} className="p-4 rounded-lg border border-border/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{pred.timeframe}</Badge>
                              <Badge variant="outline">{pred.category}</Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{pred.probability}% likely</p>
                              <Badge className={getRiskColor(pred.potentialImpact)}>
                                {pred.potentialImpact} impact
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-sm font-medium mb-3">{pred.prediction}</p>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="p-2 rounded bg-muted/30">
                              <p className="text-xs text-muted-foreground mb-1">Current Indicators</p>
                              <ul className="text-xs space-y-1">
                                {pred.indicators?.slice(0, 2).map((ind, j) => (
                                  <li key={j}>• {ind}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="p-2 rounded bg-green-500/10">
                              <p className="text-xs text-green-400 mb-1">Preventive Actions</p>
                              <ul className="text-xs space-y-1">
                                {pred.preventiveActions?.slice(0, 2).map((action, j) => (
                                  <li key={j} className="text-green-300/80">• {action}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )) || <p className="text-muted-foreground">No predictions available</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="threats">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    Emerging Threats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {result.emergingThreats?.map((threat, i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium flex-1">{threat.threat}</p>
                          <Badge className={getRiskColor(threat.relevance)}>
                            {threat.relevance} relevance
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Clock className="w-3 h-3" />
                          Time to impact: {threat.timeToImpact}
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Preparation Steps</p>
                          <ul className="text-xs space-y-1">
                            {threat.preparationSteps?.map((step, j) => (
                              <li key={j}>• {step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )) || <p className="text-muted-foreground">No emerging threats detected</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vulnerabilities">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Vulnerability Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.vulnerabilityForecast?.map((vuln, i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">{vuln.area}</span>
                          <div className="flex items-center gap-2">
                            <Badge className={getRiskColor(vuln.currentExposure)}>
                              {vuln.currentExposure}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            <Badge className={getRiskColor(vuln.predictedExposure)}>
                              {vuln.predictedExposure}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          {vuln.trendDirection === 'increasing' && <TrendingUp className="w-4 h-4 text-red-400" />}
                          {vuln.trendDirection === 'decreasing' && <TrendingDown className="w-4 h-4 text-green-400" />}
                          {vuln.trendDirection === 'stable' && <Activity className="w-4 h-4 text-yellow-400" />}
                          <span className="capitalize">{vuln.trendDirection}</span>
                        </div>
                        <p className="text-sm p-2 rounded bg-primary/10">{vuln.recommendation}</p>
                      </div>
                    )) || <p className="text-muted-foreground">No vulnerability forecasts</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Prioritized Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.prioritizedActions?.map((action, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                          {action.priority}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{action.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{action.impact}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className={getEffortColor(action.effort)}>
                              {action.effort} effort
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {action.deadline}
                            </span>
                          </div>
                        </div>
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                    )) || <p className="text-muted-foreground">No prioritized actions</p>}
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
