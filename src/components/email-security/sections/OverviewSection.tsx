import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Shield, ShieldAlert, Bug, Link2, Paperclip, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { EmailSecurityOverview } from '../EmailSecurityTypes';

export const OverviewSection = () => {
  const { data, isLoading, fetchData } = useEmailSecurityData<EmailSecurityOverview>({ action: 'fetch-overview' });

  useEffect(() => { fetchData(); }, []);

  const cards = data ? [
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
          {/* Protection score */}
          <Card className="p-5 mb-6 border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Protection Coverage Score</p>
                <p className="text-3xl font-bold text-foreground mt-1">{data.protectionScore}%</p>
              </div>
              <Badge variant={data.protectionScore >= 80 ? 'default' : data.protectionScore >= 50 ? 'secondary' : 'destructive'}>
                {data.protectionScore >= 80 ? 'Strong' : data.protectionScore >= 50 ? 'Moderate' : 'Weak'}
              </Badge>
            </div>
          </Card>

          {/* Policy counts */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="p-4 border-border/50">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${card.color}`} />
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.count}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Domain auth summary */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">Domain Authentication</h3>
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
