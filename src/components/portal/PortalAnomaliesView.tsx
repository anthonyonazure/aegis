import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface PortalAnomaliesViewProps {
  customerId: string;
}

/**
 * Phase 2 #3a placeholder. Anomaly history is not yet persisted to a
 * portal-readable table — current `ai-anomaly-detection` returns findings
 * inline (see audit results: REAL but ephemeral). Wiring this view to live
 * data is Phase 2 #3b: introduce an `anomaly_runs` table and an RLS policy
 * mirroring scheduled_drift_runs.
 */
export function PortalAnomaliesView({ customerId: _customerId }: PortalAnomaliesViewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Anomalies</h1>
        <p className="text-muted-foreground mt-1">
          Sign-in, configuration, and permission anomalies detected in your tenants.
        </p>
      </header>

      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <CardTitle className="text-base mb-2">Coming soon</CardTitle>
          <CardDescription>
            Your provider runs AI-powered anomaly detection on your tenants. We're wiring the historical record into
            the portal next — for now, ask your provider for the latest report.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
