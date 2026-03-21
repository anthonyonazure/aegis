import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { osintFeeds } from '@/lib/mispData';
import { Rss, ExternalLink, Search } from 'lucide-react';

export const FeedsSection = () => {
  const [search, setSearch] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  const filtered = useMemo(() => {
    return osintFeeds.filter((f) => {
      const matchFree = !showFreeOnly || f.free;
      const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase());
      return matchFree && matchSearch;
    });
  }, [search, showFreeOnly]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Rss className="w-5 h-5" /> OSINT Feeds</h2>
      <p className="text-sm text-muted-foreground">Public and community threat intelligence feeds for IOC enrichment.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search feeds..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" variant={showFreeOnly ? 'default' : 'outline'} onClick={() => setShowFreeOnly(!showFreeOnly)} className="text-xs">Free Only</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {filtered.map((feed) => (
          <Card key={feed.id} className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{feed.name}</span>
                <Badge variant={feed.free ? 'default' : 'secondary'} className="text-[10px]">{feed.free ? 'Free' : 'Paid'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{feed.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">{feed.category}</Badge>
                  <Badge variant="outline" className="text-[10px]">{feed.format}</Badge>
                </div>
                <a href={feed.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                    <ExternalLink className="w-3 h-3" /> Visit
                  </Button>
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground">Provider: {feed.provider}</p>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-sm col-span-full text-center py-8">No feeds match your search.</p>}
      </div>
    </div>
  );
};
