/**
 * DUDE Manager — Dynamic User & Device Enumeration.
 *
 * Concept inspired by Daniel Petri's PowerShell + WPF DUDE-Manager
 * (https://github.com/danielpetri666/DUDE-Manager, MIT licensed). His
 * project established the design — user-group → device-group sync with
 * transitive membership resolution, a blast-radius limiter, and optional
 * Administrative Unit / Defender tag automation. This view ports the same
 * concept to Aegis's Supabase + React stack via the dude-sync edge function.
 *
 * Feature parity gap-analysis tracked at: GitHub issue #6.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Trash2, Play, Eye, RefreshCw, AlertTriangle, CheckCircle2, 
  XCircle, Clock, Search, Download, Upload, Loader2, Shield, ArrowRight
} from 'lucide-react';

interface DudeMapping {
  id: string;
  enabled: boolean;
  dry_run: boolean;
  user_group_id: string;
  user_group_name: string;
  device_group_id: string;
  device_group_name: string;
  os_filter: string;
  admin_unit_id: string | null;
  admin_unit_name: string | null;
  defender_tag: string | null;
  max_removal_percent: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_summary: any;
  tenant_connection_id: string | null;
  created_at: string;
}

interface DudeSettings {
  user_id: string;
  allowed_group_prefixes: string[];
}

interface SyncLog {
  id: string;
  mapping_id: string;
  status: string;
  devices_added: number;
  devices_removed: number;
  devices_skipped: number;
  details: any;
  duration_ms: number | null;
  created_at: string;
}

interface GroupOption {
  id: string;
  displayName: string;
}

interface PreviewResult {
  resolvedDeviceCount: number;
  currentMemberCount: number;
  toAdd: { id: string; displayName: string }[];
  toRemove: { id: string; displayName: string }[];
  removalPercent: number;
  blastRadiusExceeded: boolean;
  maxRemovalPercent: number;
}

const OS_FILTERS = ['All', 'Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS'];

export const DudeManagerView = () => {
  const [mappings, setMappings] = useState<DudeMapping[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editMapping, setEditMapping] = useState<DudeMapping | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [previewMappingId, setPreviewMappingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [searchingGroups, setSearchingGroups] = useState(false);

  // Safety settings — per-MSP prefix allowlist (issue #6 PR1)
  const [allowedPrefixes, setAllowedPrefixes] = useState<string[]>([]);
  const [newPrefix, setNewPrefix] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Form state
  const [formUserGroupId, setFormUserGroupId] = useState('');
  const [formUserGroupName, setFormUserGroupName] = useState('');
  const [formDeviceGroupId, setFormDeviceGroupId] = useState('');
  const [formDeviceGroupName, setFormDeviceGroupName] = useState('');
  const [formOsFilter, setFormOsFilter] = useState('All');
  const [formAdminUnitId, setFormAdminUnitId] = useState('');
  const [formAdminUnitName, setFormAdminUnitName] = useState('');
  const [formDefenderTag, setFormDefenderTag] = useState('');
  const [formMaxRemoval, setFormMaxRemoval] = useState(25);
  const [selectedGroupField, setSelectedGroupField] = useState<'user' | 'device'>('user');

  const { toast } = useToast();
  const { connectionId } = useTenant();

  const loadMappings = useCallback(async () => {
    const { data, error } = await supabase
      .from('dude_mappings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setMappings(data as unknown as DudeMapping[]);
  }, []);

  const loadSyncLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('dude_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setSyncLogs(data as unknown as SyncLog[]);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadMappings(), loadSyncLogs(), loadSettings()]);
      setLoading(false);
    };
    load();
  }, [loadMappings, loadSyncLogs, loadSettings]);

  const searchGroups = async (prefix: string) => {
    if (!connectionId || prefix.length < 2) { setGroupOptions([]); return; }
    setSearchingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke('dude-sync', {
        body: { action: 'list-groups', tenantConnectionId: connectionId, prefix },
      });
      if (!error && data?.groups) setGroupOptions(data.groups);
    } catch { /* ignore */ }
    setSearchingGroups(false);
  };

  const resetForm = () => {
    setFormUserGroupId(''); setFormUserGroupName('');
    setFormDeviceGroupId(''); setFormDeviceGroupName('');
    setFormOsFilter('All'); setFormAdminUnitId(''); setFormAdminUnitName('');
    setFormDefenderTag(''); setFormMaxRemoval(25);
    setGroupSearch(''); setGroupOptions([]);
  };

  const openAdd = () => { resetForm(); setEditMapping(null); setShowAddDialog(true); };
  const openEdit = (m: DudeMapping) => {
    setEditMapping(m);
    setFormUserGroupId(m.user_group_id); setFormUserGroupName(m.user_group_name);
    setFormDeviceGroupId(m.device_group_id); setFormDeviceGroupName(m.device_group_name);
    setFormOsFilter(m.os_filter); setFormAdminUnitId(m.admin_unit_id || '');
    setFormAdminUnitName(m.admin_unit_name || ''); setFormDefenderTag(m.defender_tag || '');
    setFormMaxRemoval(m.max_removal_percent);
    setShowAddDialog(true);
  };

  const saveMapping = async () => {
    if (!formUserGroupId || !formUserGroupName || !formDeviceGroupId || !formDeviceGroupName) {
      toast({ title: 'Validation Error', description: 'User Group and Device Group are required.', variant: 'destructive' });
      return;
    }

    const payload: any = {
      user_group_id: formUserGroupId,
      user_group_name: formUserGroupName,
      device_group_id: formDeviceGroupId,
      device_group_name: formDeviceGroupName,
      os_filter: formOsFilter,
      admin_unit_id: formAdminUnitId || null,
      admin_unit_name: formAdminUnitName || null,
      defender_tag: formDefenderTag || null,
      max_removal_percent: formMaxRemoval,
      tenant_connection_id: connectionId,
    };

    if (editMapping) {
      const { error } = await supabase.from('dude_mappings').update(payload).eq('id', editMapping.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Mapping Updated' });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      payload.user_id = user.id;
      const { error } = await supabase.from('dude_mappings').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Mapping Created' });
    }

    setShowAddDialog(false);
    loadMappings();
  };

  const deleteMapping = async (id: string) => {
    const { error } = await supabase.from('dude_mappings').delete().eq('id', id);
    if (!error) { toast({ title: 'Mapping Deleted' }); loadMappings(); }
  };

  // Load per-MSP DUDE safety settings (prefix allowlist).
  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('dude_settings')
      .select('allowed_group_prefixes')
      .eq('user_id', user.id)
      .maybeSingle();
    setAllowedPrefixes((data?.allowed_group_prefixes as string[] | undefined) ?? []);
  }, []);

  const saveAllowedPrefixes = async (next: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('dude_settings')
        .upsert({ user_id: user.id, allowed_group_prefixes: next }, { onConflict: 'user_id' });
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
      setAllowedPrefixes(next);
      toast({
        title: next.length === 0 ? 'Allowlist cleared' : 'Allowlist saved',
        description: next.length === 0
          ? 'Sync will operate on any group. Add prefixes to enforce a guardrail.'
          : `Sync will only write to groups starting with: ${next.join(', ')}`,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const addPrefix = async () => {
    const p = newPrefix.trim();
    if (!p) return;
    if (allowedPrefixes.includes(p)) {
      toast({ title: 'Already in allowlist', variant: 'destructive' });
      return;
    }
    await saveAllowedPrefixes([...allowedPrefixes, p]);
    setNewPrefix('');
  };

  const removePrefix = async (p: string) => {
    await saveAllowedPrefixes(allowedPrefixes.filter((x) => x !== p));
  };

  const toggleDryRun = async (id: string, dry_run: boolean) => {
    const { error } = await supabase.from('dude_mappings').update({ dry_run }).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMappings((list) => list.map((m) => (m.id === id ? { ...m, dry_run } : m)));
    toast({
      title: dry_run ? 'Dry-run enabled' : 'Apply mode enabled',
      description: dry_run ? 'Sync will preview only.' : 'Next sync will write to the device group.',
    });
  };

  const toggleMapping = async (id: string, enabled: boolean) => {
    await supabase.from('dude_mappings').update({ enabled }).eq('id', id);
    loadMappings();
  };

  const previewSync = async (mappingId: string) => {
    if (!connectionId) { toast({ title: 'No tenant connected', variant: 'destructive' }); return; }
    setPreviewMappingId(mappingId);
    setPreviewData(null);
    setShowPreview(true);

    try {
      const { data, error } = await supabase.functions.invoke('dude-sync', {
        body: { action: 'preview-sync', tenantConnectionId: connectionId, mappingId },
      });
      if (error) throw error;
      setPreviewData(data);
    } catch (e: any) {
      toast({ title: 'Preview Failed', description: e.message, variant: 'destructive' });
      setShowPreview(false);
    }
  };

  const executeSync = async (mappingId: string) => {
    if (!connectionId) return;
    setSyncing(prev => new Set(prev).add(mappingId));
    try {
      const { data, error } = await supabase.functions.invoke('dude-sync', {
        body: { action: 'execute-sync', tenantConnectionId: connectionId, mappingId },
      });
      if (error) throw error;
      toast({
        title: data.status === 'success' ? 'Sync Complete' : data.status === 'skipped' ? 'Sync Skipped' : 'Sync Error',
        description: `Added: ${data.devicesAdded}, Removed: ${data.devicesRemoved}, Skipped: ${data.devicesSkipped}`,
        variant: data.status === 'error' ? 'destructive' : 'default',
      });
      await Promise.all([loadMappings(), loadSyncLogs()]);
    } catch (e: any) {
      toast({ title: 'Sync Failed', description: e.message, variant: 'destructive' });
    }
    setSyncing(prev => { const n = new Set(prev); n.delete(mappingId); return n; });
  };

  const bulkSync = async () => {
    if (!connectionId) { toast({ title: 'No tenant connected', variant: 'destructive' }); return; }
    setBulkSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('dude-sync', {
        body: { action: 'bulk-sync', tenantConnectionId: connectionId },
      });
      if (error) throw error;
      const successCount = data.results?.filter((r: any) => r.status === 'success').length || 0;
      toast({ title: 'Bulk Sync Complete', description: `${successCount}/${data.totalMappings} mappings synced successfully.` });
      await Promise.all([loadMappings(), loadSyncLogs()]);
    } catch (e: any) {
      toast({ title: 'Bulk Sync Failed', description: e.message, variant: 'destructive' });
    }
    setBulkSyncing(false);
  };

  const exportCsv = () => {
    const headers = ['UserGroupName', 'DeviceGroupName', 'Enabled', 'OSFilter', 'AdminUnitName', 'DefenderTag', 'MaxRemovalPercent'];
    const rows = mappings.map(m => [m.user_group_name, m.device_group_name, m.enabled, m.os_filter, m.admin_unit_name || '', m.defender_tag || '', m.max_removal_percent]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dude-mappings.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Never</Badge>;
    switch (status) {
      case 'success': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Success</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      case 'skipped': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Skipped</Badge>;
      case 'dry-run': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Dry Run</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DUDE Sync</h1>
        <p className="text-muted-foreground mt-1">
          Dynamic User & Device Enumeration — Automate device group membership based on user groups
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Required Graph Permissions</p>
            <p className="text-muted-foreground mt-1">
              Group.Read.All, GroupMember.ReadWrite.All, User.Read.All, DeviceManagementManagedDevices.Read.All
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mappings">
        <TabsList>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        {/* MAPPINGS TAB */}
        <TabsContent value="mappings" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Mapping</Button>
              <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </div>
            <Button variant="outline" onClick={loadMappings}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>

          {mappings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ArrowRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Mappings Yet</h3>
                <p className="text-muted-foreground mt-1">Create your first user group → device group mapping to get started.</p>
                <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Mapping</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Enabled</TableHead>
                    <TableHead className="w-20">Mode</TableHead>
                    <TableHead>User Group</TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Device Group</TableHead>
                    <TableHead>OS Filter</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Switch checked={m.enabled} onCheckedChange={(v) => toggleMapping(m.id, v)} />
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              onClick={() => toggleDryRun(m.id, !m.dry_run)}
                              className={`cursor-pointer ${m.dry_run ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border' : 'bg-green-500/20 text-green-400 border-green-500/30 border'}`}
                            >
                              {m.dry_run ? 'Dry-run' : 'Apply'}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {m.dry_run
                              ? 'Click to enable writes. Currently the sync only previews.'
                              : 'Click to revert to dry-run. Currently the sync writes to the device group.'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="font-medium">{m.user_group_name}</TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      <TableCell className="font-medium">{m.device_group_name}</TableCell>
                      <TableCell><Badge variant="secondary">{m.os_filter}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.last_sync_at ? new Date(m.last_sync_at).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>{getStatusBadge(m.last_sync_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => previewSync(m.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => executeSync(m.id)} disabled={syncing.has(m.id)}>
                                {syncing.has(m.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sync Now</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                                <Search className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => deleteMapping(m.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* SYNC TAB */}
        <TabsContent value="sync" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mappings.length}</div>
                <p className="text-xs text-muted-foreground">{mappings.filter(m => m.enabled).length} enabled</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Last Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mappings.some(m => m.last_sync_at)
                    ? new Date(Math.max(...mappings.filter(m => m.last_sync_at).map(m => new Date(m.last_sync_at!).getTime()))).toLocaleDateString()
                    : 'Never'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {syncLogs.length > 0
                    ? `${Math.round((syncLogs.filter(l => l.status === 'success').length / syncLogs.length) * 100)}%`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sync Controls</CardTitle>
              <CardDescription>Run sync operations for all enabled mappings or individually.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button onClick={bulkSync} disabled={bulkSyncing || mappings.filter(m => m.enabled).length === 0}>
                  {bulkSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Sync All Enabled ({mappings.filter(m => m.enabled).length})
                </Button>
              </div>

              {!connectionId && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Connect to a tenant first to run sync operations.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Sync History</h3>
            <Button variant="outline" onClick={loadSyncLogs}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>

          {syncLogs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Sync History</h3>
                <p className="text-muted-foreground mt-1">Run a sync to see results here.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Removed</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-emerald-400">+{log.devices_added}</TableCell>
                      <TableCell className="text-destructive">-{log.devices_removed}</TableCell>
                      <TableCell className="text-muted-foreground">{log.devices_skipped}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* SAFETY TAB */}
        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Group prefix allowlist
              </CardTitle>
              <CardDescription>
                When set, DUDE Sync refuses to write to any group whose name doesn't start with one of these prefixes —
                applies to BOTH the user group and the device group on every mapping. Empty = no restriction (legacy
                behavior). Recommended: pick a naming convention like <code>SG-DUDE-</code> for everything DUDE manages,
                so an attacker who compromises Aegis can't pivot into your "All Users" group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Prefix (e.g. SG-DUDE-)"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPrefix()}
                />
                <Button onClick={addPrefix} disabled={savingSettings || !newPrefix.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {allowedPrefixes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No prefixes set. DUDE Sync will operate on any group your service principal can write to.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowedPrefixes.map((p) => (
                    <Badge key={p} variant="outline" className="gap-2 py-1.5 pr-1">
                      <span className="font-mono">{p}</span>
                      <button
                        onClick={() => removePrefix(p)}
                        className="hover:text-destructive"
                        aria-label={`Remove ${p}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Dry-run mode
              </CardTitle>
              <CardDescription>
                New mappings ship with dry-run enabled — sync produces a preview but never writes. Flip the badge in
                the Mappings table to "Apply" once you've reviewed the preview and trust the result.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mappings in dry-run</span>
                  <span className="font-medium">{mappings.filter((m) => m.dry_run).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mappings applying writes</span>
                  <span className="font-medium">{mappings.filter((m) => !m.dry_run).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD/EDIT DIALOG */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editMapping ? 'Edit Mapping' : 'Add Mapping'}</DialogTitle>
            <DialogDescription>Map a user group to a device group for automatic membership sync.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Group search */}
            <div className="space-y-2">
              <Label>Search Groups in Entra ID</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type group name prefix..."
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                />
                <Button variant="outline" onClick={() => searchGroups(groupSearch)} disabled={searchingGroups || groupSearch.length < 2}>
                  {searchingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {groupOptions.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  <div className="p-2 flex gap-2">
                    <Button size="sm" variant={selectedGroupField === 'user' ? 'default' : 'outline'} onClick={() => setSelectedGroupField('user')}>Set as User Group</Button>
                    <Button size="sm" variant={selectedGroupField === 'device' ? 'default' : 'outline'} onClick={() => setSelectedGroupField('device')}>Set as Device Group</Button>
                  </div>
                  {groupOptions.map(g => (
                    <button key={g.id} className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        if (selectedGroupField === 'user') { setFormUserGroupId(g.id); setFormUserGroupName(g.displayName); }
                        else { setFormDeviceGroupId(g.id); setFormDeviceGroupName(g.displayName); }
                        toast({ title: `${selectedGroupField === 'user' ? 'User' : 'Device'} Group Set`, description: g.displayName });
                      }}>
                      {g.displayName}
                      <span className="text-xs text-muted-foreground ml-2">{g.id.slice(0, 8)}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>User Group</Label>
                <Input value={formUserGroupName} onChange={e => setFormUserGroupName(e.target.value)} placeholder="Display name" />
                <Input value={formUserGroupId} onChange={e => setFormUserGroupId(e.target.value)} placeholder="Object ID" className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label>Device Group</Label>
                <Input value={formDeviceGroupName} onChange={e => setFormDeviceGroupName(e.target.value)} placeholder="Display name" />
                <Input value={formDeviceGroupId} onChange={e => setFormDeviceGroupId(e.target.value)} placeholder="Object ID" className="text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>OS Filter</Label>
                <Select value={formOsFilter} onValueChange={setFormOsFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OS_FILTERS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Defender Tag (optional)</Label>
                <Input value={formDefenderTag} onChange={e => setFormDefenderTag(e.target.value)} placeholder="e.g. Sales" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Admin Unit Name (optional)</Label>
                <Input value={formAdminUnitName} onChange={e => setFormAdminUnitName(e.target.value)} placeholder="AU display name" />
              </div>
              <div className="space-y-1">
                <Label>Admin Unit ID (optional)</Label>
                <Input value={formAdminUnitId} onChange={e => setFormAdminUnitId(e.target.value)} placeholder="Object ID" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Removal Percent (Blast Radius Limiter): {formMaxRemoval}%</Label>
              <Slider value={[formMaxRemoval]} onValueChange={v => setFormMaxRemoval(v[0])} min={10} max={100} step={5} />
              <p className="text-xs text-muted-foreground">If removals exceed this % of current members, sync is skipped for safety.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={saveMapping}>{editMapping ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Preview (Dry Run)</DialogTitle>
            <DialogDescription>Review changes before executing sync.</DialogDescription>
          </DialogHeader>
          {!previewData ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Resolving devices...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Resolved Devices:</span>
                  <span className="ml-2 font-medium">{previewData.resolvedDeviceCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Members:</span>
                  <span className="ml-2 font-medium">{previewData.currentMemberCount}</span>
                </div>
              </div>

              {previewData.blastRadiusExceeded && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Blast Radius Exceeded</p>
                    <p className="text-muted-foreground">Removal {previewData.removalPercent}% exceeds limit of {previewData.maxRemovalPercent}%. Sync will be skipped.</p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-emerald-400 mb-1">To Add ({previewData.toAdd.length})</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {previewData.toAdd.map((d: any) => (
                    <div key={d.id} className="text-xs bg-emerald-500/10 rounded px-2 py-1">{d.displayName || d.id}</div>
                  ))}
                  {previewData.toAdd.length === 0 && <p className="text-xs text-muted-foreground">No devices to add</p>}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-destructive mb-1">To Remove ({previewData.toRemove.length})</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {previewData.toRemove.map((d: any) => (
                    <div key={d.id} className="text-xs bg-destructive/10 rounded px-2 py-1">{d.displayName || d.id}</div>
                  ))}
                  {previewData.toRemove.length === 0 && <p className="text-xs text-muted-foreground">No devices to remove</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            {previewData && !previewData.blastRadiusExceeded && previewMappingId && (
              <Button onClick={() => { setShowPreview(false); executeSync(previewMappingId); }}>
                <Play className="h-4 w-4 mr-2" />Execute Sync
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
