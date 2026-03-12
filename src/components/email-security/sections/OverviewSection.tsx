import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Shield, ShieldAlert, Bug, Link2, Paperclip, Globe, CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { EmailSecurityOverview } from '../EmailSecurityTypes';

type OverviewWithMeta = EmailSecurityOverview & {
  policyDataAvailable?: boolean;
  protectionScoreNote?: string;
};

export const OverviewSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<OverviewWithMeta>({ action: 'fetch-overview' });

  useEffect(() => { fetchData(); }, []);

  const policyCards = data ? [
    { label: 'Anti-Phishing', count: data.antiPhishingCount, icon: ShieldAlert, color: 'text-blue-500' },
    { label: 'Anti-Spam', count: data.antiSpamCount, icon: Shield, color: 'text-amber-500' },
    { label: 'Anti-Malware', count: data.antiMalwareCount, icon: Bug, color: 'text-red-500' },
    { label: 'Safe Links', count: data.safeLinksCount, icon: Link2, color: 'text-emerald-500' },
    { label: 'Safe Attachments', count: data.safeAttachmentsCount, icon: Paperclip, color: 'text-purple-500' },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Security Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Exchange Online Protection and domain authentication status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Domain auth score — verified data */}
          <Card className="p-5 mb-6 border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Domain Authentication Score</p>
                  <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-600">Verified</Badge>
                </div>
                <p className="text-3xl font-bold text-foreground mt-1">{data.protectionScore}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.protectionScoreNote || 'Based on SPF and DKIM verification across all domains'}
                </p>
              </div>
              <Badge variant={data.protectionScore >= 80 ? 'default' : data.protectionScore >= 50 ? 'secondary' : 'destructive'}>
                {data.protectionScore >= 80 ? 'Strong' : data.protectionScore >= 50 ? 'Moderate' : 'Weak'}
              </Badge>
            </div>
          </Card>

          {/* Policy counts — unverifiable via Graph API */}
          {data.policyDataAvailable === false && (
            <Alert className="mb-4 border-yellow-500/30 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                EOP and Defender for Office 365 policy details are <strong>not available via Microsoft Graph API</strong>.
                Use the <strong>Microsoft 365 Defender portal</strong> or <strong>Exchange Online PowerShell</strong> to view policy configurations.
                The <strong>AI Recommendations</strong> tab can provide guidance based on available data.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {policyCards.map((card) => {
              const Icon = card.icon;
              const isUnverifiable = card.count === null || card.count === undefined;
              return (
                <Card key={card.label} className="p-4 border-border/50">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isUnverifiable ? 'text-muted-foreground' : card.color}`} />
                    <div>
                      {isUnverifiable ? (
                        <div className="flex items-center gap-1">
                          <HelpCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-muted-foreground">N/A</span>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-foreground">{card.count}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Domain auth summary — verified data */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">Domain Authentication</h3>
              <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-600">Verified</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">{data.domainsWithFullAuth} fully authenticated</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-muted-foreground">{data.domainCount - data.domainsWithFullAuth} need attention</span>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground">Connect a tenant to view email security data.</p>
        </Card>
      )}
    </div>
  );
};
