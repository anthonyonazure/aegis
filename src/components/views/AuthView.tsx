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
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const requiredPermissions = [
  { scope: 'DeviceManagementConfiguration.Read.All', description: 'Read Intune device configurations' },
  { scope: 'DeviceManagementApps.Read.All', description: 'Read Intune app configurations' },
  { scope: 'Policy.Read.All', description: 'Read Conditional Access policies' },
  { scope: 'Directory.Read.All', description: 'Read directory data' },
  { scope: 'Application.Read.All', description: 'Read app registrations' },
  { scope: 'SecurityEvents.Read.All', description: 'Read security configurations' },
];

export const AuthView = () => {
  const [authMethod, setAuthMethod] = useState<'app' | 'delegated'>('app');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = () => {
    // TODO: Implement actual connection
    console.log('Connecting...', { tenantId, clientId, authMethod });
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
                  />
                  <p className="text-xs text-muted-foreground">
                    For CI/CD, use environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
                  </p>
                </div>

                <Button onClick={handleConnect} className="w-full md:w-auto">
                  Connect to Tenant
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
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Azure Portal
                </Button>
                <Button variant="ghost" size="sm">
                  Copy All Permissions
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
                    <p className="font-medium text-foreground">Interactive Sign-In Required</p>
                    <p className="text-sm text-muted-foreground">
                      You'll be redirected to Microsoft to authenticate. Requires browser interaction.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-id-delegated">Tenant ID (optional)</Label>
                  <Input
                    id="tenant-id-delegated"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Leave blank for multi-tenant or enter specific tenant"
                    className="font-mono bg-secondary/50 border-border"
                  />
                </div>

                <Button onClick={handleConnect} className="w-full md:w-auto gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Sign in with Microsoft
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Status Card */}
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
    </div>
  );
};
