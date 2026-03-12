import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Mail,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { PERMISSION_REQUIREMENTS, PermissionRequirement } from '@/lib/permissionsCheck';
import { ALL_RESOURCE_CATEGORIES } from '@/types/tenant';
import { cn } from '@/lib/utils';

interface PermissionStatus {
  permission: string;
  granted: boolean;
}

interface CategoryCheckResult {
  categoryId: string;
  categoryName: string;
  icon: string;
  resources: ResourceCheckResult[];
  grantedCount: number;
  totalCount: number;
  percentage: number;
  providerType: 'graph' | 'exo' | 'powershell' | 'mixed';
}

interface ResourceCheckResult {
  resourceId: string;
  resourceName: string;
  requiredPermissions: string[];
  alternativePermissions?: string[];
  allGranted: boolean;
  grantedPermissions: string[];
  missingPermissions: string[];
  providerType: 'graph' | 'exo' | 'powershell';
}

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

function getProviderType(resourceId: string): 'graph' | 'exo' | 'powershell' {
  const category = ALL_RESOURCE_CATEGORIES.find(c => c.id === resourceId.split('/')[0]);
  const sub = category?.subcategories.find(s => s.id === resourceId.split('/')[1]);
  if (sub?.exoEndpoint) return 'exo';
  if (sub?.powershellModule) return 'powershell';
  return 'graph';
}

function getCategoryIcon(categoryId: string): string {
  const cat = ALL_RESOURCE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.icon || 'Shield';
}

function getCategoryName(categoryId: string): string {
  const cat = ALL_RESOURCE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.name || categoryId;
}

