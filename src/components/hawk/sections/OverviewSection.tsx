import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Terminal, BookOpen, Compass, ExternalLink, Activity, ShieldAlert, UserX, LogIn, Loader2 } from 'lucide-react';
import { hawkCommands, investigationPlaybooks, hawkPrerequisites } from '@/lib/hawkData';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantSecurityData } from '@/hooks/useTenantSecurityData';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { format } from 'date-fns';

export const OverviewSection = () => {
  const tenantCmds = hawkCommands.filter(c => c.category === 'tenant').length;
  const userCmds = hawkCommands.filter(c => c.category === 'user').length;
  const { isConnected, tenantName, tenantId } = useTenant();
  const { alerts, riskyUsers, riskySignIns, isLoading } = useTenantSecurityData();
  const { users, isLoading: usersLoading } = useTenantUsers();

  const highAlerts = alerts.filter(a => a.severity === 'high');
  const activeRiskyUsers = riskyUsers.filter(u => u.riskLevel !== 'none' && u.riskState !== 'remediated');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Hawk — M365 Cloud Forensics</h2>
        <p className="text-muted-foreground mt-1">
          PowerShell-based incident response and threat hunting for Microsoft 365. Generate scripts, follow investigation playbooks, and reference the complete command catalog.
        </p>
      </div>

      {/* Live Tenant Context */}
      {isConnected && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              Tenant Context — {tenantName || tenantId}
            </CardTitle>
            <CardDescription>Live security posture from your connected tenant</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading security data...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  <div>
                    <p className="text-lg font-bold">{alerts.length}</p>
                    <p className="text-[10px] text-muted-foreground">Alerts</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-lg font-bold">{highAlerts.length}</p>
                    <p className="text-[10px] text-muted-foreground">High Severity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-lg font-bold">{activeRiskyUsers.length}</p>
                    <p className="text-[10px] text-muted-foreground">Risky Users</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-lg font-bold">{riskySignIns.length}</p>
                    <p className="text-[10px] text-muted-foreground">Risky Sign-Ins</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-lg font-bold">{usersLoading ? '...' : users.length}</p>
                    <p className="text-[10px] text-muted-foreground">Users Available</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isConnected && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Connect a tenant for enhanced investigation</p>
              <p className="text-xs text-muted-foreground">User lists and security context will auto-populate in the Script Generator and Investigation Wizard.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tenant Commands', value: tenantCmds, icon: Shield, color: 'text-blue-500' },
          { label: 'User Commands', value: userCmds, icon: Terminal, color: 'text-emerald-500' },
          { label: 'Investigation Playbooks', value: investigationPlaybooks.length, icon: Compass, color: 'text-amber-500' },
          { label: 'Prerequisites', value: hawkPrerequisites.length, icon: BookOpen, color: 'text-violet-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prerequisites</CardTitle>
          <CardDescription>Requirements before running Hawk investigations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hawkPrerequisites.map(p => (
            <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
              <Badge variant={p.required ? 'default' : 'secondary'} className="mt-0.5 shrink-0 text-[10px]">
                {p.required ? 'Required' : 'Optional'}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                {p.command && (
                  <code className="text-xs bg-muted px-2 py-1 rounded mt-1.5 block font-mono text-foreground/80">{p.command}</code>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resources</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            { label: 'GitHub Repository', url: 'https://github.com/T0pCyber/hawk' },
            { label: 'Documentation', url: 'https://hawkforensics.io' },
            { label: 'PowerShell Gallery', url: 'https://www.powershellgallery.com/packages/HAWK' },
          ].map(l => (
            <Button key={l.label} variant="outline" size="sm" asChild>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                {l.label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
