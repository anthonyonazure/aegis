import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PortalAnomaliesViewProps {
  customerId: string;
}

interface AnomalyFinding {
  category?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  recommendation?: string;
}

interface AnomalyRunRow {
  id: string;
  tenant_connection_id: string;
  total_anomalies: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  overall_risk_level: string | null;
  anomalies: AnomalyFinding[];
  completed_at: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30 border',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30 border',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30 border',
  info: 'bg-muted text-muted-foreground',
};

/**
 * Phase 2 #3b — read-only anomaly history for the customer portal.
 * Reads anomaly_runs filtered by RLS to the portal user's tenants.
 */
export function PortalAnomaliesView({ customerId }: PortalAnomaliesViewProps) {
  const [runs, setRuns] = useState<AnomalyRunRow[]>([]);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Tenant id -> name map (RLS already restricts to this customer's tenants)
        const { data: tenants, error: tenantErr } = await supabase
          .from('tenant_connections')
          .select('id, display_name, tenant_name, tenant_id');
        if (tenantErr) throw tenantErr;
        const nameMap: Record<string, string> = {};
        for (const t of (tenants ?? []) as Array<{
          id: string;
          display_name: string | null;
          tenant_name: string | null;
          tenant_id: string;
        }>) {
          nameMap[t.id] = t.display_name || t.tenant_name || t.tenant_id;
        }

        const { data, error: runErr } = await supabase
          .from('anomaly_runs')
          .select(
            'id, tenant_connection_id, total_anomalies, critical_count, high_count, medium_count, low_count, overall_risk_level, anomalies, completed_at'
          )
          .order('completed_at', { ascending: false })
          .limit(20);
        if (runErr) throw runErr;

        if (cancelled) return;
        setTenantNames(nameMap);
        setRuns((data as AnomalyRunRow[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load anomaly history');
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
          <CardTitle>Could not load anomalies</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Anomalies</h1>
        <p className="text-muted-foreground mt-1">
          Sign-in, configuration, and permission anomalies detected in your tenants.
        </p>
      </header>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No anomaly checks have run yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{tenantNames[run.tenant_connection_id] ?? 'Unknown tenant'}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {new Date(run.completed_at).toLocaleString()}
                  </span>
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-2 pt-1">
                  <span>{run.total_anomalies} total</span>
                  {run.critical_count > 0 && <Badge className={SEVERITY_BADGE.critical}>{run.critical_count} critical</Badge>}
                  {run.high_count > 0 && <Badge className={SEVERITY_BADGE.high}>{run.high_count} high</Badge>}
                  {run.medium_count > 0 && <Badge className={SEVERITY_BADGE.medium}>{run.medium_count} medium</Badge>}
                  {run.low_count > 0 && <Badge className={SEVERITY_BADGE.low}>{run.low_count} low</Badge>}
                </CardDescription>
              </CardHeader>
              {Array.isArray(run.anomalies) && run.anomalies.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    {run.anomalies.slice(0, 8).map((a, i) => (
                      <div key={i} className="p-3 rounded-md border border-border/50 bg-card/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {a.category && (
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{a.category}</p>
                            )}
                            <p className="text-sm">{a.description ?? '(no description)'}</p>
                            {a.recommendation && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Recommended:</span> {a.recommendation}
                              </p>
                            )}
                          </div>
                          {a.severity && (
                            <Badge className={SEVERITY_BADGE[a.severity] ?? SEVERITY_BADGE.info}>{a.severity}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {run.anomalies.length > 8 && (
                      <p className="text-xs text-muted-foreground">
                        + {run.anomalies.length - 8} more findings — contact your provider for the full report.
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
