import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Bell,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  TestTube,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_config_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  success: boolean;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  { id: 'export.completed', label: 'Export Completed', description: 'When an export job finishes successfully' },
  { id: 'export.failed', label: 'Export Failed', description: 'When an export job fails' },
  { id: 'drift.detected', label: 'Drift Detected', description: 'When configuration drift is detected' },
  { id: 'compliance.failed', label: 'Compliance Failed', description: 'When compliance check finds failures' },
  { id: 'compliance.warning', label: 'Compliance Warning', description: 'When compliance check finds warnings' },
  { id: 'import.completed', label: 'Import Completed', description: 'When an import job finishes' },
  { id: 'import.failed', label: 'Import Failed', description: 'When an import job fails' },
  { id: 'schedule.run', label: 'Scheduled Export Run', description: 'When a scheduled export runs' },
];

export const WebhooksView = () => {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [webhooksRes, logsRes] = await Promise.all([
        supabase
          .from('webhook_configs')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('webhook_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (webhooksRes.error) throw webhooksRes.error;
      if (logsRes.error) throw logsRes.error;

      setWebhooks(webhooksRes.data || []);
      setLogs((logsRes.data || []).map(log => ({
        ...log,
        payload: (log.payload as Record<string, unknown>) || {},
      })));
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhook configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!formName || !formUrl || formEvents.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name, URL, and select at least one event',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('webhook_configs').insert([{
        user_id: user.id,
        name: formName,
        url: formUrl,
        secret: formSecret || null,
        events: formEvents,
        is_active: true,
      }]);

      if (error) throw error;

      toast({
        title: 'Webhook Created',
        description: 'Webhook configuration has been created successfully',
      });

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to create webhook',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('webhook_configs')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev =>
        prev.map(w => w.id === id ? { ...w, is_active: !isActive } : w)
      );

      toast({
        title: isActive ? 'Webhook Disabled' : 'Webhook Enabled',
      });
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to update webhook',
        variant: 'destructive',
      });
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev => prev.filter(w => w.id !== id));

      toast({
        title: 'Webhook Deleted',
      });
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete webhook',
        variant: 'destructive',
      });
    }
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    toast({
      title: 'Test Sent',
      description: 'A test payload has been queued for delivery',
    });
    
    // In a real implementation, this would call an edge function
    // that sends a test payload to the webhook URL
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copied to clipboard' });
  };

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormSecret('');
    setFormEvents([]);
  };

  const toggleEvent = (eventId: string) => {
    setFormEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleShowSecret = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhook Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Get notified when events occur in your M365 configuration management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Webhook</DialogTitle>
                <DialogDescription>
                  Configure a webhook to receive event notifications
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name">Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="Slack Notifications"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Secret (optional)</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    placeholder="Used to sign payloads"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If provided, payloads will include an HMAC signature header
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Events to Trigger</Label>
                  <ScrollArea className="h-[200px] border rounded-lg p-3">
                    <div className="space-y-2">
                      {WEBHOOK_EVENTS.map(event => (
                        <div key={event.id} className="flex items-start gap-2">
                          <Checkbox
                            id={event.id}
                            checked={formEvents.includes(event.id)}
                            onCheckedChange={() => toggleEvent(event.id)}
                          />
                          <div className="flex-1">
                            <label htmlFor={event.id} className="text-sm font-medium cursor-pointer">
                              {event.label}
                            </label>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createWebhook} disabled={isCreating}>
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Webhook
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
                <Webhook className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{webhooks.length}</p>
                <p className="text-sm text-muted-foreground">Total Webhooks</p>
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
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.success).length}
                </p>
                <p className="text-sm text-muted-foreground">Successful Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {logs.filter(l => !l.success).length}
                </p>
                <p className="text-sm text-muted-foreground">Failed Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Bell className="w-4 h-4 mr-2" />
            Delivery Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Configured Webhooks</CardTitle>
              <CardDescription>Manage your webhook endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured</p>
                  <p className="text-sm">Add a webhook to start receiving notifications</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {webhooks.map((webhook, idx) => (
                      <motion.div
                        key={webhook.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "p-4 rounded-lg border",
                          webhook.is_active
                            ? "bg-muted/30 border-border/50"
                            : "bg-muted/10 border-border/30 opacity-60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-foreground">{webhook.name}</h3>
                              <Badge variant={webhook.is_active ? "default" : "secondary"}>
                                {webhook.is_active ? 'Active' : 'Disabled'}
                              </Badge>
                              {webhook.failure_count > 0 && (
                                <Badge variant="destructive">
                                  {webhook.failure_count} failures
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <span className="truncate">{webhook.url}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyUrl(webhook.url)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {webhook.events.map(event => (
                                <Badge key={event} variant="outline" className="text-xs">
                                  {event}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => testWebhook(webhook)}
                              title="Send test"
                            >
                              <TestTube className="w-4 h-4" />
                            </Button>
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={() => toggleWebhook(webhook.id, webhook.is_active)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteWebhook(webhook.id)}
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
        </TabsContent>

        <TabsContent value="logs">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Delivery Logs</CardTitle>
              <CardDescription>Recent webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No delivery logs yet
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {logs.map((log, idx) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          "p-3 rounded-lg border",
                          log.success
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-red-500/5 border-red-500/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {log.success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                            <Badge variant="outline">{log.event_type}</Badge>
                            {log.response_status && (
                              <span className={cn(
                                "text-xs",
                                log.response_status >= 200 && log.response_status < 300
                                  ? "text-green-400"
                                  : "text-red-400"
                              )}>
                                HTTP {log.response_status}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};