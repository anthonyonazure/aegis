import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Target,
  Shield,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Briefcase,
  Award
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface CopilotAdvisorAnalysis {
  overallAssessment: {
    readinessScore: number;
    readinessLevel: string;
    summary: string;
    estimatedTimeToReady: string;
  };
  categoryScores: Array<{
    category: string;
    score: number;
    status: string;
    findings: string[];
    recommendations: string[];
  }>;
  licensingAnalysis: {
    currentState: string;
    requiredLicenses: number;
    estimatedMonthlyCost: number;
    optimizationOpportunities: string[];
    licensingRecommendations: string[];
  };
  dataGovernance: {
    sensitivityLabelsStatus: string;
    dlpPoliciesStatus: string;
    retentionPoliciesStatus: string;
    oversharedContentRisk: string;
    recommendations: string[];
  };
  securityRequirements: {
    mfaStatus: string;
    conditionalAccessStatus: string;
    identityProtectionStatus: string;
    gaps: string[];
    recommendations: string[];
  };
  adoptionStrategy: {
    targetUserGroups: Array<{
      group: string;
      priority: string;
      estimatedImpact: string;
      rolloutPhase: number;
    }>;
    changeManagementSteps: string[];
    trainingRequirements: string[];
    successMetrics: string[];
  };
  rolloutPlan: {
    phases: Array<{
      phase: number;
      name: string;
      duration: string;
      userCount: number;
      objectives: string[];
      successCriteria: string[];
      risks: string[];
    }>;
    totalDuration: string;
    keyMilestones: string[];
  };
  riskAssessment: {
    overallRisk: string;
    risks: Array<{
      risk: string;
      likelihood: string;
      impact: string;
      mitigation: string;
    }>;
  };
  prioritizedActions: Array<{
    priority: number;
    action: string;
    category: string;
    effort: string;
    impact: string;
    timeline: string;
  }>;
  expectedBenefits: {
    productivityGains: string;
    timesSavingsPerUser: string;
    estimatedROI: string;
    keyUseCases: string[];
  };
}

interface CopilotReadinessAdvisorProps {
  selectedTenants?: Array<{ id: string; name: string; customerId: string | null }>;
}

