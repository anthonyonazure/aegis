import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileJson, 
  History, 
  Play, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  FileUp,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { RESOURCE_CATEGORIES } from '@/types/tenant';

// Map category/subcategory to resource type key
function getResourceTypeKey(category: string, resourceType: string): string {
  return `${category}/${resourceType}`;
}

// Get supported import resource types
function getSupportedImportTypes(): Set<string> {
  const supported = new Set<string>();
  // These match the supportsImport: true endpoints in the edge function
  const importable = [
    'intune/device-configurations',
    'intune/compliance-policies',
    'intune/autopilot',
    'intune/scripts',
    'conditional-access/ca-policies',
    'conditional-access/named-locations',
    'entra-id/groups',
    'entra-id/app-registrations',
    'entra-id/admin-units',
  ];
  importable.forEach(t => supported.add(t));
  return supported;
}

// Check if a resource type supports import
function supportsImport(resourceType: string): boolean {
  return getSupportedImportTypes().has(resourceType);
}

interface ImportJob {
  id: string;
  name: string;
  status: string;
  source_type: string;
  source_export_job_id: string | null;
  resources_total: number;
  resources_imported: number;
  resources_failed: number;
  errors: Array<{ resource: string; error: string }>;
  created_at: string;
  completed_at: string | null;
}

interface ExportJob {
  id: string;
  name: string;
  status: string;
  created_at: string;
  categories: string[];
}

interface ParsedResource {
  resourceType: string;
  resourceName: string;
  data: Record<string, unknown>;
}

