import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Target,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ComplianceAnalysis {
  overallCompliance: {
    score: number;
    status: string;
    summary: string;
    criticalGaps: number;
    highGaps: number;
    mediumGaps: number;
    lowGaps: number;
  };
  frameworkAnalysis: Array<{
    framework: string;
    version: string;
    complianceScore: number;
    status: string;
    controlsTotal: number;
    controlsPassed: number;
    controlsFailed: number;
    controlsNotApplicable: number;
    categories: Array<{
      name: string;
      score: number;
      status: string;
      controls: Array<{
        id: string;
        name: string;
        status: string;
        finding: string;
        recommendation: string;
        m365Setting: string;
        effort: string;
      }>;
    }>;
  }>;
  gapAnalysis: Array<{
    framework: string;
    controlId: string;
    controlName: string;
    severity: string;
    currentState: string;
    requiredState: string;
    gap: string;
    businessRisk: string;
    remediation: {
      steps: string[];
      m365AdminPath: string;
      powershellCommand: string;
      estimatedTime: string;
      requiresLicense: string;
    };
  }>;
  crossFrameworkFindings: Array<{
    finding: string;
    affectedFrameworks: string[];
    severity: string;
    singleRemediation: string;
    impactedControls: number;
  }>;
  complianceRoadmap: {
    phases: Array<{
      phase: number;
      name: string;
      duration: string;
      focus: string;
      actions: string[];
      expectedOutcome: string;
      frameworksImpacted: string[];
    }>;
    quickWins: string[];
    longTermInitiatives: string[];
  };
  auditReadiness: {
    overallReadiness: number;
    documentationStatus: string;
    evidenceGaps: string[];
    recommendedDocuments: string[];
    auditPreparationSteps: string[];
  };
  riskAssessment: {
    overallRisk: string;
    risksByCategory: Array<{
      category: string;
      riskLevel: string;
      findings: string[];
      mitigations: string[];
    }>;
  };
  certificationGuidance: {
    readyForCertification: string[];
    nearCertification: Array<{
      framework: string;
      gapsRemaining: number;
      estimatedTimeToReady: string;
    }>;
    requiresSignificantWork: string[];
  };
}

const AVAILABLE_FRAMEWORKS = [
  { id: 'nist-csf', name: 'NIST CSF', description: 'Cybersecurity Framework' },
  { id: 'cis-m365', name: 'CIS M365', description: 'CIS Benchmarks for M365' },
  { id: 'iso-27001', name: 'ISO 27001', description: 'Information Security' },
  { id: 'soc2', name: 'SOC 2', description: 'Service Organization Control' },
  { id: 'hipaa', name: 'HIPAA', description: 'Healthcare Privacy' },
  { id: 'gdpr', name: 'GDPR', description: 'EU Data Protection' },
  { id: 'pci-dss', name: 'PCI DSS', description: 'Payment Card Industry' },
  { id: 'cmmc', name: 'CMMC', description: 'Cybersecurity Maturity Model' },
];

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface ComplianceAdvisorFullProps {
  selectedTenants?: SelectedTenantInfo[];
}

