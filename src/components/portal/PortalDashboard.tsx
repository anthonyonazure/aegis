import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, GitCompare, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PortalDashboardProps {
  customerId: string;
  customerName: string;
}

interface DashboardData {
  tenantCount: number;
  // Secure score: average of latest scores across this customer's tenants (0-100)
  averageScore: number | null;
  // Most recent drift run summary across the customer's tenants
  driftRun: {
    completed_at: string | null;
    tenants_checked: number;
    tenants_with_drift: number;
  } | null;
}

/**
 * Phase 2 #3a — read-only Dashboard view for the customer portal.
 * Pulls tenant_connections + tenant_secure_scores + scheduled_drift_runs
 * via the new portal RLS policies.
 */
export function PortalDashboard({ customerId, customerName }: PortalDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Tenants the portal user is allowed to see (RLS-filtered to their customer)
        const { data: tenants, error: tenantErr } = await supabase
          .from('tenant_connections')
          .select('id');
        if (tenantErr) throw tenantErr;
        const tenantIds = (tenants ?? []).map((t) => t.id as string);

        // Latest secure score per tenant (each row already represents a snapshot)
        let avg: number | null = null;
        if (tenantIds.length > 0) {
          const { data: scoreRows } = await supabase
            .from('tenant_secure_scores')
            .select('score, max_score, tenant_connection_id, recorded_at')
            .in('tenant_connection_id', tenantIds)
            .order('recorded_at', { ascending: false });
          if (scoreRows && scoreRows.length > 0) {
            // Take the most recent row per tenant
            const latestPerTenant = new Map<string, { score: number; max: number }>();
            for (const r of scoreRows as Array<{ score: number; max_score: number; tenant_connection_id: string }>) {
              if (!latestPerTenant.has(r.tenant_connection_id)) {
                latestPerTenant.set(r.tenant_connection_id, { score: Number(r.score), max: Number(r.max_score) });
              }
            }
            const pcts = Array.from(latestPerTenant.values())
              .filter((s) => s.max > 0)
              .map((s) => (s.score / s.max) * 100);
            if (pcts.length > 0) {
              avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
            }
          }
        }

        // Most recent drift run
        const { data: runs } = await supabase
          .from('scheduled_drift_runs')
          .select('completed_at, total_tenants, tenants_with_drift, status')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1);
        const run = runs?.[0] as
          | { completed_at: string | null; total_tenants: number; tenants_with_drift: number }
          | undefined;

        if (cancelled) return;
        setData({
          tenantCount: tenantIds.length,
          averageScore: avg,
          driftRun: run
            ? {
                completed_at: run.completed_at,
                tenants_checked: run.total_tenants,
                tenants_with_drift: run.tenants_with_drift,
              }
            : null,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portal data');
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
          <CardTitle>Could not load dashboard</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {customerName}</h1>
        <p className="text-muted-foreground mt-1">A read-only summary of your Microsoft 365 security posture.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Secure score (average)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.averageScore == null ? '—' : `${data.averageScore.toFixed(0)}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {data.tenantCount} {data.tenantCount === 1 ? 'tenant' : 'tenants'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-primary" />
              Most recent drift run
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.driftRun ? (
              <>
                <p className="text-3xl font-bold">
                  {data.driftRun.tenants_with_drift}{' '}
                  <span className="text-base font-normal text-muted-foreground">
                    of {data.driftRun.tenants_checked} drifted
                  </span>
                </p>
                {data.driftRun.completed_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(data.driftRun.completed_at).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No drift runs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Tenants under management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.tenantCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.tenantCount === 0 ? 'No tenants linked yet' : 'Connected to your Aegis instance'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What you can see here</CardTitle>
          <CardDescription>
            This is a read-only view of the security posture work your provider runs against your Microsoft 365 tenant.
            Use the navigation on the left to view configuration drift findings and detected anomalies. To change any
            policy or take action, contact your provider directly.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
