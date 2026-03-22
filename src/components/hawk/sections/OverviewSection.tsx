import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Terminal, BookOpen, Compass, ExternalLink } from 'lucide-react';
import { hawkCommands, investigationPlaybooks, hawkPrerequisites } from '@/lib/hawkData';
import { Button } from '@/components/ui/button';

export const OverviewSection = () => {
  const tenantCmds = hawkCommands.filter(c => c.category === 'tenant').length;
  const userCmds = hawkCommands.filter(c => c.category === 'user').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Hawk — M365 Cloud Forensics</h2>
        <p className="text-muted-foreground mt-1">
          PowerShell-based incident response and threat hunting for Microsoft 365. Generate scripts, follow investigation playbooks, and reference the complete command catalog.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tenant Commands', value: tenantCmds, icon: Shield, color: 'text-blue-500' },
          { label: 'User Commands', value: userCmds, icon: Terminal, color: 'text-emerald-500' },
          { label: 'Investigation Playbooks', value: investigationPlaybooks.length, icon: Compass, color: 'text-amber-500' },
          { label: 'Prerequisites', value: hawkPrerequisites.length, icon: BookOpen, color: 'text-violet-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prerequisites</CardTitle>
          <CardDescription>Requirements before running Hawk investigations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hawkPrerequisites.map(p => (
            <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
              <Badge variant={p.required ? 'default' : 'secondary'} className="mt-0.5 shrink-0 text-[10px]">
                {p.required ? 'Required' : 'Optional'}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                {p.command && (
                  <code className="text-xs bg-muted px-2 py-1 rounded mt-1.5 block font-mono text-foreground/80">{p.command}</code>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resources</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            { label: 'GitHub Repository', url: 'https://github.com/T0pCyber/hawk' },
            { label: 'Documentation', url: 'https://hawkforensics.io' },
            { label: 'PowerShell Gallery', url: 'https://www.powershellgallery.com/packages/HAWK' },
          ].map(l => (
            <Button key={l.label} variant="outline" size="sm" asChild>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                {l.label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
