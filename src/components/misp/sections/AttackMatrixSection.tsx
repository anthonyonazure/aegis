import { useState, useMemo } from 'react';
import { attackTechniques, ATTACK_TACTICS, AttackTechnique } from '@/lib/mispData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Activity, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTenantSecurityData } from '@/hooks/useTenantSecurityData';
import { useTenant } from '@/contexts/TenantContext';
import { format } from 'date-fns';

const severityBg: Record<string, string> = {
  low: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30',
  medium: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30',
  high: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30',
  critical: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',
};

export const AttackMatrixSection = () => {
  const [selected, setSelected] = useState<AttackTechnique | null>(null);
  const { isConnected, tenantName } = useTenant();
  const { alerts, isLoading, refresh, lastRefreshed } = useTenantSecurityData();

  // Map techniques that match live security alerts
  const matchedTechniques = useMemo(() => {
    const matched = new Set<string>();
    if (!alerts.length) return matched;

    const alertTexts = alerts.map(a =>
      `${a.title} ${a.description} ${a.category}`.toLowerCase()
    );

    attackTechniques.forEach(tech => {
      const searchTerms = [tech.name.toLowerCase(), tech.id.toLowerCase()];
      for (const text of alertTexts) {
        for (const term of searchTerms) {
          if (text.includes(term)) {
            matched.add(tech.id);
            break;
          }
        }
      }
    });

    return matched;
  }, [alerts]);

  const byTactic = useMemo(() => {
    const map: Record<string, AttackTechnique[]> = {};
    ATTACK_TACTICS.forEach((t) => { map[t] = []; });
    attackTechniques.forEach((tech) => {
      if (map[tech.tactic]) map[tech.tactic].push(tech);
    });
    return map;
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">MITRE ATT&CK Matrix</h2>
      <p className="text-sm text-muted-foreground">Visual matrix of tactics and techniques. Click a technique for details.</p>

      {/* Live Alert Mapping */}
      {isConnected && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Live Alert Mapping — {tenantName || 'Connected Tenant'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Mapping alerts to techniques...</span>
                    ) : (
                      <>
                        {matchedTechniques.size} techniques matched across {alerts.length} alerts
                        {lastRefreshed && <> · Updated {format(lastRefreshed, 'HH:mm:ss')}</>}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading} className="gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="w-full">
        <div className="flex gap-2 min-w-[1200px] pb-4">
          {ATTACK_TACTICS.map((tactic) => (
            <div key={tactic} className="flex-1 min-w-[140px]">
              <div className="bg-primary/10 rounded-t-md px-2 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary truncate">{tactic}</p>
              </div>
              <div className="space-y-1 mt-1">
                {byTactic[tactic]?.map((tech) => {
                  const isMatched = matchedTechniques.has(tech.id);
                  return (
                    <button
                      key={tech.id}
                      onClick={() => setSelected(tech)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded border text-[11px] transition-colors cursor-pointer relative',
                        isMatched ? 'ring-2 ring-destructive/60 bg-destructive/15 border-destructive/40' : severityBg[tech.severity]
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[9px] text-muted-foreground">{tech.id}</span>
                        {isMatched && <ShieldAlert className="w-3 h-3 text-destructive shrink-0" />}
                      </div>
                      <p className="leading-tight truncate">{tech.name}</p>
                    </button>
                  );
                })}
                {(!byTactic[tactic] || byTactic[tactic].length === 0) && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-3 text-xs items-center flex-wrap">
        <span className="text-muted-foreground">Severity:</span>
        {['low', 'medium', 'high', 'critical'].map((s) => (
          <span key={s} className={cn('px-2 py-0.5 rounded border text-[10px] capitalize', severityBg[s])}>{s}</span>
        ))}
        {isConnected && (
          <>
            <span className="text-muted-foreground ml-2">Live:</span>
            <span className="px-2 py-0.5 rounded border text-[10px] ring-2 ring-destructive/60 bg-destructive/15 border-destructive/40">Alert Match</span>
          </>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">{selected.id}</Badge>
                  {selected.name}
                  {matchedTechniques.has(selected.id) && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <ShieldAlert className="w-3 h-3" /> Live Alert
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Tactic</p>
                  <Badge variant="outline">{selected.tactic}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Description</p>
                  <p>{selected.description}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Platforms</p>
                  <div className="flex flex-wrap gap-1">{selected.platforms.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Associated Actors</p>
                  <div className="flex flex-wrap gap-1">{selected.actors.map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Severity</p>
                  <Badge variant={selected.severity === 'critical' ? 'destructive' : 'default'} className="capitalize">{selected.severity}</Badge>
                </div>
                {matchedTechniques.has(selected.id) && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                    <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> This technique was detected in your tenant's security alerts
                    </p>
                  </div>
                )}
                <a href={`https://attack.mitre.org/techniques/${selected.id}/`} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">
                  View on MITRE ATT&CK →
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
