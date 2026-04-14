import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMispStats, threatActors, iocEntries, attackTechniques } from '@/lib/mispData';
import { useTenantSecurityData } from '@/hooks/useTenantSecurityData';
import { useTenant } from '@/contexts/TenantContext';
import { Shield, Users, Search, Globe, Rss, AlertTriangle, Grid3X3, Tags, RefreshCw, Activity, ShieldAlert, UserX, LogIn, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const riskColor: Record<string, string> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
  informational: 'outline',
  none: 'outline',
};

export const OverviewSection = () => {
  const stats = getMispStats();
  const { isConnected, tenantName } = useTenant();
  const { alerts, riskyUsers, riskySignIns, isLoading, error, refresh, lastRefreshed } = useTenantSecurityData();

  const statCards = [
    { label: 'ATT&CK Techniques', value: stats.totalTechniques, icon: Grid3X3, color: 'text-blue-500' },
    { label: 'Threat Actors', value: `${stats.activeActors} active / ${stats.totalActors}`, icon: Users, color: 'text-red-500' },
    { label: 'IOC Entries', value: stats.totalIOCs, icon: Search, color: 'text-amber-500' },
    { label: 'Critical IOCs', value: stats.criticalIOCs, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Galaxy Clusters', value: stats.totalGalaxies, icon: Globe, color: 'text-purple-500' },
    { label: 'OSINT Feeds', value: `${stats.freeFeeds} free / ${stats.totalFeeds}`, icon: Rss, color: 'text-green-500' },
    { label: 'Taxonomies', value: stats.totalTaxonomies, icon: Tags, color: 'text-cyan-500' },
  ];

  const recentCriticalIOCs = iocEntries.filter(i => i.severity === 'critical').slice(0, 5);
  const topActors = threatActors.filter(a => a.active).slice(0, 5);
  const criticalTechniques = attackTechniques.filter(t => t.severity === 'critical').slice(0, 5);

  const highAlerts = alerts.filter(a => a.severity === 'high');
  const activeRiskyUsers = riskyUsers.filter(u => u.riskLevel !== 'none' && u.riskState !== 'remediated');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Threat Intelligence Overview
        </h2>
        <p className="text-muted-foreground mt-1">
          MISP-inspired local threat intelligence browser with curated ATT&CK techniques, IOCs, threat actor profiles, and OSINT feeds.
        </p>
      </div>

      {/* Live Tenant Security Section */}
      {isConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              Live Tenant Security — {tenantName || 'Connected Tenant'}
            </h3>
            <div className="flex items-center gap-2">
              {lastRefreshed && (
                <span className="text-xs text-muted-foreground">
                  Updated {format(lastRefreshed, 'HH:mm:ss')}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading} className="gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="text-lg font-bold">{alerts.length}</p>
                  <p className="text-xs text-muted-foreground">Security Alerts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold">{highAlerts.length}</p>
                  <p className="text-xs text-muted-foreground">High Severity</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <UserX className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold">{activeRiskyUsers.length}</p>
                  <p className="text-xs text-muted-foreground">Risky Users</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <LogIn className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold">{riskySignIns.length}</p>
                  <p className="text-xs text-muted-foreground">Risky Sign-Ins</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Live Alerts */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  Recent Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No security alerts found.</p>
                ) : (
                  alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate max-w-[180px] text-xs">{alert.title}</span>
                      <Badge variant={riskColor[alert.severity] as any} className="text-[10px] shrink-0">
                        {alert.severity}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Risky Users */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserX className="w-4 h-4 text-red-500" />
                  Risky Users
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : activeRiskyUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No risky users detected.</p>
                ) : (
                  activeRiskyUsers.slice(0, 5).map(user => (
                    <div key={user.id} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate max-w-[140px] text-xs">{user.userDisplayName}</span>
                      <Badge variant={user.riskLevel === 'high' ? 'destructive' : 'default'} className="text-[10px] shrink-0">
                        {user.riskLevel}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Risky Sign-ins */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-amber-500" />
                  Risky Sign-Ins
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : riskySignIns.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No risky sign-ins detected.</p>
                ) : (
                  riskySignIns.slice(0, 5).map(si => (
                    <div key={si.id} className="flex items-center justify-between text-sm gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs">{si.userDisplayName}</p>
                        <p className="text-[10px] text-muted-foreground">{si.ipAddress} · {si.location?.city || si.location?.countryOrRegion || 'Unknown'}</p>
                      </div>
                      <Badge variant={si.riskLevelDuringSignIn === 'high' ? 'destructive' : 'default'} className="text-[10px] shrink-0">
                        {si.riskLevelDuringSignIn}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isConnected && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Connect a tenant to see live security data</p>
              <p className="text-xs text-muted-foreground">Security alerts, risky users, and sign-in anomalies will appear here.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Static Reference Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Reference Intelligence Catalog</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical IOCs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCriticalIOCs.map((ioc) => (
              <div key={ioc.id} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[180px] font-mono text-xs">{ioc.value}</span>
                <Badge variant="destructive" className="text-[10px]">{ioc.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Threat Actors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topActors.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.name}</span>
                <Badge variant="outline" className="text-[10px]">{a.country}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical Techniques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalTechniques.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[140px]">{t.name}</span>
                <Badge variant="secondary" className="text-[10px] font-mono">{t.id}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
