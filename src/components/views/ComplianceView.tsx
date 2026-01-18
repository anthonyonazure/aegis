import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { COMPLIANCE_BASELINES, runComplianceCheck } from '@/lib/complianceRules';
import { logAuditEvent } from '@/lib/auditLog';
import { notifyComplianceFailed, notifyComplianceWarning } from '@/lib/webhookNotifications';
import { createComplianceTickets } from '@/lib/autoTicketing';

interface ExportJob {
  id: string;
  name: string;
  created_at: string;
  categories: string[];
  tenant_connection_id: string | null;
}

interface ComplianceResult {
  resourceType: string;
  resourceName: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  passed: boolean;
  message: string;
}

interface ComplianceHistory {
  id: string;
  baseline_name: string;
  status: string;
  total_checks: number;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  created_at: string;
  export_job_id: string | null;
}

export const ComplianceView = () => {
  const { toast } = useToast();
  const { selectedCustomerId, selectedTenantId, customers } = useTenant();
  const [allExportJobs, setAllExportJobs] = useState<ExportJob[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [selectedExport, setSelectedExport] = useState<string>('');
  const [selectedBaseline, setSelectedBaseline] = useState<string>('microsoft-recommended');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [allHistory, setAllHistory] = useState<ComplianceHistory[]>([]);
  const [history, setHistory] = useState<ComplianceHistory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [tenantConnectionIds, setTenantConnectionIds] = useState<string[]>([]);

  // Get selected customer name for display
  const selectedCustomerName = selectedCustomerId 
    ? customers.find(c => c.id === selectedCustomerId)?.name 
    : null;

  useEffect(() => {
    loadData();
  }, []);

  // Load tenant connections for selected customer
  useEffect(() => {
    const loadTenantConnections = async () => {
      if (!selectedCustomerId) {
        setTenantConnectionIds([]);
        return;
      }
      
      const { data } = await supabase
        .from('tenant_connections')
        .select('id')
        .eq('customer_id', selectedCustomerId);
      
      setTenantConnectionIds(data?.map(t => t.id) || []);
    };
    
    loadTenantConnections();
  }, [selectedCustomerId]);

  // Filter export jobs and history when customer/tenant selection changes
  useEffect(() => {
    if (selectedTenantId) {
      // Filter by specific tenant
      setExportJobs(allExportJobs.filter(job => job.tenant_connection_id === selectedTenantId));
      
      // Filter history by matching export jobs
      const filteredJobIds = allExportJobs
        .filter(job => job.tenant_connection_id === selectedTenantId)
        .map(job => job.id);
      setHistory(allHistory.filter(h => h.export_job_id && filteredJobIds.includes(h.export_job_id)));
    } else if (selectedCustomerId && tenantConnectionIds.length > 0) {
      // Filter by customer's tenants
      setExportJobs(allExportJobs.filter(job => 
        job.tenant_connection_id && tenantConnectionIds.includes(job.tenant_connection_id)
      ));
      
      // Filter history by matching export jobs
      const filteredJobIds = allExportJobs
        .filter(job => job.tenant_connection_id && tenantConnectionIds.includes(job.tenant_connection_id))
        .map(job => job.id);
      setHistory(allHistory.filter(h => h.export_job_id && filteredJobIds.includes(h.export_job_id)));
    } else {
      // Show all
      setExportJobs(allExportJobs);
      setHistory(allHistory);
    }
    
    // Clear selection if it's no longer valid
    if (selectedExport && !exportJobs.find(j => j.id === selectedExport)) {
      setSelectedExport('');
    }
  }, [selectedCustomerId, selectedTenantId, tenantConnectionIds, allExportJobs, allHistory]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exportRes, historyRes] = await Promise.all([
        supabase
          .from('export_jobs')
          .select('id, name, created_at, categories, tenant_connection_id')
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('compliance_results')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (exportRes.error) throw exportRes.error;
      if (historyRes.error) throw historyRes.error;

      setAllExportJobs(exportRes.data || []);
      setAllHistory(historyRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load compliance data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runCheck = async () => {
    if (!selectedExport) {
      toast({
        title: 'Select Export',
        description: 'Please select an export to check',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      // Fetch resources from export
      const { data: resources, error } = await supabase
        .from('exported_resources')
        .select('*')
        .eq('export_job_id', selectedExport);

      if (error) throw error;

      if (!resources || resources.length === 0) {
        toast({
          title: 'No Resources',
          description: 'No resources found in this export',
          variant: 'destructive',
        });
        return;
      }

      // Run compliance checks
      const preparedResources = resources.map(r => ({
        resourceType: `${r.category}/${r.resource_type}`,
        resourceName: r.resource_name || 'Unknown',
        data: r.data as Record<string, unknown>,
      }));

      const checkResults = runComplianceCheck(preparedResources, selectedBaseline);
      setResults(checkResults);

      // Calculate summary
      const passed = checkResults.filter(r => r.passed).length;
      const failed = checkResults.filter(r => !r.passed && r.severity !== 'low').length;
      const warnings = checkResults.filter(r => !r.passed && r.severity === 'low').length;

      // Save results
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: complianceResult } = await supabase.from('compliance_results').insert([{
          user_id: user.id,
          export_job_id: selectedExport,
          baseline_name: selectedBaseline,
          status: failed > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed',
          total_checks: checkResults.length,
          passed_count: passed,
          warning_count: warnings,
          failed_count: failed,
          results: JSON.parse(JSON.stringify(checkResults)),
          completed_at: new Date().toISOString(),
        }]).select().single();

        await logAuditEvent({
          action: 'compliance_check',
          resourceType: 'export',
          resourceId: selectedExport,
          details: { baseline: selectedBaseline, passed, failed, warnings },
        });

        // Trigger webhook notifications for failures or warnings
        if (complianceResult) {
          if (failed > 0) {
            await notifyComplianceFailed(
              complianceResult.id,
              selectedBaseline,
              failed,
              checkResults.length
            );

            // Auto-create PSA tickets for compliance failures
            const ticketResult = await createComplianceTickets({
              complianceResultId: complianceResult.id,
              baselineName: selectedBaseline,
              failedCount: failed,
              warningCount: warnings,
              totalChecks: checkResults.length,
            });

            if (ticketResult.ticketsCreated > 0) {
              toast({
                title: 'Tickets Created',
                description: `${ticketResult.ticketsCreated} PSA ticket(s) created for compliance failure`,
              });
            }
          } else if (warnings > 0) {
            await notifyComplianceWarning(
              complianceResult.id,
              selectedBaseline,
              warnings,
              checkResults.length
            );
          }
        }
      }

      toast({
        title: 'Compliance Check Complete',
        description: `${passed} passed, ${failed} failed, ${warnings} warnings`,
        variant: failed > 0 ? 'destructive' : 'default',
      });

      await loadData();
    } catch (error) {
      console.error('Compliance check failed:', error);
      toast({
        title: 'Check Failed',
        description: 'Failed to run compliance check',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    const category = result.resourceType.split('/')[0];
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, ComplianceResult[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const getSeverityBadge = (severity: string, passed: boolean) => {
    if (passed) {
      return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</Badge>;
    }
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/20 text-orange-400"><AlertTriangle className="w-3 h-3 mr-1" /> High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3 mr-1" /> Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500/20 text-blue-400">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Checks</h1>
          <p className="text-muted-foreground mt-1">
            Verify configurations against security baselines
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing compliance data for <strong>{selectedCustomerName}</strong>
            {selectedTenantId && ' (filtered by selected tenant)'}
          </AlertDescription>
        </Alert>
      )}

      {/* Run Check */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Run Compliance Check
          </CardTitle>
          <CardDescription>
            Check exported configurations against security baselines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Export</label>
              <Select value={selectedExport} onValueChange={setSelectedExport}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an export" />
                </SelectTrigger>
                <SelectContent>
                  {exportJobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name} ({format(new Date(job.created_at), 'MMM d, yyyy')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Baseline</label>
              <Select value={selectedBaseline} onValueChange={setSelectedBaseline}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPLIANCE_BASELINES.map(baseline => (
                    <SelectItem key={baseline.id} value={baseline.id}>
                      {baseline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={runCheck} disabled={isRunning || !selectedExport}>
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span>{results.length} checks performed</span>
              <span className="text-green-400">{passedCount} passed</span>
              <span className="text-red-400">{failedCount} failed</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Compliance Score</span>
                <span className={cn(
                  passRate >= 80 ? 'text-green-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {passRate.toFixed(0)}%
                </span>
              </div>
              <Progress value={passRate} className="h-2" />
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {Object.entries(groupedResults).map(([category, categoryResults]) => (
                  <Collapsible key={category} open={expandedCategories.has(category)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium capitalize">{category.replace('-', ' ')}</span>
                          <Badge variant="outline">{categoryResults.length} checks</Badge>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-green-400 text-sm">
                            {categoryResults.filter(r => r.passed).length} ✓
                          </span>
                          <span className="text-red-400 text-sm">
                            {categoryResults.filter(r => !r.passed).length} ✗
                          </span>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-6 space-y-2 pb-2">
                        {categoryResults.map((result, idx) => (
                          <motion.div
                            key={`${result.ruleId}-${idx}`}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-foreground">{result.ruleName}</p>
                                <p className="text-xs text-muted-foreground">{result.resourceName}</p>
                              </div>
                              {getSeverityBadge(result.severity, result.passed)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{result.message}</p>
                          </motion.div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Check History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No compliance checks yet</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {history.map(check => (
                  <div key={check.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{check.baseline_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(check.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-400">{check.passed_count} passed</span>
                      <span className="text-xs text-red-400">{check.failed_count} failed</span>
                      <Badge className={cn(
                        check.status === 'passed' ? 'bg-green-500/20 text-green-400' :
                        check.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {check.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
