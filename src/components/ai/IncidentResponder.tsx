import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertOctagon, 
  Shield,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Phone,
  Mail,
  FileText,
  Search,
  Sparkles,
  Loader2,
  AlertTriangle,
  Lock,
  Laptop,
  Database,
  MessageSquare,
  Target,
  Lightbulb,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

const INCIDENT_TYPES = [
  { value: 'phishing', label: 'Phishing Attack' },
  { value: 'account_compromise', label: 'Account Compromise' },
  { value: 'malware', label: 'Malware Infection' },
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'insider_threat', label: 'Insider Threat' },
  { value: 'unauthorized_access', label: 'Unauthorized Access' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'ddos', label: 'DDoS Attack' },
  { value: 'other', label: 'Other' }
];

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface IncidentResponderProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function IncidentResponder({ selectedTenants }: IncidentResponderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [affectedUsers, setAffectedUsers] = useState('');
  const { connectionId, tenantName } = useTenant();

  const effectiveConnectionId = selectedTenants?.[0]?.id || connectionId;
  const effectiveTenantName = selectedTenants?.[0]?.name || tenantName;

  // Load last analysis on mount
  useEffect(() => {
    const loadLastAnalysis = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('incident-responder');
        if (lastAnalysis?.result) {
          setAnalysis(lastAnalysis.result);
        }
      } catch (error) {
        console.error('Failed to load last analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastAnalysis();
  }, []);

  const runAnalysis = async () => {
    if (!incidentDescription.trim()) {
      toast.error('Please describe the incident');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-incident-responder', {
        body: {
          incidentDescription,
          incidentType,
          affectedUsers: affectedUsers.split(',').map(u => u.trim()).filter(Boolean),
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
        
        // Save to database for persistence
        await saveAnalysisResult({
          analysisType: 'incident-responder',
          result: data.analysis,
          tenantConnectionId: connectionId || undefined,
        });

        toast.success('Incident response plan generated');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Incident responder error:', error);
      toast.error('Failed to generate response plan');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'immediate': return 'destructive';
      default: return 'secondary';
    }
  };

  const classification = analysis?.incidentClassification as Record<string, unknown> | undefined;
  const immediateActions = analysis?.immediateActions as Array<Record<string, unknown>> | undefined;
  const containmentSteps = analysis?.containmentSteps as Record<string, unknown> | undefined;
  const investigationGuidance = analysis?.investigationGuidance as Record<string, unknown> | undefined;
  const affectedAssets = analysis?.affectedAssets as Record<string, unknown> | undefined;
  const remediationPlan = analysis?.remediationPlan as Record<string, unknown> | undefined;
  const communicationPlan = analysis?.communicationPlan as Record<string, unknown> | undefined;
  const preventionRecommendations = analysis?.preventionRecommendations as Array<Record<string, unknown>> | undefined;
  const lessonsLearned = analysis?.lessonsLearned as Record<string, unknown> | undefined;
  const recoveryTimeline = analysis?.recoveryTimeline as Record<string, unknown> | undefined;

  if (!analysis) {
    return (
      <Card className="border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
            <AlertOctagon className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            AI Incident Responder
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Get AI-guided response to security incidents with containment, investigation, and remediation steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl mx-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Incident Type</label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type..." />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Affected Users (comma-separated)</label>
              <Textarea
                value={affectedUsers}
                onChange={(e) => setAffectedUsers(e.target.value)}
                placeholder="user1@company.com, user2@company.com"
                className="h-[40px] resize-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Incident Description</label>
            <Textarea
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              placeholder="Describe what happened, when it was discovered, initial observations, and any actions already taken...

Example:
- Multiple users reported receiving phishing emails with malicious attachments
- One user clicked the link and entered credentials
- Suspicious sign-ins detected from foreign IP addresses
- User's mailbox shows forwarding rules to external address"
              className="min-h-[180px]"
            />
          </div>
          <div className="flex justify-center">
            <Button onClick={runAnalysis} disabled={isAnalyzing || !incidentDescription.trim()} size="lg" className="gap-2 bg-destructive hover:bg-destructive/90">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Response Plan...
                </>
              ) : (
                <>
                  <AlertOctagon className="h-4 w-4" />
                  Generate Incident Response
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
      {/* Classification Header */}
      <Card className={`border-2 ${getSeverityColor(classification?.severity as string).replace('bg-', 'border-')}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertOctagon className="h-5 w-5" />
                {classification?.type as string || 'Security Incident'}
              </CardTitle>
              <CardDescription className="mt-1">
                Attack Vector: {classification?.attackVector as string} | 
                Threat Actor: {String(classification?.threatActorType || 'unknown')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getSeverityColor(classification?.severity as string)}>
                {String(classification?.severity || 'unknown').toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {String(classification?.category || 'unknown').replace(/_/g, ' ')}
              </Badge>
              <Badge variant="secondary">
                {Number(classification?.confidence) || 0}% confidence
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Recovery Timeline */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Containment</CardDescription>
            <CardTitle className="text-lg">{recoveryTimeline?.estimatedContainment as string || 'TBD'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eradication</CardDescription>
            <CardTitle className="text-lg">{recoveryTimeline?.estimatedEradication as string || 'TBD'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recovery</CardDescription>
            <CardTitle className="text-lg">{recoveryTimeline?.estimatedRecovery as string || 'TBD'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Post-Incident</CardDescription>
            <CardTitle className="text-lg">{recoveryTimeline?.estimatedPostIncident as string || 'TBD'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="immediate" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="immediate" className="gap-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Immediate</span>
          </TabsTrigger>
          <TabsTrigger value="containment" className="gap-1">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Containment</span>
          </TabsTrigger>
          <TabsTrigger value="investigation" className="gap-1">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Investigate</span>
          </TabsTrigger>
          <TabsTrigger value="remediation" className="gap-1">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Remediate</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Communicate</span>
          </TabsTrigger>
          <TabsTrigger value="prevention" className="gap-1">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Prevent</span>
          </TabsTrigger>
        </TabsList>

        {/* Immediate Actions */}
        <TabsContent value="immediate">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Immediate Actions Required
              </CardTitle>
              <CardDescription>Execute these actions in priority order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {immediateActions?.map((action, i) => (
                  <Card key={i} className="border-l-4 border-l-destructive">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground font-bold">
                            {Number(action.priority)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{action.action as string}</CardTitle>
                            <CardDescription>{action.reason as string}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{action.timeframe as string}</Badge>
                          <Badge variant="secondary">{String(action.owner || '').replace(/_/g, ' ')}</Badge>
                          {action.automatable && <Badge className="bg-green-500">Automatable</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Containment */}
        <TabsContent value="containment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Short-Term Containment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {(containmentSteps?.shortTerm as Array<Record<string, unknown>>)?.map((step, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <p className="font-medium mb-2">{step.step as string}</p>
                        {(step.commands as string[])?.length > 0 && (
                          <div className="bg-muted p-2 rounded font-mono text-xs mb-2">
                            {(step.commands as string[]).map((cmd, j) => (
                              <p key={j}>{cmd}</p>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Expected: {step.expectedOutcome as string}
                        </p>
                        {step.rollbackPossible && (
                          <Badge variant="outline" className="mt-2 text-xs">Rollback available</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Long-Term Containment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {(containmentSteps?.longTerm as Array<Record<string, unknown>>)?.map((step, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <p className="font-medium mb-2">{step.step as string}</p>
                        <p className="text-sm text-muted-foreground mb-2">{step.implementation as string}</p>
                        <Badge variant="outline">{step.timeline as string}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Affected Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Affected Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Users</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Confirmed: {((affectedAssets?.users as Record<string, unknown>)?.confirmed as string[])?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Suspected: {((affectedAssets?.users as Record<string, unknown>)?.suspected as string[])?.length || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Laptop className="h-4 w-4" />
                    <span className="font-medium">Devices</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Confirmed: {((affectedAssets?.devices as Record<string, unknown>)?.confirmed as string[])?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Suspected: {((affectedAssets?.devices as Record<string, unknown>)?.suspected as string[])?.length || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Applications</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {((affectedAssets?.applications as Record<string, unknown>)?.confirmed as string[])?.length || 0} affected
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" />
                    <span className="font-medium">Data</span>
                  </div>
                  <Badge variant={(affectedAssets?.data as Record<string, unknown>)?.exfiltrationRisk === 'confirmed' ? 'destructive' : 'secondary'}>
                    {String((affectedAssets?.data as Record<string, unknown>)?.exfiltrationRisk || 'unknown')} risk
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investigation */}
        <TabsContent value="investigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Collection</CardTitle>
              <CardDescription>Evidence to collect for investigation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(investigationGuidance?.dataToCollect as Array<Record<string, unknown>>)?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{item.data as string}</p>
                      <p className="text-xs text-muted-foreground">Source: {item.source as string}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={getPriorityBadge(item.priority as string)}>{item.priority as string}</Badge>
                      <Badge variant="outline">Retain: {item.retentionPeriod as string}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Investigation Queries</CardTitle>
              <CardDescription>Run these queries to gather evidence</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {(investigationGuidance?.queries as Array<Record<string, unknown>>)?.map((q, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{q.name as string}</span>
                        <Badge variant="outline">{q.platform as string}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{q.description as string}</p>
                      <div className="bg-muted p-2 rounded font-mono text-xs overflow-x-auto">
                        {q.query as string}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indicators of Compromise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(investigationGuidance?.indicatorsOfCompromise as string[])?.map((ioc, i) => (
                  <Badge key={i} variant="outline" className="font-mono">{ioc}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remediation */}
        <TabsContent value="remediation">
          <Card>
            <CardHeader>
              <CardTitle>Remediation Plan</CardTitle>
              <div className="flex gap-2 mt-2">
                {remediationPlan?.passwordResets && <Badge>Password Resets</Badge>}
                {remediationPlan?.tokenRevocation && <Badge>Token Revocation</Badge>}
                {remediationPlan?.mfaEnforcement && <Badge>MFA Enforcement</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(remediationPlan?.phases as Array<Record<string, unknown>>)?.map((phase, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                            {i + 1}
                          </div>
                          {phase.name as string}
                        </CardTitle>
                        <Badge variant="outline">{phase.duration as string}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Steps</p>
                          <ul className="space-y-1">
                            {(phase.steps as string[])?.map((step, j) => (
                              <li key={j} className="text-sm text-muted-foreground flex items-start gap-1">
                                <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />{step}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Success Criteria</p>
                          <ul className="space-y-1">
                            {(phase.successCriteria as string[])?.map((c, j) => (
                              <li key={j} className="text-sm text-muted-foreground flex items-start gap-1">
                                <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Resources Needed</p>
                          <div className="flex flex-wrap gap-1">
                            {(phase.resources as string[])?.map((r, j) => (
                              <Badge key={j} variant="secondary" className="text-xs">{r}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication */}
        <TabsContent value="communication" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Internal Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(communicationPlan?.internalNotifications as Array<Record<string, unknown>>)?.map((notif, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{notif.audience as string}</span>
                        <Badge variant="outline">{notif.timing as string}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Via: {notif.channel as string}</p>
                      <ul className="space-y-1">
                        {(notif.keyMessages as string[])?.map((msg, j) => (
                          <li key={j} className="text-sm text-muted-foreground">• {msg}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  External Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(communicationPlan?.externalNotifications as Array<Record<string, unknown>>)?.map((notif, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{notif.party as string}</span>
                        <Badge variant={notif.requirement === 'mandatory' ? 'destructive' : 'outline'}>
                          {notif.requirement as string}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{notif.reason as string}</p>
                      <p className="text-xs text-muted-foreground mt-1">Deadline: {notif.deadline as string}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {(communicationPlan?.regulatoryReporting as Record<string, unknown>)?.required && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <FileText className="h-5 w-5" />
                  Regulatory Reporting Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Regulations</p>
                    <div className="flex flex-wrap gap-1">
                      {((communicationPlan?.regulatoryReporting as Record<string, unknown>)?.regulations as string[])?.map((reg, i) => (
                        <Badge key={i} variant="destructive">{reg}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Reporting Bodies</p>
                    <ul className="space-y-1">
                      {((communicationPlan?.regulatoryReporting as Record<string, unknown>)?.reportingBodies as string[])?.map((body, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {body}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Deadlines</p>
                    <ul className="space-y-1">
                      {((communicationPlan?.regulatoryReporting as Record<string, unknown>)?.deadlines as string[])?.map((d, i) => (
                        <li key={i} className="text-sm text-destructive font-medium">• {d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Prevention */}
        <TabsContent value="prevention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Lessons Learned
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Root Cause</p>
                <p className="text-muted-foreground">{lessonsLearned?.rootCause as string}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium mb-2">Security Gaps</p>
                  <ul className="space-y-1">
                    {(lessonsLearned?.securityGaps as string[])?.map((gap, i) => (
                      <li key={i} className="text-sm text-destructive flex items-start gap-1">
                        <XCircle className="h-3 w-3 mt-1 flex-shrink-0" />{gap}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Process Improvements</p>
                  <ul className="space-y-1">
                    {(lessonsLearned?.processImprovements as string[])?.map((imp, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />{imp}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Training Needs</p>
                  <ul className="space-y-1">
                    {(lessonsLearned?.trainingNeeds as string[])?.map((need, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-1">
                        <Users className="h-3 w-3 mt-1 flex-shrink-0" />{need}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prevention Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {preventionRecommendations?.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium">{rec.recommendation as string}</span>
                      <Badge variant={getPriorityBadge(rec.priority as string)}>{rec.priority as string}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{rec.category as string}</Badge>
                      <Badge variant="secondary">{rec.effort as string} effort</Badge>
                      <Badge className="bg-green-500">{rec.effectiveness as string} effectiveness</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Incident Button */}
      <div className="flex justify-center">
        <Button onClick={() => setAnalysis(null)} variant="outline" className="gap-2">
          <AlertOctagon className="h-4 w-4" />
          Report New Incident
        </Button>
      </div>
    </div>
  );
}
