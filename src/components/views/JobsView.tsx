import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Radio,
  StopCircle,
  Building2,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getExportJobs, deleteExportJob, cancelExportJob } from '@/lib/database';
import { downloadExportAsZip } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Helper to provide actionable guidance for common errors
function getErrorGuidance(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('access denied') || lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'Grant the required API permission in Azure Portal → App Registrations → API Permissions, then click "Grant admin consent".';
  }
  if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
    return 'Your session may have expired. Try disconnecting and reconnecting to the tenant.';
  }
  if (lowerError.includes('bad request') || lowerError.includes('400') || lowerError.includes('not supported')) {
    return 'This resource may not be available via the Graph API. Consider using Azure Automation for PowerShell-based exports.';
  }
  if (lowerError.includes('not found') || lowerError.includes('404')) {
    return 'This resource type may not exist in your tenant or requires a specific license.';
  }
  if (lowerError.includes('rate limit') || lowerError.includes('429')) {
    return 'Microsoft is rate-limiting requests. Wait a few minutes and try again.';
  }
  if (lowerError.includes('timeout')) {
    return 'The request took too long. Try exporting fewer resources at once.';
  }
  
  return 'Check your service principal permissions and ensure the resource is available in your tenant.';
}

interface ExportJobRecord {
  id: string;
  name: string;
  status: string;
  progress: number;
  categories: string[];
  formats: string[];
  created_at: string;
  completed_at: string | null;
  output_path: string | null;
  error: string | null;
  metadata: {
    results?: Array<{ resource: string; success: boolean; error?: string }>;
    currentResource?: string;
    completed?: number;
    total?: number;
    lastUpdate?: string;
  } | null;
  tenant_connection_id: string | null;
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

const getStatusIcon = (status: JobStatus) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-destructive" />;
    case 'cancelled':
      return <StopCircle className="w-5 h-5 text-muted-foreground" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: JobStatus, hasError: boolean) => {
  if (status === 'completed' && hasError) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning">
        Completed with Errors
      </span>
    );
  }

  const variants: Record<JobStatus, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-success/20 text-success' },
    running: { label: 'Running', className: 'bg-primary/20 text-primary' },
    failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", variants[status]?.className || variants.pending.className)}>
      {variants[status]?.label || 'Unknown'}
    </span>
  );
};

