import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HardDrive,
  Plus,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  History,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  BackupConfig,
  BackupRun,
  SCHEDULE_PRESETS,
  BACKUP_TYPES,
  getBackupConfigs,
  createBackupConfig,
  updateBackupConfig,
  deleteBackupConfig,
  getBackupRuns,
  triggerBackupRun,
  deleteBackupRun,
  getBackupStats,
} from '@/lib/backupApi';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
}

interface TenantGroup {
  id: string;
  name: string;
  customerId: string;
}

export function AutomatedBackupsView() {
  const [configs, setConfigs] = useState<BackupConfig[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<BackupConfig | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<TenantGroup[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    backupType: 'policy',
    scheduleCron: '0 2 * * *',
    scheduleDescription: 'Daily at 2:00 AM',
    targetType: 'all',
    targetCustomerId: '',
    targetGroupId: '',
    retentionDays: 30,
    maxBackups: 10,
    autoCleanup: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsData, runsData, statsData, customersData] = await Promise.all([
        getBackupConfigs(),
        getBackupRuns(),
        getBackupStats(),
        supabase.from('customers').select('id, name').order('name'),
      ]);
      setConfigs(configsData);
      setRuns(runsData);
      setStats(statsData);
      setCustomers(customersData.data || []);
      
      // Load groups if we have customers
      if (customersData.data && customersData.data.length > 0) {
        const { data: groupsData } = await supabase
          .from('tenant_groups')
          .select('id, name, customer_id')
          .order('name');
        setGroups((groupsData || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          customerId: g.customer_id,
        })));
      }
    } catch (error) {
      console.error('Error loading backup data:', error);
      toast.error('Failed to load backup configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    try {
      await createBackupConfig({
        name: formData.name,
        description: formData.description,
        backupType: formData.backupType,
        scheduleCron: formData.scheduleCron,
        scheduleDescription: formData.scheduleDescription,
        resourceIds: getResourceIdsForType(formData.backupType),
        formats: ['json'],
        targetType: formData.targetType,
        targetCustomerId: formData.targetCustomerId || undefined,
        targetGroupId: formData.targetGroupId || undefined,
        retentionDays: formData.retentionDays,
        maxBackups: formData.maxBackups,
        autoCleanup: formData.autoCleanup,
      });
      toast.success('Backup schedule created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating backup config:', error);
      toast.error('Failed to create backup schedule');
    }
  };

  const handleToggleActive = async (config: BackupConfig) => {
    try {
      await updateBackupConfig(config.id, { isActive: !config.isActive });
      toast.success(`Backup schedule ${config.isActive ? 'paused' : 'activated'}`);
      loadData();
    } catch (error) {
      console.error('Error toggling backup config:', error);
      toast.error('Failed to update backup schedule');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await deleteBackupConfig(id);
      toast.success('Backup schedule deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting backup config:', error);
      toast.error('Failed to delete backup schedule');
    }
  };

  const handleRunNow = async (configId: string) => {
    try {
      toast.info('Starting backup...');
      await triggerBackupRun(configId);
      toast.success('Backup started successfully');
      loadData();
    } catch (error) {
      console.error('Error triggering backup:', error);
      toast.error('Failed to start backup');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      backupType: 'policy',
      scheduleCron: '0 2 * * *',
      scheduleDescription: 'Daily at 2:00 AM',
      targetType: 'all',
      targetCustomerId: '',
      targetGroupId: '',
      retentionDays: 30,
      maxBackups: 10,
      autoCleanup: true,
    });
  };

  const getResourceIdsForType = (type: string): string[] => {
    switch (type) {
      case 'policy':
        return [
          'intune/device-configurations',
          'intune/compliance-policies',
          'intune/configuration-policies',
          'entra-id/conditional-access',
        ];
      case 'full':
        return [
          'intune/device-configurations',
          'intune/compliance-policies',
          'intune/configuration-policies',
          'intune/app-protection-policies',
          'entra-id/conditional-access',
          'entra-id/named-locations',
          'entra-id/groups',
          'security/defender-policies',
        ];
      default:
        return [];
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-500">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardDrive className="h-8 w-8 text-primary" />
            Automated Backups
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule automatic policy backups with retention policies
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats?.activeConfigs || 0}</span>
                <span className="text-muted-foreground">/ {stats?.totalConfigs || 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Backups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats?.totalRuns || 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">
                  {stats?.totalRuns > 0
                    ? Math.round((stats.successfulRuns / stats.totalRuns) * 100)
                    : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resources Backed Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  {stats?.totalResourcesBackedUp?.toLocaleString() || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedules" className="gap-2">
            <Calendar className="h-4 w-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Backup History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <Card>
            <CardHeader>
              <CardTitle>Backup Schedules</CardTitle>
              <CardDescription>
                Configure automated backup schedules for your tenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Backup Schedules</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Create your first backup schedule to automatically backup tenant policies
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Retention</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{config.name}</p>
                              {config.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {config.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {BACKUP_TYPES.find(t => t.id === config.backupType)?.label || config.backupType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {config.scheduleDescription || config.scheduleCron}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {config.retentionDays} days / {config.maxBackups} max
                            </span>
                          </TableCell>
                          <TableCell>
                            {config.lastRunAt ? (
                              <div className="flex items-center gap-2">
                                {config.lastRunSuccess ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">
                                  {formatDistanceToNow(config.lastRunAt, { addSuffix: true })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={config.isActive}
                              onCheckedChange={() => handleToggleActive(config)}
                            />
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRunNow(config.id)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Run Now
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteConfig(config.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
              <CardDescription>
                View past backup runs and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Backup History</h3>
                  <p className="text-muted-foreground mt-2">
                    Backup runs will appear here once schedules are executed
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Tenants</TableHead>
                        <TableHead>Resources</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">
                            {run.configName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {run.startedAt
                              ? format(run.startedAt, 'MMM dd, HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {run.startedAt && run.completedAt
                              ? `${Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000)}s`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-green-500">{run.completedTenants}</span>
                              <span className="text-muted-foreground">/</span>
                              <span>{run.totalTenants}</span>
                              {run.failedTenants > 0 && (
                                <span className="text-destructive ml-1">
                                  ({run.failedTenants} failed)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{run.totalResources.toLocaleString()}</TableCell>
                          <TableCell>
                            {run.expiresAt
                              ? formatDistanceToNow(run.expiresAt, { addSuffix: true })
                              : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(run.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Backup Schedule</DialogTitle>
            <DialogDescription>
              Configure automatic backups for your tenant policies
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Schedule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nightly Policy Backup"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backupType">Backup Type</Label>
                <Select
                  value={formData.backupType}
                  onValueChange={(value) => setFormData({ ...formData, backupType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKUP_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Automatic nightly backup of all Intune policies"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select
                  value={formData.scheduleCron}
                  onValueChange={(value) => {
                    const preset = SCHEDULE_PRESETS.find(p => p.cron === value);
                    setFormData({
                      ...formData,
                      scheduleCron: value,
                      scheduleDescription: preset?.description || value,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_PRESETS.map((preset) => (
                      <SelectItem key={preset.cron} value={preset.cron}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Select
                  value={formData.targetType}
                  onValueChange={(value) => setFormData({ ...formData, targetType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    <SelectItem value="customer">By Customer</SelectItem>
                    <SelectItem value="group">By Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.targetType === 'customer' && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={formData.targetCustomerId}
                  onValueChange={(value) => setFormData({ ...formData, targetCustomerId: value })}
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

            {formData.targetType === 'group' && (
              <div className="space-y-2">
                <Label>Tenant Group</Label>
                <Select
                  value={formData.targetGroupId}
                  onValueChange={(value) => setFormData({ ...formData, targetGroupId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retentionDays">Retention (days)</Label>
                <Input
                  id="retentionDays"
                  type="number"
                  min={1}
                  max={365}
                  value={formData.retentionDays}
                  onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxBackups">Max Backups to Keep</Label>
                <Input
                  id="maxBackups"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.maxBackups}
                  onChange={(e) => setFormData({ ...formData, maxBackups: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Auto Cleanup</p>
                <p className="text-sm text-muted-foreground">
                  Automatically delete old backups based on retention settings
                </p>
              </div>
              <Switch
                checked={formData.autoCleanup}
                onCheckedChange={(checked) => setFormData({ ...formData, autoCleanup: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConfig} disabled={!formData.name}>
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
