import { useState, useCallback } from 'react';
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
  Cog,
  LogIn,
  LogOut,
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
import { PermissionHealthIndicator } from '@/components/PermissionHealthIndicator';
import { AzureAutomationManager } from '@/components/AzureAutomationManager';
import { loginWithPopup, acquireToken, logout, getCurrentAccount, GRAPH_SCOPES } from '@/lib/msalAuth';
import type { AccountInfo } from '@azure/msal-browser';

// Graph API permissions - organized by read-only vs read-write
const graphPermissions = {
  readOnly: [
    // Intune / Device Management
    { scope: 'DeviceManagementConfiguration.Read.All', description: 'Device configs, compliance, update rings' },
    { scope: 'DeviceManagementApps.Read.All', description: 'Apps, scripts, app configs' },
    { scope: 'DeviceManagementManagedDevices.Read.All', description: 'Managed devices' },
    { scope: 'DeviceManagementServiceConfig.Read.All', description: 'Autopilot, enrollment' },
    // Identity & Access
    { scope: 'Policy.Read.All', description: 'Conditional Access policies' },
    { scope: 'Directory.Read.All', description: 'Users, groups, roles, directory settings' },
    { scope: 'Application.Read.All', description: 'App registrations' },
    { scope: 'RoleManagement.Read.Directory', description: 'Role assignments' },
    // Security
    { scope: 'SecurityEvents.Read.All', description: 'Defender configs' },
    // Collaboration
    { scope: 'Sites.Read.All', description: 'SharePoint settings' },
    { scope: 'TeamSettings.Read.All', description: 'Teams policies' },
  ],
  readWrite: [
    // Intune / Device Management
    { scope: 'DeviceManagementConfiguration.ReadWrite.All', description: 'Create/update device configs, compliance, update rings' },
    { scope: 'DeviceManagementApps.ReadWrite.All', description: 'Create/update apps, scripts' },
    { scope: 'DeviceManagementManagedDevices.ReadWrite.All', description: 'Manage devices' },
    { scope: 'DeviceManagementServiceConfig.ReadWrite.All', description: 'Create/update Autopilot, enrollment' },
    // Identity & Access
    { scope: 'Policy.ReadWrite.ConditionalAccess', description: 'Create/update CA policies' },
    { scope: 'Directory.ReadWrite.All', description: 'Create/update groups, settings' },
    { scope: 'Application.ReadWrite.All', description: 'Create/update app registrations' },
    { scope: 'RoleManagement.ReadWrite.Directory', description: 'Assign roles' },
    // Security
    { scope: 'SecurityEvents.ReadWrite.All', description: 'Update Defender configs' },
    // Collaboration
    { scope: 'Sites.ReadWrite.All', description: 'Update SharePoint settings' },
    { scope: 'TeamSettings.ReadWrite.All', description: 'Update Teams policies' },
  ],
};

// Azure RBAC - simple role-based (not individual permissions)
const azureRoles = {
  readOnly: {
    role: 'Reader',
    description: 'Export/backup all Azure resources',
    scope: 'Subscription or Management Group',
  },
  readWrite: {
    role: 'Contributor', 
    description: 'Export + Import/Restore Azure resources',
    scope: 'Subscription or Management Group',
  },
};

const azureRbacSteps = [
  { step: 1, title: 'Open Azure Portal', action: 'Go to portal.azure.com → Subscriptions' },
  { step: 2, title: 'Select Subscription', action: 'Choose the subscription you want to manage' },
  { step: 3, title: 'Access Control', action: 'Click "Access control (IAM)" in the left menu' },
  { step: 4, title: 'Add Role Assignment', action: 'Click "Add" → "Add role assignment"' },
  { step: 5, title: 'Choose Role', action: 'Select "Reader" (export only) or "Contributor" (export + import)' },
  { step: 6, title: 'Assign to App', action: 'Search for your App Registration name, select it, and click "Review + assign"' },
];

