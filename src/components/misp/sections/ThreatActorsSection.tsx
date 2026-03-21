import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { threatActors, attackTechniques, ThreatActor } from '@/lib/mispData';
import { Search, Users } from 'lucide-react';

const countryFlag: Record<string, string> = {
  Russia: '🇷🇺', China: '🇨🇳', 'North Korea': '🇰🇵', International: '🌐', Unknown: '❓',
};

export const ThreatActorsSection = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ThreatActor | null>(null);

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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Threat Actors</h2>
      <p className="text-sm text-muted-foreground">Profiles of known APT groups and ransomware operators with mapped TTPs.</p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search actors, aliases, countries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((actor) => (
          <Card key={actor.id} className="border-border/50 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(actor)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{countryFlag[actor.country] || '🌐'} {actor.name}</span>
                <Badge variant={actor.active ? 'destructive' : 'secondary'} className="text-[10px]">{actor.active ? 'Active' : 'Inactive'}</Badge>
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
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{countryFlag[selected.country]} {selected.name}</DialogTitle>
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
