import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  Shield,
  Key,
  Database,
  Wifi,
  Lightbulb,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  fetchReadinessAssessment, 
  saveReadinessAssessment,
  ReadinessAssessment 
} from '@/lib/copilotApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopilotReadinessCardProps {
  tenantConnectionId: string;
  customerId?: string;
  tenantName: string;
}

export const CopilotReadinessCard = ({ 
  tenantConnectionId, 
  customerId,
  tenantName 
}: CopilotReadinessCardProps) => {
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<ReadinessAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runAssessment = async () => {
    setIsLoading(true);
    try {
      const result = await fetchReadinessAssessment(tenantConnectionId);
      setAssessment(result);
      
      // Save to database
      await saveReadinessAssessment(tenantConnectionId, customerId, result);
      
      toast({
        title: 'Assessment Complete',
        description: `Copilot readiness score: ${result.overallScore}%`,
      });
    } catch (error) {
      console.error('Assessment error:', error);
      toast({
        title: 'Assessment Failed',
        description: error instanceof Error ? error.message : 'Failed to run assessment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-yellow-500 to-amber-500';
    return 'from-red-500 to-rose-500';
  };

  const ReadinessItem = ({ 
    label, 
    ready, 
    icon: Icon,
    details 
  }: { 
    label: string; 
    ready: boolean; 
    icon: React.ElementType;
    details?: any;
  }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          ready ? "bg-green-500/20" : "bg-red-500/20"
        )}>
          <Icon className={cn("w-4 h-4", ready ? "text-green-400" : "text-red-400")} />
        </div>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      {ready ? (
        <Badge className="bg-green-500/20 text-green-400">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
        </Badge>
      ) : (
        <Badge className="bg-red-500/20 text-red-400">
          <XCircle className="w-3 h-3 mr-1" /> Not Ready
        </Badge>
      )}
    </div>
  );

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Copilot Readiness Assessment</CardTitle>
            <CardDescription>
              Evaluate {tenantName}'s readiness for Microsoft 365 Copilot deployment
            </CardDescription>
          </div>
          <Button onClick={runAssessment} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {assessment ? 'Re-run' : 'Run'} Assessment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!assessment && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Assessment" to evaluate Copilot readiness</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing tenant configuration...</p>
          </div>
        )}

        {assessment && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Overall Score */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              <div className={cn("text-5xl font-bold mb-2", getScoreColor(assessment.overallScore))}>
                {assessment.overallScore}%
              </div>
              <p className="text-muted-foreground">Overall Readiness Score</p>
              <Progress 
                value={assessment.overallScore} 
                className={cn("mt-4 h-3", `bg-gradient-to-r ${getScoreGradient(assessment.overallScore)}`)}
              />
            </div>

            {/* Readiness Checklist */}
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Readiness Checklist</h4>
              <ReadinessItem 
                label="Copilot Licensing" 
                ready={assessment.licensing.ready} 
                icon={Key}
                details={assessment.licensing.details}
              />
              <ReadinessItem 
                label="Permissions & Access" 
                ready={assessment.permissions.ready} 
                icon={Shield}
                details={assessment.permissions.details}
              />
              <ReadinessItem 
                label="Semantic Index" 
                ready={assessment.semanticIndex.ready} 
                icon={Database}
                details={assessment.semanticIndex.details}
              />
              <ReadinessItem 
                label="Data Governance" 
                ready={assessment.dataGovernance.ready} 
                icon={Shield}
                details={assessment.dataGovernance.details}
              />
              <ReadinessItem 
                label="Network Connectivity" 
                ready={assessment.network.ready} 
                icon={Wifi}
                details={assessment.network.details}
              />
            </div>

            {/* Licensing Details */}
            {assessment.licensing.details && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Licensing Details
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {assessment.licensing.details.copilotLicenses || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Licenses</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {assessment.licensing.details.consumedLicenses || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Assigned</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">
                      {assessment.licensing.details.availableLicenses || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Available</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {assessment.recommendations.length > 0 && (
              <Alert className="border-yellow-500/50 bg-yellow-500/5">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <AlertDescription>
                  <p className="font-medium text-foreground mb-2">Recommendations</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {assessment.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Export Button */}
            <Button variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export Assessment Report
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
