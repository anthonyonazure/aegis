import { useState, useMemo } from 'react';
import { attackTechniques, ATTACK_TACTICS, AttackTechnique } from '@/lib/mispData';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const severityBg: Record<string, string> = {
  low: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30',
  medium: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30',
  high: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30',
  critical: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',
};

export const AttackMatrixSection = () => {
  const [selected, setSelected] = useState<AttackTechnique | null>(null);

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

      <ScrollArea className="w-full">
        <div className="flex gap-2 min-w-[1200px] pb-4">
          {ATTACK_TACTICS.map((tactic) => (
            <div key={tactic} className="flex-1 min-w-[140px]">
              <div className="bg-primary/10 rounded-t-md px-2 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary truncate">{tactic}</p>
              </div>
              <div className="space-y-1 mt-1">
                {byTactic[tactic]?.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelected(tech)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded border text-[11px] transition-colors cursor-pointer',
                      severityBg[tech.severity]
                    )}
                  >
                    <span className="font-mono text-[9px] text-muted-foreground">{tech.id}</span>
                    <p className="leading-tight truncate">{tech.name}</p>
                  </button>
                ))}
                {(!byTactic[tactic] || byTactic[tactic].length === 0) && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-3 text-xs items-center">
        <span className="text-muted-foreground">Severity:</span>
        {['low', 'medium', 'high', 'critical'].map((s) => (
          <span key={s} className={cn('px-2 py-0.5 rounded border text-[10px] capitalize', severityBg[s])}>{s}</span>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">{selected.id}</Badge>
                  {selected.name}
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
