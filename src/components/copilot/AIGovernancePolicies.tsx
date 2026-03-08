import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Plus, 
  Settings2, 
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  getGovernancePolicies, 
  createGovernancePolicy, 
  updateGovernancePolicy,
  deleteGovernancePolicy, 
  AIGovernancePolicy 
} from '@/lib/copilotApi';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AIGovernancePoliciesProps {
  customerId?: string;
}

const POLICY_TYPES = [
  { value: 'data-access', label: 'Data Access Control', description: 'Control what data Copilot can access' },
  { value: 'usage-restriction', label: 'Usage Restrictions', description: 'Restrict Copilot usage by department or role' },
  { value: 'content-filtering', label: 'Content Filtering', description: 'Filter sensitive content in responses' },
  { value: 'audit-logging', label: 'Audit & Logging', description: 'Enhanced logging for compliance' },
  { value: 'app-restriction', label: 'App Restrictions', description: 'Control which apps can use Copilot' },
];

const ENFORCEMENT_LEVELS = [
  { value: 'audit', label: 'Audit Only', description: 'Log violations but don\'t block' },
  { value: 'warn', label: 'Warn', description: 'Show warning but allow action' },
  { value: 'block', label: 'Block', description: 'Block violating actions' },
];

export const AIGovernancePolicies = ({ customerId }: AIGovernancePoliciesProps) => {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<AIGovernancePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AIGovernancePolicy | null>(null);
  
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    description: '',
    policyType: 'data-access',
    isActive: true,
    settings: {} as Record<string, any>,
    targetType: 'all_tenants',
    targetTenantIds: [] as string[],
    enforcementLevel: 'audit',
  });

  useEffect(() => {
    loadPolicies();
  }, [customerId]);

  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const data = await getGovernancePolicies(customerId);
      setPolicies(data);
    } catch (error) {
      console.error('Failed to load policies:', error);
      toast({ title: 'Failed to load policies', description: 'Please try again', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePolicy = async () => {
    if (!newPolicy.name) {
      toast({
        title: 'Validation Error',
        description: 'Policy name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createGovernancePolicy(newPolicy, customerId);
      toast({
        title: 'Policy Created',
        description: 'Your governance policy has been created',
      });
      setShowCreateDialog(false);
      resetForm();
      loadPolicies();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create policy',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePolicy = async (policy: AIGovernancePolicy) => {
    try {
      await updateGovernancePolicy(policy.id, { isActive: !policy.isActive });
      toast({
        title: policy.isActive ? 'Policy Disabled' : 'Policy Enabled',
      });
      loadPolicies();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update policy',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await deleteGovernancePolicy(policyId);
      toast({
        title: 'Policy Deleted',
      });
      loadPolicies();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete policy',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setNewPolicy({
      name: '',
      description: '',
      policyType: 'data-access',
      isActive: true,
      settings: {},
      targetType: 'all_tenants',
      targetTenantIds: [],
      enforcementLevel: 'audit',
    });
  };

  const getPolicyTypeInfo = (type: string) => {
    return POLICY_TYPES.find(t => t.value === type);
  };

  const getEnforcementBadge = (level: string) => {
    switch (level) {
      case 'block':
        return <Badge className="bg-red-500/20 text-red-400">Block</Badge>;
      case 'warn':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Warn</Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-400">Audit</Badge>;
    }
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              AI Governance Policies
            </CardTitle>
            <CardDescription>
              Define organization-wide AI usage policies and compliance rules
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading policies...</div>
          ) : policies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No governance policies configured</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                Create your first policy
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => (
                <motion.div
                  key={policy.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        policy.isActive ? 'bg-primary/20' : 'bg-muted/50'
                      }`}>
                        <Shield className={`w-5 h-5 ${policy.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{policy.name}</h4>
                          {policy.isActive ? (
                            <Badge className="bg-green-500/20 text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {policy.description || getPolicyTypeInfo(policy.policyType)?.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="capitalize">
                            {getPolicyTypeInfo(policy.policyType)?.label || policy.policyType}
                          </Badge>
                          {getEnforcementBadge(policy.enforcementLevel)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {policy.targetType === 'all_tenants' ? 'All Tenants' : `${policy.targetTenantIds.length} Tenants`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleTogglePolicy(policy)}
                      >
                        {policy.isActive ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => handleDeletePolicy(policy.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {policy.violationsCount > 0 && (
                    <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-400">{policy.violationsCount} violations detected</span>
                      {policy.lastEnforcedAt && (
                        <span className="text-muted-foreground ml-auto">
                          Last checked: {format(policy.lastEnforcedAt, 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Create Policy Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Governance Policy</DialogTitle>
              <DialogDescription>
                Define rules and restrictions for AI usage in your organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Policy Name</Label>
                <Input
                  placeholder="E.g., Restrict Copilot for Finance"
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Describe what this policy does..."
                  value={newPolicy.description}
                  onChange={(e) => setNewPolicy(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div>
                <Label>Policy Type</Label>
                <Select
                  value={newPolicy.policyType}
                  onValueChange={(v) => setNewPolicy(prev => ({ ...prev, policyType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Enforcement Level</Label>
                <Select
                  value={newPolicy.enforcementLevel}
                  onValueChange={(v) => setNewPolicy(prev => ({ ...prev, enforcementLevel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENFORCEMENT_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div>
                          <div className="font-medium">{level.label}</div>
                          <div className="text-xs text-muted-foreground">{level.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Scope</Label>
                <Select
                  value={newPolicy.targetType}
                  onValueChange={(v) => setNewPolicy(prev => ({ ...prev, targetType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_tenants">All Tenants</SelectItem>
                    <SelectItem value="specific_tenants">Specific Tenants</SelectItem>
                    <SelectItem value="tenant_group">Tenant Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newPolicy.isActive}
                    onCheckedChange={(checked) => setNewPolicy(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label>Enable policy immediately</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreatePolicy}>Create Policy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
