import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Link2, 
  ExternalLink,
  Ticket,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { 
  getPSAIntegrations, 
  createPSAIntegration, 
  updatePSAIntegration, 
  deletePSAIntegration,
  getPSATickets,
  PSAIntegration,
  PSATicket,
  PSA_PROVIDERS,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  PSAProvider
} from '@/lib/psaDatabase';
import { format } from 'date-fns';

export const PSAIntegrationsView = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<PSAIntegration[]>([]);
  const [tickets, setTickets] = useState<PSATicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<PSAIntegration | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    provider: 'halopsa' as PSAProvider,
    api_url: '',
    default_ticket_type: 'incident',
    default_priority: 'medium',
    auto_create_tickets: false,
    ticket_on_drift: true,
    ticket_on_compliance_fail: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [integrationsData, ticketsData] = await Promise.all([
        getPSAIntegrations(),
        getPSATickets(),
      ]);
      setIntegrations(integrationsData);
      setTickets(ticketsData);
    } catch (error) {
      console.error('Failed to load PSA data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load PSA integrations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingIntegration) {
        await updatePSAIntegration(editingIntegration.id, formData);
        toast({ title: 'Success', description: 'Integration updated successfully' });
      } else {
        await createPSAIntegration({
          ...formData,
          is_active: true,
        });
        toast({ title: 'Success', description: 'Integration created successfully' });
      }
      setShowAddDialog(false);
      setEditingIntegration(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to save integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save integration',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePSAIntegration(id);
      toast({ title: 'Success', description: 'Integration deleted' });
      loadData();
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete integration',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (integration: PSAIntegration) => {
    try {
      await updatePSAIntegration(integration.id, { is_active: !integration.is_active });
      loadData();
    } catch (error) {
      console.error('Failed to toggle integration:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'halopsa',
      api_url: '',
      default_ticket_type: 'incident',
      default_priority: 'medium',
      auto_create_tickets: false,
      ticket_on_drift: true,
      ticket_on_compliance_fail: true,
    });
  };

  const openEditDialog = (integration: PSAIntegration) => {
    setEditingIntegration(integration);
    setFormData({
      name: integration.name,
      provider: integration.provider,
      api_url: integration.api_url,
      default_ticket_type: integration.default_ticket_type || 'incident',
      default_priority: integration.default_priority || 'medium',
      auto_create_tickets: integration.auto_create_tickets,
      ticket_on_drift: integration.ticket_on_drift,
      ticket_on_compliance_fail: integration.ticket_on_compliance_fail,
    });
    setShowAddDialog(true);
  };

  const getProviderInfo = (providerId: string) => {
    return PSA_PROVIDERS.find(p => p.id === providerId) || { name: providerId, logo: '🔌' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><RefreshCw className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Resolved</Badge>;
      case 'closed':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'drift':
        return <Badge variant="outline" className="text-purple-500 border-purple-500">Drift</Badge>;
      case 'scheduled_drift':
        return <Badge variant="outline" className="text-purple-500 border-purple-500">Scheduled Drift</Badge>;
      case 'compliance':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Compliance</Badge>;
      case 'manual':
        return <Badge variant="outline">Manual</Badge>;
      default:
        return <Badge variant="outline">{sourceType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PSA Integrations</h1>
          <p className="text-muted-foreground">Connect to HaloPSA, Autotask, or ConnectWise for automated ticketing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingIntegration(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingIntegration ? 'Edit Integration' : 'Add PSA Integration'}</DialogTitle>
                <DialogDescription>
                  Connect your PSA platform for automated ticket creation
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Integration Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My HaloPSA Connection"
                  />
                </div>

                <div className="space-y-2">
                  <Label>PSA Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) => setFormData({ ...formData, provider: value as PSAProvider })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PSA_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <span className="flex items-center gap-2">
                            <span>{provider.logo}</span>
                            <span>{provider.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>API URL</Label>
                  <Input
                    value={formData.api_url}
                    onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                    placeholder="https://your-instance.halopsa.com/api"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Ticket Type</Label>
                    <Select
                      value={formData.default_ticket_type}
                      onValueChange={(value) => setFormData({ ...formData, default_ticket_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Priority</Label>
                    <Select
                      value={formData.default_priority}
                      onValueChange={(value) => setFormData({ ...formData, default_priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority.replace(/^\w/, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Create Tickets</Label>
                      <p className="text-sm text-muted-foreground">Automatically create tickets on events</p>
                    </div>
                    <Switch
                      checked={formData.auto_create_tickets}
                      onCheckedChange={(checked) => setFormData({ ...formData, auto_create_tickets: checked })}
                    />
                  </div>

                  {formData.auto_create_tickets && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>On Drift Detection</Label>
                          <p className="text-sm text-muted-foreground">Create ticket when drift is detected</p>
                        </div>
                        <Switch
                          checked={formData.ticket_on_drift}
                          onCheckedChange={(checked) => setFormData({ ...formData, ticket_on_drift: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>On Compliance Failure</Label>
                          <p className="text-sm text-muted-foreground">Create ticket when compliance check fails</p>
                        </div>
                        <Switch
                          checked={formData.ticket_on_compliance_fail}
                          onCheckedChange={(checked) => setFormData({ ...formData, ticket_on_compliance_fail: checked })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.name || !formData.api_url}>
                  {editingIntegration ? 'Save Changes' : 'Add Integration'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">
            <Link2 className="w-4 h-4 mr-2" />
            Integrations ({integrations.length})
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <Ticket className="w-4 h-4 mr-2" />
            Tickets ({tickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : integrations.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No PSA Integrations</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect to your PSA platform to enable automated ticketing
                  </p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Integration
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {integrations.map((integration) => {
                const provider = getProviderInfo(integration.provider);
                return (
                  <Card key={integration.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{provider.logo}</div>
                          <div>
                            <h3 className="font-medium flex items-center gap-2">
                              {integration.name}
                              {integration.is_active ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">{provider.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{integration.api_url}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            {integration.auto_create_tickets && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Settings className="w-4 h-4" />
                                Auto-ticketing enabled
                              </div>
                            )}
                            <div className="flex gap-2 mt-1">
                              {integration.ticket_on_drift && (
                                <Badge variant="outline" className="text-xs">Drift</Badge>
                              )}
                              {integration.ticket_on_compliance_fail && (
                                <Badge variant="outline" className="text-xs">Compliance</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              checked={integration.is_active}
                              onCheckedChange={() => handleToggleActive(integration)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(integration)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(integration.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tickets</CardTitle>
              <CardDescription>Tickets created automatically or manually from this platform</CardDescription>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Tickets Yet</h3>
                  <p className="text-muted-foreground">
                    Tickets will appear here when created automatically or manually
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>External ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.title}</TableCell>
                          <TableCell>{getSourceBadge(ticket.source_type)}</TableCell>
                          <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                          <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {ticket.external_ticket_id ? (
                              <Button variant="ghost" size="sm" className="gap-1">
                                {ticket.external_ticket_id}
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
      </Tabs>
    </div>
  );
};
