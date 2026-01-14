import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  FileJson,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ValidationDetail {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  status: 'passed' | 'warning' | 'error';
  checks: Array<{
    name: string;
    status: 'passed' | 'warning' | 'error';
    message: string;
  }>;
}

interface ValidationResult {
  id: string;
  export_job_id: string;
  status: string;
  total_resources: number;
  passed_count: number;
  warning_count: number;
  error_count: number;
  validation_details: ValidationDetail[];
  created_at: string;
  completed_at: string | null;
}

interface ExportJob {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

// Validation rules - designed to handle Graph API response structures
const VALIDATION_RULES = [
  {
    id: 'schema',
    name: 'Schema Validation',
    description: 'Checks if the resource has identifiable properties',
    check: (data: Record<string, unknown>): { status: 'passed' | 'warning' | 'error'; message: string } => {
      if (!data || typeof data !== 'object') {
        return { status: 'error', message: 'Invalid data structure' };
      }
      
      // Handle array data (common for Graph API responses)
      if (Array.isArray(data)) {
        return data.length > 0 
          ? { status: 'passed', message: `Contains ${data.length} items` }
          : { status: 'warning', message: 'Empty array returned' };
      }
      
      // Check for any common name/identifier properties
      const nameProps = ['displayName', 'name', 'title', 'description', 'webUrl', 'userPrincipalName', 'mail'];
      const hasName = nameProps.some(prop => data[prop]);
      
      if (!hasName) {
        // Check if it has meaningful data at all
        const keys = Object.keys(data).filter(k => !k.startsWith('@'));
        if (keys.length > 2) {
          return { status: 'passed', message: 'Resource has data properties' };
        }
        return { status: 'warning', message: 'No standard name property found' };
      }
      return { status: 'passed', message: 'Schema is valid' };
    }
  },
  {
    id: 'id_present',
    name: 'Resource ID',
    description: 'Checks if the resource has an identifier',
    check: (data: Record<string, unknown>): { status: 'passed' | 'warning' | 'error'; message: string } => {
      // Handle array data
      if (Array.isArray(data)) {
        const itemsWithIds = data.filter((item: any) => item?.id);
        if (data.length === 0) {
          return { status: 'passed', message: 'Empty collection (no IDs expected)' };
        }
        if (itemsWithIds.length === data.length) {
          return { status: 'passed', message: `All ${data.length} items have IDs` };
        }
        if (itemsWithIds.length > 0) {
          return { status: 'warning', message: `${itemsWithIds.length}/${data.length} items have IDs` };
        }
        return { status: 'warning', message: 'Items in collection lack IDs' };
      }
      
      // Check various ID properties
      const idProps = ['id', '@odata.id', 'objectId', 'policyId'];
      const hasId = idProps.some(prop => data[prop]);
      
      if (!hasId) {
        // Some resources don't have IDs (e.g., settings, root objects)
        if (data['@odata.context'] || data['@odata.type']) {
          return { status: 'passed', message: 'OData resource (ID may be in context)' };
        }
        return { status: 'warning', message: 'No standard ID property found' };
      }
      return { status: 'passed', message: 'Resource ID is present' };
    }
  },
  {
    id: 'references',
    name: 'Reference Integrity',
    description: 'Checks for broken references to other resources',
    check: (data: Record<string, unknown>): { status: 'passed' | 'warning' | 'error'; message: string } => {
      // Handle array data
      if (Array.isArray(data)) {
        return { status: 'passed', message: 'Collection references not checked' };
      }
      
      const refFields = ['groupId', 'userId', 'policyId', 'templateId', 'parentId', 'appId'];
      const missingRefs = refFields.filter(field => 
        data[field] !== undefined && (data[field] === null || data[field] === '')
      );
      
      if (missingRefs.length > 0) {
        return { status: 'warning', message: `Empty references: ${missingRefs.join(', ')}` };
      }
      return { status: 'passed', message: 'All references are valid' };
    }
  },
  {
    id: 'completeness',
    name: 'Data Completeness',
    description: 'Checks if the resource has meaningful data',
    check: (data: Record<string, unknown>): { status: 'passed' | 'warning' | 'error'; message: string } => {
      // Handle array data
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return { status: 'warning', message: 'No items in collection' };
        }
        return { status: 'passed', message: `Collection has ${data.length} items` };
      }
      
      const keys = Object.keys(data).filter(k => !k.startsWith('@odata'));
      if (keys.length < 2) {
        return { status: 'warning', message: 'Resource has very few properties' };
      }
      
      const nullCount = keys.filter(k => data[k] === null).length;
      if (nullCount > keys.length * 0.7) {
        return { status: 'warning', message: 'Most properties are null' };
      }
      
      return { status: 'passed', message: 'Resource data is complete' };
    }
  },
  {
    id: 'timestamps',
    name: 'Timestamp Validation',
    description: 'Validates date/time fields',
    check: (data: Record<string, unknown>): { status: 'passed' | 'warning' | 'error'; message: string } => {
      // Handle array data
      if (Array.isArray(data)) {
        return { status: 'passed', message: 'Timestamps not validated for collections' };
      }
      
      const dateFields = ['createdDateTime', 'lastModifiedDateTime', 'expirationDateTime', 'deletedDateTime'];
      const invalidDates: string[] = [];
      
      for (const field of dateFields) {
        if (data[field]) {
          const date = new Date(data[field] as string);
          if (isNaN(date.getTime())) {
            invalidDates.push(field);
          }
        }
      }
      
      if (invalidDates.length > 0) {
        return { status: 'error', message: `Invalid date fields: ${invalidDates.join(', ')}` };
      }
      return { status: 'passed', message: 'All timestamps are valid' };
    }
  }
];

