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
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PermissionResult {
  permission: string;
  displayName: string;
  hasPermission: boolean;
  features: string[];
  severity: 'critical' | 'high' | 'medium';
  category: string;
}

// All required permissions grouped by category, with features they unlock
const REQUIRED_PERMISSIONS: Record<string, { permissions: Record<string, { displayName: string; features: string[]; severity: 'critical' | 'high' | 'medium' }> }> = {
  'Intune / Endpoint Management': {
    permissions: {
      'DeviceManagementConfiguration.Read.All': {
        displayName: 'Device Management Config (Read)',
        features: ['Export device configs', 'Compliance policies', 'Update rings', 'Drift detection'],
        severity: 'critical',
      },
      'DeviceManagementConfiguration.ReadWrite.All': {
        displayName: 'Device Management Config (Read/Write)',
        features: ['Deploy device configs', 'Import compliance policies', 'Policy deployment'],
        severity: 'high',
      },
      'DeviceManagementApps.Read.All': {
        displayName: 'Device Management Apps (Read)',
        features: ['Export apps & scripts', 'App configuration policies', 'Win32 app backup'],
        severity: 'high',
      },
      'DeviceManagementApps.ReadWrite.All': {
        displayName: 'Device Management Apps (Read/Write)',
        features: ['Deploy apps', 'Import app configs', 'Restore app assignments'],
        severity: 'high',
      },
      'DeviceManagementManagedDevices.Read.All': {
        displayName: 'Managed Devices (Read)',
        features: ['Device inventory', 'Managed device reports'],
        severity: 'medium',
      },
      'DeviceManagementServiceConfig.Read.All': {
        displayName: 'Service Config (Read)',
        features: ['Autopilot profiles', 'Enrollment restrictions'],
        severity: 'high',
      },
    },
  },
  'Entra ID / Directory': {
    permissions: {
      'Directory.Read.All': {
        displayName: 'Directory (Read)',
        features: ['Users & groups', 'Role assignments', 'Directory settings', 'Governance metrics'],
        severity: 'critical',
      },
      'Application.Read.All': {
        displayName: 'Applications (Read)',
        features: ['App registrations export', 'Service principal audit'],
        severity: 'medium',
      },
      'RoleManagement.Read.Directory': {
        displayName: 'Role Management (Read)',
        features: ['Role assignments', 'Admin role audit'],
        severity: 'medium',
      },
      'Domain.Read.All': {
        displayName: 'Domains (Read)',
        features: ['Domain configuration export'],
        severity: 'medium',
      },
      'AdministrativeUnit.Read.All': {
        displayName: 'Administrative Units (Read)',
        features: ['Admin unit export', 'Scoped role assignments'],
        severity: 'medium',
      },
    },
  },
  'Security & Compliance': {
    permissions: {
      'Policy.Read.All': {
        displayName: 'Policies (Read)',
        features: ['Conditional Access policies', 'Named locations', 'Auth strengths'],
        severity: 'critical',
      },
      'SecurityEvents.Read.All': {
        displayName: 'Security Events (Read)',
        features: ['Defender configurations', 'Security alerts', 'Secure Score'],
        severity: 'high',
      },
    },
  },
  'Copilot Readiness': {
    permissions: {
      'Organization.Read.All': {
        displayName: 'Organization (Read)',
        features: ['Copilot licensing check', 'Organization info', 'Subscribed SKUs'],
        severity: 'high',
      },
      'AuditLog.Read.All': {
        displayName: 'Audit Logs (Read)',
        features: ['MFA assessment', 'Authentication methods report', 'Sign-in audit'],
        severity: 'high',
      },
      'UserAuthenticationMethod.Read.All': {
        displayName: 'User Auth Methods (Read)',
        features: ['MFA coverage check', 'Per-user auth method audit'],
        severity: 'medium',
      },
      'Reports.Read.All': {
        displayName: 'Reports (Read)',
        features: ['Copilot usage reports', 'Adoption analytics'],
        severity: 'high',
      },
      'InformationProtectionPolicy.Read.All': {
        displayName: 'Info Protection Policy (Read)',
        features: ['Sensitivity labels', 'Data governance readiness', 'DLP policy review'],
        severity: 'high',
      },
    },
  },
  'Collaboration': {
    permissions: {
      'Sites.Read.All': {
        displayName: 'SharePoint Sites (Read)',
        features: ['SharePoint settings', 'Copilot readiness (SharePoint)'],
        severity: 'medium',
      },
      'TeamSettings.Read.All': {
        displayName: 'Teams Settings (Read)',
        features: ['Teams policies', 'Teams app settings'],
        severity: 'medium',
      },
      'TeamworkAppSettings.Read.All': {
        displayName: 'Teamwork App Settings (Read)',
        features: ['Copilot Teams transcription check', 'Teams app governance'],
        severity: 'medium',
      },
      'MailboxSettings.Read': {
        displayName: 'Mailbox Settings (Read)',
        features: ['Exchange mailbox status', 'Mail flow configuration'],
        severity: 'medium',
      },
    },
  },
};

