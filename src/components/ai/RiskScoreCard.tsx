import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown,
  TrendingUp,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { runAIAnalysis } from '@/lib/aiApi';
import { cn } from '@/lib/utils';

interface RiskFactor {
  factor: string;
  severity: string;
  impact: string;
  likelihood: string;
}

interface Mitigation {
  action: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
  impact: string;
}

interface RiskResult {
  overallRisk: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  categoryScores: Record<string, number>;
  riskFactors: RiskFactor[];
  mitigations: Mitigation[];
  summary: string;
}

export function RiskScoreCard() {
  const { toast } = useToast();
  const { selectedTenantId, tenants, isConnected } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);

  const runRiskAnalysis = async () => {
    if (!selectedTenantId) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select a tenant to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);

    const result = await runAIAnalysis({
      analysisType: 'risk-score',
      tenantConnectionId: selectedTenantId,
    });

    setIsAnalyzing(false);

    if (result.success && result.result) {
      // Safely cast the result
      const data = result.result as unknown as RiskResult;
      if (data.overallRisk !== undefined && data.riskLevel) {
        setRiskResult(data);
      } else {
        toast({
          title: 'Invalid Response',
          description: 'AI returned an unexpected format',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Analysis Failed',
        description: result.error || 'Failed to calculate risk score',
        variant: 'destructive',
      });
    }
  };

  const getRiskLevelConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return { color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/50', icon: AlertTriangle };
      case 'high':
        return { color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/50', icon: TrendingUp };
      case 'medium':
        return { color: 'text-yellow-500', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: Info };
      case 'low':
        return { color: 'text-green-500', bg: 'bg-green-500/20', border: 'border-green-500/50', icon: TrendingDown };
      default:
        return { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', icon: Info };
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'high': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const categoryLabels: Record<string, string> = {
    identity: 'Identity & Access',
    dataProtection: 'Data Protection',
    deviceManagement: 'Device Management',
    threatProtection: 'Threat Protection',
    governance: 'Governance',
  };

  return (
    <div className="space-y-4">
      {/* Risk Score Header */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security Risk Score
              </CardTitle>
              <CardDescription>
                AI-powered risk assessment for {selectedTenant?.displayName || 'your tenant'}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={runRiskAnalysis}
              disabled={isAnalyzing || !isConnected}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!riskResult && !isAnalyzing && (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Run a risk analysis to see your security score
              </p>
              <Button onClick={runRiskAnalysis} disabled={!isConnected}>
                <Shield className="w-4 h-4 mr-2" />
                Calculate Risk Score
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Analyzing security posture...</p>
            </div>
          )}

          {riskResult && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Overall Risk Score */}
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className={cn(
                    "inline-flex flex-col items-center justify-center w-28 h-28 rounded-full",
                    getRiskLevelConfig(riskResult.riskLevel).bg
                  )}>
                    <span className={cn(
                      "text-3xl font-bold",
                      getRiskLevelConfig(riskResult.riskLevel).color
                    )}>
                      {riskResult.overallRisk}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <Badge className={cn(
                    "mt-2",
                    getRiskLevelConfig(riskResult.riskLevel).bg,
                    getRiskLevelConfig(riskResult.riskLevel).color
                  )}>
                    {riskResult.riskLevel.toUpperCase()} RISK
                  </Badge>
                </div>

                <div className="flex-1 max-w-xs">
                  <p className="text-sm text-muted-foreground mb-3">{riskResult.summary}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingDown className="w-4 h-4 text-green-500" />
                    <span>Lower score = Lower risk</span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="grid gap-3 md:grid-cols-5">
                <TooltipProvider>
                  {Object.entries(riskResult.categoryScores).map(([key, value]) => (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <div className="p-3 bg-muted/30 rounded-lg text-center cursor-help">
                          <p className="text-xs text-muted-foreground mb-1 truncate">
                            {categoryLabels[key] || key}
                          </p>
                          <p className={cn(
                            "text-xl font-bold",
                            value <= 30 ? 'text-green-500' :
                            value <= 60 ? 'text-yellow-500' :
                            'text-red-500'
                          )}>
                            {value}
                          </p>
                          <Progress 
                            value={value} 
                            className="h-1 mt-2" 
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{categoryLabels[key] || key}: {value}/100 risk</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Risk Factors & Mitigations */}
      {riskResult && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Risk Factors */}
          <Card className="glass-panel border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {riskResult.riskFactors.slice(0, 5).map((factor, i) => (
                  <div 
                    key={i}
                    className="p-2 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{factor.factor}</p>
                      <Badge variant="outline" className={cn(
                        "text-xs flex-shrink-0",
                        factor.severity === 'high' ? 'border-red-500 text-red-500' :
                        factor.severity === 'medium' ? 'border-yellow-500 text-yellow-500' :
                        'border-green-500 text-green-500'
                      )}>
                        {factor.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{factor.impact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mitigations */}
          <Card className="glass-panel border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                Recommended Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {riskResult.mitigations.slice(0, 5).map((mitigation, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {mitigation.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{mitigation.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-xs", getEffortBadge(mitigation.effort))}>
                          {mitigation.effort} effort
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {mitigation.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