export const PermissionsChecklistView = () => {
  const { toast } = useToast();
  const { isConnected, accessToken } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'missing' | 'granted'>('all');
  const [copiedPerm, setCopiedPerm] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [grantedPermissions, setGrantedPermissions] = useState<Set<string> | null>(null);

  const runCheck = () => {
    if (!accessToken) return;
    setIsChecking(true);

    try {
      const payload = decodeJwtPayload(accessToken);
      if (!payload) {
        toast({ title: 'Token Error', description: 'Could not decode access token', variant: 'destructive' });
        return;
      }

      const roles = new Set<string>(payload.roles as string[] || []);
      if (typeof payload.scp === 'string') {
        payload.scp.split(' ').forEach(s => roles.add(s));
      }

      setGrantedPermissions(roles);
      // Auto-expand categories with missing permissions
      const results = buildCategoryResults(roles);
      const withMissing = results.filter(c => c.percentage < 100).map(c => c.categoryId);
      setExpandedCategories(new Set(withMissing));
    } finally {
      setIsChecking(false);
    }
  };

  const isPermissionGranted = (perm: string, granted: Set<string>): boolean => {
    if (granted.has(perm)) return true;
    // ReadWrite.All covers Read.All
    if (perm.endsWith('.Read.All') && granted.has(perm.replace('.Read.All', '.ReadWrite.All'))) return true;
    if (perm.endsWith('.Read') && granted.has(perm.replace('.Read', '.ReadWrite'))) return true;
    return false;
  };

  const buildCategoryResults = (granted: Set<string>): CategoryCheckResult[] => {
    const categoryMap = new Map<string, ResourceCheckResult[]>();

    for (const req of PERMISSION_REQUIREMENTS) {
      const catId = req.resourceId.split('/')[0];
      if (!categoryMap.has(catId)) categoryMap.set(catId, []);

      const providerType = getProviderType(req.resourceId);
      const grantedPerms = req.requiredPermissions.filter(p => isPermissionGranted(p, granted));
      const missingPerms = req.requiredPermissions.filter(p => !isPermissionGranted(p, granted));

      // Check if any alternative permissions satisfy the requirement
      let allGranted = missingPerms.length === 0;
      if (!allGranted && req.alternativePermissions) {
        const hasAlternative = req.alternativePermissions.some(p => isPermissionGranted(p, granted));
        if (hasAlternative) allGranted = true;
      }

      // For EXO resources, check if Exchange.ManageAsApp role is present
      if (providerType === 'exo') {
        allGranted = granted.has('Exchange.ManageAsApp') || isPermissionGranted('Exchange.ManageAsApp', granted);
      }

      categoryMap.get(catId)!.push({
        resourceId: req.resourceId,
        resourceName: req.resourceName,
        requiredPermissions: req.requiredPermissions,
        alternativePermissions: req.alternativePermissions,
        allGranted,
        grantedPermissions: grantedPerms,
        missingPermissions: allGranted ? [] : missingPerms,
        providerType,
      });
    }

    return Array.from(categoryMap.entries()).map(([catId, resources]) => {
      const grantedCount = resources.filter(r => r.allGranted).length;
      const providers = new Set(resources.map(r => r.providerType));
      const providerType = providers.size > 1 ? 'mixed' as const : (providers.values().next().value || 'graph') as 'graph' | 'exo' | 'powershell';

      return {
        categoryId: catId,
        categoryName: getCategoryName(catId),
        icon: getCategoryIcon(catId),
        resources,
        grantedCount,
        totalCount: resources.length,
        percentage: resources.length > 0 ? Math.round((grantedCount / resources.length) * 100) : 0,
        providerType,
      };
    });
  };

  const categoryResults = useMemo(() => {
    if (!grantedPermissions) return [];
    return buildCategoryResults(grantedPermissions);
  }, [grantedPermissions]);

  const filteredResults = useMemo(() => {
    let results = categoryResults;

    if (filterMode === 'missing') {
      results = results.map(c => ({
        ...c,
        resources: c.resources.filter(r => !r.allGranted),
      })).filter(c => c.resources.length > 0);
    } else if (filterMode === 'granted') {
      results = results.map(c => ({
        ...c,
        resources: c.resources.filter(r => r.allGranted),
      })).filter(c => c.resources.length > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.map(c => ({
        ...c,
        resources: c.resources.filter(r =>
          r.resourceName.toLowerCase().includes(q) ||
          r.requiredPermissions.some(p => p.toLowerCase().includes(q)) ||
          r.resourceId.toLowerCase().includes(q)
        ),
      })).filter(c => c.resources.length > 0);
    }

    return results;
  }, [categoryResults, filterMode, searchQuery]);

  const overallStats = useMemo(() => {
    const totalResources = categoryResults.reduce((acc, c) => acc + c.totalCount, 0);
    const grantedResources = categoryResults.reduce((acc, c) => acc + c.grantedCount, 0);
    const graphResources = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'graph').length, 0);
    const graphGranted = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'graph' && r.allGranted).length, 0);
    const exoResources = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'exo').length, 0);
    const exoGranted = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'exo' && r.allGranted).length, 0);
    const psResources = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'powershell').length, 0);
    const psGranted = categoryResults.reduce((acc, c) => acc + c.resources.filter(r => r.providerType === 'powershell' && r.allGranted).length, 0);

    return { totalResources, grantedResources, graphResources, graphGranted, exoResources, exoGranted, psResources, psGranted };
  }, [categoryResults]);

  const copyPermission = (perm: string) => {
    navigator.clipboard.writeText(perm);
    setCopiedPerm(perm);
    setTimeout(() => setCopiedPerm(null), 1500);
    toast({ title: 'Copied', description: perm });
  };

  const copyMissingPermissions = () => {
    const missing = new Set<string>();
    categoryResults.forEach(c => c.resources.forEach(r => r.missingPermissions.forEach(p => missing.add(p))));
    const text = Array.from(missing).sort().join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${missing.size} missing permission(s) copied` });
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const providerBadge = (type: 'graph' | 'exo' | 'powershell' | 'mixed') => {
    const config = {
      graph: { label: 'Graph API', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
      exo: { label: 'EXO REST', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
      powershell: { label: 'PowerShell', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      mixed: { label: 'Mixed', className: 'bg-muted text-muted-foreground' },
    };
    const c = config[type];
    return <Badge variant="outline" className={cn('text-[10px]', c.className)}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permissions Checklist</h1>
          <p className="text-muted-foreground mt-1">
            Verify which Graph API and EXO permissions are configured for each resource category
          </p>
        </div>
        <Button
          onClick={runCheck}
          disabled={!isConnected || isChecking}
          className="gap-2"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {grantedPermissions ? 'Re-check' : 'Run Check'}
        </Button>
      </div>

      {!isConnected && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Connect a tenant first to check permissions against your service principal's access token.
          </AlertDescription>
        </Alert>
      )}

      {isConnected && grantedPermissions && (
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Permissions are read from your current access token. If you've changed permissions in Azure, disconnect and reconnect the tenant to refresh.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {grantedPermissions && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-panel">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Coverage</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      overallStats.totalResources > 0 && (overallStats.grantedResources / overallStats.totalResources) >= 0.9 ? "text-success" :
                      overallStats.totalResources > 0 && (overallStats.grantedResources / overallStats.totalResources) >= 0.5 ? "text-warning" : "text-destructive"
                    )}>
                      {overallStats.grantedResources}/{overallStats.totalResources}
                    </p>
                  </div>
                  <Shield className="w-8 h-8 text-primary opacity-60" />
                </div>
                <Progress
                  value={overallStats.totalResources > 0 ? (overallStats.grantedResources / overallStats.totalResources) * 100 : 0}
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Graph API</p>
                    <p className="text-2xl font-bold text-foreground">
                      {overallStats.graphGranted}/{overallStats.graphResources}
                    </p>
                  </div>
                  {providerBadge('graph')}
                </div>
                <Progress
                  value={overallStats.graphResources > 0 ? (overallStats.graphGranted / overallStats.graphResources) * 100 : 0}
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">EXO REST API</p>
                    <p className="text-2xl font-bold text-foreground">
                      {overallStats.exoGranted}/{overallStats.exoResources}
                    </p>
                  </div>
                  {providerBadge('exo')}
                </div>
                <Progress
                  value={overallStats.exoResources > 0 ? (overallStats.exoGranted / overallStats.exoResources) * 100 : 0}
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Missing Permissions</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      overallStats.totalResources - overallStats.grantedResources === 0 ? "text-success" : "text-destructive"
                    )}>
                      {overallStats.totalResources - overallStats.grantedResources}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyMissingPermissions}
                    disabled={overallStats.totalResources - overallStats.grantedResources === 0}
                    className="gap-1 text-xs"
                  >
                    <Copy className="w-3 h-3" />
                    Copy All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search resources or permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['all', 'missing', 'granted'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    filterMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'all' ? 'All' : mode === 'missing' ? 'Missing' : 'Granted'}
                </button>
              ))}
            </div>
          </div>

          {/* Category List */}
          <ScrollArea className="h-[calc(100vh-500px)] min-h-[400px]">
            <div className="space-y-3">
              {filteredResults.map((category) => (
                <Collapsible
                  key={category.categoryId}
                  open={expandedCategories.has(category.categoryId)}
                  onOpenChange={() => toggleCategory(category.categoryId)}
                >
                  <Card className="glass-panel">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {expandedCategories.has(category.categoryId) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div className="text-left">
                            <p className="font-medium text-foreground">{category.categoryName}</p>
                            <p className="text-xs text-muted-foreground">
                              {category.grantedCount}/{category.totalCount} resources covered
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {providerBadge(category.providerType)}
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={category.percentage} className="h-2 flex-1" />
                            <span className={cn(
                              'text-sm font-mono font-medium min-w-[40px] text-right',
                              category.percentage === 100 ? 'text-success' :
                              category.percentage >= 50 ? 'text-warning' : 'text-destructive'
                            )}>
                              {category.percentage}%
                            </span>
                          </div>
                          {category.percentage === 100 ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : category.percentage > 0 ? (
                            <AlertTriangle className="w-5 h-5 text-warning" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border px-4 pb-4">
                        <div className="space-y-2 mt-3">
                          {category.resources.map((resource) => (
                            <div
                              key={resource.resourceId}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-lg',
                                resource.allGranted ? 'bg-success/5' : 'bg-destructive/5'
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {resource.allGranted ? (
                                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {resource.resourceName}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {resource.requiredPermissions.map((perm) => {
                                      const granted = resource.allGranted || resource.grantedPermissions.includes(perm);
                                      return (
                                        <button
                                          key={perm}
                                          onClick={(e) => { e.stopPropagation(); copyPermission(perm); }}
                                          className={cn(
                                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer',
                                            granted
                                              ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
                                              : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'
                                          )}
                                        >
                                          {copiedPerm === perm ? <Check className="w-2.5 h-2.5" /> : null}
                                          {perm}
                                        </button>
                                      );
                                    })}
                                    {resource.alternativePermissions && resource.alternativePermissions.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground italic self-center ml-1">
                                        or: {resource.alternativePermissions.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 ml-2">
                                {providerBadge(resource.providerType)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {filteredResults.length === 0 && grantedPermissions && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-lg font-medium">
                    {filterMode === 'missing' ? 'No missing permissions!' : 'No results found'}
                  </p>
                  <p className="text-sm">
                    {filterMode === 'missing' ? 'All resource categories have the required permissions configured.' : 'Try adjusting your search or filter.'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Empty state when not checked */}
      {!grantedPermissions && isConnected && (
        <Card className="glass-panel">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="w-16 h-16 text-primary/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Check Permissions</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Click "Run Check" to analyze your service principal's Graph API and Exchange Online
              permissions against all supported resource categories.
            </p>
            <Button onClick={runCheck} className="gap-2">
              <Shield className="w-4 h-4" />
              Run Permission Check
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