export const AuthView = () => {
  const [connectionType, setConnectionType] = useState<'graph' | 'azure' | 'both'>('graph');
  const [permissionMode, setPermissionMode] = useState<'readOnly' | 'readWrite'>('readWrite');
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
  
  // Delegated auth state
  const [delegatedClientId, setDelegatedClientId] = useState('');
  const [delegatedTenantId, setDelegatedTenantId] = useState('');
  const [delegatedAccount, setDelegatedAccount] = useState<AccountInfo | null>(null);
  const [delegatedConnecting, setDelegatedConnecting] = useState(false);
  const [delegatedToken, setDelegatedToken] = useState<string | null>(null);
  
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

  // Delegated authentication handlers
  const handleDelegatedSignIn = useCallback(async () => {
    if (!delegatedClientId) {
      toast({
        title: 'Client ID Required',
        description: 'Please enter your App Registration Client ID for delegated auth.',
        variant: 'destructive',
      });
      return;
    }

    setDelegatedConnecting(true);
    try {
      const scopes = permissionMode === 'readWrite' ? GRAPH_SCOPES.readWrite : GRAPH_SCOPES.readOnly;
      const result = await loginWithPopup(
        delegatedClientId,
        delegatedTenantId || 'common',
        scopes
      );

      if (result.success && result.account) {
        setDelegatedAccount(result.account);
        setDelegatedToken(result.accessToken || null);
        toast({
          title: 'Signed In Successfully',
          description: `Connected as ${result.account.username}`,
        });
      } else {
        toast({
          title: 'Sign In Failed',
          description: result.error || 'Could not complete sign in',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Sign In Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setDelegatedConnecting(false);
    }
  }, [delegatedClientId, delegatedTenantId, permissionMode, toast]);

  const handleDelegatedRefreshToken = useCallback(async () => {
    if (!delegatedClientId || !delegatedAccount) return;

    try {
      const scopes = permissionMode === 'readWrite' ? GRAPH_SCOPES.readWrite : GRAPH_SCOPES.readOnly;
      const result = await acquireToken(delegatedClientId, delegatedTenantId || 'common', scopes);
      
      if (result.success && result.accessToken) {
        setDelegatedToken(result.accessToken);
        toast({
          title: 'Token Refreshed',
          description: 'Access token has been refreshed.',
        });
      }
    } catch (error) {
      toast({
        title: 'Token Refresh Failed',
        description: error instanceof Error ? error.message : 'Could not refresh token',
        variant: 'destructive',
      });
    }
  }, [delegatedClientId, delegatedTenantId, delegatedAccount, permissionMode, toast]);

  const handleDelegatedSignOut = useCallback(async () => {
    if (!delegatedClientId) return;

    try {
      await logout(delegatedClientId, delegatedTenantId || 'common');
      setDelegatedAccount(null);
      setDelegatedToken(null);
      toast({
        title: 'Signed Out',
        description: 'You have been signed out.',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [delegatedClientId, delegatedTenantId, toast]);

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
    const permsToUse = permissionMode === 'readWrite' ? graphPermissions.readWrite : graphPermissions.readOnly;
    const allScopes = permsToUse.map(p => p.scope).join('\n');
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

          {/* Azure Automation for PowerShell Resources */}
          {isAnyConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cog className="w-5 h-5 text-primary" />
                    Azure Automation for PowerShell Resources
                  </CardTitle>
                  <CardDescription>
                    Configure Azure Automation to export Exchange, Teams, and SharePoint policies that require PowerShell
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AzureAutomationManager />
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
                Choose what you need to do with your tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Permission Mode Toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setPermissionMode('readOnly')}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm font-medium transition-all",
                    permissionMode === 'readOnly' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-card hover:bg-secondary/50 text-muted-foreground"
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>📤 Export Only</span>
                    <span className="text-xs opacity-75">Read permissions</span>
                  </div>
                </button>
                <button
                  onClick={() => setPermissionMode('readWrite')}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm font-medium transition-all",
                    permissionMode === 'readWrite' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-card hover:bg-secondary/50 text-muted-foreground"
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>🔄 Export + Import</span>
                    <span className="text-xs opacity-75">Read & Write permissions</span>
                  </div>
                </button>
              </div>

              {/* Recommendation banner */}
              <div className={cn(
                "p-3 rounded-lg border",
                permissionMode === 'readWrite' 
                  ? "bg-amber-500/10 border-amber-500/20" 
                  : "bg-green-500/10 border-green-500/20"
              )}>
                <p className="text-sm">
                  {permissionMode === 'readWrite' ? (
                    <>
                      <strong>Recommended:</strong> Use ReadWrite permissions if you plan to import configurations, restore backups, or deploy policies.
                    </>
                  ) : (
                    <>
                      <strong>Minimal access:</strong> Use Read-only permissions if you only need to export/backup configurations.
                    </>
                  )}
                </p>
              </div>

              {/* Graph Permissions */}
              {(connectionType === 'graph' || connectionType === 'both') && (
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> Microsoft Graph API Permissions
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {permissionMode === 'readWrite' ? 'Read + Write' : 'Read Only'}
                    </span>
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(permissionMode === 'readWrite' ? graphPermissions.readWrite : graphPermissions.readOnly).map((perm) => (
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
                  <p className="text-xs text-muted-foreground mt-3">
                    Add these in Azure Portal → App Registrations → Your App → API Permissions → Add a permission → Microsoft Graph → Application permissions
                  </p>
                </div>
              )}

              {/* Azure RBAC Setup Guide */}
              {(connectionType === 'azure' || connectionType === 'both') && (
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4" /> Azure RBAC Role
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {permissionMode === 'readWrite' ? 'Contributor' : 'Reader'}
                    </span>
                  </h4>
                  
                  {/* Role summary */}
                  <div className={cn(
                    "p-4 rounded-lg border mb-4",
                    permissionMode === 'readWrite' 
                      ? "bg-amber-500/10 border-amber-500/20" 
                      : "bg-blue-500/10 border-blue-500/20"
                  )}>
                    <p className={cn(
                      "font-medium mb-1",
                      permissionMode === 'readWrite' 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-blue-600 dark:text-blue-400"
                    )}>
                      Assign the "{permissionMode === 'readWrite' ? 'Contributor' : 'Reader'}" role
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {permissionMode === 'readWrite' 
                        ? "This role allows you to read, create, update, and delete Azure resources. Required for imports and policy deployments."
                        : "This role allows you to view Azure resources. Sufficient for exports and backups only."
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>No need to add individual permissions</strong> like "Microsoft.Compute/virtualMachines/read" - the role includes everything.
                    </p>
                  </div>

                  {/* Step by step guide */}
                  <div className="space-y-2">
                    {azureRbacSteps.map((item) => (
                      <div 
                        key={item.step}
                        className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                          {item.step}
                        </span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.step === 5 
                              ? `Select "${permissionMode === 'readWrite' ? 'Contributor' : 'Reader'}" role and click Next`
                              : item.action
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open('https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open Subscriptions
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      MS Docs: Assign Roles
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    <strong>Note:</strong> Repeat for each subscription you want to manage.
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
                  Open App Registrations
                </Button>
                {(connectionType === 'graph' || connectionType === 'both') && (
                  <Button variant="ghost" size="sm" onClick={copyAllPermissions}>
                    {copied === 'all' ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>Copy All Graph Permissions</>
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
                {/* App Registration for Delegated Auth */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                    <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">App Registration Required</p>
                      <p>
                        Create an App Registration in Azure AD with <strong>delegated permissions</strong> (not application permissions).
                        Enable "Allow public client flows" in Authentication settings.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="delegatedClientId">Application (Client) ID</Label>
                      <Input
                        id="delegatedClientId"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={delegatedClientId}
                        onChange={(e) => setDelegatedClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delegatedTenantId">Tenant ID (optional)</Label>
                      <Input
                        id="delegatedTenantId"
                        placeholder="common (for multi-tenant) or specific tenant ID"
                        value={delegatedTenantId}
                        onChange={(e) => setDelegatedTenantId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave as "common" for multi-tenant apps, or enter a specific tenant ID
                      </p>
                    </div>
                  </div>

                  {/* Permission Mode for Delegated */}
                  <div className="space-y-2">
                    <Label>Permission Level</Label>
                    <div className="flex gap-4">
                      <Button
                        variant={permissionMode === 'readOnly' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPermissionMode('readOnly')}
                      >
                        Read Only (Export)
                      </Button>
                      <Button
                        variant={permissionMode === 'readWrite' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPermissionMode('readWrite')}
                      >
                        Read + Write (Export & Import)
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Sign In Status */}
                {delegatedAccount ? (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                        <div>
                          <p className="font-medium text-foreground">Signed In</p>
                          <p className="text-sm text-muted-foreground">{delegatedAccount.username}</p>
                          <p className="text-xs text-muted-foreground">Tenant: {delegatedAccount.tenantId}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDelegatedRefreshToken}
                        >
                          Refresh Token
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDelegatedSignOut}
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Sign Out
                        </Button>
                      </div>
                    </div>

                    {delegatedToken && (
                      <div className="space-y-2">
                        <Label>Access Token (for testing)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={delegatedToken.substring(0, 50) + '...'}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(delegatedToken, 'delegated-token')}
                          >
                            {copied === 'delegated-token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={handleDelegatedSignIn}
                    disabled={!delegatedClientId || delegatedConnecting}
                  >
                    {delegatedConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In with Microsoft
                      </>
                    )}
                  </Button>
                )}

                {/* Setup Instructions */}
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-medium text-foreground">Setup Instructions</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure App Registrations</a></li>
                    <li>Create a new registration (or use existing)</li>
                    <li>Set redirect URI to: <code className="bg-muted px-1 rounded">{window.location.origin}</code></li>
                    <li>Enable "Allow public client flows" in Authentication</li>
                    <li>Add <strong>Delegated</strong> permissions under API Permissions</li>
                    <li>Grant admin consent for the permissions</li>
                    <li>Copy the Application (Client) ID above and sign in</li>
                  </ol>
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
