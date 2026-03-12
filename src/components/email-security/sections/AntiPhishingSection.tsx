import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { AntiPhishingPolicy } from '../EmailSecurityTypes';

export const AntiPhishingSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<AntiPhishingPolicy[]>({ action: 'fetch-anti-phishing' });

  useEffect(() => { fetchData(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Anti-Phishing Policies</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Impersonation protection, spoof intelligence, and mailbox intelligence settings
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}</div>
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
                {policy.impersonationProtectionEnabled !== undefined && (
                  <Badge variant="outline">Impersonation: {policy.impersonationProtectionEnabled ? 'On' : 'Off'}</Badge>
                )}
                {policy.mailboxIntelligenceEnabled !== undefined && (
                  <Badge variant="outline">Mailbox Intelligence: {policy.mailboxIntelligenceEnabled ? 'On' : 'Off'}</Badge>
                )}
                {policy.spoofIntelligenceEnabled !== undefined && (
                  <Badge variant="outline">Spoof Intelligence: {policy.spoofIntelligenceEnabled ? 'On' : 'Off'}</Badge>
                )}
                {policy.priority !== undefined && (
                  <Badge variant="outline">Priority: {policy.priority}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground">No anti-phishing policies found. Connect a tenant to fetch policies.</p>
        </Card>
      )}
    </div>
  );
};
