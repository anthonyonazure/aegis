import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Play, Pause, Clock, Calendar, Bell, Loader2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduledJob {
  id: string;
  name: string;
  service_type: string;
  frequency: 'daily' | 'weekly';
  day_of_week: number | null;
  time_of_day: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  notification_channel_ids: string[];
  created_at: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: 'slack' | 'teams' | 'email';
}

const AI_SERVICES = [
  { value: 'security_predictor', label: 'Security Predictor' },
  { value: 'security_benchmark', label: 'Security Benchmark' },
  { value: 'user_risk_profiler', label: 'User Risk Profiler' },
  { value: 'anomaly_detection', label: 'Anomaly Detection' },
  { value: 'compliance_advisor', label: 'Compliance Advisor' },
  { value: 'config_optimizer', label: 'Config Optimizer' },
  { value: 'license_optimizer', label: 'License Optimizer' },
  { value: 'drift_explainer', label: 'Drift Explainer' },
  { value: 'tenant_analyzer', label: 'Tenant Analyzer' },
  { value: 'copilot_advisor', label: 'Copilot Readiness Advisor' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface AIScheduleManagerProps {
  onViewTrends: (serviceType: string) => void;
}

export function AIScheduleManager({ onViewTrends }: AIScheduleManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formService, setFormService] = useState('');
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly'>('daily');
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(1);
  const [formTimeOfDay, setFormTimeOfDay] = useState('09:00');
  const [formChannelIds, setFormChannelIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchJobs();
      fetchChannels();
    }
  }, [user]);

  async function fetchJobs() {
    try {
      const { data, error } = await supabase
        .from('ai_scheduled_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled jobs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchChannels() {
    try {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('id, name, channel_type')
        .eq('is_active', true);

      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
    }
  }

  async function createJob() {
    if (!user || !formName || !formService) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_scheduled_jobs')
        .insert({
          user_id: user.id,
          tenant_connection_id: null,
          name: formName,
          service_type: formService,
          frequency: formFrequency,
          day_of_week: formFrequency === 'weekly' ? formDayOfWeek : null,
          time_of_day: formTimeOfDay,
          notification_channel_ids: formChannelIds,
        });

      if (error) throw error;

      toast({ title: 'Schedule created successfully' });
      setDialogOpen(false);
      resetForm();
      fetchJobs();
    } catch (err) {
      console.error('Error creating job:', err);
      toast({
        title: 'Error',
        description: 'Failed to create schedule',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleJob(job: ScheduledJob) {
    try {
      const { error } = await supabase
        .from('ai_scheduled_jobs')
        .update({ is_active: !job.is_active })
        .eq('id', job.id);

      if (error) throw error;
      fetchJobs();
    } catch (err) {
      console.error('Error toggling job:', err);
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  }

  async function deleteJob(id: string) {
    try {
      const { error } = await supabase
        .from('ai_scheduled_jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Schedule deleted' });
      fetchJobs();
    } catch (err) {
      console.error('Error deleting job:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  }

  function resetForm() {
    setFormName('');
    setFormService('');
    setFormFrequency('daily');
    setFormDayOfWeek(1);
    setFormTimeOfDay('09:00');
    setFormChannelIds([]);
  }

  function getServiceLabel(serviceType: string): string {
    return AI_SERVICES.find(s => s.value === serviceType)?.label || serviceType;
  }

  function toggleChannelSelection(channelId: string) {
    setFormChannelIds(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduled AI Analysis
            </CardTitle>
            <CardDescription>
              Schedule automated AI analysis and receive trend reports via your preferred channels
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Schedule</DialogTitle>
                <DialogDescription>
                  Set up automated AI analysis on a recurring schedule
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Schedule Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Security Review"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>AI Service</Label>
                  <Select value={formService} onValueChange={setFormService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_SERVICES.map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          {service.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as 'daily' | 'weekly')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formFrequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select value={String(formDayOfWeek)} onValueChange={(v) => setFormDayOfWeek(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="time">Time of Day</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formTimeOfDay}
                    onChange={(e) => setFormTimeOfDay(e.target.value)}
                  />
                </div>

                {channels.length > 0 && (
                  <div className="space-y-2">
                    <Label>Notification Channels</Label>
                    <div className="flex flex-wrap gap-2">
                      {channels.map((channel) => (
                        <Badge
                          key={channel.id}
                          variant={formChannelIds.includes(channel.id) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleChannelSelection(channel.id)}
                        >
                          <Bell className="h-3 w-3 mr-1" />
                          {channel.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createJob} disabled={saving || !formName || !formService}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled analyses yet. Create one to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{getServiceLabel(job.service_type)}</TableCell>
                    <TableCell>
                      {job.frequency === 'daily' ? (
                        <span>Daily at {job.time_of_day.slice(0, 5)}</span>
                      ) : (
                        <span>
                          {DAYS_OF_WEEK.find(d => d.value === job.day_of_week)?.label} at {job.time_of_day.slice(0, 5)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.next_run_at ? format(new Date(job.next_run_at), 'MMM d, h:mm a') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.is_active ? 'default' : 'secondary'}>
                        {job.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewTrends(job.service_type)}
                          title="View trends"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleJob(job)}
                          title={job.is_active ? 'Pause' : 'Resume'}
                        >
                          {job.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteJob(job.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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
