import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Play, Plus, Download, Trash2, Edit, Search, Boxes, History, Code2, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';
import {
  Plugin,
  PluginCategory,
  PluginInputField,
  PluginRun,
  browsePublicPlugins,
  createPlugin,
  deletePlugin,
  getMyPlugins,
  getRecentRuns,
  installPlugin,
  runPlugin,
  updatePlugin,
} from '@/lib/pluginsDatabase';

const CATEGORIES: PluginCategory[] = ['analysis', 'remediation', 'reporting', 'compliance', 'other'];

const SAMPLE_TEMPLATE = `Analyze the M365 tenant context below and write a 1-paragraph executive summary
focused on {{focusArea}}. Avoid jargon. Tone: {{tone}}.

Tenant context:
{{tenantContext}}`;

const SAMPLE_SCHEMA: PluginInputField[] = [
  { name: 'focusArea', label: 'Focus area', type: 'text', required: true, default: 'access control' },
  { name: 'tone', label: 'Tone', type: 'text', required: false, default: 'concise, technical' },
];

/**
 * Phase 2 #6 — Plugin SDK MSP-side UI.
 *
 * Three tabs:
 *   - My plugins: CRUD + Run.
 *   - Marketplace: browse + Install (clones to your library).
 *   - Run history: recent executions across all plugins, with full output.
 */
