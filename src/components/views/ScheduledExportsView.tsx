import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { RESOURCE_CATEGORIES } from '@/types/tenant';
import { ServicePrincipalManager, ServicePrincipalConfig, useServicePrincipalConfigs } from '@/components/ServicePrincipalManager';

const EXPORT_FORMATS = [
  { id: 'json', name: 'JSON' },
  { id: 'terraform', name: 'Terraform' },
  { id: 'bicep', name: 'Bicep' },
  { id: 'powershell', name: 'PowerShell' },
];

interface ScheduledExport {
  id: string;
  name: string;
  description: string | null;
  resource_ids: string[];
  formats: string[];
  schedule_cron: string;
  schedule_description: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
  service_principal_config_id: string | null;
}

const SCHEDULE_PRESETS = [
  { label: 'Every hour', cron: '0 * * * *', description: 'Runs at the start of every hour' },
  { label: 'Every 6 hours', cron: '0 */6 * * *', description: 'Runs every 6 hours' },
  { label: 'Daily at midnight', cron: '0 0 * * *', description: 'Runs daily at 12:00 AM' },
  { label: 'Daily at 6 AM', cron: '0 6 * * *', description: 'Runs daily at 6:00 AM' },
  { label: 'Weekly on Monday', cron: '0 0 * * 1', description: 'Runs every Monday at midnight' },
  { label: 'Monthly on 1st', cron: '0 0 1 * *', description: 'Runs on the 1st of each month' },
];

export const ScheduledExportsView = () => {
  const { toast } = useToast();
  const { configs: spConfigs, isLoading: spLoading } = useServicePrincipalConfigs();
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSchedule, setFormSchedule] = useState('0 0 * * *');
  const [formResources, setFormResources] = useState<string[]>([]);
  const [formFormats, setFormFormats] = useState<string[]>(['json']);
  const [formServicePrincipalId, setFormServicePrincipalId] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_exports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled exports',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSchedule = async () => {
    if (!formName || formResources.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and select at least one resource',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const preset = SCHEDULE_PRESETS.find(p => p.cron === formSchedule);

      const { error } = await supabase.from('scheduled_exports').insert([{
        user_id: user.id,
        name: formName,
        description: formDescription || null,
        resource_ids: formResources,
        formats: formFormats,
        schedule_cron: formSchedule,
        schedule_description: preset?.label || 'Custom schedule',
        is_active: true,
        service_principal_config_id: formServicePrincipalId,
      }]);

      if (error) throw error;

      toast({
        title: 'Schedule Created',
        description: 'Scheduled export has been created successfully',
      });

      setDialogOpen(false);
      resetForm();
      await loadSchedules();
    } catch (error) {
      console.error('Failed to create schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create scheduled export',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_exports')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setSchedules(prev =>
        prev.map(s => s.id === id ? { ...s, is_active: !isActive } : s)
      );

      toast({
        title: isActive ? 'Schedule Paused' : 'Schedule Activated',
        description: `Scheduled export has been ${isActive ? 'paused' : 'activated'}`,
      });
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_exports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSchedules(prev => prev.filter(s => s.id !== id));

      toast({
        title: 'Schedule Deleted',
        description: 'Scheduled export has been deleted',
      });
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormSchedule('0 0 * * *');
    setFormResources([]);
    setFormFormats(['json']);
    setFormServicePrincipalId(null);
  };

  const getConfigName = (configId: string | null) => {
    if (!configId) return null;
    return spConfigs.find(c => c.id === configId)?.name || 'Unknown';
  };

  const toggleResource = (resourceId: string) => {
    setFormResources(prev =>
      prev.includes(resourceId)
        ? prev.filter(r => r !== resourceId)
        : [...prev, resourceId]
    );
  };

  const toggleFormat = (formatId: string) => {
    setFormFormats(prev =>
      prev.includes(formatId)
        ? prev.filter(f => f !== formatId)
        : [...prev, formatId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduled Exports</h1>
          <p className="text-muted-foreground mt-1">
            Automate recurring exports of your M365 configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSchedules} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Scheduled Export</DialogTitle>
                <DialogDescription>
                  Set up an automated export that runs on a schedule
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Daily Security Export"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="Export security-related resources daily"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Service Principal Configuration */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Service Principal
                  </Label>
                  <Select 
                    value={formServicePrincipalId || 'none'} 
                    onValueChange={(v) => setFormServicePrincipalId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved configuration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No configuration (use active connection)</span>
                      </SelectItem>
                      {spConfigs.map(config => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex flex-col">
                            <span>{config.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {config.tenant_id.slice(0, 8)}...
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a saved service principal to use for this scheduled export
                  </p>
                </div>

                {/* Schedule */}
                <div className="space-y-2">
                  <Label>Schedule</Label>
                  <Select value={formSchedule} onValueChange={setFormSchedule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_PRESETS.map(preset => (
                        <SelectItem key={preset.cron} value={preset.cron}>
                          <div className="flex flex-col">
                            <span>{preset.label}</span>
                            <span className="text-xs text-muted-foreground">{preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Formats */}
                <div className="space-y-2">
                  <Label>Export Formats</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXPORT_FORMATS.map(format => (
                      <Button
                        key={format.id}
                        variant={formFormats.includes(format.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFormat(format.id)}
                      >
                        {format.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Resources */}
                <div className="space-y-2">
                  <Label>Resources to Export</Label>
                  <ScrollArea className="h-[200px] border rounded-lg p-3">
                    <div className="space-y-4">
                      {RESOURCE_CATEGORIES.map(category => (
                        <div key={category.id}>
                          <p className="font-medium text-sm mb-2">{category.name}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {category.subcategories
                              .filter(sub => sub.supported !== false)
                              .map(sub => {
                                const resourceId = `${category.id}/${sub.id}`;
                                return (
                                  <div key={resourceId} className="flex items-center gap-2">
                                    <Checkbox
                                      id={resourceId}
                                      checked={formResources.includes(resourceId)}
                                      onCheckedChange={() => toggleResource(resourceId)}
                                    />
                                    <label htmlFor={resourceId} className="text-sm cursor-pointer">
                                      {sub.name}
                                    </label>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {formResources.length} resources selected
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createSchedule} disabled={isCreating}>
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.filter(s => s.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {schedules.reduce((sum, s) => sum + s.run_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Your Schedules
          </CardTitle>
          <CardDescription>Manage your automated export schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled exports yet</p>
              <p className="text-sm">Create your first schedule to automate exports</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {schedules.map((schedule, idx) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "p-4 rounded-lg border",
                      schedule.is_active 
                        ? "bg-muted/30 border-border/50" 
                        : "bg-muted/10 border-border/30 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{schedule.name}</h3>
                          <Badge variant={schedule.is_active ? "default" : "secondary"}>
                            {schedule.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        {schedule.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {schedule.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {schedule.schedule_description || schedule.schedule_cron}
                          </span>
                          {schedule.service_principal_config_id && (
                            <span className="flex items-center gap-1">
                              <Key className="w-3 h-3" />
                              {getConfigName(schedule.service_principal_config_id)}
                            </span>
                          )}
                          <span>{schedule.resource_ids.length} resources</span>
                          <span>{schedule.formats.join(', ').toUpperCase()}</span>
                          <span>{schedule.run_count} runs</span>
                          {schedule.last_run_at && (
                            <span>
                              Last run: {format(new Date(schedule.last_run_at), 'MMM d, HH:mm')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => toggleSchedule(schedule.id, schedule.is_active)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};