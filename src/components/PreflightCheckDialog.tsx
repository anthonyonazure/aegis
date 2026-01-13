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
} from '@/lib/permissionsCheck';
import { useToast } from '@/hooks/use-toast';

interface PreflightCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
  selectedResources: string[];
  onProceed: () => void;
  onCancel: () => void;
  onRefreshToken?: () => Promise<string | null>;
}

export function PreflightCheckDialog({
  open,
  onOpenChange,
  accessToken,
  selectedResources,
  onProceed,
  onCancel,
  onRefreshToken,
}: PreflightCheckDialogProps) {
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<PreflightCheckResult | null>(null);
  const [showGrantedPermissions, setShowGrantedPermissions] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(accessToken);
  const { toast } = useToast();

  // Run preflight check
  const runPreflightCheck = useCallback((token: string | null) => {
    if (token && selectedResources.length > 0) {
      setChecking(true);
      setTimeout(() => {
        const checkResult = performPreflightCheck(token, selectedResources);
        setResult(checkResult);
        setChecking(false);
      }, 500);
    }
  }, [selectedResources]);

  useEffect(() => {
    if (open && accessToken && selectedResources.length > 0) {
      setCurrentToken(accessToken);
      runPreflightCheck(accessToken);
    }
  }, [open, accessToken, selectedResources, runPreflightCheck]);

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
        runPreflightCheck(newToken);
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
    const missing = getMissingPermissionsSummary(result.results);
    navigator.clipboard.writeText(missing.join('\n'));
    toast({
      title: 'Copied!',
      description: 'Missing permissions copied to clipboard',
    });
  };

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
            Validating Microsoft Graph API permissions for selected resources
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

            {/* Warning if some will fail */}
            {result.deniedResources > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20"
              >
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-warning">Some resources will fail to export</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add the missing permissions in Azure AD and grant admin consent, or proceed with partial export.
                  </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyMissingPermissions}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Missing Permissions
                    </Button>
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
                        Open Azure AD
                      </a>
                    </Button>
                    <Button
                      variant="default"
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
                          Refresh Permissions
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Resource List - Failed resources first */}
            <ScrollArea className="h-[280px] -mx-6 px-6">
              <div className="space-y-2 pr-4">
                <p className="text-sm font-medium text-foreground">Resource Status</p>
                {/* Show failed resources first */}
                {result.results
                  .slice()
                  .sort((a, b) => (a.hasPermission === b.hasPermission ? 0 : a.hasPermission ? 1 : -1))
                  .map((res, idx) => (
                  <motion.div
                    key={res.resourceId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "flex items-start justify-between p-3 rounded-lg gap-4",
                      res.hasPermission ? "bg-success/5" : "bg-destructive/5"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {res.hasPermission ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground">{res.resourceName}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{res.resourceId}</p>
                        {!res.hasPermission && res.missingPermissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {res.missingPermissions.map((perm) => (
                              <code 
                                key={perm} 
                                className="text-xs text-destructive font-mono bg-destructive/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-destructive/20 transition-colors"
                                onClick={() => {
                                  navigator.clipboard.writeText(perm);
                                  toast({
                                    title: 'Copied!',
                                    description: `${perm} copied to clipboard`,
                                  });
                                }}
                                title="Click to copy"
                              >
                                {perm}
                              </code>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {res.hasPermission ? (
                        <Badge variant="outline" className="text-success border-success/30 text-xs">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                          Missing
                        </Badge>
                      )}
                    </div>
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
          >
            {result?.deniedResources ? (
              <>Proceed Anyway ({result.accessibleResources} resources)</>
            ) : (
              <>Start Export</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
