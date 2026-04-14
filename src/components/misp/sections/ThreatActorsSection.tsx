import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { threatActors, attackTechniques, ThreatActor } from '@/lib/mispData';
import { Search, Users, Activity, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { useTenantSecurityData } from '@/hooks/useTenantSecurityData';
import { useTenant } from '@/contexts/TenantContext';
import { format } from 'date-fns';

const countryFlag: Record<string, string> = {
  Russia: '🇷🇺', China: '🇨🇳', 'North Korea': '🇰🇵', International: '🌐', Unknown: '❓',
};

export const ThreatActorsSection = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ThreatActor | null>(null);
  const { isConnected, tenantName } = useTenant();
  const { alerts, isLoading, refresh, lastRefreshed } = useTenantSecurityData();

  // Map actors whose techniques appear in live alert categories/titles
  const actorAlertMatches = useMemo(() => {
    const matchMap = new Map<string, number>();
    if (!alerts.length) return matchMap;

    const alertTexts = alerts.map(a =>
      `${a.title} ${a.description} ${a.category}`.toLowerCase()
    );

    threatActors.forEach(actor => {
      let matchCount = 0;
      // Check if any of the actor's techniques or aliases appear in alerts
      const searchTerms = [
        ...actor.aliases.map(a => a.toLowerCase()),
        actor.name.toLowerCase(),
        ...actor.techniques.map(tid => {
          const tech = attackTechniques.find(t => t.id === tid);
          return tech ? tech.name.toLowerCase() : '';
        }).filter(Boolean),
      ];

      for (const text of alertTexts) {
        for (const term of searchTerms) {
          if (term && text.includes(term)) {
            matchCount++;
            break;
          }
        }
      }

      if (matchCount > 0) {
        matchMap.set(actor.id, matchCount);
      }
    });

    return matchMap;
  }, [alerts]);

  const filtered = useMemo(() => {
    if (!search) return threatActors;
    const q = search.toLowerCase();
    return threatActors.filter(
      (a) => a.name.toLowerCase().includes(q) || a.aliases.some((al) => al.toLowerCase().includes(q)) || a.country.toLowerCase().includes(q) || a.targetSectors.some((s) => s.toLowerCase().includes(q))
    );
  }, [search]);

  const getTechniqueNames = (ids: string[]) => ids.map((id) => {
    const t = attackTechniques.find((at) => at.id === id);
    return t ? `${t.id} — ${t.name}` : id;
  });

  const matchedActorCount = filtered.filter(a => actorAlertMatches.has(a.id)).length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Threat Actors</h2>
      <p className="text-sm text-muted-foreground">Profiles of known APT groups and ransomware operators with mapped TTPs.</p>

      {/* Live Alert Correlation */}
      {isConnected && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Live TTP Correlation — {tenantName || 'Connected Tenant'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Analyzing alerts...</span>
                    ) : (
                      <>
                        {alerts.length} alerts scanned · {matchedActorCount} actors with potential TTP matches
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search actors, aliases, countries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((actor) => {
          const matchCount = actorAlertMatches.get(actor.id);
          return (
            <Card
              key={actor.id}
              className={`border-border/50 cursor-pointer hover:border-primary/50 transition-colors ${matchCount ? 'ring-1 ring-destructive/30' : ''}`}
              onClick={() => setSelected(actor)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{countryFlag[actor.country] || '🌐'} {actor.name}</span>
                  <div className="flex items-center gap-1">
                    {matchCount && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <ShieldAlert className="w-3 h-3" /> {matchCount}
                      </Badge>
                    )}
                    <Badge variant={actor.active ? 'destructive' : 'secondary'} className="text-[10px]">{actor.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="text-muted-foreground line-clamp-2">{actor.description}</p>
                <div className="flex flex-wrap gap-1">
                  {actor.targetSectors.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                </div>
                <p className="text-[10px] text-muted-foreground">Aliases: {actor.aliases.join(', ')}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {countryFlag[selected.country]} {selected.name}
                  {actorAlertMatches.has(selected.id) && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <ShieldAlert className="w-3 h-3" /> {actorAlertMatches.get(selected.id)} alert matches
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <Badge variant={selected.active ? 'destructive' : 'secondary'}>{selected.active ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant="outline">{selected.motivation}</Badge>
                  <Badge variant="outline">Since {selected.firstSeen}</Badge>
                </div>
                <p>{selected.description}</p>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Aliases</p>
                  <div className="flex flex-wrap gap-1">{selected.aliases.map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Target Sectors</p>
                  <div className="flex flex-wrap gap-1">{selected.targetSectors.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Known Techniques</p>
                  <div className="space-y-1">{getTechniqueNames(selected.techniques).map((t) => <p key={t} className="text-xs font-mono">{t}</p>)}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
