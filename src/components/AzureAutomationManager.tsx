import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Copy,
  Download,
  Play,
  Terminal,
  Cloud,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import {
  AutomationConfig,
  getAutomationConfigs,
  createAutomationConfig,
  updateAutomationConfig,
  deleteAutomationConfig,
  testAutomationConnection,
  getRunbookScript,
  POWERSHELL_RESOURCE_TYPES,
} from '@/lib/automationApi';
import { Pencil } from 'lucide-react';

export function AzureAutomationManager() {
  const { connectionId: currentTenantId } = useTenant();
  const [configs, setConfigs] = useState<AutomationConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AutomationConfig | null>(null);
  const [showRunbookDialog, setShowRunbookDialog] = useState(false);
  const [runbookScript, setRunbookScript] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [newConfig, setNewConfig] = useState({
    name: '',
    subscription_id: '',
    resource_group: '',
    automation_account_name: '',
    runbook_name: 'Export-M365Config',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    const data = await getAutomationConfigs();
    setConfigs(data);
    setIsLoading(false);
  };

  // Extract just the resource name if a full Azure resource ID is provided
  const extractResourceName = (value: string): string => {
    // If it's a full resource ID path, extract just the name
    if (value.includes('/')) {
      const parts = value.split('/');
      return parts[parts.length - 1];
    }
    return value.trim();
  };

  const handleCreate = async () => {
    if (!newConfig.name || !newConfig.subscription_id || !newConfig.resource_group || !newConfig.automation_account_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Clean up input values - extract just names if full paths were provided
    const cleanedConfig = {
      ...newConfig,
      subscription_id: extractResourceName(newConfig.subscription_id),
      resource_group: extractResourceName(newConfig.resource_group),
      automation_account_name: extractResourceName(newConfig.automation_account_name),
      runbook_name: extractResourceName(newConfig.runbook_name) || 'Export-M365Config',
    };

    const result = await createAutomationConfig(cleanedConfig);
    if (result.success) {
      toast.success('Azure Automation configuration created');
      setShowAddDialog(false);
      setNewConfig({
        name: '',
        subscription_id: '',
        resource_group: '',
        automation_account_name: '',
        runbook_name: 'Export-M365Config',
      });
      loadConfigs();
    } else {
      toast.error(result.error || 'Failed to create configuration');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    const result = await deleteAutomationConfig(id);
    if (result.success) {
      toast.success('Configuration deleted');
      loadConfigs();
    } else {
      toast.error(result.error || 'Failed to delete configuration');
    }
  };

  const handleEdit = (config: AutomationConfig) => {
    setEditingConfig(config);
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingConfig) return;

    // Clean up input values
    const cleanedUpdates = {
      name: editingConfig.name,
      subscription_id: extractResourceName(editingConfig.subscription_id),
      resource_group: extractResourceName(editingConfig.resource_group),
      automation_account_name: extractResourceName(editingConfig.automation_account_name),
      runbook_name: extractResourceName(editingConfig.runbook_name) || 'Export-M365Config',
    };

    const result = await updateAutomationConfig(editingConfig.id, cleanedUpdates);
    if (result.success) {
      toast.success('Configuration updated');
      setShowEditDialog(false);
      setEditingConfig(null);
      loadConfigs();
    } else {
      toast.error(result.error || 'Failed to update configuration');
    }
  };

  const handleTest = async (configId: string) => {
    if (!currentTenantId) {
      toast.error('Please select a tenant first');
      return;
    }

    setTestingId(configId);
    const result = await testAutomationConnection(configId, currentTenantId);
    setTestingId(null);

    if (result.success) {
      if (result.runbookExists) {
        toast.success('Connected successfully! Runbook is ready.');
      } else {
        toast.warning('Connected to Automation Account, but runbook not found. Please import the runbook.');
      }
      loadConfigs();
    } else {
      toast.error(result.error || 'Connection test failed');
      loadConfigs();
    }
  };

  const handleShowRunbook = async () => {
    const data = await getRunbookScript();
    if (data) {
      setRunbookScript(data.script);
      setShowRunbookDialog(true);
    } else {
      toast.error('Failed to generate runbook script');
    }
  };

  const copyRunbookScript = () => {
    if (runbookScript) {
      navigator.clipboard.writeText(runbookScript);
      toast.success('Runbook script copied to clipboard');
    }
  };

  const downloadRunbookScript = () => {
    if (runbookScript) {
      const blob = new Blob([runbookScript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Export-M365Config.ps1';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Runbook script downloaded');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'runbook_missing':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Runbook Missing</Badge>;
      default:
        return <Badge variant="secondary">Untested</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-primary" />
                Azure Automation Integration
              </CardTitle>
              <CardDescription>
                Run PowerShell scripts in Azure to export Exchange, Teams, and SharePoint policies
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleShowRunbook}>
                <Terminal className="w-4 h-4 mr-2" />
                Get Runbook Script
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Configuration
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add Azure Automation Configuration</DialogTitle>
                    <DialogDescription>
                      Connect to an Azure Automation Account to run PowerShell exports
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Configuration Name</Label>
                      <Input
                        id="name"
                        value={newConfig.name}
                        onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                        placeholder="My Automation Account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subscription">Azure Subscription ID</Label>
                      <Input
                        id="subscription"
                        value={newConfig.subscription_id}
                        onChange={(e) => setNewConfig({ ...newConfig, subscription_id: e.target.value })}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rg">Resource Group</Label>
                      <Input
                        id="rg"
                        value={newConfig.resource_group}
                        onChange={(e) => setNewConfig({ ...newConfig, resource_group: e.target.value })}
                        placeholder="my-resource-group"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account">Automation Account Name</Label>
                      <Input
                        id="account"
                        value={newConfig.automation_account_name}
                        onChange={(e) => setNewConfig({ ...newConfig, automation_account_name: e.target.value })}
                        placeholder="my-automation-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="runbook">Runbook Name</Label>
                      <Input
                        id="runbook"
                        value={newConfig.runbook_name}
                        onChange={(e) => setNewConfig({ ...newConfig, runbook_name: e.target.value })}
                        placeholder="Export-M365Config"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use the "Get Runbook Script" button to download the script and import it into your Automation Account
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Prerequisites</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Create an Azure Automation Account with a System-assigned Managed Identity</li>
                <li>Install required modules: ExchangeOnlineManagement, MicrosoftTeams, PnP.PowerShell</li>
                <li>Import the runbook script (use "Get Runbook Script" button)</li>
                <li>Grant your Service Principal "Automation Job Operator" role on the Automation Account</li>
              </ol>
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No Azure Automation configurations yet</p>
              <p className="text-sm">Click "Add Configuration" to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <Card key={config.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{config.name}</h4>
                          {getStatusBadge(config.connection_status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          <p>Account: {config.automation_account_name}</p>
                          <p>Resource Group: {config.resource_group}</p>
                          <p>Runbook: {config.runbook_name}</p>
                        </div>
                        {config.last_tested_at && (
                          <p className="text-xs text-muted-foreground">
                            Last tested: {new Date(config.last_tested_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(config.id)}
                          disabled={testingId === config.id || !currentTenantId}
                        >
                          {testingId === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-2">Test</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supported Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supported PowerShell Resources</CardTitle>
          <CardDescription>
            These resource types require Azure Automation for export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {POWERSHELL_RESOURCE_TYPES.map((resourceType) => {
              const [category, type] = resourceType.split('/');
              return (
                <div key={resourceType} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Terminal className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium capitalize">{type.replace(/-/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground capitalize">{category}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Runbook Script Dialog */}
      <Dialog open={showRunbookDialog} onOpenChange={setShowRunbookDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Azure Automation Runbook Script</DialogTitle>
            <DialogDescription>
              Import this PowerShell script into your Azure Automation Account as a runbook
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="script">
            <TabsList>
              <TabsTrigger value="script">Script</TabsTrigger>
              <TabsTrigger value="instructions">Setup Instructions</TabsTrigger>
            </TabsList>
            <TabsContent value="script">
              <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/50">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {runbookScript || 'Loading...'}
                </pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="instructions">
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">1. Create Azure Automation Account</h4>
                    <p className="text-muted-foreground">
                      In the Azure Portal, create a new Automation Account with a System-assigned Managed Identity enabled.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Install Required Modules</h4>
                    <p className="text-muted-foreground">
                      In your Automation Account, go to Modules Gallery and install:
                    </p>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground">
                      <li>ExchangeOnlineManagement</li>
                      <li>MicrosoftTeams</li>
                      <li>PnP.PowerShell</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">3. Import the Runbook</h4>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                      <li>Download the script using the button below</li>
                      <li>In Azure Portal, go to your Automation Account → Runbooks</li>
                      <li>Click "Import a runbook"</li>
                      <li>Upload the downloaded .ps1 file</li>
                      <li>Set name to "Export-M365Config" (or your preferred name)</li>
                      <li>Set runbook type to "PowerShell"</li>
                      <li>Click Create, then Publish</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">4. Grant Permissions</h4>
                    <p className="text-muted-foreground">
                      Your Service Principal needs "Automation Job Operator" role on the Automation Account to start jobs.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">5. Grant M365 Permissions</h4>
                    <p className="text-muted-foreground">
                      The Managed Identity needs appropriate permissions in M365:
                    </p>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground">
                      <li>Exchange: Exchange Administrator role</li>
                      <li>Teams: Teams Administrator role</li>
                      <li>SharePoint: SharePoint Administrator role</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyRunbookScript}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Script
            </Button>
            <Button onClick={downloadRunbookScript}>
              <Download className="w-4 h-4 mr-2" />
              Download .ps1
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Configuration Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Azure Automation Configuration</DialogTitle>
            <DialogDescription>
              Update the Azure Automation Account settings
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Configuration Name</Label>
                <Input
                  id="edit-name"
                  value={editingConfig.name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                  placeholder="My Automation Account"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subscription">Azure Subscription ID</Label>
                <Input
                  id="edit-subscription"
                  value={editingConfig.subscription_id}
                  onChange={(e) => setEditingConfig({ ...editingConfig, subscription_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rg">Resource Group</Label>
                <Input
                  id="edit-rg"
                  value={editingConfig.resource_group}
                  onChange={(e) => setEditingConfig({ ...editingConfig, resource_group: e.target.value })}
                  placeholder="my-resource-group"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-account">Automation Account Name</Label>
                <Input
                  id="edit-account"
                  value={editingConfig.automation_account_name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, automation_account_name: e.target.value })}
                  placeholder="my-automation-account"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-runbook">Runbook Name</Label>
                <Input
                  id="edit-runbook"
                  value={editingConfig.runbook_name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, runbook_name: e.target.value })}
                  placeholder="Export-M365Config"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
