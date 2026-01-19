import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Copy, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight,
  Terminal,
  Globe,
  Code,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Zap
} from 'lucide-react';
import { RemediationGuide, RemediationStep } from '@/lib/remediationGuides';

interface RemediationGuideDialogProps {
  guide: RemediationGuide | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METHOD_ICONS = {
  portal: Globe,
  powershell: Terminal,
  'graph-api': Code,
  manual: User,
};

const METHOD_COLORS = {
  portal: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  powershell: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'graph-api': 'bg-green-500/10 text-green-500 border-green-500/20',
  manual: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const DIFFICULTY_COLORS = {
  easy: 'bg-green-500/10 text-green-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  hard: 'bg-red-500/10 text-red-500',
};

export function RemediationGuideDialog({ guide, open, onOpenChange }: RemediationGuideDialogProps) {
  const { toast } = useToast();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  if (!guide) return null;

  const toggleStep = (stepOrder: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepOrder)) {
        next.delete(stepOrder);
      } else {
        next.add(stepOrder);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  const renderStep = (step: RemediationStep) => {
    const Icon = METHOD_ICONS[step.method];
    const isExpanded = expandedSteps.has(step.order);

    return (
      <Collapsible key={step.order} open={isExpanded} onOpenChange={() => toggleStep(step.order)}>
        <Card className="border border-border/50">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {step.order}
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-sm font-medium">{step.title}</CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={METHOD_COLORS[step.method]}>
                    <Icon className="w-3 h-3 mr-1" />
                    {step.method === 'graph-api' ? 'Graph API' : step.method.charAt(0).toUpperCase() + step.method.slice(1)}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4 space-y-3">
              <p className="text-sm text-muted-foreground">{step.description}</p>
              
              {step.code && (
                <div className="relative">
                  <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto max-h-64">
                    <code>{step.code}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(step.code!, 'Code');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {step.portalUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(step.portalUrl, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Open in Portal
                </Button>
              )}

              {step.notes && (
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{step.notes}</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{guide.title}</DialogTitle>
              <DialogDescription className="mt-1">
                Step-by-step remediation guide
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="steps" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="prerequisites">Prerequisites</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="steps" className="space-y-4 pr-4">
              {/* Overview Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <Zap className="w-5 h-5 text-primary mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm">{guide.overview}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {guide.estimatedTime}
                        </div>
                        <Badge className={DIFFICULTY_COLORS[guide.difficulty]}>
                          {guide.difficulty.charAt(0).toUpperCase() + guide.difficulty.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Steps */}
              <div className="space-y-2">
                {guide.steps.map(step => renderStep(step))}
              </div>

              {/* Rollback Section */}
              {guide.rollbackSteps && guide.rollbackSteps.length > 0 && (
                <Card className="border-orange-500/20 bg-orange-500/5">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-orange-500" />
                      Rollback Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {guide.rollbackSteps.map((step, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-orange-500">•</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="prerequisites" className="space-y-4 pr-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Before You Begin</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {guide.prerequisites.map((prereq, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {prereq}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="verification" className="space-y-4 pr-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Verification Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {guide.verificationSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex-shrink-0">
                          {i + 1}
                        </div>
                        {step}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resources" className="space-y-4 pr-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Documentation & Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {guide.documentationLinks.map((link, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => window.open(link.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {link.title}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            // Copy all PowerShell commands
            const psCommands = guide.steps
              .filter(s => s.method === 'powershell' && s.code)
              .map(s => s.code)
              .join('\n\n');
            if (psCommands) {
              copyToClipboard(psCommands, 'All PowerShell commands');
            }
          }}>
            <Terminal className="w-4 h-4 mr-2" />
            Copy All PowerShell
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