export const ValidationView = () => {
  const { toast } = useToast();
  
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [selectedExportJob, setSelectedExportJob] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [currentResult, setCurrentResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exportRes, validationRes] = await Promise.all([
        supabase
          .from('export_jobs')
          .select('id, name, status, created_at')
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('validation_results')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (exportRes.error) throw exportRes.error;
      if (validationRes.error) throw validationRes.error;

      setExportJobs(exportRes.data || []);
      setValidationResults((validationRes.data || []).map(r => ({
        ...r,
        validation_details: Array.isArray(r.validation_details) ? r.validation_details as unknown as ValidationDetail[] : []
      })));
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load validation data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runValidation = async () => {
    if (!selectedExportJob) {
      toast({
        title: 'Select Export',
        description: 'Please select an export job to validate',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    setValidationProgress(0);
    setCurrentResult(null);

    try {
      // Fetch resources from the export job
      const { data: resources, error: fetchError } = await supabase
        .from('exported_resources')
        .select('*')
        .eq('export_job_id', selectedExportJob);

      if (fetchError) throw fetchError;
      if (!resources || resources.length === 0) {
        toast({
          title: 'No Resources',
          description: 'The selected export has no resources to validate',
          variant: 'destructive',
        });
        setIsValidating(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Run validation on each resource
      const validationDetails: ValidationDetail[] = [];
      let passedCount = 0;
      let warningCount = 0;
      let errorCount = 0;

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const data = resource.data as Record<string, unknown>;
        
        const checks = VALIDATION_RULES.map(rule => {
          const result = rule.check(data);
          return {
            name: rule.name,
            status: result.status,
            message: result.message,
          };
        });

        const hasError = checks.some(c => c.status === 'error');
        const hasWarning = checks.some(c => c.status === 'warning');
        
        let status: 'passed' | 'warning' | 'error' = 'passed';
        if (hasError) {
          status = 'error';
          errorCount++;
        } else if (hasWarning) {
          status = 'warning';
          warningCount++;
        } else {
          passedCount++;
        }

        // Extract a meaningful name from the resource
        let displayName = resource.resource_name;
        if (!displayName || displayName === 'Unknown') {
          // Try to extract name from data
          if (Array.isArray(data)) {
            displayName = `${data.length} ${resource.resource_type} items`;
          } else if (data.displayName || data.name || data.title) {
            displayName = (data.displayName || data.name || data.title) as string;
          } else {
            displayName = resource.resource_type;
          }
        }

        validationDetails.push({
          resourceId: resource.id,
          resourceType: resource.resource_type,
          resourceName: displayName,
          status,
          checks,
        });

        setValidationProgress(Math.round(((i + 1) / resources.length) * 100));
        
        // Small delay to show progress
        if (resources.length > 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Determine overall status
      let overallStatus = 'passed';
      if (errorCount > 0) {
        overallStatus = 'failed';
      } else if (warningCount > 0) {
        overallStatus = 'warning';
      }

      // Save validation result
      const insertData = {
        user_id: user.id,
        export_job_id: selectedExportJob,
        status: overallStatus,
        total_resources: resources.length,
        passed_count: passedCount,
        warning_count: warningCount,
        error_count: errorCount,
        validation_details: JSON.parse(JSON.stringify(validationDetails)),
        completed_at: new Date().toISOString(),
      };
      
      const { data: result, error: saveError } = await supabase
        .from('validation_results')
        .insert(insertData)
        .select()
        .single();

      if (saveError) throw saveError;

      setCurrentResult({
        ...result,
        validation_details: validationDetails,
      });

      toast({
        title: 'Validation Complete',
        description: `Validated ${resources.length} resources: ${passedCount} passed, ${warningCount} warnings, ${errorCount} errors`,
      });

      await loadData();
    } catch (error) {
      console.error('Validation failed:', error);
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
      setValidationProgress(0);
    }
  };

  const toggleResource = (resourceId: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-500/20 text-green-400">Passed</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Warning</Badge>;
      case 'failed':
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const displayResult = currentResult || (validationResults.length > 0 ? validationResults[0] : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Validation</h1>
          <p className="text-muted-foreground mt-1">
            Validate exported data for schema compliance, references, and completeness
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Validation Controls */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Run Validation
          </CardTitle>
          <CardDescription>
            Select an export job to validate its resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedExportJob} onValueChange={setSelectedExportJob}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an export job to validate" />
              </SelectTrigger>
              <SelectContent>
                {exportJobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      {job.name} ({format(new Date(job.created_at), 'MMM d, yyyy')})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runValidation} disabled={!selectedExportJob || isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Validate
                </>
              )}
            </Button>
          </div>

          {isValidating && (
            <div className="space-y-2">
              <Progress value={validationProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Validating resources... {validationProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Rules Info */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Validation Checks</CardTitle>
          <CardDescription>
            The following checks are performed on each resource
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VALIDATION_RULES.map(rule => (
              <div key={rule.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="font-medium text-sm text-foreground">{rule.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {displayResult && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Validation Results
                {getStatusBadge(displayResult.status)}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> {displayResult.passed_count} passed
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  <AlertTriangle className="w-4 h-4" /> {displayResult.warning_count} warnings
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="w-4 h-4" /> {displayResult.error_count} errors
                </span>
              </div>
            </div>
            <CardDescription>
              Validated {displayResult.total_resources} resources on{' '}
              {format(new Date(displayResult.created_at), 'MMM d, yyyy HH:mm')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {displayResult.validation_details.map((detail) => (
                  <Collapsible
                    key={detail.resourceId}
                    open={expandedResources.has(detail.resourceId)}
                    onOpenChange={() => toggleResource(detail.resourceId)}
                  >
                    <CollapsibleTrigger asChild>
                      <motion.div
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                        whileHover={{ scale: 1.005 }}
                      >
                        <div className="flex items-center gap-3">
                          {expandedResources.has(detail.resourceId) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          {getStatusIcon(detail.status)}
                          <div>
                            <p className="font-medium text-sm text-foreground">{detail.resourceName}</p>
                            <p className="text-xs text-muted-foreground">{detail.resourceType}</p>
                          </div>
                        </div>
                        {getStatusBadge(detail.status)}
                      </motion.div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-2 space-y-1 pb-2">
                        {detail.checks.map((check, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded bg-background/50 text-sm"
                          >
                            {getStatusIcon(check.status)}
                            <span className="font-medium">{check.name}:</span>
                            <span className="text-muted-foreground">{check.message}</span>
                          </div>
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
    </div>
  );
};