export const JobsView = () => {
  const [allJobs, setAllJobs] = useState<ExportJobRecord[]>([]);
  const [jobs, setJobs] = useState<ExportJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ExportJobRecord | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null);
  const [tenantConnectionIds, setTenantConnectionIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { selectedTenantId, selectedCustomerId, tenants, customers } = useTenant();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Get tenant/customer name for display
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  const tenantDisplayName = selectedTenant?.displayName || selectedTenant?.tenantName || null;
  const selectedCustomerName = selectedCustomerId 
    ? customers.find(c => c.id === selectedCustomerId)?.name 
    : null;

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

  // Filter jobs when customer/tenant selection changes
  useEffect(() => {
    if (selectedTenantId) {
      setJobs(allJobs.filter(job => job.tenant_connection_id === selectedTenantId));
    } else if (selectedCustomerId && tenantConnectionIds.length > 0) {
      setJobs(allJobs.filter(job => 
        job.tenant_connection_id && tenantConnectionIds.includes(job.tenant_connection_id)
      ));
    } else {
      setJobs(allJobs);
    }
  }, [selectedCustomerId, selectedTenantId, tenantConnectionIds, allJobs]);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getExportJobs();
      setAllJobs(data as ExportJobRecord[]);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch export jobs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Fallback polling: keep progress updating even if realtime isn't available
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) => j.status === 'running' || j.status === 'pending');

    if (!hasActiveJobs) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = setInterval(() => {
      fetchJobs();
    }, 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, fetchJobs]);

  // Subscribe to realtime updates for export_jobs
  useEffect(() => {
    const channel = supabase
      .channel('export-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'export_jobs',
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          setLastRealtimeUpdate(new Date());

          if (payload.eventType === 'INSERT') {
            const newJob = payload.new as ExportJobRecord;
            setAllJobs((prev) => [newJob, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedJob = payload.new as ExportJobRecord;
            setAllJobs((prev) =>
              prev.map((job) => (job.id === updatedJob.id ? updatedJob : job))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedJob = payload.old as { id: string };
            setAllJobs((prev) => prev.filter((job) => job.id !== deletedJob.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Keep the Job Details dialog in sync with job data
  useEffect(() => {
    if (!selectedJob) return;

    const updated = jobs.find((j) => j.id === selectedJob.id);
    if (updated) setSelectedJob(updated);
  }, [jobs, selectedJob?.id]);

  const handleDownload = async (job: ExportJobRecord) => {
    setDownloading(job.id);
    try {
      await downloadExportAsZip(job.id);
      toast({
        title: 'Download Started',
        description: 'Your export is being downloaded as a ZIP file',
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download export',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteExportJob(jobId);
      setAllJobs(prev => prev.filter(j => j.id !== jobId));
      toast({
        title: 'Job Deleted',
        description: 'Export job has been deleted',
      });
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete export job',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancelling(jobId);
    try {
      await cancelExportJob(jobId);
      toast({
        title: 'Export Cancelled',
        description: 'The export job has been cancelled',
      });
    } catch (error) {
      console.error('Cancel failed:', error);
      toast({
        title: 'Cancel Failed',
        description: 'Failed to cancel export job',
        variant: 'destructive',
      });
    } finally {
      setCancelling(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const runningJobs = jobs.filter(j => j.status === 'running');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Jobs</h1>
          <p className="text-muted-foreground mt-1">
            View, download, and manage your export history
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Realtime Indicator */}
          <AnimatePresence>
            {isRealtimeConnected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-xs font-medium text-success">LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {lastRealtimeUpdate && (
            <motion.span
              key={lastRealtimeUpdate.getTime()}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted-foreground"
            >
              Updated {lastRealtimeUpdate.toLocaleTimeString()}
            </motion.span>
          )}
          
          <Button variant="outline" className="gap-2" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing export jobs for <strong>{selectedCustomerName}</strong>
            {selectedTenantId && tenantDisplayName && ` (${tenantDisplayName})`}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Exports', value: jobs.length.toString(), icon: Download },
          { label: 'Successful', value: completedJobs.length.toString(), icon: CheckCircle2, color: 'text-success' },
          { label: 'Failed', value: failedJobs.length.toString(), icon: XCircle, color: 'text-destructive' },
          { label: 'In Progress', value: runningJobs.length.toString(), icon: Loader2, color: 'text-primary' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <Icon className={cn("w-5 h-5", stat.color || 'text-muted-foreground')} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Jobs List */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg">Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No export jobs yet. Start an export from the Resources tab.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((job, index) => {
                const hasError = !!job.error;
                const status = job.status as JobStatus;
                
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {hasError && status === 'completed' ? (
                        <AlertTriangle className="w-5 h-5 text-warning" />
                      ) : (
                        getStatusIcon(status)
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium text-foreground">{job.name}</h3>
                          {getStatusBadge(status, hasError)}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>Started: {formatDate(job.created_at)}</span>
                          {job.completed_at && (
                            <span>• Completed: {formatDate(job.completed_at)}</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {job.categories.map(cat => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          <span className="text-muted-foreground">→</span>
                          {job.formats.map(format => (
                            <span 
                              key={format}
                              className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium"
                            >
                              {format.toUpperCase()}
                            </span>
                          ))}
                        </div>

                        {(job.status === 'running' || job.status === 'pending') && (
                          <div className="space-y-1">
                            {job.metadata?.currentResource && (
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                Exporting {job.metadata.currentResource}
                                {typeof job.metadata.completed === 'number' && typeof job.metadata.total === 'number'
                                  ? ` (${job.metadata.completed}/${job.metadata.total})`
                                  : ''}
                              </p>
                            )}
                            <Progress value={job.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground">{job.progress}% complete</p>
                          </div>
                        )}

                        {job.error && (
                          <p className="text-sm text-warning mt-2">{job.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(job.status === 'running' || job.status === 'pending') && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleCancel(job.id)}
                            disabled={cancelling === job.id}
                            title="Cancel Export"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {cancelling === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <StopCircle className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {job.status === 'completed' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setSelectedJob(job)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDownload(job)}
                              disabled={downloading === job.id}
                              title="Download as ZIP"
                            >
                              {downloading === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(job.id)}
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedJob?.name}</DialogTitle>
            <DialogDescription>
              Export completed on {selectedJob?.completed_at ? formatDate(selectedJob.completed_at) : 'N/A'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob?.metadata?.results && (
            <div className="space-y-4">
              <h4 className="font-medium">Export Results</h4>
              <div className="space-y-2">
                {selectedJob.metadata.results.map((result, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg",
                      result.success ? "bg-success/10" : "bg-destructive/10"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className="font-mono text-sm">{result.resource}</span>
                      </div>
                    </div>
                    {result.error && (
                      <div className="mt-2 ml-6 text-sm">
                        <span className="text-destructive">{result.error}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getErrorGuidance(result.error)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSelectedJob(null)}>
              Close
            </Button>
            {selectedJob && (
              <Button onClick={() => handleDownload(selectedJob)} disabled={downloading === selectedJob.id}>
                {downloading === selectedJob.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download ZIP
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
