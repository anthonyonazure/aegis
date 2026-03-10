import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PermissionResult {
  resource: string;
  resourceName: string;
  hasPermission: boolean;
  requiredPermissions: string[];
  testedEndpoint?: string;
}

// Map permissions to the features they unlock
const PERMISSION_FEATURE_MAP: Record<string, { features: string[]; severity: 'critical' | 'high' | 'medium' }> = {
  'DeviceManagementConfiguration.Read.All': {
    features: ['Export device configs', 'Compliance policies', 'Update rings', 'Drift detection for Intune'],
    severity: 'critical',
  },
  'DeviceManagementConfiguration.ReadWrite.All': {
    features: ['Deploy device configs', 'Import compliance policies', 'Policy deployment'],
    severity: 'high',
  },
  'DeviceManagementApps.Read.All': {
    features: ['Export apps & scripts', 'App configuration policies', 'Win32 app backup'],
    severity: 'high',
  },
  'DeviceManagementApps.ReadWrite.All': {
    features: ['Deploy apps', 'Import app configs', 'Restore app assignments'],
    severity: 'high',
  },
  'DeviceManagementManagedDevices.Read.All': {
    features: ['Device inventory', 'Managed device reports'],
    severity: 'medium',
  },
  'DeviceManagementServiceConfig.Read.All': {
    features: ['Autopilot profiles', 'Enrollment restrictions'],
    severity: 'high',
  },
  'Policy.Read.All': {
    features: ['Conditional Access policies', 'Named locations', 'Auth strengths', 'Copilot readiness checks'],
    severity: 'critical',
  },
  'Directory.Read.All': {
    features: ['Users & groups', 'Role assignments', 'Directory settings', 'Governance metrics'],
    severity: 'critical',
  },
  'Application.Read.All': {
    features: ['App registrations export', 'Service principal audit'],
    severity: 'medium',
  },
  'RoleManagement.Read.Directory': {
    features: ['Role assignments', 'Admin role audit'],
    severity: 'medium',
  },
  'SecurityEvents.Read.All': {
    features: ['Defender configurations', 'Security alerts', 'Secure Score'],
    severity: 'high',
  },
  'Sites.Read.All': {
    features: ['SharePoint settings', 'Copilot readiness (SharePoint)', 'Data governance checks'],
    severity: 'medium',
  },
  'TeamSettings.Read.All': {
    features: ['Teams policies', 'Teams app settings'],
    severity: 'medium',
  },
  'Organization.Read.All': {
    features: ['Copilot licensing check', 'Organization info', 'Subscribed SKUs'],
    severity: 'high',
  },
  'AuditLog.Read.All': {
    features: ['Copilot MFA assessment', 'Authentication methods report', 'Sign-in audit'],
    severity: 'high',
  },
  'UserAuthenticationMethod.Read.All': {
    features: ['Copilot MFA coverage check', 'Per-user auth method audit'],
    severity: 'medium',
  },
  'InformationProtection.Read.All': {
    features: ['Copilot sensitivity labels check', 'Data governance readiness'],
    severity: 'high',
  },
  'TeamworkAppSettings.Read.All': {
    features: ['Copilot Teams transcription check', 'Teams app governance'],
    severity: 'medium',
  },
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  high: { label: 'High', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { label: 'Medium', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

interface PermissionHealthIndicatorProps {
  connectionId: string;
  accessToken: string;
}

export const PermissionHealthIndicator = ({ connectionId, accessToken }: PermissionHealthIndicatorProps) => {
  const { toast } = useToast();
  const [results, setResults] = useState<PermissionResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['missing']);

  // All Graph resource IDs the edge function knows about
  const ALL_GRAPH_RESOURCES = [
    'intune/device-configurations', 'intune/compliance-policies', 'intune/app-configurations',
    'intune/autopilot', 'intune/scripts', 'intune/win32-apps', 'intune/update-rings',
    'intune/enrollment-restrictions', 'conditional-access/ca-policies', 'conditional-access/named-locations',
    'conditional-access/auth-strengths', 'entra/users', 'entra/groups', 'entra/directory-roles',
    'entra/applications', 'entra/domains', 'entra/admin-units', 'entra/directory-settings',
    'defender/security-alerts', 'defender/secure-score', 'defender/antivirus-policies',
    'defender/disk-encryption-policies', 'defender/firewall-policies',
    'sharepoint/tenant-settings', 'teams/messaging-policies',
    'copilot/licensing', 'copilot/organization-info', 'copilot/mfa-registration',
    'copilot/auth-methods', 'copilot/sensitivity-labels', 'copilot/sharepoint-sharing',
    'copilot/onedrive-provisioning', 'copilot/exchange-mailbox', 'copilot/teams-settings',
    'copilot/conditional-access', 'copilot/usage-reports',
  ];

  const runCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-permissions', {
        body: { graphToken: accessToken, resourceIds: ALL_GRAPH_RESOURCES },
      });

      if (error) throw error;

      // Map edge function results to component's PermissionResult format
      const mapped: PermissionResult[] = (data?.results || []).map((r: any) => ({
        resource: r.resourceId,
        resourceName: r.resourceName,
        hasPermission: r.success,
        requiredPermissions: r.error ? [r.error] : [],
        testedEndpoint: r.resourceId,
      }));

      setResults(mapped);
      setHasChecked(true);

      const passedCount = mapped.filter((r: PermissionResult) => r.hasPermission).length;
      const total = mapped.length;

      toast({
        title: 'Permission Check Complete',
        description: `${passedCount}/${total} permissions verified`,
      });
    } catch (error) {
      console.error('Permission check failed:', error);
      toast({
        title: 'Permission Check Failed',
        description: error instanceof Error ? error.message : 'Could not validate permissions',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const passed = results.filter(r => r.hasPermission);
  const missing = results.filter(r => !r.hasPermission);
  const score = results.length > 0 ? Math.round((passed.length / results.length) * 100) : 0;

  // Collect all missing permissions and their affected features
  const missingPermissionImpact = missing.flatMap(r =>
    r.requiredPermissions.map(perm => ({
      permission: perm,
      resourceName: r.resourceName,
      ...(PERMISSION_FEATURE_MAP[perm] || { features: [r.resourceName], severity: 'medium' as const }),
    }))
  );

  // Deduplicate by permission
  const uniqueMissingPermissions = Array.from(
    new Map(missingPermissionImpact.map(p => [p.permission, p])).values()
  ).sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              hasChecked
                ? missing.length === 0 ? "bg-green-500/20" : missing.length <= 3 ? "bg-yellow-500/20" : "bg-destructive/20"
                : "bg-muted"
            )}>
              <Shield className={cn(
                "w-5 h-5",
                hasChecked
                  ? missing.length === 0 ? "text-green-400" : missing.length <= 3 ? "text-yellow-400" : "text-destructive"
                  : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-lg">Permission Health</CardTitle>
              <CardDescription>
                Verify granted API permissions and see what features are affected
              </CardDescription>
            </div>
          </div>
          <Button onClick={runCheck} disabled={isChecking} variant={hasChecked ? "outline" : "default"} size="sm">
            {isChecking ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {hasChecked ? 'Re-check' : 'Check Permissions'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasChecked && !isChecking && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Run a permission check to see which features are available</p>
          </div>
        )}

        {isChecking && (
          <div className="text-center py-6">
            <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validating permissions against Microsoft Graph...</p>
          </div>
        )}

        {hasChecked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Score bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {passed.length}/{results.length} permissions granted
                  </span>
                  <span className={cn(
                    "text-sm font-bold",
                    score === 100 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-destructive"
                  )}>
                    {score}%
                  </span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            </div>

            {/* Missing permissions with impact */}
            {uniqueMissingPermissions.length > 0 && (
              <Collapsible open={expandedGroups.includes('missing')}>
                <CollapsibleTrigger
                  onClick={() => toggleGroup('missing')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-foreground">
                      {uniqueMissingPermissions.length} Missing Permission{uniqueMissingPermissions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {expandedGroups.includes('missing') ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {uniqueMissingPermissions.map((item) => {
                    const sevConfig = SEVERITY_CONFIG[item.severity];
                    return (
                      <div
                        key={item.permission}
                        className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono text-destructive">{item.permission}</code>
                          <Badge className={sevConfig.className} variant="outline">
                            {sevConfig.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.features.map((feature, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-muted/50 text-muted-foreground">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Granted permissions */}
            {passed.length > 0 && (
              <Collapsible open={expandedGroups.includes('granted')}>
                <CollapsibleTrigger
                  onClick={() => toggleGroup('granted')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-foreground">
                      {passed.length} Granted Permission{passed.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {expandedGroups.includes('granted') ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {passed.map((r) => (
                    <div
                      key={r.resource}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-muted-foreground">{r.resourceName}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* All clear */}
            {missing.length === 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium text-foreground">All permissions verified</p>
                <p className="text-xs text-muted-foreground mt-1">All features are available for this tenant</p>
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
