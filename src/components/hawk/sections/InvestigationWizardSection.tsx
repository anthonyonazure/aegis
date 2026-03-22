import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, AlertTriangle, CheckCircle2, Copy, Compass, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { investigationPlaybooks, hawkCommands } from '@/lib/hawkData';
import type { InvestigationPlaybook } from '@/lib/hawkData';

const severityColor: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
};

export const InvestigationWizardSection = () => {
  const { toast } = useToast();
  const [selectedPlaybook, setSelectedPlaybook] = useState<InvestigationPlaybook | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast({ title: 'Copied', description: 'Command copied to clipboard.' });
  };

  if (!selectedPlaybook) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Investigation Wizard</h2>
          <p className="text-muted-foreground mt-1">Choose an investigation scenario and follow the step-by-step guided workflow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investigationPlaybooks.map(pb => (
            <Card
              key={pb.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => { setSelectedPlaybook(pb); setActiveStep(0); }}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base">{pb.title}</h3>
                  <Badge className={severityColor[pb.severity]} variant="outline">
                    {pb.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pb.scenario}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Compass className="w-3.5 h-3.5" />
                  {pb.steps.length} steps · {pb.relatedCommands.length} commands
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const step = selectedPlaybook.steps[activeStep];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPlaybook(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div>
          <h2 className="text-xl font-bold">{selectedPlaybook.title}</h2>
          <p className="text-sm text-muted-foreground">{selectedPlaybook.description}</p>
        </div>
        <Badge className={`ml-auto ${severityColor[selectedPlaybook.severity]}`} variant="outline">
          {selectedPlaybook.severity}
        </Badge>
      </div>

      {/* Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Key Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedPlaybook.indicators.map((ind, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                {ind}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Step Progress */}
      <div className="flex gap-1.5">
        {selectedPlaybook.steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i === activeStep ? 'bg-primary' : i < activeStep ? 'bg-primary/40' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Current Step */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
              {step.order}
            </div>
            <div>
              <CardTitle className="text-base">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step.command && (
            <div className="relative">
              <pre className="text-sm font-mono bg-muted/60 rounded-lg p-4 pr-12 overflow-x-auto">{step.command}</pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => copyCommand(step.command!)}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {step.expectedOutput && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Expected output: </span>
              {step.expectedOutput}
            </div>
          )}

          {step.redFlags && step.redFlags.length > 0 && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Red Flags to Watch For
              </p>
              <ul className="space-y-1">
                {step.redFlags.map((rf, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span> {rf}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={activeStep === 0}
          onClick={() => setActiveStep(p => p - 1)}
        >
          Previous Step
        </Button>
        <Button
          disabled={activeStep === selectedPlaybook.steps.length - 1}
          onClick={() => setActiveStep(p => p + 1)}
        >
          Next Step <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
