import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitCompare, 
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Edit3,
  Loader2,
  RefreshCw,
  History,
  Eye,
  Code,
  Filter,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { compareExports, DriftResult } from '@/lib/driftDetection';
import { logAuditEvent } from '@/lib/auditLog';
import { DiffViewer } from '@/components/DiffViewer';
import { notifyDriftDetected } from '@/lib/webhookNotifications';

interface ExportedResource {
  id: string;
  resource_id: string | null;
  resource_name: string | null;
  resource_type: string;
  category: string;
  data: Record<string, unknown>;
}

interface ExportJob {
  id: string;
  name: string;
  created_at: string;
  categories: string[];
}

interface DriftHistory {
  id: string;
  baseline_export_id: string | null;
  status: string;
  total_resources: number;
  unchanged_count: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
  created_at: string;
}

export const DriftDetectionView = () => {
  const { toast } = useToast();
  const { isConnected } = useTenant();
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [baselineExport, setBaselineExport] = useState<string>('');
  const [compareExport, setCompareExport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<DriftResult[]>([]);
  const [history, setHistory] = useState<DriftHistory[]>([]);
  
  // State for visual diff dialog
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [selectedDiffResult, setSelectedDiffResult] = useState<DriftResult | null>(null);
  const [baselineResources, setBaselineResources] = useState<ExportedResource[]>([]);
  const [compareResources, setCompareResources] = useState<ExportedResource[]>([]);
  const [resultFilter, setResultFilter] = useState<'all' | 'changes' | 'modified' | 'added' | 'removed'>('changes');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exportRes, historyRes] = await Promise.all([
        supabase
          .from('export_jobs')
          .select('id, name, created_at, categories')
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('drift_detections')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (exportRes.error) throw exportRes.error;
      if (historyRes.error) throw historyRes.error;

      setExportJobs(exportRes.data || []);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load drift detection data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runComparison = async () => {
    if (!baselineExport || !compareExport) {
      toast({
        title: 'Select Exports',
        description: 'Please select both baseline and comparison exports',
        variant: 'destructive',
      });
      return;
    }

    if (baselineExport === compareExport) {
      toast({
        title: 'Same Export',
        description: 'Please select different exports to compare',
        variant: 'destructive',
      });
      return;
    }

    setIsComparing(true);
    setResults([]);

    try {
      // Fetch resources from both exports
      const [baselineRes, compareRes] = await Promise.all([
        supabase
          .from('exported_resources')
          .select('*')
          .eq('export_job_id', baselineExport),
        supabase
          .from('exported_resources')
          .select('*')
          .eq('export_job_id', compareExport),
      ]);

      if (baselineRes.error) throw baselineRes.error;
      if (compareRes.error) throw compareRes.error;

      if (!baselineRes.data?.length || !compareRes.data?.length) {
        toast({
          title: 'No Resources',
          description: 'One or both exports have no resources',
          variant: 'destructive',
        });
        return;
      }

      // Store resources for diff viewing
      setBaselineResources(baselineRes.data.map(r => ({
        ...r,
        data: r.data as Record<string, unknown>,
      })));
      setCompareResources(compareRes.data.map(r => ({
        ...r,
        data: r.data as Record<string, unknown>,
      })));

      // Compare the exports
      const driftResults = compareExports(baselineRes.data, compareRes.data);
      setResults(driftResults);

      // Calculate summary
      const unchanged = driftResults.filter(r => r.status === 'unchanged').length;
      const added = driftResults.filter(r => r.status === 'added').length;
      const removed = driftResults.filter(r => r.status === 'removed').length;
      const modified = driftResults.filter(r => r.status === 'modified').length;

      // Save results
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const status = added === 0 && removed === 0 && modified === 0 ? 'no_drift' : 'drift_detected';
        
        const { data: driftDetection } = await supabase.from('drift_detections').insert([{
          user_id: user.id,
          baseline_export_id: baselineExport,
          status,
          total_resources: driftResults.length,
          unchanged_count: unchanged,
          added_count: added,
          removed_count: removed,
          modified_count: modified,
          drift_details: JSON.parse(JSON.stringify(driftResults)),
          completed_at: new Date().toISOString(),
        }]).select().single();

        await logAuditEvent({
          action: 'drift_detection',
          resourceType: 'export',
          resourceId: baselineExport,
          details: { compareExport, unchanged, added, removed, modified },
        });

        // Trigger webhook notification if drift was detected
        if (driftDetection && (added > 0 || removed > 0 || modified > 0)) {
          await notifyDriftDetected(
            driftDetection.id,
            baselineExport,
            { added, removed, modified }
          );
        }
      }

      toast({
        title: added + removed + modified > 0 ? 'Drift Detected' : 'No Drift',
        description: `${unchanged} unchanged, ${added} added, ${removed} removed, ${modified} modified`,
        variant: added + removed + modified > 0 ? 'destructive' : 'default',
      });

      await loadData();
    } catch (error) {
      console.error('Comparison failed:', error);
      toast({
        title: 'Comparison Failed',
        description: 'Failed to compare exports',
        variant: 'destructive',
      });
    } finally {
      setIsComparing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unchanged':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'added':
        return <Plus className="w-4 h-4 text-blue-400" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-400" />;
      case 'modified':
        return <Edit3 className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unchanged':
        return <Badge className="bg-green-500/20 text-green-400">Unchanged</Badge>;
      case 'added':
        return <Badge className="bg-blue-500/20 text-blue-400">Added</Badge>;
      case 'removed':
        return <Badge className="bg-red-500/20 text-red-400">Removed</Badge>;
      case 'modified':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Modified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const unchangedCount = results.filter(r => r.status === 'unchanged').length;
  const addedCount = results.filter(r => r.status === 'added').length;
  const removedCount = results.filter(r => r.status === 'removed').length;
  const modifiedCount = results.filter(r => r.status === 'modified').length;
  const changesCount = addedCount + removedCount + modifiedCount;

  // Filter results based on selection
  const filteredResults = results.filter(r => {
    if (resultFilter === 'all') return true;
    if (resultFilter === 'changes') return r.status !== 'unchanged';
    return r.status === resultFilter;
  });

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = filteredResults.map((r, i) => `${r.resourceId}-${i}`);
    setExpandedItems(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  const exportChangesJson = () => {
    const changesOnly = results.filter(r => r.status !== 'unchanged');
    const blob = new Blob([JSON.stringify(changesOnly, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-changes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Drift Detection</h1>
          <p className="text-muted-foreground mt-1">
            Compare exports to detect configuration changes
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="compare" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compare">
            <GitCompare className="w-4 h-4 mr-2" />
            Compare Exports
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-4">
          {/* Select Exports */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                Compare Two Exports
              </CardTitle>
              <CardDescription>
                Select an older export as baseline (before) and a newer export to compare (after) to detect what changed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Baseline (Older Export)
                    <span className="text-muted-foreground font-normal ml-2">— the "before" state</span>
                  </label>
                  <Select value={baselineExport} onValueChange={setBaselineExport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select older export" />
                    </SelectTrigger>
                    <SelectContent>
                      {exportJobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} ({format(new Date(job.created_at), 'MMM d, yyyy HH:mm')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Current (Newer Export)
                    <span className="text-muted-foreground font-normal ml-2">— the "after" state</span>
                  </label>
                  <Select value={compareExport} onValueChange={setCompareExport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select newer export" />
                    </SelectTrigger>
                    <SelectContent>
                      {exportJobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} ({format(new Date(job.created_at), 'MMM d, yyyy HH:mm')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={runComparison} disabled={isComparing || !baselineExport || !compareExport}>
                {isComparing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Compare
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Comparison Results
                      {changesCount > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          {changesCount} changes detected
                        </Badge>
                      )}
                      {changesCount === 0 && (
                        <Badge className="bg-green-500/20 text-green-400">
                          No drift
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 flex-wrap mt-2">
                      <span className="text-green-400">{unchangedCount} unchanged</span>
                      <span className="text-blue-400">{addedCount} added</span>
                      <span className="text-red-400">{removedCount} removed</span>
                      <span className="text-yellow-400">{modifiedCount} modified</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportChangesJson} disabled={changesCount === 0}>
                      <Download className="w-4 h-4 mr-1" />
                      Export Changes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter and actions */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Show:</span>
                    <div className="flex gap-1">
                      <Button
                        variant={resultFilter === 'changes' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setResultFilter('changes')}
                      >
                        Changes Only ({changesCount})
                      </Button>
                      <Button
                        variant={resultFilter === 'modified' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setResultFilter('modified')}
                      >
                        Modified ({modifiedCount})
                      </Button>
                      <Button
                        variant={resultFilter === 'added' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setResultFilter('added')}
                      >
                        Added ({addedCount})
                      </Button>
                      <Button
                        variant={resultFilter === 'removed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setResultFilter('removed')}
                      >
                        Removed ({removedCount})
                      </Button>
                      <Button
                        variant={resultFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setResultFilter('all')}
                      >
                        All ({results.length})
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={expandAll}>
                      Expand All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll}>
                      Collapse All
                    </Button>
                  </div>
                </div>

                {/* Results list */}
                {filteredResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No results match the current filter
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredResults.map((result, idx) => {
                        const itemKey = `${result.resourceId}-${idx}`;
                        const isExpanded = expandedItems.has(itemKey);
                        
                        return (
                          <motion.div
                            key={itemKey}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                            className={cn(
                              "rounded-lg border overflow-hidden",
                              result.status === 'unchanged' && "bg-muted/20 border-border/30",
                              result.status === 'added' && "bg-blue-500/10 border-blue-500/30",
                              result.status === 'removed' && "bg-red-500/10 border-red-500/30",
                              result.status === 'modified' && "bg-yellow-500/10 border-yellow-500/30"
                            )}
                          >
                            {/* Header - always visible */}
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                              onClick={() => toggleExpanded(itemKey)}
                            >
                              <div className="flex items-center gap-3">
                                {result.status !== 'unchanged' && (
                                  isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )
                                )}
                                {getStatusIcon(result.status)}
                                <div>
                                  <p className="font-medium text-sm text-foreground">{result.resourceName}</p>
                                  <p className="text-xs text-muted-foreground">{result.resourceType}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.changes && result.changes.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {result.changes.length} field{result.changes.length !== 1 ? 's' : ''} changed
                                  </Badge>
                                )}
                                {result.status === 'modified' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDiffResult(result);
                                      setDiffDialogOpen(true);
                                    }}
                                  >
                                    <Code className="w-4 h-4 mr-1" />
                                    Full Diff
                                  </Button>
                                )}
                                {getStatusBadge(result.status)}
                              </div>
                            </div>

                            {/* Expanded details */}
                            <AnimatePresence>
                              {isExpanded && result.status !== 'unchanged' && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 pt-0 border-t border-border/30">
                                    {result.status === 'added' && (
                                      <div className="mt-3 p-3 rounded bg-blue-500/5 border border-blue-500/20">
                                        <p className="text-sm text-blue-400 font-medium mb-2">New Resource Added</p>
                                        <p className="text-xs text-muted-foreground">
                                          This resource exists in the comparison export but not in the baseline.
                                        </p>
                                      </div>
                                    )}

                                    {result.status === 'removed' && (
                                      <div className="mt-3 p-3 rounded bg-red-500/5 border border-red-500/20">
                                        <p className="text-sm text-red-400 font-medium mb-2">Resource Removed</p>
                                        <p className="text-xs text-muted-foreground">
                                          This resource existed in the baseline but is no longer present.
                                        </p>
                                      </div>
                                    )}

                                    {result.status === 'modified' && result.changes && result.changes.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-sm font-medium text-yellow-400">Changed Fields:</p>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                          {result.changes.map((change, cidx) => (
                                            <div
                                              key={cidx}
                                              className="p-3 rounded bg-muted/30 border border-border/30"
                                            >
                                              <p className="text-sm font-medium text-foreground mb-2">
                                                {change.field}
                                              </p>
                                              <div className="grid gap-2 md:grid-cols-2">
                                                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                                  <p className="text-xs text-red-400 font-medium mb-1">Before (Baseline):</p>
                                                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-[100px] overflow-auto">
                                                    {JSON.stringify(change.baselineValue, null, 2) || 'null'}
                                                  </pre>
                                                </div>
                                                <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                                                  <p className="text-xs text-green-400 font-medium mb-1">After (Current):</p>
                                                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-[100px] overflow-auto">
                                                    {JSON.stringify(change.currentValue, null, 2) || 'null'}
                                                  </pre>
                                                </div>
                                              </div>
                                            </div>
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
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Detection History</CardTitle>
              <CardDescription>Past drift detection runs</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No drift detections yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {history.map(detection => (
                      <div key={detection.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="font-medium text-sm">
                            {detection.status === 'no_drift' ? 'No Drift Detected' : 'Drift Detected'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(detection.created_at), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-400">{detection.unchanged_count} unchanged</span>
                          <span className="text-blue-400">{detection.added_count} added</span>
                          <span className="text-red-400">{detection.removed_count} removed</span>
                          <span className="text-yellow-400">{detection.modified_count} modified</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Visual Diff Dialog */}
      <Dialog open={diffDialogOpen} onOpenChange={setDiffDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Configuration Diff: {selectedDiffResult?.resourceName}
            </DialogTitle>
            <DialogDescription>
              Side-by-side comparison of {selectedDiffResult?.resourceType}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {selectedDiffResult && (() => {
              // Find the baseline and current resource data
              const baselineResource = baselineResources.find(
                r => r.resource_id === selectedDiffResult.resourceId || 
                     r.resource_name === selectedDiffResult.resourceName
              );
              const currentResource = compareResources.find(
                r => r.resource_id === selectedDiffResult.resourceId || 
                     r.resource_name === selectedDiffResult.resourceName
              );
              
              if (!baselineResource?.data || !currentResource?.data) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    Resource data not available for comparison
                  </div>
                );
              }
              
              return (
                <DiffViewer
                  baseline={baselineResource.data}
                  current={currentResource.data}
                  className="h-[500px]"
                />
              );
            })()}
          </div>
          
          {/* Change summary */}
          {selectedDiffResult?.changes && selectedDiffResult.changes.length > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm font-medium mb-2">
                {selectedDiffResult.changes.length} field{selectedDiffResult.changes.length !== 1 ? 's' : ''} modified:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedDiffResult.changes.map((change, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {change.field}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
