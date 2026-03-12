import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { AntiSpamPolicy } from '../EmailSecurityTypes';

type PolicyWithSource = AntiSpamPolicy & { source?: string };

const isUnavailable = (p: PolicyWithSource) => p.source === 'graph-api-unavailable' || p.source === 'exo-api-unavailable';

const PolicyStatusBadge = ({ policy }: { policy: PolicyWithSource }) => {
  if (isUnavailable(policy) || policy.isEnabled === undefined) {
    return <Badge variant="outline" className="border-yellow-500/50 text-yellow-600">Setup Required</Badge>;
  }
  return <Badge variant={policy.isEnabled ? 'default' : 'secondary'}>{policy.isEnabled ? 'Enabled' : 'Disabled'}</Badge>;
};

export const AntiSpamSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<PolicyWithSource[]>({ action: 'fetch-anti-spam' });

  useEffect(() => { fetchData(); }, []);

  const isApiUnavailable = data?.some(p => isUnavailable(p));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Anti-Spam Policies</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound and outbound spam filter policies, allowed/blocked senders
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isApiUnavailable && (
        <Alert className="mb-4 border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            To read anti-spam policies, your service principal needs the <strong>Exchange.ManageAsApp</strong> application permission and <strong>Exchange Administrator</strong> role in Azure AD.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((policy) => (
            <Card key={policy.id} className="p-4 border-border/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground">{policy.displayName || policy.name || 'Unnamed Policy'}</h3>
                <div className="flex gap-2">
                  {policy.direction && <Badge variant="outline">{policy.direction}</Badge>}
                  <PolicyStatusBadge policy={policy} />
                </div>
              </div>
              {policy.description && <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>}
              {policy.source !== 'graph-api-unavailable' && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {policy.spamAction && <Badge variant="outline">Spam: {policy.spamAction}</Badge>}
                  {policy.highConfidenceSpamAction && <Badge variant="outline">High-confidence: {policy.highConfidenceSpamAction}</Badge>}
                  {policy.bulkThreshold !== undefined && <Badge variant="outline">Bulk threshold: {policy.bulkThreshold}</Badge>}
                  {policy.allowedSenders && policy.allowedSenders.length > 0 && (
                    <Badge variant="outline">{policy.allowedSenders.length} allowed senders</Badge>
                  )}
                  {policy.blockedSenders && policy.blockedSenders.length > 0 && (
                    <Badge variant="outline">{policy.blockedSenders.length} blocked senders</Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground">No anti-spam policies found. Connect a tenant to fetch policies.</p>
        </Card>
      )}
    </div>
  );
};