export const ComplianceAdvisorFull = ({ selectedTenants }: ComplianceAdvisorFullProps) => {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<ComplianceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['nist-csf', 'cis-m365', 'iso-27001']);
  const [expandedGaps, setExpandedGaps] = useState<string[]>([]);

  const runAnalysis = async () => {
    if (selectedFrameworks.length === 0) {
      toast({
        title: 'Select Frameworks',
        description: 'Please select at least one compliance framework to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const tenantConfig = {
        security: {
          mfaEnabled: true,
          mfaCoverage: 85,
          conditionalAccess: 12,
          legacyAuthBlocked: false,
          pimEnabled: false,
          securityDefaults: false
        },
        identity: {
          passwordPolicy: { minLength: 12, complexity: true, expiry: 90 },
          guestAccess: 'restricted',
          selfServicePasswordReset: true,
          adminCount: 15
        },
        dataProtection: {
          dlpPolicies: 8,
          sensitivityLabels: true,
          retentionPolicies: 5,
          encryptionAtRest: true
        },
        auditLogging: {
          enabled: true,
          retentionDays: 180,
          advancedAudit: false
        }
      };

      const { data, error } = await supabase.functions.invoke('ai-compliance-advisor', {
        body: { 
          tenantConfig, 
          selectedFrameworks: selectedFrameworks.map(f => 
            AVAILABLE_FRAMEWORKS.find(af => af.id === f)?.name || f
          )
        }
      });

      if (error) throw error;

      setAnalysis(data);
      toast({
        title: 'Analysis Complete',
        description: `Overall compliance score: ${data.overallCompliance?.score}%`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze compliance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFramework = (id: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleGap = (id: string) => {
    setExpandedGaps(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'pass': return 'text-green-400';
      case 'partially-compliant':
      case 'partial': return 'text-yellow-400';
      default: return 'text-red-400';
    }
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

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-green-500/20 text-green-400'
    };
    return colors[risk] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>AI Compliance Advisor</CardTitle>
              <CardDescription>
                Framework gap analysis and compliance recommendations
              </CardDescription>
            </div>
          </div>
          <Button onClick={runAnalysis} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {analysis ? 'Re-analyze' : 'Analyze Compliance'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Framework Selection */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <h4 className="font-medium text-foreground mb-3">Select Compliance Frameworks</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AVAILABLE_FRAMEWORKS.map((framework) => (
              <div
                key={framework.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedFrameworks.includes(framework.id)
                    ? "border-primary bg-primary/10"
                    : "border-border/50 hover:border-border"
                )}
                onClick={() => toggleFramework(framework.id)}
              >
                <Checkbox
                  checked={selectedFrameworks.includes(framework.id)}
                  onCheckedChange={() => toggleFramework(framework.id)}
                />
                <div>
                  <p className="font-medium text-foreground text-sm">{framework.name}</p>
                  <p className="text-xs text-muted-foreground">{framework.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!analysis && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Scale className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ready to assess compliance?</p>
            <p className="text-sm">Select frameworks above and click Analyze Compliance</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing compliance against {selectedFrameworks.length} frameworks...</p>
          </div>
        )}

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Overall Compliance */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Overall Compliance</h3>
                  <p className="text-sm text-muted-foreground">{analysis.overallCompliance.summary}</p>
                </div>
                <div className="text-right">
                  <div className={cn("text-4xl font-bold", getStatusColor(analysis.overallCompliance.status))}>
                    {analysis.overallCompliance.score}%
                  </div>
                  <Badge className={getSeverityBadge(
                    analysis.overallCompliance.score >= 80 ? 'low' :
                    analysis.overallCompliance.score >= 60 ? 'medium' : 'high'
                  )}>
                    {analysis.overallCompliance.status.replace('-', ' ')}
                  </Badge>
                </div>
              </div>
              <Progress value={analysis.overallCompliance.score} className="h-3 mb-4" />
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <div className="text-xl font-bold text-red-400">{analysis.overallCompliance.criticalGaps}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <div className="text-xl font-bold text-orange-400">{analysis.overallCompliance.highGaps}</div>
                  <div className="text-xs text-muted-foreground">High</div>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <div className="text-xl font-bold text-yellow-400">{analysis.overallCompliance.mediumGaps}</div>
                  <div className="text-xs text-muted-foreground">Medium</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <div className="text-xl font-bold text-blue-400">{analysis.overallCompliance.lowGaps}</div>
                  <div className="text-xs text-muted-foreground">Low</div>
                </div>
              </div>
            </div>

            {/* Framework Scores */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {analysis.frameworkAnalysis.map((framework, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{framework.framework}</span>
                    <Badge variant="outline" className="text-xs">{framework.version}</Badge>
                  </div>
                  <div className={cn("text-2xl font-bold mb-1", getStatusColor(framework.status))}>
                    {framework.complianceScore}%
                  </div>
                  <Progress value={framework.complianceScore} className="h-1.5 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-green-400">{framework.controlsPassed} passed</span>
                    <span className="text-red-400">{framework.controlsFailed} failed</span>
                  </div>
                </div>
              ))}
            </div>

            <Tabs defaultValue="gaps" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
                <TabsTrigger value="cross">Cross-Framework</TabsTrigger>
                <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                <TabsTrigger value="audit">Audit Ready</TabsTrigger>
                <TabsTrigger value="cert">Certification</TabsTrigger>
              </TabsList>

              <TabsContent value="gaps" className="mt-4 space-y-3">
                {analysis.gapAnalysis.map((gap, index) => (
                  <Collapsible key={index} open={expandedGaps.includes(gap.controlId)}>
                    <CollapsibleTrigger
                      onClick={() => toggleGap(gap.controlId)}
                      className="w-full p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-left">
                          <Badge className={getSeverityBadge(gap.severity)}>{gap.severity}</Badge>
                          <div>
                            <p className="font-medium text-foreground">{gap.controlId}: {gap.controlName}</p>
                            <p className="text-sm text-muted-foreground">{gap.framework}</p>
                          </div>
                        </div>
                        {expandedGaps.includes(gap.controlId) ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/20 border border-border/30 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Current State</p>
                          <p className="text-sm text-red-400">{gap.currentState}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Required State</p>
                          <p className="text-sm text-green-400">{gap.requiredState}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Business Risk</p>
                        <p className="text-sm text-foreground">{gap.businessRisk}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-foreground mb-2">Remediation Steps</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {gap.remediation.steps.map((step, i) => (
                            <li key={i} className="text-sm text-muted-foreground">{step}</li>
                          ))}
                        </ol>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{gap.remediation.estimatedTime}</Badge>
                          {gap.remediation.requiresLicense && (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
                              Requires: {gap.remediation.requiresLicense}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </TabsContent>

              <TabsContent value="cross" className="mt-4 space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Cross-Framework Findings (Fix Once, Comply Everywhere)
                </h4>
                {analysis.crossFrameworkFindings.map((finding, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{finding.finding}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {finding.affectedFrameworks.map((fw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{fw}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getSeverityBadge(finding.severity)}>{finding.severity}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{finding.impactedControls} controls</p>
                      </div>
                    </div>
                    <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/30">
                      <p className="text-sm text-green-400">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        {finding.singleRemediation}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="roadmap" className="mt-4 space-y-4">
                <div className="space-y-3">
                  {analysis.complianceRoadmap.phases.map((phase) => (
                    <div key={phase.phase} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {phase.phase}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{phase.name}</p>
                          <p className="text-sm text-muted-foreground">{phase.duration} • {phase.focus}</p>
                        </div>
                      </div>
                      <ul className="list-disc list-inside space-y-1 mb-3">
                        {phase.actions.map((action, i) => (
                          <li key={i} className="text-sm text-muted-foreground">{action}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1">
                        {phase.frameworksImpacted.map((fw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{fw}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <h5 className="font-medium text-green-400 mb-2">Quick Wins</h5>
                    <ul className="space-y-1">
                      {analysis.complianceRoadmap.quickWins.map((win, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {win}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <h5 className="font-medium text-blue-400 mb-2">Long-Term Initiatives</h5>
                    <ul className="space-y-1">
                      {analysis.complianceRoadmap.longTermInitiatives.map((init, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          {init}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit" className="mt-4 space-y-4">
                <div className="p-6 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Audit Readiness
                    </h4>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">{analysis.auditReadiness.overallReadiness}%</div>
                      <Badge className={getRiskBadge(
                        analysis.auditReadiness.overallReadiness >= 80 ? 'low' :
                        analysis.auditReadiness.overallReadiness >= 60 ? 'medium' : 'high'
                      )}>
                        {analysis.auditReadiness.documentationStatus}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={analysis.auditReadiness.overallReadiness} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <h5 className="font-medium text-foreground mb-3">Evidence Gaps</h5>
                    <ul className="space-y-2">
                      {analysis.auditReadiness.evidenceGaps.map((gap, i) => (
                        <li key={i} className="text-sm text-red-400 flex items-start gap-2">
                          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <h5 className="font-medium text-foreground mb-3">Recommended Documents</h5>
                    <ul className="space-y-2">
                      {analysis.auditReadiness.recommendedDocuments.map((doc, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <FileCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cert" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <h5 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Ready for Certification
                    </h5>
                    {analysis.certificationGuidance.readyForCertification.length > 0 ? (
                      <ul className="space-y-1">
                        {analysis.certificationGuidance.readyForCertification.map((fw, i) => (
                          <li key={i} className="text-sm text-foreground">{fw}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No frameworks ready yet</p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <h5 className="font-medium text-yellow-400 mb-3">Near Certification</h5>
                    <ul className="space-y-2">
                      {analysis.certificationGuidance.nearCertification.map((item, i) => (
                        <li key={i} className="text-sm">
                          <span className="text-foreground">{item.framework}</span>
                          <p className="text-xs text-muted-foreground">
                            {item.gapsRemaining} gaps • {item.estimatedTimeToReady}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <h5 className="font-medium text-red-400 mb-3">Requires Significant Work</h5>
                    <ul className="space-y-1">
                      {analysis.certificationGuidance.requiresSignificantWork.map((fw, i) => (
                        <li key={i} className="text-sm text-foreground">{fw}</li>
                      ))}
                    </ul>
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
