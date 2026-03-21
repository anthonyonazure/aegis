import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMispStats, threatActors, iocEntries, attackTechniques } from '@/lib/mispData';
import { Shield, Users, Search, Globe, Rss, AlertTriangle, Grid3X3, Tags } from 'lucide-react';

export const OverviewSection = () => {
  const stats = getMispStats();

  const statCards = [
    { label: 'ATT&CK Techniques', value: stats.totalTechniques, icon: Grid3X3, color: 'text-blue-500' },
    { label: 'Threat Actors', value: `${stats.activeActors} active / ${stats.totalActors}`, icon: Users, color: 'text-red-500' },
    { label: 'IOC Entries', value: stats.totalIOCs, icon: Search, color: 'text-amber-500' },
    { label: 'Critical IOCs', value: stats.criticalIOCs, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Galaxy Clusters', value: stats.totalGalaxies, icon: Globe, color: 'text-purple-500' },
    { label: 'OSINT Feeds', value: `${stats.freeFeeds} free / ${stats.totalFeeds}`, icon: Rss, color: 'text-green-500' },
    { label: 'Taxonomies', value: stats.totalTaxonomies, icon: Tags, color: 'text-cyan-500' },
  ];

  const recentCriticalIOCs = iocEntries.filter(i => i.severity === 'critical').slice(0, 5);
  const topActors = threatActors.filter(a => a.active).slice(0, 5);
  const criticalTechniques = attackTechniques.filter(t => t.severity === 'critical').slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Threat Intelligence Overview
        </h2>
        <p className="text-muted-foreground mt-1">
          MISP-inspired local threat intelligence browser with curated ATT&CK techniques, IOCs, threat actor profiles, and OSINT feeds.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical IOCs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCriticalIOCs.map((ioc) => (
              <div key={ioc.id} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[180px] font-mono text-xs">{ioc.value}</span>
                <Badge variant="destructive" className="text-[10px]">{ioc.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Threat Actors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topActors.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.name}</span>
                <Badge variant="outline" className="text-[10px]">{a.country}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical Techniques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalTechniques.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[140px]">{t.name}</span>
                <Badge variant="secondary" className="text-[10px] font-mono">{t.id}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
