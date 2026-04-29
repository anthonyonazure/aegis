import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight, FileCheck, Play, Calendar, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';
import {
  ComplianceFramework,
  ComplianceEvidenceRun,
  ComplianceEvidenceItem,
  collectEvidence,
  getComplianceFrameworks,
  getRecentEvidenceRuns,
  getRunItems,
} from '@/lib/complianceDatabase';
import { downloadEvidencePackage } from '@/lib/complianceEvidencePackage';
import { ComplianceSchedulesPanel } from '@/components/compliance/ComplianceSchedulesPanel';

const STATUS_BADGE: Record<string, string> = {
  pass: 'bg-green-500/20 text-green-400 border-green-500/30 border',
  fail: 'bg-red-500/20 text-red-400 border-red-500/30 border',
  na: 'bg-muted text-muted-foreground',
  error: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border',
};

const STATUS_TOOLTIP: Record<string, string> = {
  pass: 'Evaluator ran and the tenant satisfies this control.',
  fail: 'Evaluator ran and the tenant does NOT satisfy this control. Expand to see the captured snapshot.',
  na: "This control's evaluator hasn't been implemented, or the required Graph permission isn't granted. Treat as manual review.",
  error: 'Evaluator threw an exception (often a Graph timeout or unexpected response shape). Check the function logs.',
};

const SEVERITY_PILL: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-yellow-500/15 text-yellow-400',
  low: 'bg-blue-500/15 text-blue-400',
  info: 'bg-muted text-muted-foreground',
};

/**
 * Phase 2 #4a — MSP-side compliance evidence collection.
 *
 * Pick a framework + tenant, hit Collect, see PASS/FAIL/NA per control with
 * the captured snapshot inline. Each run is persisted so an audit trail
 * builds up without re-running evaluators.
 */
