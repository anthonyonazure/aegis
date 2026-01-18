import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import {
  getScheduledGovernanceConfigs,
  createScheduledGovernanceConfig,
  updateScheduledGovernanceConfig,
  deleteScheduledGovernanceConfig,
  getScheduledGovernanceRuns,
  runGovernanceScanManually,
  ScheduledGovernanceConfig,
  ScheduledGovernanceRun,
} from '@/lib/scheduledGovernanceDatabase';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
  Bell,
  Shield,
  Users,
  CreditCard,
  Activity,
  History,
} from 'lucide-react';

const SCHEDULE_OPTIONS = [
  { value: '0 6 * * *', label: 'Daily at 6 AM' },
  { value: '0 0 * * 1', label: 'Weekly on Monday' },
  { value: '0 0 1 * *', label: 'Monthly on the 1st' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 */12 * * *', label: 'Every 12 hours' },
];

interface GovernanceScheduleManagerProps {
  onRunComplete?: () => void;
}

export function GovernanceScheduleManager({ onRunComplete }: GovernanceScheduleManagerProps) {
  const { toast } = useToast();
  const { customers, tenants, selectedCustomerId } = useTenant();
  const [configs, setConfigs] = useState<ScheduledGovernanceConfig[]>([]);
  const [runs, setRuns] = useState<ScheduledGovernanceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRunsDialog, setShowRunsDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ScheduledGovernanceConfig | null>(null);
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSchedule, setFormSchedule] = useState('0 6 * * *');
  const [formTargetType, setFormTargetType] = useState('all_tenants');
  const [formTargetCustomerId, setFormTargetCustomerId] = useState<string>('');
  const [formSecureScoreThreshold, setFormSecureScoreThreshold] = useState(50);
  const [formMfaThreshold, setFormMfaThreshold] = useState(80);
  const [formLicenseThreshold, setFormLicenseThreshold] = useState(70);
  const [formAlertRiskyUsers, setFormAlertRiskyUsers] = useState(true);
  const [formAlertRiskySignins, setFormAlertRiskySignins] = useState(true);
  const [formNotifyOnCompletion, setFormNotifyOnCompletion] = useState(false);
  const [formNotifyOnThreshold, setFormNotifyOnThreshold] = useState(true);
  const [formWebhookId, setFormWebhookId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsData, runsData] = await Promise.all([
        getScheduledGovernanceConfigs(),
        getScheduledGovernanceRuns(),
      ]);
      setConfigs(configsData);
      setRuns(runsData);

      // Load webhooks
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: webhookData } = await supabase
          .from('webhook_configs')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_active', true);
        setWebhooks(webhookData || []);
      }
    } catch (error) {
      console.error('Failed to load governance schedules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled scans',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createScheduledGovernanceConfig({
        name: formName,
        description: formDescription || undefined,
        schedule_cron: formSchedule,
        schedule_description: SCHEDULE_OPTIONS.find(o => o.value === formSchedule)?.label,
        target_type: formTargetType,
        target_customer_id: formTargetType === 'customer' ? formTargetCustomerId : undefined,
        secure_score_threshold: formSecureScoreThreshold,
        mfa_coverage_threshold: formMfaThreshold,
        license_utilization_threshold: formLicenseThreshold,
        alert_on_risky_users: formAlertRiskyUsers,
        alert_on_risky_signins: formAlertRiskySignins,
        notify_on_completion: formNotifyOnCompletion,
        notify_on_threshold_breach: formNotifyOnThreshold,
        webhook_config_id: formWebhookId || undefined,
      });

      toast({
        title: 'Schedule Created',
        description: `Governance scan "${formName}" has been scheduled`,
      });

      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create scheduled scan',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (config: ScheduledGovernanceConfig) => {
    try {
      await updateScheduledGovernanceConfig(config.id, { is_active: !config.is_active });
      toast({
        title: config.is_active ? 'Schedule Paused' : 'Schedule Activated',
        description: `"${config.name}" is now ${config.is_active ? 'paused' : 'active'}`,
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

  const handleDelete = async (config: ScheduledGovernanceConfig) => {
    if (!confirm(`Are you sure you want to delete "${config.name}"?`)) return;

    try {
      await deleteScheduledGovernanceConfig(config.id);
      toast({
        title: 'Schedule Deleted',
        description: `"${config.name}" has been removed`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const handleRunNow = async (config: ScheduledGovernanceConfig) => {
    setRunningConfigId(config.id);
    try {
      const result = await runGovernanceScanManually(config.id);
      if (result.success) {
        toast({
          title: 'Scan Started',
          description: `Governance scan "${config.name}" is running`,
        });
        loadData();
        onRunComplete?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start scan',
        variant: 'destructive',
      });
    } finally {
      setRunningConfigId(null);
    }
  };

  const handleViewRuns = async (config: ScheduledGovernanceConfig) => {
    setSelectedConfig(config);
    const configRuns = await getScheduledGovernanceRuns(config.id);
    setRuns(configRuns);
    setShowRunsDialog(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormSchedule('0 6 * * *');
    setFormTargetType('all_tenants');
    setFormTargetCustomerId('');
    setFormSecureScoreThreshold(50);
    setFormMfaThreshold(80);
    setFormLicenseThreshold(70);
    setFormAlertRiskyUsers(true);
    setFormAlertRiskySignins(true);
    setFormNotifyOnCompletion(false);
    setFormNotifyOnThreshold(true);
    setFormWebhookId('');
  };

  const getStatusBadge = (run: ScheduledGovernanceRun) => {
    switch (run.status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{run.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scheduled Governance Scans</h3>
          <p className="text-sm text-muted-foreground">
            Automate governance scans with configurable thresholds and alerts
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {/* Schedules List */}
      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Scheduled Scans</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a scheduled scan to automatically monitor governance metrics
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <Card key={config.id} className={!config.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{config.name}</h4>
                      {config.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Activity className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </div>
                    {config.description && (
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {config.schedule_description || config.schedule_cron}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {config.target_type === 'all_tenants' ? 'All Tenants' : 
                         config.target_type === 'customer' ? 'Customer' : 'Specific Tenants'}
                      </span>
                      <span>Runs: {config.run_count}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewRuns(config)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunNow(config)}
                      disabled={runningConfigId === config.id}
                    >
                      {runningConfigId === config.id ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-1" />
                      )}
                      Run Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(config)}
                    >
                      {config.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(config)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Thresholds */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Secure Score: ≥{config.secure_score_threshold}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-sm">MFA: ≥{config.mfa_coverage_threshold}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">License: ≥{config.license_utilization_threshold}%</span>
                  </div>
                  {config.webhook_config_id && (
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">Webhook enabled</span>
                    </div>
                  )}
                </div>

                {/* Last Run Info */}
                {config.last_run_at && (
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    Last run: {format(new Date(config.last_run_at), 'MMM d, yyyy h:mm a')}
                    {config.last_run_success !== null && (
                      <span className={config.last_run_success ? 'text-green-500 ml-2' : 'text-red-500 ml-2'}>
                        ({config.last_run_success ? 'Success' : 'Failed'})
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Governance Scan Schedule</DialogTitle>
            <DialogDescription>
              Configure automated governance scans with custom thresholds and alerts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Schedule Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Daily Security Check"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this schedule"
                />
              </div>

              <div className="space-y-2">
                <Label>Schedule Frequency</Label>
                <Select value={formSchedule} onValueChange={setFormSchedule}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Target */}
            <div className="space-y-4">
              <Label>Target Tenants</Label>
              <Select value={formTargetType} onValueChange={setFormTargetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_tenants">All Connected Tenants</SelectItem>
                  <SelectItem value="customer">Specific Customer</SelectItem>
                </SelectContent>
              </Select>

              {formTargetType === 'customer' && (
                <Select value={formTargetCustomerId} onValueChange={setFormTargetCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Thresholds */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Alert Thresholds</Label>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Secure Score Threshold</Label>
                    <span className="text-sm font-medium">{formSecureScoreThreshold}%</span>
                  </div>
                  <Slider
                    value={[formSecureScoreThreshold]}
                    onValueChange={(v) => setFormSecureScoreThreshold(v[0])}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Alert when score falls below this threshold</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">MFA Coverage Threshold</Label>
                    <span className="text-sm font-medium">{formMfaThreshold}%</span>
                  </div>
                  <Slider
                    value={[formMfaThreshold]}
                    onValueChange={(v) => setFormMfaThreshold(v[0])}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">License Utilization Threshold</Label>
                    <span className="text-sm font-medium">{formLicenseThreshold}%</span>
                  </div>
                  <Slider
                    value={[formLicenseThreshold]}
                    onValueChange={(v) => setFormLicenseThreshold(v[0])}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="risky-users"
                    checked={formAlertRiskyUsers}
                    onCheckedChange={(checked) => setFormAlertRiskyUsers(checked as boolean)}
                  />
                  <Label htmlFor="risky-users">Alert on risky users detected</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="risky-signins"
                    checked={formAlertRiskySignins}
                    onCheckedChange={(checked) => setFormAlertRiskySignins(checked as boolean)}
                  />
                  <Label htmlFor="risky-signins">Alert on risky sign-ins detected</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notifications */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Notifications</Label>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-completion"
                    checked={formNotifyOnCompletion}
                    onCheckedChange={(checked) => setFormNotifyOnCompletion(checked as boolean)}
                  />
                  <Label htmlFor="notify-completion">Notify on every scan completion</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-threshold"
                    checked={formNotifyOnThreshold}
                    onCheckedChange={(checked) => setFormNotifyOnThreshold(checked as boolean)}
                  />
                  <Label htmlFor="notify-threshold">Notify only when thresholds breached</Label>
                </div>
              </div>

              {webhooks.length > 0 && (
                <div className="space-y-2">
                  <Label>Webhook (optional)</Label>
                  <Select value={formWebhookId} onValueChange={setFormWebhookId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a webhook" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {webhooks.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName}>
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run History Dialog */}
      <Dialog open={showRunsDialog} onOpenChange={setShowRunsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run History: {selectedConfig?.name}</DialogTitle>
            <DialogDescription>
              View past scan runs and their results
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            {runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No runs yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Tenants</TableHead>
                    <TableHead className="text-center">Alerts</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        {run.started_at
                          ? format(new Date(run.started_at), 'MMM d, h:mm a')
                          : format(new Date(run.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>{getStatusBadge(run)}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-500">{run.completed_tenants}</span>
                        {run.failed_tenants > 0 && (
                          <span className="text-red-500"> / {run.failed_tenants} failed</span>
                        )}
                        <span className="text-muted-foreground"> / {run.total_tenants}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {run.tenants_with_alerts > 0 ? (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {run.tenants_with_alerts}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
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
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
