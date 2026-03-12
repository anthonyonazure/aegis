import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { DomainAuthRecord } from '../EmailSecurityTypes';

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === 'missing') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
};

const statusLabel = (status: string) => {
  if (status === 'pass') return 'Configured';
  if (status === 'fail') return 'Misconfigured';
  if (status === 'missing') return 'Missing';
  return 'Unknown';
};

export const DomainAuthSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<DomainAuthRecord[]>({ action: 'fetch-domain-auth' });

  useEffect(() => { fetchData(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Domain Authentication</h2>
          <p className="text-sm text-muted-foreground mt-1">
            SPF, DKIM, and DMARC configuration status for each verified domain
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-4">
          {data.map((domain) => (
            <Card key={domain.domain} className="p-5 border-border/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground text-lg">{domain.domain}</h3>
                <Badge variant={domain.isVerified ? 'default' : 'secondary'}>
                  {domain.isVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* SPF */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon status={domain.spf.status} />
                    <span className="font-medium text-sm text-foreground">SPF</span>
                    <Badge variant="outline" className="ml-auto text-xs">{statusLabel(domain.spf.status)}</Badge>
                  </div>
                  {domain.spf.record && (
                    <p className="text-xs text-muted-foreground font-mono mt-2 break-all">{domain.spf.record}</p>
                  )}
                </div>

                {/* DKIM */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon status={domain.dkim.status} />
                    <span className="font-medium text-sm text-foreground">DKIM</span>
                    <Badge variant="outline" className="ml-auto text-xs">{statusLabel(domain.dkim.status)}</Badge>
                  </div>
                  {domain.dkim.selectors && domain.dkim.selectors.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Selectors: {domain.dkim.selectors.join(', ')}</p>
                  )}
                </div>

                {/* DMARC */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon status={domain.dmarc.status} />
                    <span className="font-medium text-sm text-foreground">DMARC</span>
                    <Badge variant="outline" className="ml-auto text-xs">{statusLabel(domain.dmarc.status)}</Badge>
                  </div>
                  {domain.dmarc.policy && (
                    <p className="text-xs text-muted-foreground mt-2">Policy: <span className="font-medium">{domain.dmarc.policy}</span></p>
                  )}
                  {domain.dmarc.record && (
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{domain.dmarc.record}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground">No domains found. Connect a tenant to check domain authentication.</p>
        </Card>
      )}
    </div>
  );
};
