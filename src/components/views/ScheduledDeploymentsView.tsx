import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  ScheduledDeploymentConfig,
  ScheduledDeploymentRun,
  createScheduledDeployment,
  updateScheduledDeployment,
  deleteScheduledDeployment,
  getScheduledDeployments,
  getScheduledDeploymentRuns,
  triggerScheduledDeployment,
  DEPLOYMENT_SCHEDULE_PRESETS,
} from '@/lib/scheduledDeploymentDatabase';
import { getPolicyTemplates } from '@/lib/policyDatabase';
import { getCustomers } from '@/lib/customerDatabase';
import { PolicyTemplate } from '@/types/policy';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Rocket,
  Building2,
  Server,
  Eye,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface TenantGroup {
  id: string;
  name: string;
  customer_id: string;
}

export const ScheduledDeploymentsView = () => {
  const [configs, setConfigs] = useState<ScheduledDeploymentConfig[]>([]);
  const [runs, setRuns] = useState<ScheduledDeploymentRun[]>([]);
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenantGroups, setTenantGroups] = useState<TenantGroup[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ScheduledDeploymentConfig | null>(null);
  const [deletingConfig, setDeletingConfig] = useState<ScheduledDeploymentConfig | null>(null);
  const [selectedConfigRuns, setSelectedConfigRuns] = useState<ScheduledDeploymentRun[]>([]);
  const [viewingConfig, setViewingConfig] = useState<ScheduledDeploymentConfig | null>(null);
  const [isRunning, setIsRunning] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formTargetType, setFormTargetType] = useState<'all' | 'customer' | 'group' | 'selected'>('selected');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formGroupId, setFormGroupId] = useState('');
  const [formTenantIds, setFormTenantIds] = useState<string[]>([]);
  const [formSchedulePreset, setFormSchedulePreset] = useState('daily');
  const [formCustomCron, setFormCustomCron] = useState('');
  const [formDryRun, setFormDryRun] = useState(false);
  const [formNotify, setFormNotify] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formTargetType === 'customer' && formCustomerId) {
      loadTenantGroups(formCustomerId);
    }
    loadTenants();
  }, [formTargetType, formCustomerId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [configsData, templatesData, customersData, runsData] = await Promise.all([
        getScheduledDeployments(),
        getPolicyTemplates(),
        getCustomers(),
        getScheduledDeploymentRuns(),
      ]);
      setConfigs(configsData);
      setTemplates(templatesData);
      setCustomers(customersData);
      setRuns(runsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load scheduled deployments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenantGroups = async (customerId: string) => {
    const { data } = await supabase
      .from('tenant_groups')
      .select('id, name, customer_id')
      .eq('customer_id', customerId);
    setTenantGroups(data || []);
  };

  const loadTenants = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('tenant_connections')
      .select('id, display_name, tenant_name')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    setTenants((data || []).map(t => ({
      id: t.id,
      name: t.display_name || t.tenant_name || t.id,
    })));
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTemplateId('');
    setFormTargetType('selected');
    setFormCustomerId('');
    setFormGroupId('');
    setFormTenantIds([]);
    setFormSchedulePreset('daily');
    setFormCustomCron('');
    setFormDryRun(false);
    setFormNotify(true);
    setEditingConfig(null);
  };

  const openEditDialog = (config: ScheduledDeploymentConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormDescription(config.description || '');
    setFormTemplateId(config.policy_template_id);
    setFormTargetType(config.target_type);
    setFormCustomerId(config.target_customer_id || '');
    setFormGroupId(config.target_group_id || '');
    setFormTenantIds(config.target_tenant_ids);
    
    const preset = DEPLOYMENT_SCHEDULE_PRESETS.find(p => p.cron === config.schedule_cron);
    if (preset) {
      setFormSchedulePreset(preset.id);
      setFormCustomCron('');
    } else {
      setFormSchedulePreset('custom');
      setFormCustomCron(config.schedule_cron);
    }
    
    setFormDryRun(config.dry_run);
    setFormNotify(config.notify_on_completion);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName || !formTemplateId) {
      toast({ title: 'Error', description: 'Name and template are required', variant: 'destructive' });
      return;
    }

    const cronExpression = formSchedulePreset === 'custom' 
      ? formCustomCron 
      : DEPLOYMENT_SCHEDULE_PRESETS.find(p => p.id === formSchedulePreset)?.cron || '0 0 * * *';

    try {
      if (editingConfig) {
        await updateScheduledDeployment(editingConfig.id, {
          name: formName,
          description: formDescription,
          policy_template_id: formTemplateId,
          target_type: formTargetType,
          target_customer_id: formTargetType === 'customer' ? formCustomerId : undefined,
          target_group_id: formTargetType === 'group' ? formGroupId : undefined,
          target_tenant_ids: formTargetType === 'selected' ? formTenantIds : undefined,
          schedule_cron: cronExpression,
          schedule_description: DEPLOYMENT_SCHEDULE_PRESETS.find(p => p.id === formSchedulePreset)?.description,
          dry_run: formDryRun,
          notify_on_completion: formNotify,
        });
        toast({ title: 'Success', description: 'Schedule updated' });
      } else {
        await createScheduledDeployment({
          name: formName,
          description: formDescription,
          policy_template_id: formTemplateId,
          target_type: formTargetType,
          target_customer_id: formTargetType === 'customer' ? formCustomerId : undefined,
          target_group_id: formTargetType === 'group' ? formGroupId : undefined,
          target_tenant_ids: formTargetType === 'selected' ? formTenantIds : undefined,
          schedule_cron: cronExpression,
          schedule_description: DEPLOYMENT_SCHEDULE_PRESETS.find(p => p.id === formSchedulePreset)?.description,
          dry_run: formDryRun,
          notify_on_completion: formNotify,
        });
        toast({ title: 'Success', description: 'Schedule created' });
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save schedule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;

    try {
      await deleteScheduledDeployment(deletingConfig.id);
      toast({ title: 'Success', description: 'Schedule deleted' });
      setIsDeleteDialogOpen(false);
      setDeletingConfig(null);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (config: ScheduledDeploymentConfig) => {
    try {
      await updateScheduledDeployment(config.id, { is_active: !config.is_active });
      toast({
        title: 'Success',
        description: `Schedule ${config.is_active ? 'paused' : 'activated'}`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  const handleRunNow = async (config: ScheduledDeploymentConfig) => {
    try {
      setIsRunning(config.id);
      await triggerScheduledDeployment(config.id);
      toast({ title: 'Success', description: 'Deployment triggered' });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to trigger deployment',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(null);
    }
  };

  const viewConfigRuns = (config: ScheduledDeploymentConfig) => {
    setViewingConfig(config);
    setSelectedConfigRuns(runs.filter(r => r.scheduled_config_id === config.id));
  };

  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.name || 'Unknown';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Deployments</h1>
          <p className="text-muted-foreground">Automate policy deployments on a schedule</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          New Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{configs.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Play className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{configs.filter(c => c.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {runs.filter(r => r.status === 'completed').length}
                </p>
                <p className="text-sm text-muted-foreground">Successful Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">
                  {runs.filter(r => r.status === 'failed').length}
                </p>
                <p className="text-sm text-muted-foreground">Failed Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Schedules</CardTitle>
          <CardDescription>
            {configs.length} schedule(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled deployments yet</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Create Your First Schedule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTemplateName(config.policy_template_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {config.schedule_description || config.schedule_cron}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.last_run_at ? (
                        <div className="flex items-center gap-2">
                          {config.last_run_success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(config.last_run_at), { addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.is_active ? 'default' : 'secondary'}>
                        {config.is_active ? 'Active' : 'Paused'}
                      </Badge>
                      {config.dry_run && (
                        <Badge variant="outline" className="ml-1">Dry Run</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRunNow(config)}
                          disabled={isRunning === config.id}
                          title="Run Now"
                        >
                          {isRunning === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(config)}
                          title={config.is_active ? 'Pause' : 'Activate'}
                        >
                          {config.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewConfigRuns(config)}
                          title="View Runs"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(config)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setDeletingConfig(config); setIsDeleteDialogOpen(true); }}
                          title="Delete"
                        >
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Schedule' : 'New Scheduled Deployment'}</DialogTitle>
            <DialogDescription>
              Configure automated policy deployments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Weekly Security Update"
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Template *</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select value={formSchedulePreset} onValueChange={setFormSchedulePreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPLOYMENT_SCHEDULE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label} - {preset.description}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Cron Expression</SelectItem>
                </SelectContent>
              </Select>
              {formSchedulePreset === 'custom' && (
                <Input
                  value={formCustomCron}
                  onChange={(e) => setFormCustomCron(e.target.value)}
                  placeholder="0 0 * * *"
                  className="mt-2 font-mono"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Target</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'all', label: 'All Tenants', icon: Server },
                  { value: 'customer', label: 'Customer', icon: Building2 },
                  { value: 'selected', label: 'Selected', icon: CheckCircle },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={formTargetType === opt.value ? 'default' : 'outline'}
                    onClick={() => setFormTargetType(opt.value as typeof formTargetType)}
                    className="flex-col h-auto py-3"
                  >
                    <opt.icon className="w-5 h-5 mb-1" />
                    <span className="text-xs">{opt.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {formTargetType === 'customer' && (
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {formTargetType === 'selected' && (
              <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                {tenants.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTenantIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormTenantIds([...formTenantIds, t.id]);
                        } else {
                          setFormTenantIds(formTenantIds.filter(id => id !== t.id));
                        }
                      }}
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Dry Run Mode</span>
              </div>
              <Switch checked={formDryRun} onCheckedChange={setFormDryRun} />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Notify on Completion</span>
              </div>
              <Switch checked={formNotify} onCheckedChange={setFormNotify} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingConfig ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingConfig?.name}" and all its run history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run History Dialog */}
      <Dialog open={!!viewingConfig} onOpenChange={() => setViewingConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run History: {viewingConfig?.name}</DialogTitle>
            <DialogDescription>
              {selectedConfigRuns.length} run(s) recorded
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedConfigRuns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No runs yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedConfigRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        {run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-500">{run.completed_tenants}</span>
                        {' / '}
                        <span className="text-destructive">{run.failed_tenants}</span>
                        {' / '}
                        {run.total_tenants}
                      </TableCell>
                      <TableCell>
                        {run.started_at && run.completed_at
                          ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
