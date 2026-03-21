import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { galaxyClusters } from '@/lib/mispData';
import { Globe, Search } from 'lucide-react';

const galaxyTypes = ['All', 'Ransomware', 'Tool', 'Malware', 'Sector'] as const;

const galaxyColor: Record<string, string> = {
  Ransomware: 'destructive',
  Tool: 'default',
  Malware: 'secondary',
  Sector: 'outline',
};

export const GalaxiesSection = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    return galaxyClusters.filter((g) => {
      const matchType = filter === 'All' || g.galaxy === filter;
      const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [search, filter]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Globe className="w-5 h-5" /> MISP Galaxies</h2>
      <p className="text-sm text-muted-foreground">Browse galaxy clusters: ransomware families, attack tools, malware, and targeted sectors.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search galaxies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {galaxyTypes.map((t) => (
          <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} onClick={() => setFilter(t)} className="text-xs">{t}</Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((g) => (
          <Card key={g.id} className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{g.name}</span>
                <Badge variant={galaxyColor[g.galaxy] as any} className="text-[10px]">{g.galaxy}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>
              {g.synonyms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {g.synonyms.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-sm col-span-full text-center py-8">No galaxies match your search.</p>}
      </div>
    </div>
  );
};
