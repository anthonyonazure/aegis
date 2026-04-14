import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { iocEntries, IOCEntry } from '@/lib/mispData';
import { Search, Copy, Check, Activity, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenantSecurityData } from '@/hooks/useTenantSecurityData';
import { useTenant } from '@/contexts/TenantContext';
import { format } from 'date-fns';

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
  const { isConnected, tenantName } = useTenant();
  const { alerts, isLoading, refresh, lastRefreshed, error } = useTenantSecurityData();

  // Build a set of IOC values that appear in live alerts for cross-referencing
  const alertIocMatches = useMemo(() => {
    const matchSet = new Set<string>();
    if (!alerts.length) return matchSet;

    const alertTexts = alerts.map(a =>
      `${a.title} ${a.description} ${a.category}`.toLowerCase()
    );

    iocEntries.forEach(ioc => {
      const val = ioc.value.toLowerCase();
      const desc = ioc.description.toLowerCase();
      for (const text of alertTexts) {
        if (text.includes(val) || text.includes(desc.split(' ')[0])) {
          matchSet.add(ioc.id);
          break;
        }
      }
    });

    return matchSet;
  }, [alerts]);

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

  const matchedCount = filtered.filter(i => alertIocMatches.has(i.id)).length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">IOC Browser</h2>
      <p className="text-sm text-muted-foreground">Search and browse curated Indicators of Compromise from public threat intelligence sources.</p>

      {/* Live Alert Cross-Reference */}
      {isConnected && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Live Cross-Reference — {tenantName || 'Connected Tenant'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Scanning alerts...</span>
                    ) : (
                      <>
                        {alerts.length} security alerts loaded · {matchedCount} IOC pattern matches found
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
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </CardContent>
        </Card>
      )}

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
              {isConnected && <TableHead className="w-[80px]">Alert Match</TableHead>}
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ioc) => {
              const isMatched = alertIocMatches.has(ioc.id);
              return (
                <TableRow key={ioc.id} className={isMatched ? 'bg-destructive/5' : undefined}>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{ioc.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-[250px] truncate">{ioc.value}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[250px] truncate">{ioc.description}</TableCell>
                  <TableCell><Badge variant={severityColor[ioc.severity] as any} className="text-[10px]">{ioc.severity}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{ioc.source}</TableCell>
                  {isConnected && (
                    <TableCell>
                      {isMatched && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <ShieldAlert className="w-3 h-3" /> Hit
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopy(ioc)}>
                      {copiedId === ioc.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={isConnected ? 7 : 6} className="text-center text-muted-foreground py-8">No IOCs match your search.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