export function ComplianceEvidenceView() {
  const { toast } = useToast();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [frameworkCode, setFrameworkCode] = useState<string>('');
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);
  const [recentRuns, setRecentRuns] = useState<ComplianceEvidenceRun[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunItems, setActiveRunItems] = useState<ComplianceEvidenceItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);

  const tenantId = selectedTenants[0]?.id;
  const tenantName = selectedTenants[0]?.name;

  const selectedFramework = useMemo(
    () => frameworks.find((f) => f.code === frameworkCode) ?? null,
    [frameworks, frameworkCode]
  );

  // Load frameworks once
  useEffect(() => {
    let cancelled = false;
    getComplianceFrameworks()
      .then((f) => {
        if (cancelled) return;
        setFrameworks(f);
        if (f.length > 0) setFrameworkCode((current) => current || f[0].code);
      })
      .catch((e) =>
        toast({
          title: 'Failed to load frameworks',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      )
      .finally(() => {
        if (!cancelled) setLoadingFrameworks(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh recent runs when (tenant, framework) changes
  useEffect(() => {
    let cancelled = false;
    if (!selectedFramework || !tenantId) {
      setRecentRuns([]);
      return;
    }
    getRecentEvidenceRuns({
      tenantConnectionId: tenantId,
      frameworkId: selectedFramework.id,
      limit: 10,
    })
      .then((r) => {
        if (cancelled) return;
        setRecentRuns(r);
      })
      .catch((e) =>
        toast({
          title: 'Failed to load recent runs',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFramework?.id, tenantId]);

  // Load items when active run changes
  useEffect(() => {
    let cancelled = false;
    if (!activeRunId) {
      setActiveRunItems([]);
      return;
    }
    setItemsLoading(true);
    getRunItems(activeRunId)
      .then((items) => {
        if (cancelled) return;
        setActiveRunItems(items);
      })
      .catch((e) =>
        toast({
          title: 'Failed to load run items',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      )
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  const handleCollect = async () => {
    if (!frameworkCode || !tenantId) {
      toast({
        title: 'Pick framework and tenant',
        variant: 'destructive',
      });
      return;
    }
    setCollecting(true);
    try {
      const result = await collectEvidence({ tenantConnectionId: tenantId, frameworkCode });
      if (!result.success || !result.runId) {
        toast({
          title: 'Collection failed',
          description: result.error ?? result.warning ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      const counts = result.counts ?? { passed: 0, failed: 0, na: 0, error: 0 };
      toast({
        title: 'Evidence collected',
        description: `${counts.passed} pass · ${counts.failed} fail · ${counts.na} N/A${counts.error ? ` · ${counts.error} error` : ''}`,
      });
      setActiveRunId(result.runId);
      // Refresh recent list
      if (selectedFramework) {
        const refreshed = await getRecentEvidenceRuns({
          tenantConnectionId: tenantId,
          frameworkId: selectedFramework.id,
          limit: 10,
        });
        setRecentRuns(refreshed);
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleDownloadPackage = async () => {
    if (!activeRunId || !selectedFramework) return;
    const run = recentRuns.find((r) => r.id === activeRunId);
    if (!run) return;
    try {
      await downloadEvidencePackage({
        run,
        framework: selectedFramework,
        items: activeRunItems,
        tenantName: tenantName || 'tenant',
      });
      toast({ title: 'Evidence package downloaded' });
    } catch (e) {
      toast({
        title: 'Download failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Compliance evidence</h1>
        <p className="text-muted-foreground mt-1">
          Run framework-specific control checks against a tenant. Each run captures the raw configuration as evidence
          for an audit, retained indefinitely.
        </p>
      </header>

      <Tabs defaultValue="adhoc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adhoc">On demand</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          <ComplianceSchedulesPanel frameworks={frameworks} />
        </TabsContent>

        <TabsContent value="adhoc" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            Collect evidence
          </CardTitle>
          <CardDescription>Pick a framework and tenant; we run every control's evaluator and record the result.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Framework</Label>
              <Select value={frameworkCode} onValueChange={setFrameworkCode} disabled={loadingFrameworks}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingFrameworks ? 'Loading…' : 'Select a framework'} />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.code}>
                      {f.name}
                      {f.version ? ` (${f.version})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tenant</Label>
              <TenantMultiSelector
                selectedTenantIds={selectedTenants.map((t) => t.id)}
                onSelectionChange={setSelectedTenants}
                multiSelect={false}
                label="Select tenant"
              />
            </div>
          </div>
          <Button onClick={handleCollect} disabled={collecting || !frameworkCode || !tenantId}>
            {collecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Collecting…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Collect evidence
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent runs
            {tenantName ? (
              <span className="text-sm font-normal text-muted-foreground">— {tenantName}</span>
            ) : null}
          </CardTitle>
          <CardDescription>
            {tenantId
              ? `${recentRuns.length} of last 10 ${selectedFramework?.name ?? 'framework'} run${recentRuns.length === 1 ? '' : 's'}`
              : 'Pick a framework + tenant to see history.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet for this combination.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => {
                const isActive = run.id === activeRunId;
                const overall = run.failedCount === 0 && run.errorCount === 0 ? 'pass' : 'fail';
                return (
                  <button
                    key={run.id}
                    onClick={() => setActiveRunId(isActive ? null : run.id)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-md border text-left transition-colors ${
                      isActive ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {run.completedAt ? run.completedAt.toLocaleString() : 'In progress'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.passedCount} pass · {run.failedCount} fail · {run.naCount} N/A
                        {run.errorCount ? ` · ${run.errorCount} error` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {overall === 'pass' ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          All pass
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          {run.failedCount + run.errorCount} issue{run.failedCount + run.errorCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {isActive ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active run detail */}
      {activeRunId && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Run detail</CardTitle>
                <CardDescription>
                  Per-control results and the captured evidence snapshot. Click a control to expand.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPackage}
                disabled={itemsLoading || activeRunItems.length === 0}
                title="Download an audit-ready ZIP (PDF cover + manifest + per-control snapshots)"
              >
                <Download className="w-4 h-4 mr-2" />
                Download evidence package
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeRunItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items recorded.</p>
            ) : (
              <div className="space-y-2">
                {activeRunItems.map((item) => {
                  const expanded = expandedItem === item.id;
                  return (
                    <div key={item.id} className="rounded-md border border-border/50">
                      <button
                        onClick={() => setExpandedItem(expanded ? null : item.id)}
                        className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.control?.controlCode}
                            </span>
                            {item.control?.severity && (
                              <span
                                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                  SEVERITY_PILL[item.control.severity] ?? SEVERITY_PILL.medium
                                }`}
                              >
                                {item.control.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-0.5">{item.control?.name}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Badge className={STATUS_BADGE[item.status] ?? STATUS_BADGE.na}>
                                  {item.status.toUpperCase()}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {STATUS_TOOLTIP[item.status] ?? STATUS_TOOLTIP.na}
                            </TooltipContent>
                          </Tooltip>
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3">
                          <Separator className="mb-3" />
                          <p className="text-xs text-muted-foreground mb-1">Snapshot</p>
                          <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto max-h-72">
                            {JSON.stringify(item.snapshot, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