export const ImportView = () => {
  const { toast } = useToast();
  const { isConnected, getValidToken, connectionId } = useTenant();
  
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExportJob, setSelectedExportJob] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedResources, setParsedResources] = useState<ParsedResource[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [importRes, exportRes] = await Promise.all([
        supabase
          .from('import_jobs')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('export_jobs')
          .select('id, name, status, created_at, categories')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
      ]);

      if (importRes.error) throw importRes.error;
      if (exportRes.error) throw exportRes.error;

      setImportJobs((importRes.data || []).map(job => ({
        ...job,
        errors: Array.isArray(job.errors) ? job.errors as unknown as Array<{ resource: string; error: string }> : []
      })));
      setExportJobs(exportRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load import data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a JSON file',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Parse the file to extract resources
      const resources: ParsedResource[] = [];
      
      if (Array.isArray(data)) {
        // Array of resources
        data.forEach((item: Record<string, unknown>) => {
          if (item.resourceType && item.data) {
            resources.push({
              resourceType: item.resourceType as string,
              resourceName: (item.resourceName || item.displayName || 'Unknown') as string,
              data: item.data as Record<string, unknown>,
            });
          }
        });
      } else if (data.resources) {
        // Object with resources array
        data.resources.forEach((item: Record<string, unknown>) => {
          resources.push({
            resourceType: item.resourceType as string,
            resourceName: (item.resourceName || item.displayName || 'Unknown') as string,
            data: item.data as Record<string, unknown>,
          });
        });
      } else {
        // Single resource
        resources.push({
          resourceType: data.resourceType || 'unknown',
          resourceName: data.displayName || data.name || 'Unknown',
          data: data,
        });
      }

      setUploadedFile(file);
      setParsedResources(resources);
      setShowPreview(true);
    } catch {
      toast({
        title: 'Parse Error',
        description: 'Failed to parse JSON file',
        variant: 'destructive',
      });
    }
  };

  const handleImportFromExport = async () => {
    if (!selectedExportJob) {
      toast({
        title: 'Select Export',
        description: 'Please select an export job to restore from',
        variant: 'destructive',
      });
      return;
    }

    // Fetch resources from the export job
    const { data: resources, error } = await supabase
      .from('exported_resources')
      .select('*')
      .eq('export_job_id', selectedExportJob);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch export resources',
        variant: 'destructive',
      });
      return;
    }

    const parsed = resources.map(r => ({
      resourceType: r.resource_type,
      resourceName: r.resource_name || 'Unknown',
      data: r.data as Record<string, unknown>,
    }));

    setParsedResources(parsed);
    setShowPreview(true);
  };

  const startImport = async () => {
    if (!isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to a tenant first',
        variant: 'destructive',
      });
      return;
    }

    const token = await getValidToken();
    if (!token) {
      toast({
        title: 'Session Expired',
        description: 'Please reconnect to the tenant',
        variant: 'destructive',
      });
      return;
    }

    // Check for unsupported resources
    const unsupportedResources = parsedResources.filter(r => !supportsImport(r.resourceType));
    const supportedResources = parsedResources.filter(r => supportsImport(r.resourceType));

    if (supportedResources.length === 0) {
      toast({
        title: 'No Importable Resources',
        description: 'None of the selected resources support Graph API import. Only Intune, Conditional Access, and Entra ID resources can be imported.',
        variant: 'destructive',
      });
      return;
    }

    if (unsupportedResources.length > 0) {
      toast({
        title: 'Warning',
        description: `${unsupportedResources.length} resource(s) will be skipped as they don't support Graph API import.`,
      });
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          tenant_connection_id: connectionId,
          name: uploadedFile?.name || `Import from Export ${selectedExportJob?.slice(0, 8)}`,
          source_type: uploadedFile ? 'file' : 'export_job',
          source_export_job_id: selectedExportJob || null,
          resources_total: supportedResources.length,
          status: 'running',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Prepare resources for import
      const resourcesToImport = supportedResources.map(r => ({
        resourceType: r.resourceType,
        resourceName: r.resourceName,
        data: r.data,
      }));

      // Call the import edge function
      const { data: importResult, error: importError } = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'import',
          accessToken: token,
          importJobId: job.id,
          resources: resourcesToImport,
        },
      });

      if (importError) {
        console.error('Import edge function error:', importError);
        throw new Error('Import failed. Please try again.');
      }

      const result = importResult as {
        success: boolean;
        imported: number;
        failed: number;
        total: number;
        status: string;
        results?: Array<{ resource: string; resourceName: string; success: boolean; error?: string }>;
      };

      // Update progress to 100%
      setImportProgress(100);

      // Show toast with results
      if (result.status === 'completed') {
        toast({
          title: 'Import Successful',
          description: `Successfully imported ${result.imported} resource(s) to your tenant.`,
        });
      } else if (result.status === 'partial') {
        toast({
          title: 'Import Partially Completed',
          description: `Imported ${result.imported}/${result.total} resources. ${result.failed} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import Failed',
          description: `Failed to import resources. ${result.failed} error(s).`,
          variant: 'destructive',
        });
      }

      // Reset state and reload
      setShowPreview(false);
      setParsedResources([]);
      setUploadedFile(null);
      setSelectedExportJob('');
      await loadData();
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;

    try {
      const { error } = await supabase
        .from('import_jobs')
        .delete()
        .eq('id', deleteJobId);

      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Import job deleted successfully',
      });
      
      setDeleteJobId(null);
      await loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete import job',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3 mr-1" /> Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import / Restore</h1>
          <p className="text-muted-foreground mt-1">
            Restore configurations to your tenant from exports or JSON files
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4 border-yellow-500/30"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="font-medium text-foreground">Not Connected</p>
              <p className="text-sm text-muted-foreground">
                Connect to a tenant to restore configurations
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new">
            <Upload className="w-4 h-4 mr-2" />
            New Import
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Upload JSON */}
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-primary" />
                  Upload JSON File
                </CardTitle>
                <CardDescription>
                  Import configurations from a JSON export file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileJson className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">JSON files only</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={handleFileUpload}
                  />
                </label>
              </CardContent>
            </Card>

            {/* From Export Job */}
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  From Previous Export
                </CardTitle>
                <CardDescription>
                  Restore from a completed export job
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedExportJob} onValueChange={setSelectedExportJob}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an export job" />
                  </SelectTrigger>
                  <SelectContent>
                    {exportJobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name} ({format(new Date(job.created_at), 'MMM d, yyyy')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  className="w-full" 
                  disabled={!selectedExportJob}
                  onClick={handleImportFromExport}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Load Resources
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>View past import operations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : importJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No import jobs yet
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {importJobs.map(job => (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{job.name}</span>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}</span>
                            <span>
                              {job.resources_imported}/{job.resources_total} imported
                            </span>
                            {job.resources_failed > 0 && (
                              <span className="text-red-400">{job.resources_failed} failed</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteJobId(job.id)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the resources that will be imported to your tenant
            </DialogDescription>
          </DialogHeader>
          
          {isImporting ? (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Importing resources...</p>
              </div>
              <Progress value={importProgress} />
              <p className="text-center text-sm text-muted-foreground">
                {importProgress}% complete
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {parsedResources.map((resource, idx) => {
                    const isSupported = supportsImport(resource.resourceType);
                    return (
                      <div 
                        key={idx}
                        className={cn(
                          "flex items-center justify-between p-2 rounded",
                          isSupported ? "bg-muted/30" : "bg-red-500/10 border border-red-500/20"
                        )}
                      >
                        <div>
                          <p className="font-medium text-sm text-foreground">{resource.resourceName}</p>
                          <p className="text-xs text-muted-foreground">{resource.resourceType}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSupported ? (
                            <Badge className="bg-green-500/20 text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Importable
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400">
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Supported
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              {/* Summary of importable resources */}
              {(() => {
                const supportedCount = parsedResources.filter(r => supportsImport(r.resourceType)).length;
                const unsupportedCount = parsedResources.length - supportedCount;
                return (
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      {supportedCount} importable
                    </span>
                    {unsupportedCount > 0 && (
                      <span className="text-red-400">
                        <XCircle className="w-4 h-4 inline mr-1" />
                        {unsupportedCount} will be skipped
                      </span>
                    )}
                  </div>
                );
              })()}
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-200">
                  <strong>Warning:</strong> This will create resources in your tenant via Graph API.
                  Only supported resource types (Intune, Conditional Access, Entra ID) will be imported.
                </p>
              </div>
            </>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={startImport} disabled={isImporting || !isConnected}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this import job? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJob}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
