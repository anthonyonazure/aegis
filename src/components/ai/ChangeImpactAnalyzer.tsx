import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  GitCompare, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Users,
  Shield,
  Zap,
  Clock,
  ArrowRight,
  RotateCcw,
  TestTube,
  Sparkles,
  Loader2,
  FileWarning,
  Layers,
  Target,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface ChangeImpactAnalyzerProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function ChangeImpactAnalyzer({ selectedTenants }: ChangeImpactAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [proposedChanges, setProposedChanges] = useState('');
  const { connectionId, tenantName } = useTenant();

  const effectiveConnectionId = selectedTenants?.[0]?.id || connectionId;
  const effectiveTenantName = selectedTenants?.[0]?.name || tenantName;

  const runAnalysis = async () => {
    if (!proposedChanges.trim()) {
      toast.error('Please describe the proposed changes');
      return;
    }

    if (!effectiveConnectionId) {
      toast.error('Please select a tenant first');
      return;
    }

    setIsAnalyzing(true);
    try {
      let parsedChanges;
      try {
        parsedChanges = JSON.parse(proposedChanges);
      } catch {
        parsedChanges = { description: proposedChanges };
      }

      const { data, error } = await supabase.functions.invoke('ai-change-impact', {
        body: {
          proposedChanges: parsedChanges,
          currentConfig: {},
          tenantConnectionId: effectiveConnectionId,
          tenantData: { 
            tenantId: effectiveConnectionId,
            tenantName: effectiveTenantName 
          }
        }
      });

      if (error) throw error;
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        toast.success('Impact analysis completed');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Change impact error:', error);
      toast.error('Failed to analyze impact');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'border-green-500/30 bg-green-500/5';
      case 'negative': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-muted';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'proceed': return 'bg-green-500';
      case 'proceed_with_caution': return 'bg-yellow-500';
      case 'review_required': return 'bg-orange-500';
      case 'do_not_proceed': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const summary = analysis?.summary as Record<string, unknown> | undefined;
  const impactCategories = analysis?.impactCategories as Record<string, Record<string, unknown>> | undefined;
  const affectedResources = analysis?.affectedResources as Array<Record<string, unknown>> | undefined;
  const userImpactAnalysis = analysis?.userImpactAnalysis as Record<string, unknown> | undefined;
  const dependencyAnalysis = analysis?.dependencyAnalysis as Record<string, unknown> | undefined;
  const testingRecommendations = analysis?.testingRecommendations as Record<string, unknown> | undefined;
  const rollbackPlan = analysis?.rollbackPlan as Record<string, unknown> | undefined;
  const deploymentRecommendations = analysis?.deploymentRecommendations as Record<string, unknown> | undefined;
  const risks = analysis?.risks as Array<Record<string, unknown>> | undefined;
  const benefits = analysis?.benefits as Array<Record<string, unknown>> | undefined;

  if (!analysis) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <GitCompare className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            AI Change Impact Analyzer
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Predict the impact of configuration changes before deployment. Describe your proposed changes below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl mx-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">Proposed Changes</label>
            <Textarea
              value={proposedChanges}
              onChange={(e) => setProposedChanges(e.target.value)}
              placeholder="Describe your proposed changes in plain text or paste JSON configuration...

Example:
- Enable MFA for all users
- Create new Conditional Access policy requiring compliant devices
- Disable legacy authentication protocols
- Add new security group for external contractors"
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <div className="flex justify-center">
            <Button onClick={runAnalysis} disabled={isAnalyzing || !proposedChanges.trim()} size="lg" className="gap-2">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Impact...
                </>
              ) : (
                <>
                  <GitCompare className="h-4 w-4" />
                  Analyze Change Impact
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
        <Card className={`border-2 ${getRecommendationColor(summary?.recommendedAction as string).replace('bg-', 'border-')}`}>
          <CardHeader className="pb-2">
            <CardDescription>Recommendation</CardDescription>
            <CardTitle className="text-lg">
              <Badge className={getRecommendationColor(summary?.recommendedAction as string)}>
                {String(summary?.recommendedAction || 'unknown').replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Confidence: {Number(summary?.confidenceLevel) || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Risk</CardDescription>
            <CardTitle className="text-xl">
              <Badge variant={getRiskColor(summary?.overallRisk as string)}>
                {String(summary?.overallRisk || 'unknown').toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Rollback: {summary?.rollbackComplexity as string}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Affected Users</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {Number(summary?.affectedUsersCount) || 0}
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Users impacted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Est. Downtime</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {summary?.estimatedDowntime as string || 'None'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Expected disruption
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resources Affected</CardDescription>
            <CardTitle className="text-2xl">
              {affectedResources?.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Configuration items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="impact" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="impact" className="gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Impact</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-1">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Resources</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="testing" className="gap-1">
            <TestTube className="h-4 w-4" />
            <span className="hidden sm:inline">Testing</span>
          </TabsTrigger>
          <TabsTrigger value="rollback" className="gap-1">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Rollback</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1">
            <FileWarning className="h-4 w-4" />
            <span className="hidden sm:inline">Risks</span>
          </TabsTrigger>
        </TabsList>

        {/* Impact Categories */}
        <TabsContent value="impact" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {impactCategories && Object.entries(impactCategories).map(([key, category]) => (
              <Card key={key} className={getImpactColor(category.impact as string)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base capitalize flex items-center gap-2">
                      {key === 'security' && <Shield className="h-4 w-4" />}
                      {key === 'compliance' && <FileWarning className="h-4 w-4" />}
                      {key === 'userExperience' && <Users className="h-4 w-4" />}
                      {key === 'operations' && <Target className="h-4 w-4" />}
                      {key === 'performance' && <Zap className="h-4 w-4" />}
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </CardTitle>
                    {getImpactIcon(category.impact as string)}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{category.impact as string}</Badge>
                    <Badge variant={getRiskColor(category.severity as string)}>
                      {category.severity as string}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-1">Details:</p>
                    <ul className="space-y-1">
                      {(category.details as string[])?.map((d, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span>•</span>{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(category.mitigations as string[])?.length > 0 && (
                    <div className="border-t pt-2">
                      <p className="text-xs font-medium mb-1">Mitigations:</p>
                      <ul className="space-y-1">
                        {(category.mitigations as string[])?.map((m, i) => (
                          <li key={i} className="text-xs text-green-600 flex items-start gap-1">
                            <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />{m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Benefits */}
          {benefits && benefits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Expected Benefits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {benefits.map((b, i) => (
                    <div key={i} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{b.benefit as string}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{b.category as string}</Badge>
                        <span className="text-xs text-muted-foreground">{b.quantifiableImpact as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Affected Resources */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Affected Resources</CardTitle>
              <CardDescription>Resources that will be impacted by these changes</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {affectedResources?.map((resource, i) => (
                    <Card key={i} className={`border-l-4 ${
                      resource.riskLevel === 'critical' || resource.riskLevel === 'high' 
                        ? 'border-l-destructive' 
                        : resource.riskLevel === 'medium' 
                          ? 'border-l-yellow-500' 
                          : 'border-l-green-500'
                    }`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{resource.resourceName as string}</CardTitle>
                            <CardDescription>{resource.resourceType as string}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{resource.changeType as string}</Badge>
                            <Badge variant={getRiskColor(resource.riskLevel as string)}>
                              {resource.riskLevel as string} risk
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">{resource.impactDescription as string}</p>
                        {(resource.dependencies as string[])?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground">Dependencies:</span>
                            {(resource.dependencies as string[]).map((dep, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{dep}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Impact */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Directly Affected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-2">
                  {Number((userImpactAnalysis?.directlyAffected as Record<string, unknown>)?.count) || 0}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  {(userImpactAnalysis?.directlyAffected as Record<string, unknown>)?.impactType as string}
                </p>
                <div className="flex flex-wrap gap-1">
                  {((userImpactAnalysis?.directlyAffected as Record<string, unknown>)?.groups as string[])?.map((g, i) => (
                    <Badge key={i} variant="outline">{g}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Indirectly Affected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-2">
                  {Number((userImpactAnalysis?.indirectlyAffected as Record<string, unknown>)?.count) || 0}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  {(userImpactAnalysis?.indirectlyAffected as Record<string, unknown>)?.impactType as string}
                </p>
                <div className="flex flex-wrap gap-1">
                  {((userImpactAnalysis?.indirectlyAffected as Record<string, unknown>)?.groups as string[])?.map((g, i) => (
                    <Badge key={i} variant="outline">{g}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Communication & Training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Required Communications:</p>
                <ul className="space-y-1">
                  {(userImpactAnalysis?.requiredCommunication as string[])?.map((c, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              {userImpactAnalysis?.trainingNeeded && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Training Required
                  </p>
                  <ul className="space-y-1">
                    {(userImpactAnalysis?.trainingTopics as string[])?.map((t, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span>•</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing Recommendations */}
        <TabsContent value="testing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pre-Deployment Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(testingRecommendations?.preDeployment as Array<Record<string, unknown>>)?.map((test, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{test.test as string}</span>
                        <Badge variant={test.priority === 'required' ? 'destructive' : test.priority === 'recommended' ? 'secondary' : 'outline'}>
                          {test.priority as string}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{test.description as string}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Post-Deployment Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(testingRecommendations?.postDeployment as Array<Record<string, unknown>>)?.map((test, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{test.test as string}</span>
                        <Badge variant={test.priority === 'required' ? 'destructive' : test.priority === 'recommended' ? 'secondary' : 'outline'}>
                          {test.priority as string}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{test.description as string}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {testingRecommendations?.pilotGroupSuggestion && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pilot Group Suggestion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{testingRecommendations.pilotGroupSuggestion as string}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rollback Plan */}
        <TabsContent value="rollback">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Rollback Plan
              </CardTitle>
              <CardDescription>
                Estimated time: {rollbackPlan?.estimatedTime as string} | 
                Data loss risk: {rollbackPlan?.dataLossRisk as string} | 
                Automation: {rollbackPlan?.automationAvailable ? 'Available' : 'Manual'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(rollbackPlan?.steps as string[])?.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {deploymentRecommendations && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Deployment Recommendations</CardTitle>
                <CardDescription>Suggested timing: {deploymentRecommendations.suggestedTiming as string}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deploymentRecommendations.phaseApproach && (
                  <div className="space-y-3">
                    {(deploymentRecommendations.phases as Array<Record<string, unknown>>)?.map((phase, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{phase.name as string}</span>
                          <Badge variant="outline">{phase.duration as string}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{phase.scope as string}</p>
                        <div className="flex flex-wrap gap-1">
                          {(phase.successCriteria as string[])?.map((c, j) => (
                            <Badge key={j} variant="secondary" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Monitoring Requirements:</p>
                  <ul className="space-y-1">
                    {(deploymentRecommendations.monitoringRequirements as string[])?.map((m, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Target className="h-4 w-4 mt-0.5" />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risks & Benefits */}
        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {risks?.map((risk, i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{risk.risk as string}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Mitigation:</span> {risk.mitigation as string}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Probability</p>
                            <Badge variant={risk.probability === 'high' ? 'destructive' : 'outline'}>
                              {risk.probability as string}
                            </Badge>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Impact</p>
                            <Badge variant={risk.impact === 'high' ? 'destructive' : 'outline'}>
                              {risk.impact as string}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Analysis Button */}
      <div className="flex justify-center gap-4">
        <Button onClick={() => setAnalysis(null)} variant="outline" className="gap-2">
          <GitCompare className="h-4 w-4" />
          Analyze New Changes
        </Button>
        <Button onClick={runAnalysis} disabled={isAnalyzing} variant="secondary" className="gap-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Re-analyzing...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Re-analyze
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
