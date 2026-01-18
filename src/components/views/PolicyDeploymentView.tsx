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
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  updatePolicyDeployment,
} from '@/lib/policyDatabase';
import { getCustomers, getTenantGroups, getTenantConnectionsByCustomer, getTenantConnectionsByGroup } from '@/lib/customerDatabase';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { executeFullDeployment, rollbackFullDeployment, DeploymentChange, getChangeActionBadgeVariant } from '@/lib/deploymentApi';

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
  const [executing, setExecuting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<PolicyDeployment | null>(null);
  const [deploymentResults, setDeploymentResults] = useState<DeploymentResult[]>([]);
  const [executionProgress, setExecutionProgress] = useState({ current: 0, total: 0, tenant: '' });
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [selectedResultChanges, setSelectedResultChanges] = useState<DeploymentChange[]>([]);
  
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
        description: 'Starting deployment execution...',
      });

      setSelectedDeployment(deployment);
      loadData();

      // Start execution
      await handleExecuteDeployment(deployment);

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

  const handleExecuteDeployment = async (deployment: PolicyDeployment) => {
    if (!template) return;

    try {
      setExecuting(true);

      const result = await executeFullDeployment(
        deployment.id,
        template.policyData,
        template.resourceTypes,
        deployment.dryRun,
        (completed, total, tenant) => {
          setExecutionProgress({ current: completed + 1, total, tenant });
        }
      );

      toast({
        title: deployment.dryRun ? 'Dry Run Complete' : 'Deployment Complete',
        description: `${result.completed} succeeded, ${result.failed} failed`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      loadData();
      loadDeploymentResults(deployment.id);

    } catch (error) {
      toast({
        title: 'Execution Error',
        description: error instanceof Error ? error.message : 'Failed to execute deployment',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
      setExecutionProgress({ current: 0, total: 0, tenant: '' });
    }
  };

  const handleRerunDeployment = async () => {
    if (!selectedDeployment || !template) return;

    // Reset deployment status
    await updatePolicyDeployment(selectedDeployment.id, {
      status: 'pending',
      completedTenants: 0,
      failedTenants: 0,
    });

    // Reset all results
    const { data: results } = await supabase
      .from('deployment_results')
      .select('id')
      .eq('deployment_id', selectedDeployment.id);

    if (results) {
      await supabase
        .from('deployment_results')
        .update({ status: 'pending', error_message: null, dry_run_result: null, applied_changes: null })
        .eq('deployment_id', selectedDeployment.id);
    }

    await handleExecuteDeployment(selectedDeployment);
  };

  const handleRollback = async () => {
    if (!selectedDeployment) return;

    // Check if there's rollback data available
    const hasRollbackData = deploymentResults.some(r => 
      r.rollbackData && Array.isArray(r.rollbackData) && r.rollbackData.length > 0
    );
    
    if (!hasRollbackData) {
      toast({
        title: 'No Rollback Data',
        description: 'This deployment has no changes that can be rolled back.',
        variant: 'destructive',
      });
      return;
    }

    setShowRollbackDialog(false);

    try {
      setRollingBack(true);

      const result = await rollbackFullDeployment(
        selectedDeployment.id,
        (completed, total, tenant) => {
          setExecutionProgress({ current: completed + 1, total, tenant });
        }
      );

      toast({
        title: 'Rollback Complete',
        description: `${result.completed} restored, ${result.failed} failed`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      loadData();
      loadDeploymentResults(selectedDeployment.id);

    } catch (error) {
      toast({
        title: 'Rollback Error',
        description: error instanceof Error ? error.message : 'Failed to rollback deployment',
        variant: 'destructive',
      });
    } finally {
      setRollingBack(false);
      setExecutionProgress({ current: 0, total: 0, tenant: '' });
    }
  };

  const canRollback = selectedDeployment && 
    !selectedDeployment.dryRun && 
    selectedDeployment.status === 'completed' &&
    deploymentResults.some(r => r.rollbackData && Array.isArray(r.rollbackData) && r.rollbackData.length > 0);

  const viewResultChanges = (result: DeploymentResult) => {
    const changes = (result.dryRunResult?.changes || result.appliedChanges?.changes || []) as DeploymentChange[];
    setSelectedResultChanges(changes);
    setShowChangesDialog(true);
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

          {/* Execution Progress */}
          {(executing || rollingBack) && (
            <Card className={cn("glass-panel", rollingBack ? "border-warning" : "border-primary")}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Loader2 className={cn("w-8 h-8 animate-spin", rollingBack ? "text-warning" : "text-primary")} />
                  <div>
                    <h3 className="font-semibold">
                      {rollingBack ? 'Rolling Back Deployment...' : 'Executing Deployment...'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Processing: {executionProgress.tenant}
                    </p>
                  </div>
                </div>
                <Progress value={(executionProgress.current / executionProgress.total) * 100} />
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {executionProgress.current} of {executionProgress.total} tenants
                </p>
              </CardContent>
            </Card>
          )}

          {/* Deployment Results */}
          {selectedDeployment && !executing && !rollingBack && (
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedDeployment.name}</CardTitle>
                    <CardDescription>
                      {selectedDeployment.dryRun ? 'Dry Run' : 'Live Deployment'} • {selectedDeployment.totalTenants} tenants
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={DEPLOYMENT_STATUS_CONFIG[selectedDeployment.status].color}>
                      {DEPLOYMENT_STATUS_CONFIG[selectedDeployment.status].label}
                    </Badge>
                    {canRollback && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowRollbackDialog(true)}
                        className="text-warning border-warning hover:bg-warning/10"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Rollback
                      </Button>
                    )}
                    {(selectedDeployment.status === 'completed' || selectedDeployment.status === 'failed') && (
                      <Button variant="outline" size="sm" onClick={handleRerunDeployment}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Rerun
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress
                  value={((selectedDeployment.completedTenants + selectedDeployment.failedTenants) / selectedDeployment.totalTenants) * 100}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="text-green-500">{selectedDeployment.completedTenants} completed</span>
                  <span className="text-red-500">{selectedDeployment.failedTenants} failed</span>
                </div>

                {deploymentResults.length > 0 && (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {deploymentResults.map((result) => {
                        const hasChanges = result.dryRunResult || result.appliedChanges;
                        const summary = (result.dryRunResult?.summary || result.appliedChanges?.summary) as { create?: number; update?: number; skip?: number } | undefined;
                        
                        return (
                          <div
                            key={result.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {result.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                              {result.status === 'failed' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                              {result.status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
                              {result.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{result.tenantName || result.tenantId}</p>
                                {result.errorMessage && (
                                  <p className="text-xs text-destructive truncate">{result.errorMessage}</p>
                                )}
                                {summary && (
                                  <div className="flex gap-2 text-xs mt-1">
                                    {(summary.create ?? 0) > 0 && (
                                      <span className="text-green-500 flex items-center gap-0.5">
                                        <Plus className="w-3 h-3" />{summary.create}
                                      </span>
                                    )}
                                    {(summary.update ?? 0) > 0 && (
                                      <span className="text-blue-500 flex items-center gap-0.5">
                                        <RefreshCw className="w-3 h-3" />{summary.update}
                                      </span>
                                    )}
                                    {(summary.skip ?? 0) > 0 && (
                                      <span className="text-muted-foreground flex items-center gap-0.5">
                                        <Minus className="w-3 h-3" />{summary.skip}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasChanges && (
                                <Button variant="ghost" size="sm" onClick={() => viewResultChanges(result)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {result.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
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

      {/* Changes Dialog */}
      <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Policy Changes</DialogTitle>
            <DialogDescription>
              {selectedResultChanges.length} change(s) detected
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {selectedResultChanges.map((change, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getChangeActionBadgeVariant(change.action)}>
                      {change.action.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{change.resourceName || change.resourceId}</span>
                    <Badge variant="outline" className="text-xs">
                      {change.resourceType}
                    </Badge>
                  </div>
                  {change.reason && (
                    <p className="text-sm text-muted-foreground mb-2">{change.reason}</p>
                  )}
                  {(change.action === 'create' || change.action === 'update') && change.newValue && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View configuration
                      </summary>
                      <pre className="mt-2 p-2 rounded bg-secondary overflow-x-auto">
                        {JSON.stringify(change.newValue, null, 2)}
                      </pre>
                    </details>
                  )}
                  {change.action === 'update' && change.currentValue && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View current value
                      </summary>
                      <pre className="mt-2 p-2 rounded bg-secondary overflow-x-auto">
                        {JSON.stringify(change.currentValue, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
              {selectedResultChanges.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No changes to display</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Rollback
            </DialogTitle>
            <DialogDescription>
              This will restore the original configurations for all updated policies. 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 my-4">
            <p className="text-sm text-muted-foreground">
              <strong>{deploymentResults.filter(r => r.rollbackData && Array.isArray(r.rollbackData) && r.rollbackData.length > 0).length}</strong> tenant(s) 
              have changes that can be rolled back.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRollback}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Rollback Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
