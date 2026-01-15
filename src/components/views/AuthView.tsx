import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  Building2, 
  User, 
  Shield, 
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Cloud,
  Server,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { testAzureConnection } from '@/lib/azureApi';
import { AzureSubscription } from '@/types/tenant';
import { useToast } from '@/hooks/use-toast';
import { ServicePrincipalManager, ServicePrincipalConfig } from '@/components/ServicePrincipalManager';

const graphPermissions = [
  // Intune / Device Management
  { scope: 'DeviceManagementConfiguration.Read.All', description: 'Intune device configurations' },
  { scope: 'DeviceManagementApps.Read.All', description: 'Intune apps & scripts' },
  { scope: 'DeviceManagementManagedDevices.Read.All', description: 'Managed devices & compliance' },
  { scope: 'DeviceManagementServiceConfig.Read.All', description: 'Autopilot & enrollment' },
  // Identity & Access
  { scope: 'Policy.Read.All', description: 'Conditional Access & policies' },
  { scope: 'Directory.Read.All', description: 'Users, groups, roles' },
  { scope: 'Application.Read.All', description: 'App registrations' },
  { scope: 'RoleManagement.Read.Directory', description: 'Role assignments' },
  // Security & Compliance
  { scope: 'SecurityEvents.Read.All', description: 'Defender & security configs' },
  { scope: 'ThreatAssessment.Read.All', description: 'Threat policies' },
  // Collaboration
  { scope: 'Mail.Read', description: 'Exchange transport rules (delegated)' },
  { scope: 'SharePointTenantSettings.Read.All', description: 'SharePoint settings' },
  { scope: 'Team.ReadBasic.All', description: 'Teams configurations' },
];

const azurePermissions = [
  { scope: 'Reader', description: 'Read all resources in subscriptions', required: true },
  { scope: 'Microsoft.Resources/subscriptions/read', description: 'List subscriptions', required: true },
  { scope: 'Microsoft.Compute/*/read', description: 'VMs, disks, availability sets', required: false },
  { scope: 'Microsoft.Network/*/read', description: 'VNets, NSGs, load balancers', required: false },
  { scope: 'Microsoft.Storage/*/read', description: 'Storage accounts & containers', required: false },
  { scope: 'Microsoft.KeyVault/*/read', description: 'Key Vaults & secrets metadata', required: false },
  { scope: 'Microsoft.Web/*/read', description: 'App Services & functions', required: false },
  { scope: 'Microsoft.Sql/*/read', description: 'SQL databases & servers', required: false },
  { scope: 'Contributor (optional)', description: 'Required for import/restore', required: false },
];

