import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Save,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Cloud,
  Server,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ServicePrincipalConfig {
  id: string;
  name: string;
  description: string | null;
  tenant_id: string;
  client_id: string;
  connection_types: string[];
  created_at: string;
  updated_at: string;
}

interface ServicePrincipalManagerProps {
  onSelect?: (config: ServicePrincipalConfig) => void;
  selectedId?: string | null;
  showSelector?: boolean;
  compact?: boolean;
}

export const ServicePrincipalManager = ({
  onSelect,
  selectedId,
  showSelector = false,
  compact = false,
}: ServicePrincipalManagerProps) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ServicePrincipalConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ServicePrincipalConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTenantId, setFormTenantId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formConnectionTypes, setFormConnectionTypes] = useState<string[]>(['graph']);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_principal_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Failed to load configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!formName || !formTenantId || !formClientId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingConfig) {
        // Update existing
        const { error } = await supabase
          .from('service_principal_configs')
          .update({
            name: formName,
            description: formDescription || null,
            tenant_id: formTenantId,
            client_id: formClientId,
            connection_types: formConnectionTypes,
          })
          .eq('id', editingConfig.id);

        if (error) throw error;

        toast({
          title: 'Configuration Updated',
          description: 'Service principal configuration has been updated',
        });
      } else {
        // Create new
        const { error } = await supabase.from('service_principal_configs').insert([{
          user_id: user.id,
          name: formName,
          description: formDescription || null,
          tenant_id: formTenantId,
          client_id: formClientId,
          connection_types: formConnectionTypes,
        }]);

        if (error) throw error;

        toast({
          title: 'Configuration Saved',
          description: 'Service principal configuration has been saved',
        });
      }

      setSaveDialogOpen(false);
      resetForm();
      await loadConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteConfig = async () => {
    if (!configToDelete) return;

    try {
      const { error } = await supabase
        .from('service_principal_configs')
        .delete()
        .eq('id', configToDelete);

      if (error) throw error;

      setConfigs(prev => prev.filter(c => c.id !== configToDelete));
      toast({
        title: 'Configuration Deleted',
        description: 'Service principal configuration has been deleted',
      });
    } catch (error) {
      console.error('Failed to delete config:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete configuration',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTenantId('');
    setFormClientId('');
    setFormConnectionTypes(['graph']);
    setEditingConfig(null);
  };

  const openEditDialog = (config: ServicePrincipalConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormDescription(config.description || '');
    setFormTenantId(config.tenant_id);
    setFormClientId(config.client_id);
    setFormConnectionTypes(config.connection_types);
    setSaveDialogOpen(true);
  };

  const openSaveDialog = (tenantId?: string, clientId?: string, connectionTypes?: string[]) => {
    resetForm();
    if (tenantId) setFormTenantId(tenantId);
    if (clientId) setFormClientId(clientId);
    if (connectionTypes) setFormConnectionTypes(connectionTypes);
    setSaveDialogOpen(true);
  };

  const toggleConnectionType = (type: string) => {
    setFormConnectionTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const getConnectionIcon = (types: string[]) => {
    if (types.includes('graph') && types.includes('azure')) return Building2;
    if (types.includes('azure')) return Server;
    return Cloud;
  };

  const selectedConfig = configs.find(c => c.id === selectedId);

  if (showSelector && compact) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selectedConfig ? (
                <span className="flex items-center gap-2 truncate">
                  <Key className="w-3 h-3" />
                  {selectedConfig.name}
                </span>
              ) : (
                <span className="text-muted-foreground">Select configuration...</span>
              )}
              <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[250px]">
            <DropdownMenuItem onClick={() => onSelect?.(null as unknown as ServicePrincipalConfig)}>
              <span className="text-muted-foreground">No configuration</span>
            </DropdownMenuItem>
            {configs.map(config => {
              const Icon = getConnectionIcon(config.connection_types);
              return (
                <DropdownMenuItem key={config.id} onClick={() => onSelect?.(config)}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span>{config.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {config.tenant_id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Saved Configurations
          </h4>
          <Button variant="ghost" size="sm" onClick={() => openSaveDialog()}>
            <Save className="w-4 h-4 mr-1" />
            Save New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No saved configurations</p>
            <p className="text-xs">Save a configuration to reuse it later</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {configs.map((config, idx) => {
                const Icon = getConnectionIcon(config.connection_types);
                const isSelected = selectedId === config.id;
                return (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-secondary/30 hover:border-primary/50"
                    )}
                    onClick={() => onSelect?.(config)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Icon className={cn("w-5 h-5 mt-0.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate">{config.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                          </div>
                          {config.description && (
                            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {config.tenant_id.slice(0, 8)}...
                            </span>
                            <div className="flex gap-1">
                              {config.connection_types.includes('graph') && (
                                <Badge variant="outline" className="text-xs px-1 py-0">M365</Badge>
                              )}
                              {config.connection_types.includes('azure') && (
                                <Badge variant="outline" className="text-xs px-1 py-0">Azure</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(config);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfigToDelete(config.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Save/Edit Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={(open) => {
        setSaveDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Save Configuration'}</DialogTitle>
            <DialogDescription>
              {editingConfig
                ? 'Update the service principal configuration details'
                : 'Save this service principal for later use'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="config-name">Name *</Label>
              <Input
                id="config-name"
                placeholder="Production M365 Export"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-description">Description</Label>
              <Input
                id="config-description"
                placeholder="Main service principal for automated exports"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-tenant">Tenant ID *</Label>
              <Input
                id="config-tenant"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formTenantId}
                onChange={(e) => setFormTenantId(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-client">Client ID *</Label>
              <Input
                id="config-client"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Connection Types</Label>
              <div className="flex gap-2">
                {[
                  { id: 'graph', label: 'Microsoft 365', icon: Cloud },
                  { id: 'azure', label: 'Azure', icon: Server },
                ].map(type => {
                  const Icon = type.icon;
                  const isActive = formConnectionTypes.includes(type.id);
                  return (
                    <Button
                      key={type.id}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleConnectionType(type.id)}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Client secret is not stored. You'll enter it when connecting.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingConfig ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Scheduled exports using this configuration will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConfig} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const useServicePrincipalConfigs = () => {
  const [configs, setConfigs] = useState<ServicePrincipalConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_principal_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Failed to load service principal configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { configs, isLoading, refresh: loadConfigs };
};
