import { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wrench,
  Shield,
  FileText,
  Target
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

interface Phase {
  phaseNumber: number;
  name: string;
  duration: string;
  description: string;
  tasks: Array<{
    id: string;
    task: string;
    owner: string;
    duration: string;
    automatable: boolean;
    script?: string;
  }>;
  milestones: string[];
  rollbackPlan: string;
}

interface Risk {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  contingency: string;
}

interface MigrationPlan {
  planOverview: {
    migrationType: string;
    complexity: string;
    estimatedDuration: string;
    estimatedCost?: string;
    riskLevel: 'low' | 'medium' | 'high';
    readinessScore: number;
  };
  preRequisites?: Array<{
    category: string;
    requirement: string;
    status: 'ready' | 'action-needed' | 'blocker';
    actionRequired?: string;
  }>;
  phases: Phase[];
  resourceMapping?: Array<{
    resourceType: string;
    sourceCount: number;
    targetAction: string;
    complexity: string;
    notes: string;
  }>;
  riskAssessment?: Risk[];
  testingPlan?: {
    testPhases: Array<{ phase: string; tests: string[]; successCriteria: string[] }>;
    pilotGroupSize: number;
    pilotDuration: string;
  };
  toolsRecommended?: Array<{ tool: string; purpose: string; cost: string }>;
  estimatedTimeline?: {
    planning: string;
    preparation: string;
    pilotMigration: string;
    fullMigration: string;
    validation: string;
    total: string;
  };
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface MigrationPlannerProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function MigrationPlanner({ selectedTenants }: MigrationPlannerProps) {
  const { toast } = useToast();
  const [isPlanning, setIsPlanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [migrationType, setMigrationType] = useState('tenant-to-tenant');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // Load last plan on mount
  useEffect(() => {
    const loadLastPlan = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('migration-planner');
        if (lastAnalysis?.result) {
          setPlan(lastAnalysis.result as unknown as MigrationPlan);
        }
      } catch (error) {
        console.error('Failed to load last plan:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastPlan();
  }, []);

  const createPlan = async () => {
    setIsPlanning(true);
    setPlan(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-migration-planner', {
        body: { migrationType }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPlan(data);
      
      // Save to database for persistence
      await saveAnalysisResult({
        analysisType: 'migration-planner',
        result: data,
        score: data.planOverview?.readinessScore,
      });

      toast({
        title: 'Migration Plan Created',
        description: 'Your comprehensive migration plan is ready',
      });
    } catch (error) {
      console.error('Migration planning error:', error);
      toast({
        title: 'Planning Failed',
        description: error instanceof Error ? error.message : 'Failed to create migration plan',
        variant: 'destructive',
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-500/20 text-green-400';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400';
      case 'complex': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500/20 text-green-400';
      case 'action-needed': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Migration Planner</h2>
            <p className="text-muted-foreground">Intelligent tenant migration planning</p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Migration Configuration</CardTitle>
          <CardDescription>Select migration type and generate a comprehensive plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Migration Type</label>
              <Select value={migrationType} onValueChange={setMigrationType}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant-to-tenant">Tenant-to-Tenant Migration</SelectItem>
                  <SelectItem value="consolidation">Tenant Consolidation</SelectItem>
                  <SelectItem value="config-transfer">Configuration Transfer</SelectItem>
                  <SelectItem value="hybrid-to-cloud">Hybrid to Cloud Migration</SelectItem>
                  <SelectItem value="cross-geo">Cross-Geography Migration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createPlan} disabled={isPlanning}>
              {isPlanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Planning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Migration Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isPlanning && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Creating your migration plan...</p>
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Complexity</p>
                <Badge className={`mt-2 ${getComplexityColor(plan.planOverview.complexity)}`}>
                  {plan.planOverview.complexity}
                </Badge>
              </CardContent>
            </Card>
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-xl font-bold mt-1">{plan.planOverview.estimatedDuration}</p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Risk Level</p>
                <Badge className={`mt-2 ${getRiskColor(plan.planOverview.riskLevel)}`}>
                  {plan.planOverview.riskLevel}
                </Badge>
              </CardContent>
            </Card>
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Readiness</p>
                <p className="text-xl font-bold">{plan.planOverview.readinessScore}%</p>
                <Progress value={plan.planOverview.readinessScore} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="phases" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="phases">Phases</TabsTrigger>
              <TabsTrigger value="prerequisites">Prerequisites</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
            </TabsList>

            <TabsContent value="phases">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Migration Phases</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {plan.phases?.map((phase) => (
                        <Collapsible
                          key={phase.phaseNumber}
                          open={expandedPhase === phase.phaseNumber}
                          onOpenChange={(open) => setExpandedPhase(open ? phase.phaseNumber : null)}
                        >
                          <div className="rounded-lg border border-border/50 overflow-hidden">
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                                    {phase.phaseNumber}
                                  </div>
                                  <div className="text-left">
                                    <p className="font-medium">{phase.name}</p>
                                    <p className="text-xs text-muted-foreground">{phase.duration}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{phase.tasks?.length || 0} tasks</Badge>
                                  {expandedPhase === phase.phaseNumber ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                                <p className="text-sm text-muted-foreground">{phase.description}</p>
                                
                                <div className="space-y-2">
                                  {phase.tasks?.map((task, i) => (
                                    <div key={task.id || i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-sm">{task.task}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                          <span>{task.owner}</span>
                                          <span>•</span>
                                          <span>{task.duration}</span>
                                          {task.automatable && (
                                            <Badge variant="outline" className="text-green-400 border-green-400/30">
                                              <Wrench className="w-3 h-3 mr-1" />
                                              Automatable
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {phase.milestones && phase.milestones.length > 0 && (
                                  <div className="p-3 rounded-lg bg-primary/10">
                                    <p className="text-xs text-primary mb-2">Milestones</p>
                                    <ul className="text-sm space-y-1">
                                      {phase.milestones.map((m, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                          <Target className="w-3 h-3" />
                                          {m}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prerequisites">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Prerequisites Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {plan.preRequisites?.map((prereq, i) => (
                      <div key={i} className="flex items-start justify-between p-4 rounded-lg border border-border/50">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline">{prereq.category}</Badge>
                          <div>
                            <p className="text-sm font-medium">{prereq.requirement}</p>
                            {prereq.actionRequired && (
                              <p className="text-xs text-muted-foreground mt-1">{prereq.actionRequired}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={getStatusColor(prereq.status)}>
                          {prereq.status}
                        </Badge>
                      </div>
                    )) || <p className="text-muted-foreground">No prerequisites listed</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resources">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Resource Mapping</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {plan.resourceMapping?.map((resource, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{resource.resourceType}</p>
                            <p className="text-xs text-muted-foreground">{resource.notes}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm">{resource.sourceCount} items</span>
                          <Badge variant="outline">{resource.targetAction}</Badge>
                          <Badge className={getComplexityColor(resource.complexity)}>
                            {resource.complexity}
                          </Badge>
                        </div>
                      </div>
                    )) || <p className="text-muted-foreground">No resource mapping available</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {plan.riskAssessment?.map((risk, i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-sm font-medium flex-1">{risk.risk}</p>
                          <div className="flex gap-2">
                            <Badge className={getRiskColor(risk.likelihood)}>
                              {risk.likelihood} likelihood
                            </Badge>
                            <Badge className={getRiskColor(risk.impact)}>
                              {risk.impact} impact
                            </Badge>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="p-2 rounded bg-green-500/10">
                            <p className="text-xs text-green-400 mb-1">Mitigation</p>
                            <p className="text-sm">{risk.mitigation}</p>
                          </div>
                          <div className="p-2 rounded bg-yellow-500/10">
                            <p className="text-xs text-yellow-400 mb-1">Contingency</p>
                            <p className="text-sm">{risk.contingency}</p>
                          </div>
                        </div>
                      </div>
                    )) || <p className="text-muted-foreground">No risks identified</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="testing">
              <Card className="glass-panel border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Testing Plan
                  </CardTitle>
                  {plan.testingPlan && (
                    <CardDescription>
                      Pilot: {plan.testingPlan.pilotGroupSize} users for {plan.testingPlan.pilotDuration}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {plan.testingPlan?.testPhases?.map((phase, i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50">
                        <p className="font-medium mb-3">{phase.phase}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Tests</p>
                            <ul className="text-sm space-y-1">
                              {phase.tests?.map((test, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 text-primary mt-1" />
                                  {test}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Success Criteria</p>
                            <ul className="text-sm space-y-1">
                              {phase.successCriteria?.map((criteria, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <Target className="w-3 h-3 text-green-400 mt-1" />
                                  {criteria}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )) || <p className="text-muted-foreground">No testing plan available</p>}
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
