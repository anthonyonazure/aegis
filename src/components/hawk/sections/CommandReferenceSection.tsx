import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hawkCommands } from '@/lib/hawkData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categoryLabel: Record<string, string> = {
  setup: 'Setup',
  tenant: 'Tenant',
  user: 'User',
  message: 'Message',
};

export const CommandReferenceSection = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = hawkCommands.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.cmdlet.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || c.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Command copied to clipboard.' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Command Reference</h2>
        <p className="text-muted-foreground mt-1">Complete Hawk cmdlet catalog with parameters, examples, and usage notes.</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search commands…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="setup">Setup</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="message">Message</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} command{filtered.length !== 1 ? 's' : ''}</p>

      <div className="space-y-3">
        {filtered.map(cmd => {
          const expanded = expandedId === cmd.id;
          return (
            <Card key={cmd.id}>
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : cmd.id)}
                >
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {categoryLabel[cmd.category]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{cmd.name}</p>
                    <code className="text-xs text-muted-foreground font-mono">{cmd.cmdlet}</code>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    <p className="text-sm text-muted-foreground">{cmd.description}</p>

                    {cmd.parameters.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parameters</p>
                        <div className="space-y-1.5">
                          {cmd.parameters.map(p => (
                            <div key={p.name} className="flex items-baseline gap-2 text-sm">
                              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">-{p.name}</code>
                              <span className="text-muted-foreground text-xs">{p.type}</span>
                              {p.required && <Badge variant="outline" className="text-[9px] py-0">Required</Badge>}
                              <span className="text-xs text-muted-foreground">— {p.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Example</p>
                      <div className="relative">
                        <pre className="text-xs font-mono bg-muted/60 rounded-lg p-3 pr-10">{cmd.example}</pre>
                        <Button size="icon" variant="ghost" className="absolute top-1.5 right-1.5 h-6 w-6" onClick={() => copy(cmd.example)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {cmd.notes && (
                      <p className="text-xs text-muted-foreground italic">💡 {cmd.notes}</p>
                    )}

                    <p className="text-xs text-muted-foreground"><strong>Output:</strong> {cmd.output}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
