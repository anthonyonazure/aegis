import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Play, Trash2, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ComplianceFramework,
  ComplianceSchedule,
  ComplianceScheduleTarget,
  createComplianceSchedule,
  deleteComplianceSchedule,
  listComplianceSchedules,
  setComplianceScheduleActive,
  triggerComplianceSchedule,
} from '@/lib/complianceDatabase';

interface Props {
  frameworks: ComplianceFramework[];
}

const CRON_PRESETS: Array<{ label: string; cron: string }> = [
  { label: 'Daily at 09:00', cron: '0 9 * * *' },
  { label: 'Weekly Mon 09:00', cron: '0 9 * * 1' },
  { label: 'Monthly 1st 09:00', cron: '0 9 1 * *' },
];

/**
 * Phase 2 #4c — manage scheduled compliance evidence collection.
 *
 * Targeting in #4c-MVP: only "all tenants for this MSP". Customer/group/
 * selected targeting is in the schema (run-scheduled-compliance honors it)
 * but the UI for picking those is added in a future iteration. Most MSPs
 * want "every Monday, run framework X across the whole book" anyway.
 */
export function ComplianceSchedulesPanel({ frameworks }: Props) {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ComplianceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [cron, setCron] = useState(CRON_PRESETS[1].cron);
  const [submitting, setSubmitting] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setSchedules(await listComplianceSchedules());
    } catch (e) {
      toast({
        title: 'Failed to load schedules',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    if (frameworks.length > 0 && !frameworkId) {
      setFrameworkId(frameworks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworks.length]);

  const frameworkLabel = (id: string) => {
    const f = frameworks.find((x) => x.id === id);
    return f ? `${f.name}${f.version ? ` (${f.version})` : ''}` : id;
  };

  const handleAdd = async () => {
    if (!name.trim() || !frameworkId) {
      toast({ title: 'Name and framework required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createComplianceSchedule({
        name: name.trim(),
        frameworkId,
        targetType: 'all' as ComplianceScheduleTarget,
        scheduleCron: cron,
      });
      toast({ title: 'Schedule created' });
      setName('');
      await refresh();
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (s: ComplianceSchedule) => {
    try {
      await setComplianceScheduleActive(s.id, !s.isActive);
      await refresh();
    } catch (e) {
      toast({
        title: 'Toggle failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (s: ComplianceSchedule) => {
    if (!confirm(`Delete schedule "${s.name}"? Past evidence runs are kept.`)) return;
    try {
      await deleteComplianceSchedule(s.id);
      await refresh();
      toast({ title: 'Schedule deleted' });
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRunNow = async (s: ComplianceSchedule) => {
    setTriggeringId(s.id);
    try {
      const result = await triggerComplianceSchedule(s.id);
      const summary = result.summary?.[s.id] as
        | { tenantsChecked?: number; completed?: number; failed?: number }
        | undefined;
      toast({
        title: 'Schedule triggered',
        description: summary
          ? `${summary.completed ?? 0}/${summary.tenantsChecked ?? 0} tenants checked${summary.failed ? `, ${summary.failed} failed` : ''}.`
          : 'No matching tenants found.',
      });
      await refresh();
    } catch (e) {
      toast({
        title: 'Run failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add a schedule
          </CardTitle>
          <CardDescription>
            Pick a framework + cadence; the runner evaluates every tenant in your book on that schedule. Each fire
            produces one evidence run per tenant — search the run history for an audit-ready snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Weekly HIPAA evidence"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Framework</Label>
              <Select value={frameworkId} onValueChange={setFrameworkId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.version ? ` (${f.version})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select value={cron} onValueChange={setCron}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.cron} value={p.cron}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={submitting || !name.trim() || !frameworkId}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create schedule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Active schedules
          </CardTitle>
          <CardDescription>{schedules.length} schedule{schedules.length === 1 ? '' : 's'} on file.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schedules configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Framework</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{frameworkLabel(s.frameworkId)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.scheduleCron}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastRunAt ? s.lastRunAt.toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Active</Badge>
                      ) : (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunNow(s)}
                          disabled={triggeringId === s.id}
                        >
                          {triggeringId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleToggle(s)}>
                          {s.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
