import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { runAIAnalysis } from '@/lib/aiApi';
import { AIChat } from './AIChat';
import { cn } from '@/lib/utils';

interface ComplianceFramework {
  name: string;
  score: number;
  gaps: string[];
  passed: number;
  failed: number;
}

interface RemediationItem {
  issue: string;
  framework: string;
  severity: 'high' | 'medium' | 'low';
  steps: string[];
}

export function ComplianceAdvisor() {
  const { toast } = useToast();
  const { selectedTenantId, tenants, isConnected } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [complianceResult, setComplianceResult] = useState<{
    overallCompliance: number;
    frameworks: Record<string, ComplianceFramework>;
    criticalGaps: string[];
    remediationPriority: RemediationItem[];
    summary: string;
  } | null>(null);
  const [expandedRemediation, setExpandedRemediation] = useState<number | null>(null);

  const runComplianceCheck = async () => {
    if (!selectedTenantId) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select a tenant to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setComplianceResult(null);

    const result = await runAIAnalysis({
      analysisType: 'compliance',
      tenantConnectionId: selectedTenantId,
    });

    setIsAnalyzing(false);

    if (result.success && result.result) {
      setComplianceResult(result.result as typeof complianceResult);
      toast({
        title: 'Compliance Check Complete',
        description: 'AI compliance analysis has been completed',
      });
    } else {
      toast({
        title: 'Analysis Failed',
        description: result.error || 'Failed to run compliance check',
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const frameworks = [
    { id: 'CIS', name: 'CIS Controls', description: 'Center for Internet Security Benchmarks' },
    { id: 'NIST', name: 'NIST CSF', description: 'Cybersecurity Framework' },
    { id: 'ISO27001', name: 'ISO 27001', description: 'Information Security Management' },
    { id: 'SOC2', name: 'SOC 2', description: 'Service Organization Control' },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Compliance Check
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4">
          {/* Analysis Controls */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                AI Compliance Advisor
              </CardTitle>
              <CardDescription>
                Analyze {selectedTenant?.displayName || 'your tenant'} against compliance frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {frameworks.map((fw) => (
                  <div 
                    key={fw.id}
                    className="px-3 py-2 rounded-lg border border-border/50 bg-muted/30"
                  >
                    <p className="font-medium text-sm text-foreground">{fw.name}</p>
                    <p className="text-xs text-muted-foreground">{fw.description}</p>
                  </div>
                ))}
              </div>

              <Button 
                onClick={runComplianceCheck} 
                disabled={isAnalyzing || !isConnected}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Compliance...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Run Compliance Check
                  </>
                )}
              </Button>

              {!isConnected && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Connect to a tenant to run compliance check
                </p>
              )}
            </CardContent>
          </Card>

          {/* Compliance Results */}
          {complianceResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Overall Score */}
              <Card className="glass-panel border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Compliance Score</p>
                      <p className={cn("text-4xl font-bold", getScoreColor(complianceResult.overallCompliance))}>
                        {complianceResult.overallCompliance}%
                      </p>
                    </div>
                    <div className="w-32">
                      <Progress value={complianceResult.overallCompliance} className="h-3" />
                    </div>
                  </div>
                  {complianceResult.summary && (
                    <p className="mt-4 text-sm text-muted-foreground">{complianceResult.summary}</p>
                  )}
                </CardContent>
              </Card>

              {/* Framework Scores */}
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(complianceResult.frameworks || {}).map(([key, fw]) => (
                  <Card key={key} className="glass-panel border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{key}</CardTitle>
                        <span className={cn("text-lg font-bold", getScoreColor(fw.score))}>
                          {fw.score}%
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={fw.score} className="h-2 mb-3" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {fw.passed} Passed
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          {fw.failed} Failed
                        </span>
                      </div>
                      {fw.gaps.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {fw.gaps.slice(0, 2).map((gap, i) => (
                            <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                              {gap}
                            </div>
                          ))}
                          {fw.gaps.length > 2 && (
                            <p className="text-xs text-primary">+{fw.gaps.length - 2} more gaps</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Critical Gaps */}
              {complianceResult.criticalGaps?.length > 0 && (
                <Card className="glass-panel border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Critical Compliance Gaps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {complianceResult.criticalGaps.map((gap, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Remediation Priority */}
              {complianceResult.remediationPriority?.length > 0 && (
                <Card className="glass-panel border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Remediation Priority</CardTitle>
                    <CardDescription>Step-by-step remediation guidance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-2">
                        {complianceResult.remediationPriority.map((item, i) => (
                          <Collapsible 
                            key={i}
                            open={expandedRemediation === i}
                            onOpenChange={() => setExpandedRemediation(expandedRemediation === i ? null : i)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{item.issue}</p>
                                    <p className="text-xs text-muted-foreground">{item.framework}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getSeverityColor(item.severity)}>
                                    {item.severity}
                                  </Badge>
                                  {expandedRemediation === i ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-9 mt-2 p-3 bg-muted/20 rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Remediation Steps:</p>
                                <ol className="space-y-2">
                                  {item.steps.map((step, stepIdx) => (
                                    <li key={stepIdx} className="text-sm text-foreground flex items-start gap-2">
                                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0">
                                        {stepIdx + 1}
                                      </span>
                                      {step}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          <Card className="glass-panel border-border/50 h-[600px]">
            <AIChat
              featureType="compliance-advisor"
              title="Compliance Advisor"
              placeholder="Ask about compliance requirements, remediation steps, or policy recommendations..."
              className="h-full"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
