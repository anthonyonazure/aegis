import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { taxonomies } from '@/lib/mispData';
import { Tags } from 'lucide-react';

export const TaxonomiesSection = () => {
  const grouped = useMemo(() => {
    const map: Record<string, typeof taxonomies> = {};
    taxonomies.forEach((t) => {
      if (!map[t.taxonomy]) map[t.taxonomy] = [];
      map[t.taxonomy].push(t);
    });
    return map;
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><Tags className="w-5 h-5" /> MISP Taxonomies</h2>
      <p className="text-sm text-muted-foreground">Reference for standard classification taxonomies used in threat intelligence sharing.</p>

      {Object.entries(grouped).map(([name, entries]) => (
        <div key={name} className="space-y-2">
          <h3 className="text-sm font-semibold">{name}</h3>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Tag</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((t) => (
                  <TableRow key={t.tag}>
                    <TableCell>
                      <Badge style={{ backgroundColor: t.color, color: t.color === '#FFFFFF' || t.color === '#FACC15' || t.color === '#FFC000' || t.color === '#4ADE80' || t.color === '#33FF00' ? '#000' : '#fff' }} className="text-xs font-mono">
                        {t.tag}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
};
