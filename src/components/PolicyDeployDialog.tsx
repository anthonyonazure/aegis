import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Check,
  X,
  Loader2,
  Upload,
  Building2,
  ArrowRight,
  FileText,
  Plus,
  RefreshCw,
  SkipForward,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  deployPoliciesToTenant,
  getDeploymentTargets,
  DeploymentTarget,
  DeploymentResult,
  PolicyChange,
  GroupedPolicy,
  PolicyItem,
} from '@/lib/policyDeployment';
import { cn } from '@/lib/utils';

interface PolicyDeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPolicies: Map<string, PolicyItem>;
  sourceInfo: {
    tenantName?: string;
    customerName?: string;
    tenantConnectionId?: string | null;
  };
}

type DeployStep = 'configure' | 'preview' | 'deploying' | 'complete';

export function PolicyDeployDialog({
  open,
  onOpenChange,
  selectedPolicies,
  sourceInfo,
}: PolicyDeployDialogProps) {
  const { toast } = useToast();
  
  // State
  const [step, setStep] = useState<DeployStep>('configure');
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  
  // Deployment options
  const [skipExisting, setSkipExisting] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [renameDuplicates, setRenameDuplicates] = useState(false);
  
  // Preview and results
  const [previewResult, setPreviewResult] = useState<DeploymentResult | null>(null);
  const [deployResult, setDeployResult] = useState<DeploymentResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Load available targets
  useEffect(() => {
    if (open) {
      loadTargets();
      // Reset state when dialog opens
      setStep('configure');
      setSelectedTargetId('');
      setPreviewResult(null);
      setDeployResult(null);
      setSkipExisting(true);
      setOverwriteExisting(false);
      setRenameDuplicates(false);
    }
  }, [open]);

  const loadTargets = async () => {
    setLoadingTargets(true);
    try {
      const result = await getDeploymentTargets();
      setTargets(result);
    } catch (err) {
      console.error('Failed to load targets:', err);
      toast({
        title: 'Failed to load tenants',
        description: 'Could not fetch available tenant connections',
        variant: 'destructive',
      });
    } finally {
      setLoadingTargets(false);
    }
  };

  // Group targets by customer
  const groupedTargets = useMemo(() => {
    const groups: Record<string, DeploymentTarget[]> = {};
    
    for (const target of targets) {
      const key = target.customerName || 'No Customer';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(target);
    }
    
    return groups;
  }, [targets]);

  // Get selected target info
  const selectedTarget = useMemo(() => {
    return targets.find(t => t.tenantConnectionId === selectedTargetId);
  }, [targets, selectedTargetId]);

  // Check if deploying cross-customer
  const isCrossCustomer = useMemo(() => {
    if (!selectedTarget || !sourceInfo.customerName) return false;
    return selectedTarget.customerName !== sourceInfo.customerName;
  }, [selectedTarget, sourceInfo.customerName]);

  // Group selected policies for deployment
  const groupedPolicies = useMemo((): GroupedPolicy[] => {
    const groups: Record<string, GroupedPolicy> = {};
    
    for (const [key, policy] of selectedPolicies) {
      const parts = key.split('/');
      if (parts.length < 3) continue;
      
      const categoryId = parts[0];
      const policyTypeId = parts[1];
      const groupKey = `${categoryId}/${policyTypeId}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          categoryId,
          policyTypeId,
          policies: [],
        };
      }
      groups[groupKey].policies.push(policy);
    }
    
    return Object.values(groups);
  }, [selectedPolicies]);

  // Handle preview (dry run)
  const handlePreview = async () => {
    if (!selectedTargetId) {
      toast({
        title: 'Select a target',
        description: 'Please select a target tenant for deployment',
        variant: 'destructive',
      });
      return;
    }

    setPreviewing(true);
    try {
      const result = await deployPoliciesToTenant(
        groupedPolicies,
        selectedTargetId,
        {
          skipExisting,
          overwriteExisting,
          renameDuplicates,
          dryRun: true,
        },
        sourceInfo.tenantConnectionId
      );
      
      setPreviewResult(result);
      setStep('preview');
    } catch (err) {
      console.error('Preview failed:', err);
      toast({
        title: 'Preview failed',
        description: err instanceof Error ? err.message : 'Failed to preview deployment',
        variant: 'destructive',
      });
    } finally {
      setPreviewing(false);
    }
  };

  // Handle actual deployment
  const handleDeploy = async () => {
    if (!selectedTargetId) return;

    setDeploying(true);
    setStep('deploying');
    
    try {
      const result = await deployPoliciesToTenant(
        groupedPolicies,
        selectedTargetId,
        {
          skipExisting,
          overwriteExisting,
          renameDuplicates,
          dryRun: false,
        },
        sourceInfo.tenantConnectionId
      );
      
      setDeployResult(result);
      setStep('complete');
      
      if (result.success) {
        toast({
          title: 'Deployment complete',
          description: `Created ${result.created} policies, skipped ${result.skipped}`,
        });
      } else {
        toast({
          title: 'Deployment completed with errors',
          description: `${result.failed} policies failed to deploy`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Deployment failed:', err);
      toast({
        title: 'Deployment failed',
        description: err instanceof Error ? err.message : 'Failed to deploy policies',
        variant: 'destructive',
      });
      setStep('configure');
    } finally {
      setDeploying(false);
    }
  };

  const handleClose = () => {
    if (!deploying) {
      onOpenChange(false);
    }
  };

  const renderChangeIcon = (action: PolicyChange['action']) => {
    switch (action) {
      case 'create':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'update':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'skip':
        return <SkipForward className="w-4 h-4 text-muted-foreground" />;
      case 'rename':
        return <FileText className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Deploy Policies to Tenant
          </DialogTitle>
          <DialogDescription>
            Deploy {selectedPolicies.size} selected policies to another tenant
          </DialogDescription>
        </DialogHeader>

        {/* Source info banner */}
        {sourceInfo.tenantName && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Source: <strong>{sourceInfo.customerName ? `${sourceInfo.customerName} / ` : ''}{sourceInfo.tenantName}</strong>
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground mx-2" />
            <span className="text-sm text-muted-foreground">
              {selectedTarget ? (
                <>Target: <strong>{selectedTarget.customerName ? `${selectedTarget.customerName} / ` : ''}{selectedTarget.tenantName}</strong></>
              ) : (
                'Select target tenant'
              )}
            </span>
          </div>
        )}

        {/* Cross-customer warning */}
        {isCrossCustomer && (
          <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="text-yellow-600 dark:text-yellow-400">Cross-Customer Deployment</strong>
              <p className="text-muted-foreground mt-1">
                You are deploying policies from <strong>{sourceInfo.customerName}</strong> to <strong>{selectedTarget?.customerName}</strong>. 
                Please verify this is intentional.
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {/* Step: Configure */}
          {step === 'configure' && (
            <div className="space-y-4">
              {/* Target selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Tenant</label>
                <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTargets ? 'Loading tenants...' : 'Select target tenant'} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {Object.entries(groupedTargets).map(([customerName, customerTargets]) => (
                      <SelectGroup key={customerName}>
                        <SelectLabel className="flex items-center gap-2">
                          <Building2 className="w-3 h-3" />
                          {customerName}
                        </SelectLabel>
                        {customerTargets.map(target => (
                          <SelectItem 
                            key={target.tenantConnectionId} 
                            value={target.tenantConnectionId}
                            disabled={target.tenantConnectionId === sourceInfo.tenantConnectionId}
                          >
                            {target.tenantName}
                            {target.tenantConnectionId === sourceInfo.tenantConnectionId && (
                              <span className="text-muted-foreground ml-2">(source)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Deployment options */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Deployment Options</label>
                
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="skipExisting"
                    checked={skipExisting}
                    onCheckedChange={(checked) => {
                      setSkipExisting(!!checked);
                      if (checked) setOverwriteExisting(false);
                    }}
                  />
                  <div className="space-y-1">
                    <label htmlFor="skipExisting" className="text-sm font-medium cursor-pointer">
                      Skip existing policies
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Only create new policies, skip if a policy with the same name already exists
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="overwriteExisting"
                    checked={overwriteExisting}
                    onCheckedChange={(checked) => {
                      setOverwriteExisting(!!checked);
                      if (checked) setSkipExisting(false);
                    }}
                  />
                  <div className="space-y-1">
                    <label htmlFor="overwriteExisting" className="text-sm font-medium cursor-pointer">
                      Overwrite existing policies
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Update existing policies with matching names to match the source configuration
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="renameDuplicates"
                    checked={renameDuplicates}
                    onCheckedChange={(checked) => setRenameDuplicates(!!checked)}
                  />
                  <div className="space-y-1">
                    <label htmlFor="renameDuplicates" className="text-sm font-medium cursor-pointer">
                      Rename duplicates
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Add "(Imported)" suffix to policy names to avoid conflicts
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy summary */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Policies to Deploy</h4>
                <div className="flex flex-wrap gap-2">
                  {groupedPolicies.map(group => (
                    <Badge key={`${group.categoryId}/${group.policyTypeId}`} variant="secondary">
                      {group.categoryId}/{group.policyTypeId}: {group.policies.length}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && previewResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{previewResult.created} to create</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">{previewResult.updated} to update</span>
                </div>
                <div className="flex items-center gap-2">
                  <SkipForward className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{previewResult.skipped} to skip</span>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-3 space-y-2">
                  {previewResult.changes.map((change, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg',
                        change.action === 'create' && 'bg-green-500/10',
                        change.action === 'update' && 'bg-blue-500/10',
                        change.action === 'skip' && 'bg-muted/50'
                      )}
                    >
                      {renderChangeIcon(change.action)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{change.resourceName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{change.reason}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {change.resourceType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {previewResult.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <h4 className="text-sm font-medium text-destructive mb-2">Errors</h4>
                  <ul className="text-xs space-y-1">
                    {previewResult.errors.map((err, idx) => (
                      <li key={idx} className="text-destructive">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step: Deploying */}
          {step === 'deploying' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Deploying policies...</p>
              <p className="text-sm text-muted-foreground">
                This may take a few moments
              </p>
              <Progress value={50} className="w-64" />
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && deployResult && (
            <div className="space-y-4">
              <div className={cn(
                'flex items-center gap-3 p-4 rounded-lg',
                deployResult.success ? 'bg-green-500/10' : 'bg-destructive/10'
              )}>
                {deployResult.success ? (
                  <Check className="w-8 h-8 text-green-500" />
                ) : (
                  <X className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <h3 className="font-medium">
                    {deployResult.success ? 'Deployment Complete' : 'Deployment Completed with Errors'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Created: {deployResult.created} | Updated: {deployResult.updated} | Skipped: {deployResult.skipped} | Failed: {deployResult.failed}
                  </p>
                </div>
              </div>

              {deployResult.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <h4 className="text-sm font-medium text-destructive mb-2">Errors</h4>
                  <ScrollArea className="h-[100px]">
                    <ul className="text-xs space-y-1">
                      {deployResult.errors.map((err, idx) => (
                        <li key={idx} className="text-destructive">{err}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!selectedTargetId || previewing}
              >
                {previewing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Previewing...
                  </>
                ) : (
                  'Preview Changes'
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={deploying || !previewResult || previewResult.changes.length === 0}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Deploy {previewResult?.created || 0} Policies
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
