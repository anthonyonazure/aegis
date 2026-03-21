import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { iocEntries, IOCEntry } from '@/lib/mispData';
import { Search, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const IOC_TYPES = ['all', 'ip', 'domain', 'hash-sha256', 'hash-md5', 'url', 'email'] as const;

const severityColor: Record<string, string> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

export const IocBrowserSection = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return iocEntries.filter((ioc) => {
      const matchType = typeFilter === 'all' || ioc.type === typeFilter;
      const matchSearch = !search || ioc.value.toLowerCase().includes(search.toLowerCase()) || ioc.description.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [search, typeFilter]);

  const handleCopy = (ioc: IOCEntry) => {
    navigator.clipboard.writeText(ioc.value);
    setCopiedId(ioc.id);
    toast({ title: 'Copied', description: `${ioc.type}: ${ioc.value}` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">IOC Browser</h2>
      <p className="text-sm text-muted-foreground">Search and browse curated Indicators of Compromise from public threat intelligence sources.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search IOCs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {IOC_TYPES.map((t) => (
          <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'outline'} onClick={() => setTypeFilter(t)} className="text-xs capitalize">
            {t === 'all' ? 'All Types' : t}
          </Button>
        ))}
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="w-[80px]">Severity</TableHead>
              <TableHead className="hidden lg:table-cell">Source</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ioc) => (
              <TableRow key={ioc.id}>
                <TableCell><Badge variant="outline" className="text-[10px] font-mono">{ioc.type}</Badge></TableCell>
                <TableCell className="font-mono text-xs max-w-[250px] truncate">{ioc.value}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[250px] truncate">{ioc.description}</TableCell>
                <TableCell><Badge variant={severityColor[ioc.severity] as any} className="text-[10px]">{ioc.severity}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{ioc.source}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopy(ioc)}>
                    {copiedId === ioc.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No IOCs match your search.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
