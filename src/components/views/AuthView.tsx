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
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantConnection } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';

const requiredPermissions = [
  { scope: 'DeviceManagementConfiguration.Read.All', description: 'Read Intune device configurations' },
  { scope: 'DeviceManagementApps.Read.All', description: 'Read Intune app configurations' },
  { scope: 'Policy.Read.All', description: 'Read Conditional Access policies' },
  { scope: 'Directory.Read.All', description: 'Read directory data' },
  { scope: 'Application.Read.All', description: 'Read app registrations' },
  { scope: 'SecurityEvents.Read.All', description: 'Read security configurations' },
];

interface AuthViewProps {
  onConnectionChange?: (connected: boolean, accessToken?: string, connectionId?: string) => void;
}

export const AuthView = ({ onConnectionChange }: AuthViewProps) => {
  const [authMethod, setAuthMethod] = useState<'app' | 'delegated'>('app');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const { 
    isConnected, 
    tenantName, 
    tenantId: connectedTenantId,
    isConnecting, 
    connect, 
    disconnect 
  } = useTenantConnection();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = async () => {
    if (!tenantId || !clientId || !clientSecret) {
      return;
    }

    const result = await connect(tenantId, clientId, clientSecret);
    
    if (result.success && result.accessToken) {
      onConnectionChange?.(true, result.accessToken);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    onConnectionChange?.(false);
  };

  const copyAllPermissions = () => {
    const allScopes = requiredPermissions.map(p => p.scope).join('\n');
    navigator.clipboard.writeText(allScopes);
    setCopied('all');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Authentication</h1>
        <p className="text-muted-foreground mt-1">
          Connect to your Microsoft 365 tenant using App Registration or Delegated auth
        </p>
      </div>

      {/* Connection Status */}
      {isConnected && (
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
                    <p className="font-medium text-foreground">Connected to {tenantName || connectedTenantId}</p>
                    <p className="text-sm text-muted-foreground">
                      Tenant ID: {connectedTenantId}
                    </p>
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Service Principal Configuration
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
                      disabled={isConnected}
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
                      disabled={isConnected}
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
                    disabled={isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    For CI/CD, use environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
                  </p>
                </div>

                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting || isConnected || !tenantId || !clientId || !clientSecret}
                  className="w-full md:w-auto"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Connected
                    </>
                  ) : (
                    'Connect to Tenant'
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Required Permissions */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Required API Permissions
              </CardTitle>
              <CardDescription>
                Your app registration needs these Microsoft Graph permissions (Application type)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {requiredPermissions.map((perm) => (
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
                <Button variant="ghost" size="sm" onClick={copyAllPermissions}>
                  {copied === 'all' ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-success" />
                      Copied!
                    </>
                  ) : (
                    'Copy All Permissions'
                  )}
                </Button>
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
      {!isConnected && (
        <Card className="glass-panel border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot-warning" />
              <div>
                <p className="font-medium text-foreground">Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  Configure authentication above to connect to your M365 tenant
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
