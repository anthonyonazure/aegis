import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radar, 
  AlertTriangle, 
  Shield, 
  Settings, 
  Key,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Activity,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface Anomaly {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'sign-in' | 'configuration' | 'permission';
  title: string;
  description: string;
  affectedEntity: string;
  timestamp: string;
  impact: string;
  investigation: string[];
  relatedEvents?: string[];
}

interface AnomalySummary {
  totalAnomalies: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overallRiskLevel: string;
  recommendations: string[];
}

interface DataSources {
  signInLogs: number;
  directoryAudits: number;
  riskyUsers: number;
  missingPermissions: string[];
}

interface AnomalyResult {
  anomalies: Anomaly[];
  summary: AnomalySummary;
  dataSources?: DataSources;
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface AnomalyDetectorProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function AnomalyDetector({ selectedTenants }: AnomalyDetectorProps) {
  const { toast } = useToast();
  const { selectedTenantId, tenants, isConnected } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const effectiveTenantIds = selectedTenants?.length
    ? selectedTenants.map(t => t.id)
    : selectedTenantId ? [selectedTenantId] : [];

  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-green-500/20 text-green-400 border-green-500/50',
  };

  const categoryIcons: Record<string, React.ElementType> = {
    'sign-in': User,
    'configuration': Settings,
    'permission': Key,
  };

  const runScan = async () => {
    if (effectiveTenantIds.length === 0) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select at least one tenant before running a scan.',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);
    setResult(null);
    setPermissionError(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-anomaly-detection', {
        body: { 
          tenantConnectionId: effectiveTenantIds[0],
          tenantConnectionIds: effectiveTenantIds,
          tenantNames: selectedTenants?.map(t => t.name) || [],
        }
      });

      if (error) throw error;

      if (data.error) {
        if (data.missingPermissions) {
          setPermissionError(data.error);
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setResult(data);
      toast({
        title: 'Scan Complete',
        description: `Analyzed ${(data.dataSources?.signInLogs || 0) + (data.dataSources?.directoryAudits || 0)} events. Found ${data.summary?.totalAnomalies || 0} potential anomalies.`,
      });
    } catch (error) {
      console.error('Anomaly scan error:', error);
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Failed to run anomaly detection',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getRiskProgress = (summary: AnomalySummary) => {
    const weights = { critical: 40, high: 25, medium: 15, low: 5 };
    const score = 
      (summary.critical * weights.critical) +
      (summary.high * weights.high) +
      (summary.medium * weights.medium) +
      (summary.low * weights.low);
    return Math.min(score, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Anomaly Detection</h2>
            <p className="text-muted-foreground">
              AI-powered detection of unusual activity in {selectedTenant?.displayName || 'your tenant'}
            </p>
          </div>
        </div>
        <Button 
          onClick={runScan} 
          disabled={isScanning || !isConnected}
          size="lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Radar className="w-4 h-4 mr-2" />
              Run Scan
            </>
          )}
        </Button>
      </div>

      {/* Permission Error */}
      {permissionError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{permissionError}</AlertDescription>
        </Alert>
      )}

      {/* Data Sources Info */}
      {result?.dataSources && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Analyzed {result.dataSources.signInLogs} sign-in logs, {result.dataSources.directoryAudits} directory audit events, and {result.dataSources.riskyUsers} risky user records.
            {result.dataSources.missingPermissions.length > 0 && (
              <span className="block mt-1 text-muted-foreground">
                ⚠️ Some data unavailable due to missing permissions: {result.dataSources.missingPermissions.join(', ')}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-5"
        >
          <Card className={cn("glass-panel border-border/50", severityColors[result.summary.overallRiskLevel])}>
            <CardContent className="pt-6 text-center">
              <p className="text-xs uppercase tracking-wide mb-1">Overall Risk</p>
              <p className="text-2xl font-bold capitalize">{result.summary.overallRiskLevel}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel border-red-500/30">
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-400">{result.summary.critical}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel border-orange-500/30">
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">High</p>
              <p className="text-2xl font-bold text-orange-400">{result.summary.high}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel border-yellow-500/30">
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">Medium</p>
              <p className="text-2xl font-bold text-yellow-400">{result.summary.medium}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel border-green-500/30">
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">Low</p>
              <p className="text-2xl font-bold text-green-400">{result.summary.low}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Risk Progress */}
      {result && (
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Risk Score</span>
              <span className="text-sm font-medium">{getRiskProgress(result.summary)}%</span>
            </div>
            <Progress value={getRiskProgress(result.summary)} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Anomalies List */}
      {result && result.anomalies.length > 0 && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Detected Anomalies ({result.anomalies.length})
            </CardTitle>
            <CardDescription>
              Click on an anomaly to see investigation steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <AnimatePresence>
                {result.anomalies.map((anomaly, index) => {
                  const CategoryIcon = categoryIcons[anomaly.category] || Activity;
                  const isExpanded = expandedAnomaly === anomaly.id;

                  return (
                    <motion.div
                      key={anomaly.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "border rounded-lg overflow-hidden transition-colors",
                        severityColors[anomaly.severity]
                      )}
                    >
                      <button
                        onClick={() => setExpandedAnomaly(isExpanded ? null : anomaly.id)}
                        className="w-full p-4 flex items-start justify-between gap-4 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <CategoryIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={severityColors[anomaly.severity]}>
                                {anomaly.severity}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {anomaly.category}
                              </Badge>
                            </div>
                            <p className="font-medium text-foreground">{anomaly.title}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {anomaly.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {anomaly.affectedEntity}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {anomaly.timestamp}
                              </span>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 flex-shrink-0" />
                        )}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border/30"
                          >
                            <div className="p-4 space-y-4 bg-background/30">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Potential Impact</p>
                                <p className="text-sm text-foreground">{anomaly.impact}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Investigation Steps</p>
                                <div className="space-y-2">
                                  {anomaly.investigation.map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                                        {i + 1}
                                      </span>
                                      <p className="text-sm text-foreground">{step}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {anomaly.relatedEvents && anomaly.relatedEvents.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Related Events</p>
                                  <div className="flex flex-wrap gap-2">
                                    {anomaly.relatedEvents.map((event, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {event}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No anomalies found */}
      {result && result.anomalies.length === 0 && (
        <Card className="glass-panel border-green-500/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Anomalies Detected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              The AI analysis found no security anomalies in the recent audit data. Your tenant appears to be in good shape.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {result && result.summary.recommendations.length > 0 && result.anomalies.length > 0 && (
        <Card className="glass-panel border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5" />
              Top Priority Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.summary.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!result && !isScanning && !permissionError && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Radar className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Scan Results</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Run an anomaly scan to detect unusual sign-ins, configuration changes, and permission grants in your tenant.
              {!isConnected && (
                <span className="block mt-2 text-yellow-400">⚠️ Please connect a tenant first to run a scan.</span>
              )}
            </p>
            <Button onClick={runScan} disabled={!isConnected}>
              <Radar className="w-4 h-4 mr-2" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanning State */}
      {isScanning && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Scanning for Anomalies</h3>
            <p className="text-sm text-muted-foreground text-center">
              Fetching real audit logs from your tenant and analyzing with AI...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
