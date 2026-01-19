import { useState } from 'react';
import { 
  Wrench, 
  Copy, 
  Check, 
  Loader2,
  AlertTriangle,
  Shield,
  Terminal,
  Code2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Zap,
  FileCode
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScriptInfo {
  code: string;
  modules?: string[];
  permissions?: string[];
  endpoints?: string[];
  tools?: string[];
}

interface RemediationResult {
  issueAnalysis: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    affectedResources: string[];
    rootCause: string;
  };
  scripts: {
    powershell: ScriptInfo;
    graphApi: ScriptInfo;
    cli: ScriptInfo;
  };
  implementation: {
    prerequisites: string[];
    steps: string[];
    validation: string[];
    rollback: string[];
  };
  risks: string[];
  estimatedTime: string;
  automationPossible: boolean;
  scheduledTask?: {
    recommended: boolean;
    frequency: string;
  };
}

const exampleIssues = [
  "MFA is not enabled for all admin accounts in the tenant",
  "Legacy authentication protocols are still allowed",
  "Guest users have excessive permissions in SharePoint",
  "Conditional Access policies don't cover all cloud apps",
  "BitLocker is not enforced on Windows devices"
];

export function RemediationScriptGenerator() {
  const { toast } = useToast();
  const [issue, setIssue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<RemediationResult | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const generateScripts = async () => {
    if (!issue.trim()) {
      toast({
        title: 'Enter Issue',
        description: 'Please describe the compliance gap or security issue',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-remediation', {
        body: { issue }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast({
        title: 'Scripts Generated',
        description: 'Remediation scripts are ready for review',
      });
    } catch (error) {
      console.error('Script generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate scripts',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyScript = async (script: string, type: string) => {
    try {
      await navigator.clipboard.writeText(script);
      setCopiedScript(type);
      setTimeout(() => setCopiedScript(null), 2000);
      toast({ title: 'Copied!', description: `${type} script copied to clipboard` });
    } catch {
      toast({ title: 'Copy Failed', variant: 'destructive' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Wrench className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Remediation Scripts</h2>
          <p className="text-muted-foreground">Auto-generate scripts to fix compliance gaps</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Describe the Issue</CardTitle>
            <CardDescription>
              Enter the security or compliance gap you need to fix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: MFA is not enabled for all administrator accounts in our Azure AD tenant..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="min-h-[150px] bg-background/50"
            />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Common issues:</p>
              <div className="flex flex-wrap gap-2">
                {exampleIssues.slice(0, 3).map((example, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                    onClick={() => setIssue(example)}
                  >
                    {example.length > 35 ? example.slice(0, 35) + '...' : example}
                  </Badge>
                ))}
              </div>
            </div>

            <Button 
              onClick={generateScripts} 
              disabled={isGenerating || !issue.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Scripts...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Generate Remediation Scripts
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Section */}
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Issue Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {!result && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <Shield className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Analysis will appear here</p>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-[250px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Analyzing issue and generating scripts...</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getSeverityColor(result.issueAnalysis.severity)}>
                    {result.issueAnalysis.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{result.issueAnalysis.category}</Badge>
                </div>

                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Root Cause</p>
                  <p className="text-sm">{result.issueAnalysis.rootCause}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Affected Resources</p>
                  <div className="flex flex-wrap gap-1">
                    {result.issueAnalysis.affectedResources.map((resource, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{resource}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {result.estimatedTime}
                  </div>
                  {result.automationPossible && (
                    <div className="flex items-center gap-1 text-green-400">
                      <Zap className="w-4 h-4" />
                      Automatable
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scripts Section */}
      {result && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Generated Scripts</CardTitle>
            <CardDescription>Production-ready scripts to remediate the issue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="powershell" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="powershell" className="text-xs">
                  <Terminal className="w-3 h-3 mr-1" />
                  PowerShell
                </TabsTrigger>
                <TabsTrigger value="graph" className="text-xs">
                  <Code2 className="w-3 h-3 mr-1" />
                  Graph API
                </TabsTrigger>
                <TabsTrigger value="cli" className="text-xs">
                  <FileCode className="w-3 h-3 mr-1" />
                  CLI
                </TabsTrigger>
                <TabsTrigger value="implementation" className="text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Steps
                </TabsTrigger>
              </TabsList>

              <TabsContent value="powershell" className="mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {result.scripts.powershell.modules?.map((mod, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{mod}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyScript(result.scripts.powershell.code, 'PowerShell')}
                    >
                      {copiedScript === 'PowerShell' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] rounded-lg bg-muted/30 p-4">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                      {result.scripts.powershell.code}
                    </pre>
                  </ScrollArea>
                  {result.scripts.powershell.permissions && result.scripts.powershell.permissions.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="w-3 h-3" />
                      Required: {result.scripts.powershell.permissions.join(', ')}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="graph" className="mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                      {result.scripts.graphApi.endpoints?.slice(0, 3).map((ep, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">{ep}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyScript(result.scripts.graphApi.code, 'Graph API')}
                    >
                      {copiedScript === 'Graph API' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] rounded-lg bg-muted/30 p-4">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                      {result.scripts.graphApi.code}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="cli" className="mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {result.scripts.cli.tools?.map((tool, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyScript(result.scripts.cli.code, 'CLI')}
                    >
                      {copiedScript === 'CLI' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] rounded-lg bg-muted/30 p-4">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                      {result.scripts.cli.code}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="implementation" className="mt-0">
                <ScrollArea className="h-[350px]">
                  <div className="space-y-6 pr-4">
                    {/* Prerequisites */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        Prerequisites
                      </h4>
                      <div className="space-y-2">
                        {result.implementation.prerequisites.map((prereq, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            {prereq}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Steps */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        Implementation Steps
                      </h4>
                      <div className="space-y-2">
                        {result.implementation.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                              {i + 1}
                            </span>
                            <p className="text-sm">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Validation */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Validation
                      </h4>
                      <div className="space-y-2">
                        {result.implementation.validation.map((val, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-green-500/10">
                            <Check className="w-4 h-4 text-green-400 mt-0.5" />
                            {val}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rollback */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-yellow-400" />
                        Rollback Steps
                      </h4>
                      <div className="space-y-2">
                        {result.implementation.rollback.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-yellow-500/10">
                            <span className="text-yellow-400">{i + 1}.</span>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Risks */}
                    {result.risks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-400" />
                          Risks & Considerations
                        </h4>
                        <div className="space-y-2">
                          {result.risks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-orange-500/10 text-orange-300">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {risk}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
