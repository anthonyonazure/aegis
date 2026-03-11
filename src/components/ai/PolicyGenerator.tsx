import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wand2, 
  Shield, 
  Laptop, 
  Copy, 
  Check, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  ListChecks,
  TestTube
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PolicyResult {
  policy: Record<string, unknown> | null;
  explanation: string;
  deploymentSteps: string[];
  riskConsiderations: string[];
  testingRecommendations: string[];
  rawResponse?: boolean;
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface PolicyGeneratorProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function PolicyGenerator({ selectedTenants }: PolicyGeneratorProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [policyType, setPolicyType] = useState<'conditionalAccess' | 'intune'>('conditionalAccess');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<PolicyResult | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const effectiveTenantId = selectedTenants?.[0]?.id;

  const examplePrompts = [
    "Block all sign-ins from outside the US and require MFA for admin accounts",
    "Require compliant devices for accessing SharePoint and OneDrive",
    "Block legacy authentication protocols for all users",
    "Require MFA for all users when accessing from untrusted networks",
    "Create a policy to protect privileged identity management access"
  ];

  const generatePolicy = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Enter Requirements',
        description: 'Please describe what you want the policy to do',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-policy-generator', {
        body: { 
          prompt, 
          policyType,
          tenantConnectionId: effectiveTenantId,
          tenantName: selectedTenants?.[0]?.name,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast({
        title: 'Policy Generated',
        description: 'Your policy configuration has been created',
      });
    } catch (error) {
      console.error('Policy generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate policy',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyJson = async () => {
    if (!result?.policy) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.policy, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Policy JSON copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Wand2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Policy Generator</h2>
          <p className="text-muted-foreground">Create Conditional Access & Intune policies from plain English</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Describe Your Policy</CardTitle>
            <CardDescription>
              Tell the AI what you want to protect and how
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Policy Type Toggle */}
            <div className="flex gap-2">
              <Button
                variant={policyType === 'conditionalAccess' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPolicyType('conditionalAccess')}
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Conditional Access
              </Button>
              <Button
                variant={policyType === 'intune' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPolicyType('intune')}
                className="flex items-center gap-2"
              >
                <Laptop className="w-4 h-4" />
                Intune/Device Config
              </Button>
            </div>

            {/* Prompt Input */}
            <Textarea
              placeholder="Example: Block all sign-ins from outside the US and require MFA for users accessing sensitive apps..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[150px] bg-background/50"
            />

            {/* Example Prompts */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.slice(0, 3).map((example, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                    onClick={() => setPrompt(example)}
                  >
                    {example.length > 40 ? example.slice(0, 40) + '...' : example}
                  </Badge>
                ))}
              </div>
            </div>

            <Button 
              onClick={generatePolicy} 
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Policy...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Policy
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Generated Policy
              {result?.policy && (
                <Button variant="ghost" size="sm" onClick={copyJson}>
                  {copiedJson ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <FileCode className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Your generated policy will appear here</p>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">AI is crafting your policy...</p>
              </div>
            )}

            {result && (
              <Tabs defaultValue="json" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="json" className="text-xs">
                    <FileCode className="w-3 h-3 mr-1" />
                    JSON
                  </TabsTrigger>
                  <TabsTrigger value="explain" className="text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Explain
                  </TabsTrigger>
                  <TabsTrigger value="deploy" className="text-xs">
                    <ListChecks className="w-3 h-3 mr-1" />
                    Deploy
                  </TabsTrigger>
                  <TabsTrigger value="test" className="text-xs">
                    <TestTube className="w-3 h-3 mr-1" />
                    Test
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="json" className="mt-0">
                  <div className="h-[280px] overflow-y-auto rounded-lg bg-muted/30 p-4">
                    {result.policy ? (
                      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                        {JSON.stringify(result.policy, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="explain" className="mt-0">
                  <div className="h-[280px] overflow-y-auto space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="deploy" className="mt-0">
                  <div className="h-[280px] overflow-y-auto space-y-3">
                    {result.deploymentSteps.length > 0 ? (
                      result.deploymentSteps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                            {i + 1}
                          </span>
                          <p className="text-sm text-foreground">{step}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-4">No deployment steps provided</p>
                    )}

                    {result.riskConsiderations.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Risk Considerations
                        </p>
                        {result.riskConsiderations.map((risk, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 text-sm text-yellow-500">
                            <span className="w-1 h-1 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                            {risk}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="test" className="mt-0">
                  <div className="h-[280px] overflow-y-auto space-y-3">
                    {result.testingRecommendations.length > 0 ? (
                      result.testingRecommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <TestTube className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground">{rec}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-4">No testing recommendations provided</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}