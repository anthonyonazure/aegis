import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { SafeLinksPolicy } from '../EmailSecurityTypes';

export const SafeLinksSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<SafeLinksPolicy[]>({ action: 'fetch-safe-links' });

  useEffect(() => { fetchData(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Safe Links Policies</h2>
          <p className="text-sm text-muted-foreground mt-1">
            URL scanning, detonation, and click-through protection settings
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((policy) => (
            <Card key={policy.id} className="p-4 border-border/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground">{policy.displayName || policy.name || 'Unnamed Policy'}</h3>
                <Badge variant={policy.isEnabled ? 'default' : 'secondary'}>{policy.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              {policy.description && <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                {policy.scanUrls !== undefined && <Badge variant="outline">URL scanning: {policy.scanUrls ? 'On' : 'Off'}</Badge>}
                {policy.deliverMessageAfterScan !== undefined && <Badge variant="outline">Wait for scan: {policy.deliverMessageAfterScan ? 'Yes' : 'No'}</Badge>}
                {policy.trackUserClicks !== undefined && <Badge variant="outline">Track clicks: {policy.trackUserClicks ? 'On' : 'Off'}</Badge>}
                {policy.allowClickThrough !== undefined && <Badge variant="outline">Click-through: {policy.allowClickThrough ? 'Allowed' : 'Blocked'}</Badge>}
                {policy.doNotRewriteUrls && policy.doNotRewriteUrls.length > 0 && (
                  <Badge variant="outline">{policy.doNotRewriteUrls.length} excluded URLs</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground">No Safe Links policies found. This feature requires Defender for Office 365.</p>
        </Card>
      )}
    </div>
  );
};
