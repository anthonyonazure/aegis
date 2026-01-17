import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  ArrowLeft,
  Server,
  Building2,
  FolderTree,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Play,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  PolicyTemplate,
  PolicyDeployment,
  DeploymentResult,
  TargetType,
  BASELINE_CONFIG,
  DEPLOYMENT_STATUS_CONFIG,
} from '@/types/policy';
import { Customer, TenantGroup } from '@/types/tenant';
import {
  getPolicyTemplate,
  getPolicyDeployments,
  createPolicyDeployment,
  createDeploymentResults,
  getDeploymentResults,
} from '@/lib/policyDatabase';
import { getCustomers, getTenantGroups, getTenantConnectionsByCustomer, getTenantConnectionsByGroup } from '@/lib/customerDatabase';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PolicyDeploymentViewProps {
  templateId?: string;
  onBack?: () => void;
}

export const PolicyDeploymentView = ({ templateId, onBack }: PolicyDeploymentViewProps) => {
  const [template, setTemplate] = useState<PolicyTemplate | null>(null);
  const [deployments, setDeployments] = useState<PolicyDeployment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<TenantGroup[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string; tenantId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<PolicyDeployment | null>(null);
  const [deploymentResults, setDeploymentResults] = useState<DeploymentResult[]>([]);
  
  // Form state
  const [deploymentName, setDeploymentName] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('selected');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [templateId]);

  useEffect(() => {
    if (targetType === 'customer' && selectedCustomerId) {
      loadTenantsForCustomer(selectedCustomerId);
    } else if (targetType === 'group' && selectedGroupId) {
      loadTenantsForGroup(selectedGroupId);
    } else if (targetType === 'all' || targetType === 'selected') {
      loadAllTenants();
    }
  }, [targetType, selectedCustomerId, selectedGroupId]);

  useEffect(() => {
    if (selectedDeployment) {
      loadDeploymentResults(selectedDeployment.id);
    }
  }, [selectedDeployment]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templateData, deploymentsData, customersData] = await Promise.all([
        templateId ? getPolicyTemplate(templateId) : null,
        getPolicyDeployments(templateId ? { templateId } : undefined),
        getCustomers(),
      ]);
      
      setTemplate(templateData);
      setDeployments(deploymentsData);
      setCustomers(customersData);
      
      if (templateData) {
        setDeploymentName(`Deploy ${templateData.name} - ${new Date().toLocaleDateString()}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('tenant_connections')
        .select('id, tenant_name, tenant_id, display_name')
        .eq('user_id', user.id)
        .eq('status', 'connected');

      setTenants((data || []).map(t => ({
        id: t.id,
        name: t.display_name || t.tenant_name || t.tenant_id,
        tenantId: t.tenant_id,
      })));
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const loadTenantsForCustomer = async (customerId: string) => {
    try {
      const data = await getTenantConnectionsByCustomer(customerId);
      setTenants(data.filter(t => t.status === 'connected').map(t => ({
        id: t.id,
        name: t.display_name || t.tenant_name || t.tenant_id,
        tenantId: t.tenant_id,
      })));
      
      const groupsData = await getTenantGroups(customerId);
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load tenants for customer:', error);
    }
  };

  const loadTenantsForGroup = async (groupId: string) => {
    try {
      const data = await getTenantConnectionsByGroup(groupId);
      setTenants(data.filter(t => t.status === 'connected').map(t => ({
        id: t.id,
        name: t.display_name || t.tenant_name || t.tenant_id,
        tenantId: t.tenant_id,
      })));
    } catch (error) {
      console.error('Failed to load tenants for group:', error);
    }
  };

  const loadDeploymentResults = async (deploymentId: string) => {
    try {
      const results = await getDeploymentResults(deploymentId);
      setDeploymentResults(results);
    } catch (error) {
      console.error('Failed to load deployment results:', error);
    }
  };

  const handleDeploy = async () => {
    if (!template) return;

    const targetIds = targetType === 'all' 
      ? tenants.map(t => t.id)
      : targetType === 'customer' || targetType === 'group'
        ? tenants.map(t => t.id)
        : selectedTenantIds;

    if (targetIds.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one tenant', variant: 'destructive' });
      return;
    }

    try {
      setDeploying(true);

      const deployment = await createPolicyDeployment({
        policyTemplateId: template.id,
        name: deploymentName || `Deploy ${template.name}`,
        targetType,
        targetCustomerId: targetType === 'customer' ? selectedCustomerId : undefined,
        targetGroupId: targetType === 'group' ? selectedGroupId : undefined,
        targetTenantIds: targetIds,
        dryRun,
      });

      await createDeploymentResults(deployment.id, targetIds);

      toast({
        title: 'Deployment Created',
        description: dryRun 
          ? 'Dry run deployment created. No changes will be applied.'
          : 'Deployment started. Changes will be applied to selected tenants.',
      });

      loadData();
      setSelectedDeployment(deployment);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create deployment',
        variant: 'destructive',
      });
    } finally {
      setDeploying(false);
    }
  };

  const toggleTenant = (tenantId: string) => {
    setSelectedTenantIds(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const selectAllTenants = () => {
    if (selectedTenantIds.length === tenants.length) {
      setSelectedTenantIds([]);
    } else {
      setSelectedTenantIds(tenants.map(t => t.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {template ? `Deploy: ${template.name}` : 'Policy Deployments'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {template ? 'Deploy this policy template to multiple tenants' : 'Manage and monitor policy deployments'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployment Form */}
        <div className="lg:col-span-2 space-y-6">
          {template && (
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  New Deployment
                </CardTitle>
                <CardDescription>
                  Configure deployment settings and target tenants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Deployment Name */}
                <div className="space-y-2">
                  <Label>Deployment Name</Label>
                  <Input
                    value={deploymentName}
                    onChange={(e) => setDeploymentName(e.target.value)}
                    placeholder="Enter deployment name..."
                    className="bg-secondary/50"
                  />
                </div>

                {/* Target Type */}
                <div className="space-y-2">
                  <Label>Target</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: 'all', label: 'All Tenants', icon: Server },
                      { value: 'customer', label: 'By Customer', icon: Building2 },
                      { value: 'group', label: 'By Group', icon: FolderTree },
                      { value: 'selected', label: 'Select Manually', icon: CheckCircle2 },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setTargetType(option.value as TargetType);
                          setSelectedTenantIds([]);
                        }}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          targetType === option.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <option.icon className={cn("w-5 h-5 mb-1", targetType === option.value ? "text-primary" : "text-muted-foreground")} />
                        <p className="text-sm font-medium">{option.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer/Group Selector */}
                {targetType === 'customer' && (
                  <div className="space-y-2">
                    <Label>Select Customer</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Choose a customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetType === 'group' && selectedCustomerId && (
                  <div className="space-y-2">
                    <Label>Select Group</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Choose a group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tenant Selection */}
                {(targetType === 'selected' || tenants.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Tenants ({targetType === 'selected' ? selectedTenantIds.length : tenants.length} selected)</Label>
                      {targetType === 'selected' && (
                        <Button variant="ghost" size="sm" onClick={selectAllTenants}>
                          {selectedTenantIds.length === tenants.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-lg bg-secondary/30">
                      {tenants.map((tenant) => (
                        <div
                          key={tenant.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg transition-colors",
                            targetType === 'selected' ? "hover:bg-secondary/50 cursor-pointer" : "bg-secondary/50"
                          )}
                          onClick={() => targetType === 'selected' && toggleTenant(tenant.id)}
                        >
                          {targetType === 'selected' && (
                            <Checkbox checked={selectedTenantIds.includes(tenant.id)} />
                          )}
                          <Server className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{tenant.tenantId}</p>
                          </div>
                        </div>
                      ))}
                      {tenants.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No connected tenants found
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Dry Run Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-warning" />
                    <div>
                      <p className="font-medium text-foreground">Dry Run Mode</p>
                      <p className="text-xs text-muted-foreground">
                        Preview changes without applying them
                      </p>
                    </div>
                  </div>
                  <Switch checked={dryRun} onCheckedChange={setDryRun} />
                </div>

                {/* Deploy Button */}
                <Button
                  onClick={handleDeploy}
                  disabled={deploying || (targetType === 'selected' && selectedTenantIds.length === 0)}
                  className="w-full gap-2"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Deployment...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      {dryRun ? 'Start Dry Run' : 'Deploy to Tenants'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Deployment Results */}
          {selectedDeployment && (
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedDeployment.name}</CardTitle>
                    <CardDescription>
                      {selectedDeployment.dryRun ? 'Dry Run' : 'Live Deployment'} • {selectedDeployment.totalTenants} tenants
                    </CardDescription>
                  </div>
                  <Badge className={DEPLOYMENT_STATUS_CONFIG[selectedDeployment.status].color}>
                    {DEPLOYMENT_STATUS_CONFIG[selectedDeployment.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress
                  value={(selectedDeployment.completedTenants / selectedDeployment.totalTenants) * 100}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{selectedDeployment.completedTenants} completed</span>
                  <span>{selectedDeployment.failedTenants} failed</span>
                </div>

                {deploymentResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deploymentResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          {result.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-success" />}
                          {result.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                          {result.status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                          {result.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                          <div>
                            <p className="text-sm font-medium">{result.tenantName || result.tenantId}</p>
                            {result.errorMessage && (
                              <p className="text-xs text-destructive">{result.errorMessage}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {result.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Deployments Sidebar */}
        <div className="space-y-4">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deployments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No deployments yet
                </p>
              ) : (
                deployments.slice(0, 5).map((deployment) => (
                  <button
                    key={deployment.id}
                    onClick={() => setSelectedDeployment(deployment)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all",
                      selectedDeployment?.id === deployment.id
                        ? "bg-primary/10 border border-primary"
                        : "bg-secondary/30 hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground truncate pr-2">
                        {deployment.name}
                      </p>
                      <Badge className={cn("text-xs", DEPLOYMENT_STATUS_CONFIG[deployment.status].color)}>
                        {DEPLOYMENT_STATUS_CONFIG[deployment.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Server className="w-3 h-3" />
                      <span>{deployment.totalTenants} tenants</span>
                      {deployment.dryRun && (
                        <Badge variant="outline" className="text-xs">Dry Run</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {template && (
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Template Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Baseline Type</p>
                  <Badge className={BASELINE_CONFIG[template.baselineType].color}>
                    {BASELINE_CONFIG[template.baselineType].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resource Types</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {template.resourceTypes.map((type) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-sm font-medium">v{template.version}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