// Flatten for the feature map used in impact analysis
const PERMISSION_FEATURE_MAP: Record<string, { features: string[]; severity: 'critical' | 'high' | 'medium' }> = {};
Object.values(REQUIRED_PERMISSIONS).forEach(cat => {
  Object.entries(cat.permissions).forEach(([perm, info]) => {
    PERMISSION_FEATURE_MAP[perm] = { features: info.features, severity: info.severity };
  });
});

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

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
  const [readOnlyMode, setReadOnlyMode] = useState(true);
  const [copiedPerm, setCopiedPerm] = useState<string | null>(null);

  const copyPermission = (perm: string) => {
    navigator.clipboard.writeText(perm);
    setCopiedPerm(perm);
    setTimeout(() => setCopiedPerm(null), 1500);
  };

  // Filter results based on read-only toggle
  const isReadWritePerm = (perm: string) => perm.includes('.ReadWrite.');
  const filteredResults = readOnlyMode ? results.filter(r => !isReadWritePerm(r.permission)) : results;

  const runCheck = async () => {
    setIsChecking(true);
    try {
      // Decode the JWT to extract granted roles/permissions
      const payload = decodeJwtPayload(accessToken);
      if (!payload) throw new Error('Could not decode access token');

      const grantedRoles = new Set<string>(
        (payload.roles as string[] || [])
      );

      // Also check scp (delegated permissions) if present
      if (typeof payload.scp === 'string') {
        payload.scp.split(' ').forEach(s => grantedRoles.add(s));
      }

      // Check each required permission against granted roles
      const mapped: PermissionResult[] = [];
      Object.entries(REQUIRED_PERMISSIONS).forEach(([category, { permissions }]) => {
        Object.entries(permissions).forEach(([perm, info]) => {
          // Check exact match or ReadWrite satisfying Read
          const hasIt = grantedRoles.has(perm) ||
            // ReadWrite.All covers Read.All for the same scope prefix
            (perm.endsWith('.Read.All') && grantedRoles.has(perm.replace('.Read.All', '.ReadWrite.All')));
          
          mapped.push({
            permission: perm,
            displayName: info.displayName,
            hasPermission: hasIt,
            features: info.features,
            severity: info.severity,
            category,
          });
        });
      });

      setResults(mapped);
      setHasChecked(true);

      const passedCount = mapped.filter(r => r.hasPermission).length;
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

  const passed = filteredResults.filter(r => r.hasPermission);
  const missing = filteredResults.filter(r => !r.hasPermission);
  const score = filteredResults.length > 0 ? Math.round((passed.length / filteredResults.length) * 100) : 0;

  // Collect all missing permissions and their affected features
  const uniqueMissingPermissions = missing.map(r => ({
    permission: r.permission,
    features: r.features,
    severity: r.severity,
    displayName: r.displayName,
    category: r.category,
  })).sort((a, b) => {
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="read-only-mode"
                checked={readOnlyMode}
                onCheckedChange={setReadOnlyMode}
              />
              <Label htmlFor="read-only-mode" className="text-xs text-muted-foreground cursor-pointer">
                {readOnlyMode ? 'Read-only' : 'Read + Write'}
              </Label>
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
                    {passed.length}/{filteredResults.length} permissions granted
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
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-destructive">{item.permission}</code>
                          <button
                            onClick={() => copyPermission(item.permission)}
                            className="p-1 rounded hover:bg-muted/50 transition-colors shrink-0"
                            title="Copy permission name"
                          >
                            {copiedPerm === item.permission ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <Badge className={cn("ml-auto", sevConfig.className)} variant="outline">
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
                      key={r.permission}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-muted-foreground">{r.displayName}</span>
                      <span className="text-xs text-muted-foreground/60 ml-auto">{r.permission}</span>
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
