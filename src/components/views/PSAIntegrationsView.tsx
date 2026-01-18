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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
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
  AlertTriangle,
  Key,
  Zap,
  Send
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
import { testPSAConnection, createPSATicket, storePSACredentials, hasPSACredentials } from '@/lib/psaApi';
import { format } from 'date-fns';

export const PSAIntegrationsView = () => {
  const [integrations, setIntegrations] = useState<PSAIntegration[]>([]);
  const [tickets, setTickets] = useState<PSATicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<PSAIntegration | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<PSAIntegration | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);

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

  // Credentials form state
  const [credentialsForm, setCredentialsForm] = useState({
    apiKey: '',
    apiSecret: '',
  });

  // Create ticket form state
  const [ticketForm, setTicketForm] = useState({
    integrationId: '',
    title: '',
    description: '',
    priority: 'medium',
    ticketType: 'incident',
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
      toast.error('Failed to load PSA integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingIntegration) {
        await updatePSAIntegration(editingIntegration.id, formData);
        toast.success('Integration updated successfully');
      } else {
        await createPSAIntegration({
          ...formData,
          is_active: true,
        });
        toast.success('Integration created! Now add API credentials to connect.');
      }
      setShowAddDialog(false);
      setEditingIntegration(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to save integration:', error);
      toast.error('Failed to save integration');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePSAIntegration(id);
      toast.success('Integration deleted');
      loadData();
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast.error('Failed to delete integration');
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

  const handleSaveCredentials = async () => {
    if (!selectedIntegration) return;
    
    try {
      const result = await storePSACredentials(
        selectedIntegration.id,
        credentialsForm.apiKey,
        credentialsForm.apiSecret || undefined
      );

      if (result.success) {
        toast.success('API credentials saved securely');
        setShowCredentialsDialog(false);
        setCredentialsForm({ apiKey: '', apiSecret: '' });
        loadData();
      } else {
        toast.error(result.error || 'Failed to save credentials');
      }
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toast.error('Failed to save credentials');
    }
  };

  const handleTestConnection = async (integration: PSAIntegration) => {
    setTestingConnection(integration.id);
    try {
      const result = await testPSAConnection(integration.id);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      loadData();
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.integrationId || !ticketForm.title) {
      toast.error('Please select an integration and enter a title');
      return;
    }

    setCreatingTicket(true);
    try {
      const result = await createPSATicket({
        integrationId: ticketForm.integrationId,
        title: ticketForm.title,
        description: ticketForm.description,
        priority: ticketForm.priority,
        ticketType: ticketForm.ticketType,
        sourceType: 'manual',
      });

      if (result.success) {
        toast.success(`Ticket created: ${result.externalTicketId || 'ID pending'}`);
        setShowCreateTicketDialog(false);
        setTicketForm({
          integrationId: '',
          title: '',
          description: '',
          priority: 'medium',
          ticketType: 'incident',
        });
        loadData();
      } else {
        toast.error(result.error || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
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

  const openCredentialsDialog = (integration: PSAIntegration) => {
    setSelectedIntegration(integration);
    setCredentialsForm({ apiKey: '', apiSecret: '' });
    setShowCredentialsDialog(true);
  };

  const getProviderInfo = (providerId: string) => {
    return PSA_PROVIDERS.find(p => p.id === providerId) || { name: providerId, logo: '🔌' };
  };

  const getConnectionStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Not Tested</Badge>;
    }
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
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
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

  const getProviderHelp = (provider: PSAProvider) => {
    switch (provider) {
      case 'halopsa':
        return {
          apiKeyLabel: 'Client ID',
          apiSecretLabel: 'Client Secret',
          help: 'Create an API application in HaloPSA Admin → Integrations → HaloPSA API',
        };
      case 'autotask':
        return {
          apiKeyLabel: 'API Integration Code',
          apiSecretLabel: 'Secret',
          help: 'Create API credentials in Admin → Resources → API Users',
        };
      case 'connectwise':
        return {
          apiKeyLabel: 'Public Key (company+publicKey)',
          apiSecretLabel: 'Private Key',
          help: 'Create API keys in System → Members → API Members',
        };
      default:
        return { apiKeyLabel: 'API Key', apiSecretLabel: 'API Secret', help: '' };
    }
  };

  const activeIntegrations = integrations.filter(i => i.is_active);

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
          
          {/* Create Ticket Dialog */}
          <Dialog open={showCreateTicketDialog} onOpenChange={setShowCreateTicketDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={activeIntegrations.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Manual Ticket</DialogTitle>
                <DialogDescription>Create a ticket in your PSA system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>PSA Integration</Label>
                  <Select
                    value={ticketForm.integrationId}
                    onValueChange={(value) => setTicketForm({ ...ticketForm, integrationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select integration" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeIntegrations.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id}>
                          {getProviderInfo(integration.provider).logo} {integration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={ticketForm.title}
                    onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                    placeholder="Ticket title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                    placeholder="Ticket description"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={ticketForm.priority}
                      onValueChange={(value) => setTicketForm({ ...ticketForm, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={ticketForm.ticketType}
                      onValueChange={(value) => setTicketForm({ ...ticketForm, ticketType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateTicketDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateTicket} disabled={creatingTicket || !ticketForm.title || !ticketForm.integrationId}>
                  {creatingTicket ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Create Ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Integration Dialog */}
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
                    placeholder={
                      formData.provider === 'halopsa' ? 'https://your-instance.halopsa.com/api' :
                      formData.provider === 'autotask' ? 'https://webservices.autotask.net/ATServicesRest' :
                      'https://api-na.myconnectwise.net'
                    }
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

          {/* Credentials Dialog */}
          <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure API Credentials</DialogTitle>
                <DialogDescription>
                  {selectedIntegration && getProviderHelp(selectedIntegration.provider).help}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{selectedIntegration && getProviderHelp(selectedIntegration.provider).apiKeyLabel}</Label>
                  <Input
                    value={credentialsForm.apiKey}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, apiKey: e.target.value })}
                    placeholder="Enter API key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{selectedIntegration && getProviderHelp(selectedIntegration.provider).apiSecretLabel}</Label>
                  <Input
                    type="password"
                    value={credentialsForm.apiSecret}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, apiSecret: e.target.value })}
                    placeholder="Enter API secret"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Credentials are encrypted and stored securely. They are never exposed in the UI.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveCredentials} disabled={!credentialsForm.apiKey}>
                  <Key className="w-4 h-4 mr-2" />
                  Save Credentials
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
                const hasCredentials = !!(integration as any).vault_secret_id;
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
                              {getConnectionStatusBadge((integration as any).connection_status)}
                            </h3>
                            <p className="text-sm text-muted-foreground">{provider.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{integration.api_url}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right text-sm mr-4">
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

                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openCredentialsDialog(integration)}
                          >
                            <Key className="w-4 h-4 mr-1" />
                            {hasCredentials ? 'Update' : 'Add'} Credentials
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTestConnection(integration)}
                            disabled={!hasCredentials || testingConnection === integration.id}
                          >
                            {testingConnection === integration.id ? (
                              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 mr-1" />
                            )}
                            Test
                          </Button>

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
                  <p className="text-muted-foreground mb-4">
                    Tickets will appear here when created automatically or manually
                  </p>
                  {activeIntegrations.length > 0 && (
                    <Button variant="outline" onClick={() => setShowCreateTicketDialog(true)}>
                      <Send className="w-4 h-4 mr-2" />
                      Create First Ticket
                    </Button>
                  )}
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
