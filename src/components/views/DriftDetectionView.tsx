import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  History
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { compareExports, DriftResult } from '@/lib/driftDetection';
import { logAuditEvent } from '@/lib/auditLog';

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
        
        await supabase.from('drift_detections').insert([{
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
        }]);

        await logAuditEvent({
          action: 'drift_detection',
          resourceType: 'export',
          resourceId: baselineExport,
          details: { compareExport, unchanged, added, removed, modified },
        });
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
                Select a baseline and a comparison export to detect drift
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Baseline Export</label>
                  <Select value={baselineExport} onValueChange={setBaselineExport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select baseline" />
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
                  <label className="text-sm font-medium text-foreground mb-2 block">Compare With</label>
                  <Select value={compareExport} onValueChange={setCompareExport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select comparison" />
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
                <CardTitle>Comparison Results</CardTitle>
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="text-green-400">{unchangedCount} unchanged</span>
                  <span className="text-blue-400">{addedCount} added</span>
                  <span className="text-red-400">{removedCount} removed</span>
                  <span className="text-yellow-400">{modifiedCount} modified</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <motion.div
                        key={`${result.resourceId}-${idx}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          "p-3 rounded-lg border",
                          result.status === 'unchanged' && "bg-muted/20 border-border/30",
                          result.status === 'added' && "bg-blue-500/10 border-blue-500/30",
                          result.status === 'removed' && "bg-red-500/10 border-red-500/30",
                          result.status === 'modified' && "bg-yellow-500/10 border-yellow-500/30"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(result.status)}
                            <div>
                              <p className="font-medium text-sm text-foreground">{result.resourceName}</p>
                              <p className="text-xs text-muted-foreground">{result.resourceType}</p>
                            </div>
                          </div>
                          {getStatusBadge(result.status)}
                        </div>
                        {result.changes && result.changes.length > 0 && (
                          <div className="mt-3 pl-7 space-y-1">
                            {result.changes.slice(0, 5).map((change, cidx) => (
                              <div key={cidx} className="text-xs">
                                <span className="text-muted-foreground">{change.field}:</span>
                                <span className="text-red-400 ml-2 line-through">
                                  {JSON.stringify(change.baselineValue)?.slice(0, 30)}
                                </span>
                                <span className="text-green-400 ml-2">
                                  {JSON.stringify(change.currentValue)?.slice(0, 30)}
                                </span>
                              </div>
                            ))}
                            {result.changes.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{result.changes.length - 5} more changes
                              </p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
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
    </div>
  );
};