export const AuthView = () => {
  const [connectionType, setConnectionType] = useState<'graph' | 'azure' | 'both'>('graph');
  const [authMethod, setAuthMethod] = useState<'app' | 'delegated'>('app');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ServicePrincipalConfig | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  
  // Azure-specific state
  const [azureConnecting, setAzureConnecting] = useState(false);
  const [azureConnected, setAzureConnected] = useState(false);
  const [azureToken, setAzureToken] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
  
  const { toast } = useToast();

  const { 
    isConnected, 
    tenantName, 
    tenantId: connectedTenantId,
    isConnecting, 
    connect, 
    disconnect 
  } = useTenant();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = async () => {
    if (!tenantId || !clientId || !clientSecret) {
      return;
    }

    // Connect to Graph API (M365)
    if (connectionType === 'graph' || connectionType === 'both') {
      await connect(tenantId, clientId, clientSecret);
    }

    // Connect to Azure if needed
    if (connectionType === 'azure' || connectionType === 'both') {
      await handleAzureConnect();
    }
  };

  const handleAzureConnect = async () => {
    if (!tenantId || !clientId || !clientSecret) {
      return;
    }

    setAzureConnecting(true);
    try {
      const result = await testAzureConnection(tenantId, clientId, clientSecret);
      
      if (!result.success) {
        toast({
          title: 'Azure Connection Failed',
          description: result.error || 'Failed to connect to Azure',
          variant: 'destructive',
        });
        return;
      }

      setAzureToken(result.accessToken || null);
      setSubscriptions(result.subscriptions || []);
      setAzureConnected(true);
      
      // Auto-select all subscriptions
      setSelectedSubscriptions(result.subscriptions?.map(s => s.subscriptionId) || []);
      
      toast({
        title: 'Azure Connected',
        description: `Found ${result.subscriptions?.length || 0} subscriptions`,
      });
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive',
      });
    } finally {
      setAzureConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setAzureConnected(false);
    setAzureToken(null);
    setSubscriptions([]);
    setSelectedSubscriptions([]);
  };

  const toggleSubscription = (subscriptionId: string) => {
    setSelectedSubscriptions(prev => 
      prev.includes(subscriptionId)
        ? prev.filter(id => id !== subscriptionId)
        : [...prev, subscriptionId]
    );
  };

  const copyAllPermissions = () => {
    const allScopes = graphPermissions.map(p => p.scope).join('\n');
    navigator.clipboard.writeText(allScopes);
    setCopied('all');
    setTimeout(() => setCopied(null), 2000);
  };

  const isAnyConnected = isConnected || azureConnected;

  const handleSelectSavedConfig = (config: ServicePrincipalConfig | null) => {
    setSelectedConfig(config);
    if (config) {
      setTenantId(config.tenant_id);
      setClientId(config.client_id);
      // Determine connection type from saved config
      if (config.connection_types.includes('graph') && config.connection_types.includes('azure')) {
        setConnectionType('both');
      } else if (config.connection_types.includes('azure')) {
        setConnectionType('azure');
      } else {
        setConnectionType('graph');
      }
      setClientSecret(''); // Always clear secret - user must re-enter
      toast({
        title: 'Configuration Loaded',
        description: `Loaded "${config.name}". Enter your client secret to connect.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Authentication</h1>
        <p className="text-muted-foreground mt-1">
          Connect to Microsoft 365 and/or Azure to export and manage resources
        </p>
      </div>

      {/* Connection Status */}
      {isAnyConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-panel border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="status-dot status-dot-success" />
                  <div>
                    <p className="font-medium text-foreground">
                      Connected to {tenantName || connectedTenantId || 'Azure Tenant'}
                    </p>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      {isConnected && <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> M365</span>}
                      {azureConnected && <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Azure ({selectedSubscriptions.length} subs)</span>}
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Connection Type Selector */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg">Connection Type</CardTitle>
          <CardDescription>
            Choose what you want to connect to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'graph', label: 'Microsoft 365 Only', icon: Cloud, desc: 'Intune, CA, Entra ID, Defender' },
              { id: 'azure', label: 'Azure Only', icon: Server, desc: 'VMs, Networks, Storage, PaaS' },
              { id: 'both', label: 'Both (Recommended)', icon: Building2, desc: 'Full M365 + Azure coverage' },
            ].map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setConnectionType(option.id as 'graph' | 'azure' | 'both')}
                  disabled={isAnyConnected}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    connectionType === option.id 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50",
                    isAnyConnected && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("w-6 h-6 mb-2", connectionType === option.id ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as 'app' | 'delegated')}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="app" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4" />
            App Registration
          </TabsTrigger>
          <TabsTrigger value="delegated" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="w-4 h-4" />
            Delegated Auth
          </TabsTrigger>
        </TabsList>

        <TabsContent value="app" className="space-y-6 mt-6">
          {/* Saved Configurations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-panel">
              <CardContent className="pt-6">
                <ServicePrincipalManager 
                  onSelect={handleSelectSavedConfig}
                  selectedId={selectedConfig?.id}
                />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Service Principal Configuration
                  {selectedConfig && (
                    <span className="text-sm font-normal text-muted-foreground">
                      (from: {selectedConfig.name})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Best for CI/CD pipelines and automated exports. Uses client credentials flow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-id">Tenant ID</Label>
                    <Input
                      id="tenant-id"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="font-mono bg-secondary/50 border-border"
                      disabled={isAnyConnected}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID (App ID)</Label>
                    <Input
                      id="client-id"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="font-mono bg-secondary/50 border-border"
                      disabled={isAnyConnected}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <Input
                    id="client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter your client secret"
                    className="font-mono bg-secondary/50 border-border"
                    disabled={isAnyConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    For CI/CD, use environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    onClick={handleConnect} 
                    disabled={isConnecting || azureConnecting || isAnyConnected || !tenantId || !clientId || !clientSecret}
                  >
                    {isConnecting || azureConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : isAnyConnected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Connected
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                  {!isAnyConnected && tenantId && clientId && !selectedConfig && (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowSavePrompt(true)}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Configuration
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Azure Subscriptions Selector */}
          {azureConnected && subscriptions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="w-5 h-5 text-primary" />
                    Azure Subscriptions
                  </CardTitle>
                  <CardDescription>
                    Select which subscriptions to include in exports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subscriptions.map((sub) => (
                      <div 
                        key={sub.subscriptionId}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedSubscriptions.includes(sub.subscriptionId)}
                            onCheckedChange={() => toggleSubscription(sub.subscriptionId)}
                          />
                          <div>
                            <p className="font-medium text-foreground">{sub.displayName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{sub.subscriptionId}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          sub.state === 'Enabled' ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                        )}>
                          {sub.state}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedSubscriptions(subscriptions.map(s => s.subscriptionId))}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedSubscriptions([])}
                    >
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Required Permissions */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Required Permissions
              </CardTitle>
              <CardDescription>
                Permissions needed based on your connection type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Graph Permissions */}
              {(connectionType === 'graph' || connectionType === 'both') && (
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> Microsoft Graph API Permissions
                  </h4>
                  <div className="space-y-2">
                    {graphPermissions.map((perm) => (
                      <div 
                        key={perm.scope}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <code className="text-sm font-mono text-primary">{perm.scope}</code>
                          <span className="text-sm text-muted-foreground hidden md:inline">
                            {perm.description}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(perm.scope, perm.scope)}
                        >
                          {copied === perm.scope ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Azure RBAC Permissions */}
              {(connectionType === 'azure' || connectionType === 'both') && (
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4" /> Azure RBAC Permissions
                  </h4>
                  <div className="space-y-2">
                    {azurePermissions.map((perm) => (
                      <div 
                        key={perm.scope}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <code className="text-sm font-mono text-primary">{perm.scope}</code>
                          <span className="text-sm text-muted-foreground hidden md:inline">
                            {perm.description}
                          </span>
                          {perm.required && (
                            <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Required</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Assign these roles to your App Registration at the subscription or management group level in Azure Portal.
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => window.open('https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps', '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Azure Portal
                </Button>
                {(connectionType === 'graph' || connectionType === 'both') && (
                  <Button variant="ghost" size="sm" onClick={copyAllPermissions}>
                    {copied === 'all' ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-success" />
                        Copied!
                      </>
                    ) : (
                      'Copy All Graph Permissions'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delegated" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Interactive Authentication
                </CardTitle>
                <CardDescription>
                  Sign in with your Microsoft account. Uses your permissions in the tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-info/10 border border-info/20">
                  <AlertCircle className="w-5 h-5 text-info" />
                  <div>
                    <p className="font-medium text-foreground">Coming Soon</p>
                    <p className="text-sm text-muted-foreground">
                      Delegated authentication with interactive sign-in is planned for a future release.
                      Use App Registration for now.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Status Card - Only show if not connected */}
      {!isAnyConnected && (
        <Card className="glass-panel border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot-warning" />
              <div>
                <p className="font-medium text-foreground">Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  Configure authentication above to connect to your {connectionType === 'graph' ? 'M365' : connectionType === 'azure' ? 'Azure' : 'M365 and Azure'} tenant
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