export function PluginsView() {
  const { toast } = useToast();
  const [myPlugins, setMyPlugins] = useState<Plugin[]>([]);
  const [publicPlugins, setPublicPlugins] = useState<Plugin[]>([]);
  const [runs, setRuns] = useState<PluginRun[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Plugin | null>(null);
  const [eName, setEName] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eCategory, setECategory] = useState<PluginCategory>('analysis');
  const [eTemplate, setETemplate] = useState(SAMPLE_TEMPLATE);
  const [eSchemaJson, setESchemaJson] = useState(JSON.stringify(SAMPLE_SCHEMA, null, 2));
  const [eRequiresTenant, setERequiresTenant] = useState(true);
  const [eIsPublic, setEIsPublic] = useState(false);
  const [eModel, setEModel] = useState('gpt-4o-mini');
  const [eTemperature, setETemperature] = useState('0.3');
  const [savingEditor, setSavingEditor] = useState(false);

  // Run dialog
  const [runOpen, setRunOpen] = useState(false);
  const [runPlugin_, setRunPlugin] = useState<Plugin | null>(null);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [runTenants, setRunTenants] = useState<SelectedTenantInfo[]>([]);
  const [runOutput, setRunOutput] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const refreshMine = async () => {
    setLoadingMine(true);
    try {
      setMyPlugins(await getMyPlugins());
    } catch (e) {
      toast({
        title: 'Failed to load plugins',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingMine(false);
    }
  };

  const refreshPublic = async () => {
    setLoadingPublic(true);
    try {
      setPublicPlugins(
        await browsePublicPlugins({
          search: search.trim() || undefined,
          category: category || undefined,
          limit: 50,
        })
      );
    } finally {
      setLoadingPublic(false);
    }
  };

  const refreshRuns = async () => {
    try {
      setRuns(await getRecentRuns(25));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refreshMine();
    void refreshPublic();
    void refreshRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setEName('');
    setEDescription('');
    setECategory('analysis');
    setETemplate(SAMPLE_TEMPLATE);
    setESchemaJson(JSON.stringify(SAMPLE_SCHEMA, null, 2));
    setERequiresTenant(true);
    setEIsPublic(false);
    setEModel('gpt-4o-mini');
    setETemperature('0.3');
    setEditorOpen(true);
  };

  const openEdit = (p: Plugin) => {
    setEditing(p);
    setEName(p.name);
    setEDescription(p.description ?? '');
    setECategory(p.category ?? 'analysis');
    setETemplate(p.promptTemplate);
    setESchemaJson(JSON.stringify(p.inputSchema ?? [], null, 2));
    setERequiresTenant(p.requiresTenant);
    setEIsPublic(p.isPublic);
    setEModel(p.defaultModel ?? 'gpt-4o-mini');
    setETemperature(String(p.defaultTemperature ?? 0.3));
    setEditorOpen(true);
  };

  const handleSaveEditor = async () => {
    if (!eName.trim() || !eTemplate.trim()) {
      toast({ title: 'Name and prompt template required', variant: 'destructive' });
      return;
    }
    let schema: PluginInputField[];
    try {
      schema = JSON.parse(eSchemaJson);
      if (!Array.isArray(schema)) throw new Error('input_schema must be an array');
    } catch (e) {
      toast({ title: 'Invalid input schema', description: e instanceof Error ? e.message : 'Must be valid JSON array.', variant: 'destructive' });
      return;
    }
    setSavingEditor(true);
    try {
      const tempNum = Number(eTemperature);
      const payload = {
        name: eName.trim(),
        description: eDescription.trim() || undefined,
        category: eCategory,
        promptTemplate: eTemplate,
        inputSchema: schema,
        requiresTenant: eRequiresTenant,
        defaultModel: eModel.trim() || undefined,
        defaultTemperature: Number.isFinite(tempNum) ? tempNum : 0.3,
        isPublic: eIsPublic,
      };
      if (editing) {
        await updatePlugin(editing.id, {
          ...payload,
          description: payload.description ?? null,
          defaultModel: payload.defaultModel ?? null,
        });
        toast({ title: 'Plugin updated' });
      } else {
        await createPlugin(payload);
        toast({ title: 'Plugin created' });
      }
      setEditorOpen(false);
      void refreshMine();
      void refreshPublic();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingEditor(false);
    }
  };

  const handleDelete = async (p: Plugin) => {
    if (!confirm(`Delete plugin "${p.name}"? Run history is kept.`)) return;
    try {
      await deletePlugin(p.id);
      toast({ title: 'Deleted' });
      void refreshMine();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleInstall = async (p: Plugin) => {
    try {
      await installPlugin(p.id);
      toast({ title: 'Plugin installed', description: `"${p.name}" added to your plugins.` });
      void refreshMine();
      void refreshPublic();
    } catch (e) {
      toast({
        title: 'Install failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const openRun = (p: Plugin) => {
    setRunPlugin(p);
    const initial: Record<string, string> = {};
    for (const f of p.inputSchema ?? []) {
      initial[f.name] = String(f.default ?? '');
    }
    setRunInputs(initial);
    setRunTenants([]);
    setRunOutput('');
    setRunOpen(true);
  };

  const handleRun = async () => {
    if (!runPlugin_) return;
    if (runPlugin_.requiresTenant && runTenants.length === 0) {
      toast({ title: 'Pick a tenant', variant: 'destructive' });
      return;
    }
    setRunning(true);
    setRunOutput('');
    try {
      const result = await runPlugin({
        pluginId: runPlugin_.id,
        inputs: runInputs,
        tenantConnectionId: runTenants[0]?.id,
      });
      if (!result.success) {
        toast({
          title: 'Run failed',
          description: result.error ?? 'Unknown error',
          variant: 'destructive',
        });
      } else {
        setRunOutput(result.output ?? '(no output)');
        toast({ title: 'Plugin ran successfully', description: `${result.durationMs ?? 0}ms` });
        void refreshRuns();
      }
    } finally {
      setRunning(false);
    }
  };

  const myPluginsById = useMemo(() => new Map(myPlugins.map((p) => [p.id, p])), [myPlugins]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plugins</h1>
          <p className="text-muted-foreground mt-1">
            Author and run AI workflows. Templates use <code>{'{{variable}}'}</code> placeholders; tenant context is
            auto-injected when the plugin opts in.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New plugin
        </Button>
      </header>

      <Tabs defaultValue="mine" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine">My plugins</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="history">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-3">
          {loadingMine ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : myPlugins.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Boxes className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">You don't have any plugins yet.</p>
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first plugin
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {myPlugins.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        {p.isPublic && <Badge>Public</Badge>}
                        {p.category && <Badge variant="outline">{p.category}</Badge>}
                      </div>
                    </div>
                    {p.description && <CardDescription className="line-clamp-2">{p.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>{(p.inputSchema ?? []).length} input{(p.inputSchema ?? []).length === 1 ? '' : 's'}</span>
                      {p.requiresTenant && <span>Requires tenant</span>}
                      {p.installCount > 0 && <span>{p.installCount} installs</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => openRun(p)}>
                        <Play className="w-3 h-3 mr-1" />
                        Run
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-3">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr,200px,auto]">
                <Input
                  placeholder="Search by name or description"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refreshPublic()}
                />
                <select
                  className="w-full h-10 rounded-md border border-border/60 bg-background px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button onClick={() => refreshPublic()}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {loadingPublic ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : publicPlugins.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Boxes className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No public plugins match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {publicPlugins.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.category && <Badge variant="outline">{p.category}</Badge>}
                    </div>
                    {p.description && <CardDescription className="line-clamp-2">{p.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {p.installCount}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => handleInstall(p)}>
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No plugin runs yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => {
                const expanded = expandedRunId === r.id;
                const plugin = myPluginsById.get(r.pluginId);
                return (
                  <Card key={r.id}>
                    <button
                      onClick={() => setExpandedRunId(expanded ? null : r.id)}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{plugin?.name ?? '(plugin removed)'}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.ranAt.toLocaleString()}
                            {r.durationMs ? ` · ${r.durationMs}ms` : ''}
                            {r.model ? ` · ${r.model}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              r.status === 'completed'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 border'
                                : r.status === 'failed'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30 border'
                                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border'
                            }
                          >
                            {r.status}
                          </Badge>
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/40">
                        {r.error && (
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                            {r.error}
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">Inputs</Label>
                          <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                            {JSON.stringify(r.inputs, null, 2)}
                          </pre>
                        </div>
                        {r.output && (
                          <div>
                            <Label className="text-xs">Output</Label>
                            <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                              {r.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit plugin' : 'New plugin'}</DialogTitle>
            <DialogDescription>
              Use <code>{'{{varName}}'}</code> placeholders. <code>{'{{tenantContext}}'}</code> is auto-filled when
              "Requires tenant" is enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2 space-y-1">
                <Label>Name</Label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={eCategory} onValueChange={(v) => setECategory(v as PluginCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Prompt template</Label>
              <Textarea
                value={eTemplate}
                onChange={(e) => setETemplate(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label>Input schema (JSON)</Label>
              <Textarea
                value={eSchemaJson}
                onChange={(e) => setESchemaJson(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={eModel} onChange={(e) => setEModel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Temperature</Label>
                <Input value={eTemperature} onChange={(e) => setETemperature(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1 flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={eRequiresTenant} onCheckedChange={setERequiresTenant} id="rt" />
                  <Label htmlFor="rt">Tenant ctx</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={eIsPublic} onCheckedChange={setEIsPublic} id="pub" />
                  <Label htmlFor="pub">Public</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditor} disabled={savingEditor}>
              {savingEditor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Code2 className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-2xl">
          {runPlugin_ && (
            <>
              <DialogHeader>
                <DialogTitle>Run "{runPlugin_.name}"</DialogTitle>
                {runPlugin_.description && <DialogDescription>{runPlugin_.description}</DialogDescription>}
              </DialogHeader>
              <div className="space-y-3">
                {(runPlugin_.inputSchema ?? []).map((f) => (
                  <div key={f.name} className="space-y-1">
                    <Label htmlFor={`in-${f.name}`}>
                      {f.label ?? f.name}
                      {f.required ? ' *' : ''}
                    </Label>
                    {f.type === 'textarea' ? (
                      <Textarea
                        id={`in-${f.name}`}
                        value={runInputs[f.name] ?? ''}
                        onChange={(e) => setRunInputs({ ...runInputs, [f.name]: e.target.value })}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`in-${f.name}`}
                        value={runInputs[f.name] ?? ''}
                        onChange={(e) => setRunInputs({ ...runInputs, [f.name]: e.target.value })}
                      />
                    )}
                    {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
                  </div>
                ))}
                {runPlugin_.requiresTenant && (
                  <div className="space-y-1">
                    <Label>Tenant *</Label>
                    <TenantMultiSelector
                      selectedTenantIds={runTenants.map((t) => t.id)}
                      onSelectionChange={setRunTenants}
                      multiSelect={false}
                      label="Select tenant"
                    />
                  </div>
                )}
                {runOutput && (
                  <div>
                    <Label className="text-xs">Output</Label>
                    <pre className="text-xs bg-muted/40 rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                      {runOutput}
                    </pre>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRunOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleRun} disabled={running}>
                  {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
