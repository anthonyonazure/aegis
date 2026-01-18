import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Loader2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cloud,
  Server,
  Zap,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  performPreflightCheck,
  getMissingPermissionsSummary,
  PreflightCheckResult,
  getAzureRoleGuidance,
  getPermissionsCopyText,
  isAzureRbacPermission,
} from '@/lib/permissionsCheck';
import {
  validatePermissionsLive,
  LiveValidationResult,
  LiveValidationResponse,
  getErrorGuidance,
  groupValidationFailures,
} from '@/lib/permissionValidator';
import { useToast } from '@/hooks/use-toast';

interface PreflightCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
  azureToken?: string | null;
  azureRoles?: string[];
  selectedResources: string[];
  subscriptionIds?: string[];
  onProceed: () => void;
  onCancel: () => void;
  onRefreshToken?: () => Promise<string | null>;
}

export function PreflightCheckDialog({
  open,
  onOpenChange,
  accessToken,
  azureToken,
  azureRoles = [],
  selectedResources,
  subscriptionIds = [],
  onProceed,
  onCancel,
  onRefreshToken,
}: PreflightCheckDialogProps) {
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<PreflightCheckResult | null>(null);
  const [showGrantedPermissions, setShowGrantedPermissions] = useState(false);
  const [filterProvider, setFilterProvider] = useState<'all' | 'graph' | 'azure'>('all');
  const [currentToken, setCurrentToken] = useState<string | null>(accessToken);
  
  // Live validation state
  const [liveValidating, setLiveValidating] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveValidationResponse | null>(null);
  const [showLiveResults, setShowLiveResults] = useState(false);
  
  const { toast } = useToast();

  // Run preflight check
  const runPreflightCheck = useCallback((token: string | null, roles: string[], resources: string[]) => {
    if (token && resources.length > 0) {
      setChecking(true);
      setTimeout(() => {
        const checkResult = performPreflightCheck(token, resources, roles);
        setResult(checkResult);
        setChecking(false);
      }, 500);
    }
  }, []);

  // Only run once when dialog opens
  useEffect(() => {
    if (open && accessToken && selectedResources.length > 0) {
      setCurrentToken(accessToken);
      setResult(null);
      setLiveResults(null);
      setShowLiveResults(false);
      setChecking(true);
      runPreflightCheck(accessToken, azureRoles, selectedResources);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only trigger on open change, not on every prop change

  // Run live validation
  const handleLiveValidation = async () => {
    if (!currentToken && !azureToken) {
      toast({
        title: 'No Token Available',
        description: 'Please connect to Microsoft 365 or Azure first.',
        variant: 'destructive',
      });
      return;
    }

    setLiveValidating(true);
    setShowLiveResults(true);
    
    try {
      const liveResult = await validatePermissionsLive(
        currentToken,
        azureToken || null,
        selectedResources,
        subscriptionIds
      );
      
      setLiveResults(liveResult);
      
      if (liveResult.success) {
        toast({
          title: 'All Tests Passed! ✓',
          description: `${liveResult.summary.passed} endpoints validated successfully.`,
        });
      } else {
        const failures = groupValidationFailures(liveResult.results);
        if (failures.permissionIssues.length > 0) {
          toast({
            title: 'Permission Issues Found',
            description: `${failures.permissionIssues.length} resources returned 403 Forbidden. Add missing permissions or admin consent.`,
            variant: 'destructive',
          });
        } else if (failures.authIssues.length > 0) {
          toast({
            title: 'Authentication Issues',
            description: 'Token expired or invalid. Try reconnecting.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Validation Error',
        description: error instanceof Error ? error.message : 'Failed to run live validation',
        variant: 'destructive',
      });
    } finally {
      setLiveValidating(false);
    }
  };

  // Handle refresh permissions button
  const handleRefreshPermissions = async () => {
    if (!onRefreshToken) {
      toast({
        title: 'Cannot Refresh',
        description: 'No stored credentials available. Please disconnect and reconnect.',
        variant: 'destructive',
      });
      return;
    }

    setRefreshing(true);
    try {
      const newToken = await onRefreshToken();
      if (newToken) {
        setCurrentToken(newToken);
        runPreflightCheck(newToken, azureRoles, selectedResources);
        toast({
          title: 'Permissions Refreshed',
          description: 'Token refreshed. Checking permissions with new token...',
        });
      } else {
        toast({
          title: 'Refresh Failed',
          description: 'Could not get a new token. Please disconnect and reconnect.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Refresh Error',
        description: 'An error occurred while refreshing permissions.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyMissingPermissions = () => {
    if (!result) return;
    const copyText = getPermissionsCopyText(result.results);
    navigator.clipboard.writeText(copyText);
    toast({
      title: 'Copied!',
      description: 'Permission setup instructions copied to clipboard',
    });
  };

  // Get Azure role guidance for missing Azure resources
  const missingAzureResources = result?.results.filter(r => r.provider === 'azure' && !r.hasPermission) || [];
  const missingGraphResources = result?.results.filter(r => r.provider === 'graph' && !r.hasPermission) || [];
  const azureGuidance = missingAzureResources.length > 0 ? getAzureRoleGuidance(missingAzureResources) : null;

  const accessiblePercent = result
    ? Math.round((result.accessibleResources / result.totalResources) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Permission Preflight Check
          </DialogTitle>
          <DialogDescription>
            Validating permissions for {result?.graphResources || 0} Graph API and {result?.azureResources || 0} Azure resources
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        ) : result ? (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 text-center">
                <p className="text-2xl font-bold text-foreground">{result.totalResources}</p>
                <p className="text-sm text-muted-foreground">Total Resources</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10 text-center">
                <p className="text-2xl font-bold text-success">{result.accessibleResources}</p>
                <p className="text-sm text-muted-foreground">Accessible</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 text-center">
                <p className="text-2xl font-bold text-destructive">{result.deniedResources}</p>
                <p className="text-sm text-muted-foreground">Will Fail</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Permission Coverage</span>
                <span className={cn(
                  "font-medium",
                  accessiblePercent === 100 ? "text-success" : 
                  accessiblePercent >= 50 ? "text-warning" : "text-destructive"
                )}>
                  {accessiblePercent}%
                </span>
              </div>
              <Progress 
                value={accessiblePercent} 
                className={cn(
                  "h-2",
                  accessiblePercent === 100 ? "[&>div]:bg-success" : 
                  accessiblePercent >= 50 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"
                )}
              />
            </div>

            {/* Azure RBAC Warning - Show when Azure resources are missing */}
            {azureGuidance && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-lg border bg-blue-500/10 border-blue-500/20"
              >
                <Server className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    Azure: Assign Role to Service Principal
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>Export only:</strong> Assign "Reader" role<br/>
                    <strong>Export + Import:</strong> Assign "Contributor" role
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Go to Subscriptions → Your Subscription → Access Control (IAM) → Add role assignment
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={azureGuidance.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open Subscriptions
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href="https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        How to Assign Roles
                      </a>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Graph API Warning - Show when Graph resources are missing */}
            {missingGraphResources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-lg border bg-purple-500/10 border-purple-500/20"
              >
                <Cloud className="w-5 h-5 flex-shrink-0 mt-0.5 text-purple-500" />
                <div className="flex-1">
                  <p className="font-medium text-purple-600 dark:text-purple-400">
                    M365: Add API Permissions ({missingGraphResources.length} resources)
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add the missing Graph API permissions in Azure Portal → App Registrations → API Permissions, then click "Grant admin consent".
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open App Registrations
                      </a>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* General action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {result.deniedResources > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCopyMissingPermissions}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Setup Instructions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPermissions}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Refresh
                      </>
                    )}
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleLiveValidation}
                disabled={liveValidating}
                className="gap-1"
              >
                {liveValidating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Testing APIs...
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3" />
                    Run Live Test
                  </>
                )}
              </Button>
            </div>

            {/* Live Validation Results */}
            {showLiveResults && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg overflow-hidden"
              >
                <div className={cn(
                  "flex items-center justify-between p-3",
                  liveResults?.success 
                    ? "bg-success/10 border-b border-success/20" 
                    : liveResults 
                      ? "bg-destructive/10 border-b border-destructive/20"
                      : "bg-secondary/30 border-b"
                )}>
                  <div className="flex items-center gap-2">
                    {liveValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : liveResults?.success ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : liveResults ? (
                      <XCircle className="w-4 h-4 text-destructive" />
                    ) : null}
                    <span className="font-medium text-sm">
                      {liveValidating 
                        ? 'Testing API endpoints...' 
                        : liveResults?.success 
                          ? 'All tests passed!' 
                          : `${liveResults?.summary.failed || 0} tests failed`
                      }
                    </span>
                  </div>
                  {liveResults && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {liveResults.summary.avgResponseTime}ms avg
                      </span>
                      <span className="text-success">{liveResults.summary.passed} passed</span>
                      {liveResults.summary.failed > 0 && (
                        <span className="text-destructive">{liveResults.summary.failed} failed</span>
                      )}
                    </div>
                  )}
                </div>
                
                {liveResults && !liveResults.success && (
                  <div className="p-3 space-y-2 max-h-[150px] overflow-y-auto">
                    {liveResults.results.filter(r => !r.success).map((res) => (
                      <div 
                        key={res.resourceId}
                        className="flex items-start gap-2 p-2 rounded bg-destructive/5 text-sm"
                      >
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{res.resourceName}</span>
                            {res.statusCode && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                                {res.statusCode}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getErrorGuidance(res)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Provider Filter */}
            {result && (result.graphResources > 0 && result.azureResources > 0) && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'graph', label: `M365 (${result.graphResources})`, icon: Cloud },
                  { id: 'azure', label: `Azure (${result.azureResources})`, icon: Server },
                ].map((option) => (
                  <button
                    key={option.id}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                      filterProvider === option.id 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-card hover:bg-secondary/50 text-muted-foreground"
                    )}
                    onClick={() => setFilterProvider(option.id as typeof filterProvider)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Resource List - Failed resources first */}
            <ScrollArea className="h-[250px] -mx-6 px-6">
              <div className="space-y-2 pr-4">
                <p className="text-sm font-medium text-foreground">Resource Status</p>
                {result.results
                  .filter(r => filterProvider === 'all' || r.provider === filterProvider)
                  .slice()
                  .sort((a, b) => (a.hasPermission === b.hasPermission ? 0 : a.hasPermission ? 1 : -1))
                  .map((res, idx) => (
                  <motion.div
                    key={res.resourceId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "flex items-start justify-between p-2.5 rounded-lg gap-3",
                      res.hasPermission ? "bg-success/5" : "bg-destructive/5"
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {res.hasPermission ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground">{res.resourceName}</p>
                          {res.provider === 'azure' ? (
                            <Server className="w-3 h-3 text-blue-500" />
                          ) : (
                            <Cloud className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        {!res.hasPermission && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {res.provider === 'azure' ? (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                Assign: Reader (export) or Contributor (import)
                              </span>
                            ) : (
                              <>
                                {res.missingPermissions.slice(0, 2).map((perm) => (
                                  <code 
                                    key={perm} 
                                    className="text-[10px] text-destructive font-mono bg-destructive/10 px-1 py-0.5 rounded cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(perm);
                                      toast({ title: 'Copied!' });
                                    }}
                                  >
                                    {perm}
                                  </code>
                                ))}
                                {res.missingPermissions.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{res.missingPermissions.length - 2} more
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] flex-shrink-0",
                        res.hasPermission 
                          ? "text-success border-success/30" 
                          : "text-destructive border-destructive/30"
                      )}
                    >
                      {res.hasPermission ? 'Ready' : 'Missing'}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* Granted Permissions (collapsible) */}
            <div className="border-t border-border pt-4">
              <button
                onClick={() => setShowGrantedPermissions(!showGrantedPermissions)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showGrantedPermissions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                View granted permissions ({result.grantedRoles.length})
              </button>
              {showGrantedPermissions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {result.grantedRoles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs font-mono">
                      {role}
                    </Badge>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onProceed}
            disabled={checking || !result}
            variant={result?.deniedResources && accessiblePercent < 50 ? "destructive" : "default"}
          >
            {result?.deniedResources ? (
              accessiblePercent < 50 ? (
                <>Proceed Anyway ({result.accessibleResources} of {result.totalResources})</>
              ) : (
                <>Proceed ({result.accessibleResources} resources)</>
              )
            ) : (
              <>Start Export</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}