export const CopilotReadinessAdvisor = ({ selectedTenants }: CopilotReadinessAdvisorProps) => {
  const { toast } = useToast();
  const { connectionId, customers } = useTenant();
  const [analysis, setAnalysis] = useState<CopilotAdvisorAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<number[]>([]);

  const [analysisResults, setAnalysisResults] = useState<Map<string, CopilotAdvisorAnalysis>>(new Map());

  const tenantsToAnalyze = selectedTenants && selectedTenants.length > 0
    ? selectedTenants
    : connectionId ? [{ id: connectionId, name: customers?.[0]?.name || 'Current Tenant', customerId: null }] : [];

  const runAnalysis = async () => {
    if (tenantsToAnalyze.length === 0) {
      toast({ title: 'No Tenants Selected', description: 'Select at least one tenant to analyze', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setAnalysis(null);
    setAnalysisResults(new Map());

    try {
      const results = await Promise.allSettled(
        tenantsToAnalyze.map(async (tenant) => {
          const readinessData = {
            licensing: { totalUsers: 500, copilotLicenses: 50, m365E5Licenses: 200, m365E3Licenses: 300 },
            security: { mfaEnabled: true, mfaCoverage: 95, conditionalAccessPolicies: 12, identityProtection: true },
            dataGovernance: { sensitivityLabels: true, dlpPolicies: 8, retentionPolicies: 5, informationBarriers: false },
            infrastructure: { networkConnectivity: "good", sharePointModernization: 75, teamsAdoption: 85, oneDriveAdoption: 90 },
          };

          const tenantContext = {
            tenantName: tenant.name,
            tenantConnectionId: tenant.id,
            industry: "Technology",
            size: "Medium Enterprise",
            currentM365Usage: "High",
          };

          const { data, error } = await supabase.functions.invoke('ai-copilot-advisor', {
            body: { readinessData, tenantContext },
          });

          if (error) throw error;
          return { tenantId: tenant.id, tenantName: tenant.name, data };
        })
      );

      const newResults = new Map<string, CopilotAdvisorAnalysis>();
      let lastSuccessful: CopilotAdvisorAnalysis | null = null;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          newResults.set(result.value.tenantId, result.value.data);
          lastSuccessful = result.value.data;
        }
      });

      setAnalysisResults(newResults);
      // Set single analysis for backward compat (show first result)
      if (lastSuccessful) setAnalysis(lastSuccessful);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      toast({
        title: 'Analysis Complete',
        description: `${succeeded} tenant${succeeded !== 1 ? 's' : ''} analyzed${failed > 0 ? `, ${failed} failed` : ''}`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({ title: 'Analysis Failed', description: error instanceof Error ? error.message : 'Failed to analyze readiness', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePhase = (phase: number) => {
    setExpandedPhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const getReadinessColor = (level: string) => {
    switch (level) {
      case 'ready': return 'text-green-400';
      case 'nearly-ready': return 'text-blue-400';
      case 'needs-work': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default: return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-red-500/20 text-red-400'
    };
    return colors[risk] || colors.medium;
  };

  const getEffortBadge = (effort: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-blue-500/20 text-blue-400',
      high: 'bg-orange-500/20 text-orange-400'
    };
    return colors[effort] || colors.medium;
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Copilot Readiness Advisor</CardTitle>
              <CardDescription>
                AI-powered analysis for M365 Copilot deployment
              </CardDescription>
            </div>
          </div>
          <Button onClick={runAnalysis} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {analysis ? 'Re-analyze' : 'Analyze Readiness'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!analysis && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ready to assess Copilot readiness?</p>
            <p className="text-sm">Get AI-powered recommendations for successful Copilot deployment</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing tenant readiness...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </div>
        )}

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Overall Assessment */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Overall Readiness</h3>
                  <p className="text-sm text-muted-foreground">{analysis.overallAssessment.summary}</p>
                </div>
                <div className="text-right">
                  <div className={cn("text-4xl font-bold", getReadinessColor(analysis.overallAssessment.readinessLevel))}>
                    {analysis.overallAssessment.readinessScore}%
                  </div>
                  <Badge className={cn("mt-1", getRiskBadge(
                    analysis.overallAssessment.readinessLevel === 'ready' ? 'low' :
                    analysis.overallAssessment.readinessLevel === 'nearly-ready' ? 'low' :
                    analysis.overallAssessment.readinessLevel === 'needs-work' ? 'medium' : 'high'
                  ))}>
                    {analysis.overallAssessment.readinessLevel.replace('-', ' ')}
                  </Badge>
                </div>
              </div>
              <Progress value={analysis.overallAssessment.readinessScore} className="h-3 mb-3" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Estimated time to ready: {analysis.overallAssessment.estimatedTimeToReady}</span>
              </div>
            </div>

            {/* Category Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analysis.categoryScores.map((category, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(category.status)}
                    <span className="text-sm font-medium text-foreground">{category.category}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">{category.score}%</div>
                  <Progress value={category.score} className="h-1.5" />
                </div>
              ))}
            </div>

            <Tabs defaultValue="actions" className="w-full">
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="rollout">Rollout</TabsTrigger>
                <TabsTrigger value="governance">Governance</TabsTrigger>
                <TabsTrigger value="adoption">Adoption</TabsTrigger>
                <TabsTrigger value="risks">Risks</TabsTrigger>
                <TabsTrigger value="benefits">Benefits</TabsTrigger>
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
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{action.category}</Badge>
                            <Badge className={getEffortBadge(action.effort)}>
                              {action.effort} effort
                            </Badge>
                            <Badge className={getRiskBadge(action.impact === 'high' ? 'low' : action.impact === 'low' ? 'high' : 'medium')}>
                              {action.impact} impact
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{action.timeline}</span>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="rollout" className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Rollout Plan
                  </h4>
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    {analysis.rolloutPlan.totalDuration}
                  </Badge>
                </div>

                {analysis.rolloutPlan.phases.map((phase) => (
                  <Collapsible key={phase.phase} open={expandedPhases.includes(phase.phase)}>
                    <CollapsibleTrigger
                      onClick={() => togglePhase(phase.phase)}
                      className="w-full p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                            {phase.phase}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-foreground">{phase.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {phase.duration} • {phase.userCount} users
                            </p>
                          </div>
                        </div>
                        {expandedPhases.includes(phase.phase) ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/20 border border-border/30 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Objectives</p>
                        <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                          {phase.objectives.map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Success Criteria</p>
                        <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                          {phase.successCriteria.map((criteria, i) => (
                            <li key={i}>{criteria}</li>
                          ))}
                        </ul>
                      </div>
                      {phase.risks.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Risks</p>
                          <ul className="list-disc list-inside text-sm text-yellow-400 space-y-1">
                            {phase.risks.map((risk, i) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <h5 className="font-medium text-foreground mb-2">Key Milestones</h5>
                  <div className="flex flex-wrap gap-2">
                    {analysis.rolloutPlan.keyMilestones.map((milestone, index) => (
                      <Badge key={index} variant="outline" className="bg-muted/50">
                        {milestone}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="governance" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-primary" />
                      <h5 className="font-medium text-foreground">Data Governance</h5>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sensitivity Labels</span>
                        <span className="text-foreground">{analysis.dataGovernance.sensitivityLabelsStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">DLP Policies</span>
                        <span className="text-foreground">{analysis.dataGovernance.dlpPoliciesStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Retention Policies</span>
                        <span className="text-foreground">{analysis.dataGovernance.retentionPoliciesStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Oversharing Risk</span>
                        <Badge className={getRiskBadge(analysis.dataGovernance.oversharedContentRisk)}>
                          {analysis.dataGovernance.oversharedContentRisk}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="w-4 h-4 text-primary" />
                      <h5 className="font-medium text-foreground">Security Status</h5>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MFA Status</span>
                        <span className="text-foreground">{analysis.securityRequirements.mfaStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conditional Access</span>
                        <span className="text-foreground">{analysis.securityRequirements.conditionalAccessStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Identity Protection</span>
                        <span className="text-foreground">{analysis.securityRequirements.identityProtectionStatus}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <h5 className="font-medium text-foreground">Licensing Analysis</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{analysis.licensingAnalysis.requiredLicenses}</div>
                      <div className="text-xs text-muted-foreground">Required Licenses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">${analysis.licensingAnalysis.estimatedMonthlyCost}</div>
                      <div className="text-xs text-muted-foreground">Monthly Cost</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{analysis.licensingAnalysis.optimizationOpportunities.length}</div>
                      <div className="text-xs text-muted-foreground">Optimizations</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.licensingAnalysis.currentState}</p>
                </div>
              </TabsContent>

              <TabsContent value="adoption" className="mt-4 space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-primary" />
                    <h5 className="font-medium text-foreground">Target User Groups</h5>
                  </div>
                  <div className="space-y-3">
                    {analysis.adoptionStrategy.targetUserGroups.map((group, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-foreground">{group.group}</p>
                          <p className="text-sm text-muted-foreground">{group.estimatedImpact}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getRiskBadge(group.priority === 'high' ? 'low' : group.priority === 'low' ? 'high' : 'medium')}>
                            {group.priority} priority
                          </Badge>
                          <Badge variant="outline">Phase {group.rolloutPhase}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <h5 className="font-medium text-foreground mb-3">Change Management</h5>
                    <ul className="space-y-2">
                      {analysis.adoptionStrategy.changeManagementSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <h5 className="font-medium text-foreground mb-3">Training Requirements</h5>
                    <ul className="space-y-2">
                      {analysis.adoptionStrategy.trainingRequirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Briefcase className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <h5 className="font-medium text-foreground mb-3">Success Metrics</h5>
                  <div className="flex flex-wrap gap-2">
                    {analysis.adoptionStrategy.successMetrics.map((metric, i) => (
                      <Badge key={i} variant="outline" className="bg-muted/50">
                        <Award className="w-3 h-3 mr-1" />
                        {metric}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="risks" className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    Risk Assessment
                  </h4>
                  <Badge className={getRiskBadge(analysis.riskAssessment.overallRisk)}>
                    Overall: {analysis.riskAssessment.overallRisk} risk
                  </Badge>
                </div>
                <div className="space-y-3">
                  {analysis.riskAssessment.risks.map((risk, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-foreground">{risk.risk}</p>
                        <div className="flex gap-2">
                          <Badge className={getRiskBadge(risk.likelihood)}>
                            {risk.likelihood} likelihood
                          </Badge>
                          <Badge className={getRiskBadge(risk.impact)}>
                            {risk.impact} impact
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-2">
                        <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="benefits" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                    <TrendingUp className="w-6 h-6 text-green-400 mb-2" />
                    <h5 className="font-medium text-foreground">Productivity Gains</h5>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.expectedBenefits.productivityGains}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                    <Clock className="w-6 h-6 text-blue-400 mb-2" />
                    <h5 className="font-medium text-foreground">Time Savings</h5>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.expectedBenefits.timesSavingsPerUser}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                    <DollarSign className="w-6 h-6 text-purple-400 mb-2" />
                    <h5 className="font-medium text-foreground">Estimated ROI</h5>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.expectedBenefits.estimatedROI}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <h5 className="font-medium text-foreground">Key Use Cases</h5>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.expectedBenefits.keyUseCases.map((useCase, index) => (
                      <Badge key={index} variant="outline" className="bg-muted/50">
                        {useCase}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
