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
import { ServicePrincipalManager } from '@/components/ServicePrincipalManager';
import {
  ScheduledDriftConfig,
  ScheduledDriftRun,
  createScheduledDriftConfig,
  updateScheduledDriftConfig,
  deleteScheduledDriftConfig,
  getScheduledDriftConfigs,
  getScheduledDriftRuns,
  createScheduledDriftRun,
  SCHEDULE_PRESETS,
} from '@/lib/scheduledDriftDatabase';
import { getCustomers } from '@/lib/customerDatabase';

interface Customer {
  id: string;
  name: string;
}
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Building2,
  Users,
  Shield,
  Activity,
  BarChart3,
} from 'lucide-react';

interface TenantGroup {
  id: string;
  name: string;
  customer_id: string;
}

export const ScheduledDriftView = () => {
  const [configs, setConfigs] = useState<ScheduledDriftConfig[]>([]);
  const [runs, setRuns] = useState<ScheduledDriftRun[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenantGroups, setTenantGroups] = useState<TenantGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ScheduledDriftConfig | null>(null);
  const [deletingConfig, setDeletingConfig] = useState<ScheduledDriftConfig | null>(null);
  const [selectedConfigForRun, setSelectedConfigForRun] = useState<ScheduledDriftConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('schedules');
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_type: 'all' as 'all' | 'customer' | 'group' | 'selected',
    target_customer_id: '',
    target_group_id: '',
    schedule_preset: 'daily',
    schedule_cron: '0 0 * * *',
    schedule_description: 'Runs daily at midnight UTC',
    notify_on_drift: true,
    drift_threshold_percent: 5,
    service_principal_config_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [configsData, runsData, customersData] = await Promise.all([
        getScheduledDriftConfigs(),
        getScheduledDriftRuns(),
        getCustomers(),
      ]);
      
      setConfigs(configsData);
      setRuns(runsData);
      setCustomers(customersData);

      // Load tenant groups
      const { data: groupsData } = await supabase
        .from('tenant_groups')
        .select('id, name, customer_id')
        .order('name');
      setTenantGroups(groupsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled drift configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_type: 'all',
      target_customer_id: '',
      target_group_id: '',
      schedule_preset: 'daily',
      schedule_cron: '0 0 * * *',
      schedule_description: 'Runs daily at midnight UTC',
      notify_on_drift: true,
      drift_threshold_percent: 5,
      service_principal_config_id: '',
    });
    setEditingConfig(null);
  };

  const handleOpenDialog = (config?: ScheduledDriftConfig) => {
    if (config) {
      setEditingConfig(config);
      const preset = SCHEDULE_PRESETS.find(p => p.cron === config.schedule_cron);
      setFormData({
        name: config.name,
        description: config.description || '',
        target_type: config.target_type,
        target_customer_id: config.target_customer_id || '',
        target_group_id: config.target_group_id || '',
        schedule_preset: preset?.id || 'custom',
        schedule_cron: config.schedule_cron,
        schedule_description: config.schedule_description || '',
        notify_on_drift: config.notify_on_drift,
        drift_threshold_percent: config.drift_threshold_percent || 5,
        service_principal_config_id: config.service_principal_config_id || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSchedulePresetChange = (presetId: string) => {
    const preset = SCHEDULE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        schedule_preset: presetId,
        schedule_cron: preset.cron,
        schedule_description: preset.description,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        schedule_preset: 'custom',
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the schedule',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingConfig) {
        await updateScheduledDriftConfig(editingConfig.id, {
          name: formData.name,
          description: formData.description || undefined,
          target_type: formData.target_type,
          target_customer_id: formData.target_customer_id || undefined,
          target_group_id: formData.target_group_id || undefined,
          schedule_cron: formData.schedule_cron,
          schedule_description: formData.schedule_description || undefined,
          notify_on_drift: formData.notify_on_drift,
          drift_threshold_percent: formData.drift_threshold_percent,
          service_principal_config_id: formData.service_principal_config_id || undefined,
        });

        toast({
          title: 'Success',
          description: 'Schedule updated successfully',
        });
      } else {
        await createScheduledDriftConfig({
          name: formData.name,
          description: formData.description || undefined,
          target_type: formData.target_type,
          target_customer_id: formData.target_customer_id || undefined,
          target_group_id: formData.target_group_id || undefined,
          schedule_cron: formData.schedule_cron,
          schedule_description: formData.schedule_description || undefined,
          notify_on_drift: formData.notify_on_drift,
          drift_threshold_percent: formData.drift_threshold_percent,
          service_principal_config_id: formData.service_principal_config_id || undefined,
        });

        toast({
          title: 'Success',
          description: 'Schedule created successfully',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save schedule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (config: ScheduledDriftConfig) => {
    try {
      await updateScheduledDriftConfig(config.id, { is_active: !config.is_active });
      toast({
        title: config.is_active ? 'Paused' : 'Activated',
        description: `Schedule "${config.name}" ${config.is_active ? 'paused' : 'activated'}`,
      });
      loadData();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;

    try {
      await deleteScheduledDriftConfig(deletingConfig.id);
      toast({
        title: 'Deleted',
        description: 'Schedule removed successfully',
      });
      setIsDeleteDialogOpen(false);
      setDeletingConfig(null);
      loadData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const handleRunNow = async () => {
    if (!selectedConfigForRun) return;

    try {
      await createScheduledDriftRun(selectedConfigForRun.id);
      toast({
        title: 'Run Started',
        description: 'Drift detection run has been queued',
      });
      setIsRunDialogOpen(false);
      setSelectedConfigForRun(null);
      loadData();
    } catch (error) {
      console.error('Error starting run:', error);
      toast({
        title: 'Error',
        description: 'Failed to start drift detection run',
        variant: 'destructive',
      });
    }
  };

  const getTargetLabel = (config: ScheduledDriftConfig) => {
    switch (config.target_type) {
      case 'all':
        return 'All Tenants';
      case 'customer':
        const customer = customers.find(c => c.id === config.target_customer_id);
        return customer?.name || 'Unknown Customer';
      case 'group':
        const group = tenantGroups.find(g => g.id === config.target_group_id);
        return group?.name || 'Unknown Group';
      case 'selected':
        return `${config.target_tenant_ids.length} Selected Tenants`;
      default:
        return 'Unknown';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Stats
  const activeSchedules = configs.filter(c => c.is_active).length;
  const totalRuns = runs.length;
  const runsWithDrift = runs.filter(r => r.tenants_with_drift > 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scheduled Drift Detection</h1>
        <p className="text-muted-foreground mt-1">
          Automate drift detection across your tenant groups with scheduled comparisons
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{configs.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSchedules}</p>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRuns}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runsWithDrift}</p>
                <p className="text-sm text-muted-foreground">Runs with Drift</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="service-principals">Service Principals</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </div>

          {configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Schedules</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Create a schedule to automatically detect drift across your tenants
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => (
                <Card key={config.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                          <Clock className={`h-5 w-5 ${config.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{config.name}</CardTitle>
                            {config.last_drift_detected && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Drift Detected
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            {config.schedule_description || config.schedule_cron}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.is_active}
                          onCheckedChange={() => handleToggleActive(config)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedConfigForRun(config);
                            setIsRunDialogOpen(true);
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingConfig(config);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {config.description && (
                      <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-medium flex items-center gap-1">
                          {config.target_type === 'customer' && <Building2 className="h-3 w-3" />}
                          {config.target_type === 'group' && <Users className="h-3 w-3" />}
                          {getTargetLabel(config)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Run</p>
                        <p className="font-medium">
                          {config.last_run_at 
                            ? formatDistanceToNow(new Date(config.last_run_at), { addSuffix: true })
                            : 'Never'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next Run</p>
                        <p className="font-medium">
                          {config.next_run_at && config.is_active
                            ? format(new Date(config.next_run_at), 'MMM d, h:mm a')
                            : 'Not scheduled'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Runs</p>
                        <p className="font-medium">{config.run_count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Run History</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Drift detection runs will appear here once schedules start executing
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Drift</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const config = configs.find(c => c.id === run.scheduled_config_id);
                    const duration = run.started_at && run.completed_at
                      ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                      : null;
                    
                    return (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">
                          {config?.name || 'Unknown Schedule'}
                        </TableCell>
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell>
                          {run.started_at 
                            ? format(new Date(run.started_at), 'MMM d, h:mm a')
                            : 'Pending'
                          }
                        </TableCell>
                        <TableCell>
                          {run.completed_tenants}/{run.total_tenants}
                          {run.failed_tenants > 0 && (
                            <span className="text-destructive ml-1">
                              ({run.failed_tenants} failed)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {run.tenants_with_drift > 0 ? (
                            <Badge variant="destructive">
                              {run.tenants_with_drift} tenant{run.tenants_with_drift !== 1 ? 's' : ''}
                            </Badge>
                          ) : run.status === 'completed' ? (
                            <Badge variant="default" className="bg-green-500">No drift</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {duration !== null ? `${duration}s` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="service-principals">
          <ServicePrincipalManager />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Schedule' : 'New Drift Detection Schedule'}
            </DialogTitle>
            <DialogDescription>
              Configure automated drift detection for your tenant groups
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Daily Production Drift Check"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Check all production tenants for configuration drift"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value: 'all' | 'customer' | 'group' | 'selected') => 
                  setFormData(prev => ({ ...prev, target_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  <SelectItem value="customer">By Customer</SelectItem>
                  <SelectItem value="group">By Tenant Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.target_type === 'customer' && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={formData.target_customer_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, target_customer_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.target_type === 'group' && (
              <div className="space-y-2">
                <Label>Tenant Group</Label>
                <Select
                  value={formData.target_group_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, target_group_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={formData.schedule_preset}
                onValueChange={handleSchedulePresetChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{formData.schedule_description}</p>
            </div>

            {formData.schedule_preset === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="cron">Cron Expression</Label>
                <Input
                  id="cron"
                  placeholder="0 0 * * *"
                  value={formData.schedule_cron}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedule_cron: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="threshold">Drift Threshold (%)</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                max={100}
                value={formData.drift_threshold_percent}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  drift_threshold_percent: parseInt(e.target.value) || 0 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Alert when drift exceeds this percentage of total resources
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notify on Drift</Label>
                <p className="text-xs text-muted-foreground">
                  Send notifications when drift is detected
                </p>
              </div>
              <Switch
                checked={formData.notify_on_drift}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notify_on_drift: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingConfig ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Now Confirmation */}
      <AlertDialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Drift Detection Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately start a drift detection run for "{selectedConfigForRun?.name}".
              The run will check all targeted tenants for configuration changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRunNow}>
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the schedule "{deletingConfig?.name}" and all its run history.
              This action cannot be undone.
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
    </div>
  );
};
