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
import { Plus, Trash2, Bell, Loader2, MessageSquare, Mail, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: 'slack' | 'teams' | 'email';
  config: unknown;
  is_active: boolean;
  created_at: string;
}

const CHANNEL_TYPES = [
  { value: 'slack', label: 'Slack', icon: Hash, description: 'Send to a Slack channel via webhook' },
  { value: 'teams', label: 'Microsoft Teams', icon: MessageSquare, description: 'Send to a Teams channel via webhook' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Send via email (requires Resend)' },
];

export function NotificationChannelManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'slack' | 'teams' | 'email'>('slack');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formEmail, setFormEmail] = useState('');

  useEffect(() => {
    if (user) {
      fetchChannels();
    }
  }, [user]);

  async function fetchChannels() {
    try {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
      toast({
        title: 'Error',
        description: 'Failed to load notification channels',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createChannel() {
    if (!user || !formName) return;

    const config: Record<string, string> = {};
    if (formType === 'slack' || formType === 'teams') {
      if (!formWebhookUrl) {
        toast({
          title: 'Error',
          description: 'Webhook URL is required',
          variant: 'destructive',
        });
        return;
      }
      config.webhook_url = formWebhookUrl;
    } else if (formType === 'email') {
      if (!formEmail) {
        toast({
          title: 'Error',
          description: 'Email address is required',
          variant: 'destructive',
        });
        return;
      }
      config.email = formEmail;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_channels')
        .insert({
          user_id: user.id,
          name: formName,
          channel_type: formType,
          config,
        });

      if (error) throw error;

      toast({ title: 'Channel created successfully' });
      setDialogOpen(false);
      resetForm();
      fetchChannels();
    } catch (err) {
      console.error('Error creating channel:', err);
      toast({
        title: 'Error',
        description: 'Failed to create channel',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleChannel(channel: NotificationChannel) {
    try {
      const { error } = await supabase
        .from('notification_channels')
        .update({ is_active: !channel.is_active })
        .eq('id', channel.id);

      if (error) throw error;
      fetchChannels();
    } catch (err) {
      console.error('Error toggling channel:', err);
      toast({
        title: 'Error',
        description: 'Failed to update channel',
        variant: 'destructive',
      });
    }
  }

  async function deleteChannel(id: string) {
    try {
      const { error } = await supabase
        .from('notification_channels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Channel deleted' });
      fetchChannels();
    } catch (err) {
      console.error('Error deleting channel:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete channel',
        variant: 'destructive',
      });
    }
  }

  function resetForm() {
    setFormName('');
    setFormType('slack');
    setFormWebhookUrl('');
    setFormEmail('');
  }

  function getChannelIcon(type: string) {
    const channelType = CHANNEL_TYPES.find(c => c.value === type);
    return channelType ? channelType.icon : Bell;
  }

  function getChannelLabel(type: string): string {
    return CHANNEL_TYPES.find(c => c.value === type)?.label || type;
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Configure where to send AI analysis results and trend reports
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Configure a new channel to receive AI analysis notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="e.g., Security Team Slack"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as 'slack' | 'teams' | 'email')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {CHANNEL_TYPES.find(t => t.value === formType)?.description}
                </p>
              </div>

              {(formType === 'slack' || formType === 'teams') && (
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder={formType === 'slack' 
                      ? 'https://hooks.slack.com/services/...'
                      : 'https://outlook.office.com/webhook/...'
                    }
                    value={formWebhookUrl}
                    onChange={(e) => setFormWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formType === 'slack' 
                      ? 'Create an incoming webhook in your Slack workspace'
                      : 'Create an incoming webhook connector in your Teams channel'
                    }
                  </p>
                </div>
              )}

              {formType === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="team@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createChannel} disabled={saving || !formName}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notification channels configured.</p>
            <p className="text-sm">Add a channel to receive AI analysis reports.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => {
                const Icon = getChannelIcon(channel.channel_type);
                return (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {channel.name}
                      </div>
                    </TableCell>
                    <TableCell>{getChannelLabel(channel.channel_type)}</TableCell>
                    <TableCell>
                      <Badge variant={channel.is_active ? 'default' : 'secondary'}>
                        {channel.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(channel.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Switch
                          checked={channel.is_active}
                          onCheckedChange={() => toggleChannel(channel)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteChannel(channel.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
