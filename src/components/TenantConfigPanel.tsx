import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Key,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/tenant';
import { storeEncryptedCredential, hasStoredCredentials } from '@/lib/database';
import { TenantSetupWizard } from './TenantSetupWizard';

interface TenantConnection {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  display_name: string | null;
  status: string;
  environment: string | null;
  health_status: string | null;
  customer_id: string | null;
  tenant_group_id: string | null;
  created_at: string;
  hasCredentials?: boolean;
}

interface TenantGroupDb {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  customer_id: string;
  created_at: string;
  updated_at: string;
}

interface TenantConfigPanelProps {
  customer: Customer;
  onBack: () => void;
}

export const TenantConfigPanel = ({ customer, onBack }: TenantConfigPanelProps) => {
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [groups, setGroups] = useState<TenantGroupDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantConnection | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<TenantConnection | null>(null);
  const [configuringTenant, setConfiguringTenant] = useState<TenantConnection | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();

  // Form state for tenant
  const [formTenantId, setFormTenantId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formEnvironment, setFormEnvironment] = useState('production');
  const [formGroupId, setFormGroupId] = useState<string | null>(null);

  // Form state for credentials
  const [formClientId, setFormClientId] = useState('');
  const [formClientSecret, setFormClientSecret] = useState('');

  useEffect(() => {
    loadData();
  }, [customer.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load tenants for this customer
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenant_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('customer_id', customer.id)
        .order('display_name');

      if (tenantsError) throw tenantsError;

      // Check credentials for each tenant
      const tenantsWithCredentials = await Promise.all(
        (tenantsData || []).map(async (t) => ({
          ...t,
          hasCredentials: await hasStoredCredentials(t.id),
        }))
      );

      setTenants(tenantsWithCredentials);

      // Load tenant groups for this customer
      const { data: groupsData, error: groupsError } = await supabase
        .from('tenant_groups')
        .select('*')
        .eq('customer_id', customer.id)
        .order('name');

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTenantForm = () => {
    setFormTenantId('');
    setFormDisplayName('');
    setFormEnvironment('production');
    setFormGroupId(null);
    setEditingTenant(null);
    // Also reset credentials when resetting tenant form
    setFormClientId('');
    setFormClientSecret('');
    setShowSecret(false);
  };

  const resetCredentialsForm = () => {
    setFormClientId('');
    setFormClientSecret('');
    setConfiguringTenant(null);
    setShowSecret(false);
  };

  const handleOpenCreate = () => {
    resetTenantForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (tenant: TenantConnection) => {
    setEditingTenant(tenant);
    setFormTenantId(tenant.tenant_id);
    setFormDisplayName(tenant.display_name || '');
    setFormEnvironment(tenant.environment || 'production');
    setFormGroupId(tenant.tenant_group_id);
    setDialogOpen(true);
  };

  const handleOpenCredentials = (tenant: TenantConnection) => {
    setConfiguringTenant(tenant);
    setFormClientId('');
    setFormClientSecret('');
    setShowSecret(false);
    setCredentialsDialogOpen(true);
  };

  const handleOpenDelete = (tenant: TenantConnection) => {
    setDeletingTenant(tenant);
    setDeleteDialogOpen(true);
  };

  const handleSaveTenant = async () => {
    if (!formTenantId.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Tenant ID is required',
        variant: 'destructive',
      });
      return;
    }

    // For new tenants, require credentials
    if (!editingTenant && (!formClientId.trim() || !formClientSecret.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Client ID and Client Secret are required for new tenants',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingTenant) {
        const { error } = await supabase
          .from('tenant_connections')
          .update({
            tenant_id: formTenantId.trim(),
            display_name: formDisplayName.trim() || null,
            environment: formEnvironment,
            tenant_group_id: formGroupId || null,
          })
          .eq('id', editingTenant.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Tenant updated successfully' });
      } else {
        // Create tenant connection first
        const { data: newTenant, error } = await supabase
          .from('tenant_connections')
          .insert({
            user_id: user.id,
            tenant_id: formTenantId.trim(),
            display_name: formDisplayName.trim() || null,
            tenant_name: formDisplayName.trim() || null,
            environment: formEnvironment,
            customer_id: customer.id,
            tenant_group_id: formGroupId || null,
            auth_method: 'app',
            status: 'disconnected',
            client_id: formClientId.trim(),
          })
          .select()
          .single();

        if (error) throw error;

        // Store encrypted credentials
        await storeEncryptedCredential(
          newTenant.id,
          formClientId.trim(),
          formClientSecret.trim()
        );

        // Update status to connected
        await supabase
          .from('tenant_connections')
          .update({ status: 'connected' })
          .eq('id', newTenant.id);

        toast({ title: 'Success', description: 'Tenant connected successfully' });
      }

      setDialogOpen(false);
      resetTenantForm();
      loadData();
    } catch (error) {
      console.error('Error saving tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save tenant',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Test connection for new tenant (uses edge function to avoid CORS)
  const handleTestNewConnection = async () => {
    if (!formTenantId.trim() || !formClientId.trim() || !formClientSecret.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTestingConnection(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'test-connection',
          tenantId: formTenantId.trim(),
          clientId: formClientId.trim(),
          clientSecret: formClientSecret.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Connection test failed');
      }

      if (response.data?.success) {
        toast({
          title: 'Connection Successful',
          description: response.data.tenantName 
            ? `Connected to ${response.data.tenantName}` 
            : 'Successfully authenticated with Microsoft Graph',
        });
      } else {
        throw new Error(response.data?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!configuringTenant) return;

    if (!formClientId.trim() || !formClientSecret.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Both Client ID and Client Secret are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      // Store encrypted credentials
      await storeEncryptedCredential(
        configuringTenant.id,
        formClientId.trim(),
        formClientSecret.trim()
      );

      // Update tenant status
      await supabase
        .from('tenant_connections')
        .update({ status: 'connected', client_id: formClientId.trim() })
        .eq('id', configuringTenant.id);

      toast({ title: 'Success', description: 'Credentials saved successfully' });
      setCredentialsDialogOpen(false);
      resetCredentialsForm();
      loadData();
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save credentials',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!configuringTenant || !formClientId.trim() || !formClientSecret.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter credentials first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTestingConnection(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'test-connection',
          tenantId: configuringTenant.tenant_id,
          clientId: formClientId.trim(),
          clientSecret: formClientSecret.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Connection test failed');
      }

      if (response.data?.success) {
        toast({
          title: 'Connection Successful',
          description: response.data.tenantName 
            ? `Connected to ${response.data.tenantName}` 
            : 'Successfully authenticated with Microsoft Graph',
        });
      } else {
        throw new Error(response.data?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    try {
      setSaving(true);

      // Delete credentials first
      await supabase
        .from('tenant_credentials')
        .delete()
        .eq('tenant_connection_id', deletingTenant.id);

      // Delete tenant connection
      const { error } = await supabase
        .from('tenant_connections')
        .delete()
        .eq('id', deletingTenant.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Tenant deleted successfully' });
      setDeleteDialogOpen(false);
      setDeletingTenant(null);
      loadData();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete tenant',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (tenant: TenantConnection) => {
    if (tenant.hasCredentials && tenant.status === 'connected') {
      return (
        <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    }
    if (tenant.hasCredentials) {
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Configured
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        <XCircle className="w-3 h-3 mr-1" />
        Not Configured
      </Badge>
    );
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return null;
    return groups.find(g => g.id === groupId)?.name || null;
  };

  return (
    <div className="space-y-6">
      {/* Add Tenant Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Quick Add
        </Button>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Setup Wizard
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">Total Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tenants.filter(t => t.hasCredentials).length}
                </p>
                <p className="text-sm text-muted-foreground">Configured</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tenants.filter(t => !t.hasCredentials).length}
                </p>
                <p className="text-sm text-muted-foreground">Needs Setup</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Tenant Connections
          </CardTitle>
          <CardDescription>
            Configure service principal credentials for each tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No tenants configured</h3>
              <p className="text-muted-foreground mb-4">
                Add tenant connections for {customer.name}
              </p>
              <Button onClick={() => setWizardOpen(true)} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Setup Wizard
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {tenants.map((tenant, index) => (
                  <motion.div
                    key={tenant.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Server className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {tenant.display_name || tenant.tenant_name || tenant.tenant_id}
                          </p>
                          {getStatusBadge(tenant)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="font-mono text-xs">{tenant.tenant_id}</span>
                          {tenant.environment && (
                            <Badge variant="outline" className="text-xs">
                              {tenant.environment}
                            </Badge>
                          )}
                          {getGroupName(tenant.tenant_group_id) && (
                            <span className="text-xs">
                              Group: {getGroupName(tenant.tenant_group_id)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCredentials(tenant)}
                        className="gap-1"
                      >
                        <Key className="w-4 h-4" />
                        {tenant.hasCredentials ? 'Update Credentials' : 'Configure'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(tenant)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleOpenDelete(tenant)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Tenant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Add Tenant Connection'}</DialogTitle>
            <DialogDescription>
              {editingTenant
                ? 'Update the tenant connection details'
                : 'Enter the Microsoft 365 tenant and service principal credentials'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tenant Details Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Server className="w-4 h-4" />
                Tenant Details
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant ID *</Label>
                <Input
                  id="tenantId"
                  value={formTenantId}
                  onChange={(e) => setFormTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="bg-secondary/50 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The Microsoft 365 tenant ID (GUID)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g., Contoso Production"
                  className="bg-secondary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select value={formEnvironment} onValueChange={setFormEnvironment}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group">Tenant Group</Label>
                  <Select 
                    value={formGroupId || 'none'} 
                    onValueChange={(v) => setFormGroupId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* App Registration Section - Only show for new tenants */}
            {!editingTenant && (
              <>
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                    <Key className="w-4 h-4" />
                    App Registration (Service Principal)
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newClientId">Application (Client) ID *</Label>
                      <Input
                        id="newClientId"
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="bg-secondary/50 font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newClientSecret">Client Secret *</Label>
                      <div className="relative">
                        <Input
                          id="newClientSecret"
                          type={showSecret ? 'text' : 'password'}
                          value={formClientSecret}
                          onChange={(e) => setFormClientSecret(e.target.value)}
                          placeholder="Enter client secret"
                          className="bg-secondary/50 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Credentials are encrypted and stored securely
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      type="button"
                      className="w-full gap-2"
                      onClick={handleTestNewConnection}
                      disabled={testingConnection || !formTenantId || !formClientId || !formClientSecret}
                    >
                      {testingConnection ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Test Connection
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTenant} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTenant ? 'Save Changes' : 'Add & Connect Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Configure Credentials
            </DialogTitle>
            <DialogDescription>
              Enter the service principal credentials for{' '}
              <strong>{configuringTenant?.display_name || configuringTenant?.tenant_id}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Tenant ID:</strong>{' '}
                <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                  {configuringTenant?.tenant_id}
                </code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">Application (Client) ID *</Label>
              <Input
                id="clientId"
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="bg-secondary/50 font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={formClientSecret}
                  onChange={(e) => setFormClientSecret(e.target.value)}
                  placeholder="Enter client secret"
                  className="bg-secondary/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                The client secret is encrypted and stored securely
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleTestConnection}
              disabled={testingConnection || !formClientId || !formClientSecret}
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Test Connection
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCredentialsDialogOpen(false);
                resetCredentialsForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCredentials} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tenant connection for{' '}
              <strong>
                {deletingTenant?.display_name || deletingTenant?.tenant_id}
              </strong>
              ? This will also remove all stored credentials. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Setup Wizard */}
      <TenantSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        customerId={customer.id}
        customerName={customer.name}
        onComplete={loadData}
      />
    </div>
  );
};
