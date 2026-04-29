import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitCompare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PortalDriftViewProps {
  customerId: string;
}

interface DriftTenantResult {
  connectionId: string;
  tenantName: string;
  status: string;
  hasDrift: boolean;
  added: number;
  removed: number;
  modified: number;
}

interface DriftRunRow {
  id: string;
  completed_at: string | null;
  results: { tenants?: DriftTenantResult[] } | null;
}

/**
 * Read-only view of recent drift runs for the portal user's tenants.
 * RLS already restricts which scheduled_drift_runs rows we see; we filter
 * the per-tenant results client-side to drop tenants we do NOT own (a run
 * can span many MSPs' tenants).
 */
export function PortalDriftView({ customerId }: PortalDriftViewProps) {
  const [runs, setRuns] = useState<DriftRunRow[]>([]);
  const [allowedConnectionIds, setAllowedConnectionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // First get the tenants this portal user can see (RLS-filtered).
        const { data: tenants, error: tenantErr } = await supabase
          .from('tenant_connections')
          .select('id, tenant_name, display_name');
        if (tenantErr) throw tenantErr;
        const ids = new Set<string>((tenants ?? []).map((t) => t.id as string));

        const { data, error: runErr } = await supabase
          .from('scheduled_drift_runs')
          .select('id, completed_at, results')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20);
        if (runErr) throw runErr;

        if (cancelled) return;
        setAllowedConnectionIds(ids);
        setRuns((data as DriftRunRow[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load drift history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load drift</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Flatten and filter the results to only this customer's tenants
  const filteredRuns = runs
    .map((run) => ({
      ...run,
      tenants: (run.results?.tenants ?? []).filter((t) => allowedConnectionIds.has(t.connectionId)),
    }))
    .filter((r) => r.tenants.length > 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configuration drift</h1>
        <p className="text-muted-foreground mt-1">Recent drift checks run against your Microsoft 365 tenants.</p>
      </header>

      {filteredRuns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No drift checks have completed yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRuns.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Drift check</span>
                  {run.completed_at && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {new Date(run.completed_at).toLocaleString()}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {run.tenants.map((t) => {
                    const total = t.added + t.removed + t.modified;
                    return (
                      <div
                        key={t.connectionId}
                        className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/50 bg-card/40"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.tenantName}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.added} added · {t.removed} removed · {t.modified} modified
                          </p>
                        </div>
                        {t.hasDrift ? (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
                            {total} {total === 1 ? 'change' : 'changes'}
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                            No drift
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
