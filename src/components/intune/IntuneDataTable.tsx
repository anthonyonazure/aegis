import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import { RefreshCw, Search, Filter, Columns, Download, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface IntuneDataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  isLoading: boolean;
  onRefresh: () => void;
  title?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchKey?: string;
}

export function IntuneDataTable<T extends Record<string, any>>({
  data,
  columns,
  isLoading,
  onRefresh,
  title,
  emptyMessage = 'No items found',
  searchPlaceholder = 'Search',
  searchKey = 'displayName',
}: IntuneDataTableProps<T>) {
  const [search, setSearch] = useState('');

  const filtered = data.filter((item) => {
    if (!search) return true;
    const val = item[searchKey];
    return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Toolbar - mimics Intune's action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30 border-border/50"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Add filters
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Columns className="w-3.5 h-3.5 mr-1.5" />
            Columns
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-320px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {columns.map((col) => (
                  <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item, idx) => (
                  <TableRow key={item.id || idx} className="hover:bg-muted/20 cursor-pointer">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="text-sm">
                        {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} of {data.length} item(s)
      </div>
    </div>
  );
}
