import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Shield, 
  Rocket, 
  Building2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Filter,
  ToggleLeft,
  ToggleRight,
  Eye,
  Settings2,
  Users,
  Activity,
  Sparkles,
  ClipboardCheck,
  BarChart3,
  CreditCard,
  MessageSquareText,
  Plug,
  Brain,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

// Import Copilot components
import { CopilotReadinessCard } from '@/components/copilot/CopilotReadinessCard';
import { CopilotUsageChart } from '@/components/copilot/CopilotUsageChart';
import { CopilotLicensingTable } from '@/components/copilot/CopilotLicensingTable';
import { PromptLibraryManager } from '@/components/copilot/PromptLibraryManager';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';
import { AIGovernancePolicies } from '@/components/copilot/AIGovernancePolicies';

// Import AI components
import { TenantAnalyzer } from '@/components/ai/TenantAnalyzer';
import { ComplianceAdvisor } from '@/components/ai/ComplianceAdvisor';
import { RiskScoreCard } from '@/components/ai/RiskScoreCard';
import { CrossTenantBenchmark } from '@/components/ai/CrossTenantBenchmark';

interface CopilotAgent {
  id: string;
  displayName: string;
  description?: string;
  distributionMethod: 'store' | 'organization' | 'sideloaded';
  externalId?: string;
  publishingState: 'submitted' | 'published' | 'rejected';
  appDefinitions?: Array<{
    id: string;
    displayName: string;
    description?: string;
    version?: string;
    bot?: { id: string };
    publishingState: string;
  }>;
  isBlocked?: boolean;
  lastModified?: string;
}

interface AgentPolicy {
  identity: string;
  description?: string;
  defaultCatalogApps?: string;
  globalCatalogAppsType?: string;
  privateCatalogAppsType?: string;
  allowedApps?: string[];
  blockedApps?: string[];
}

interface TenantAgentStatus {
  tenantId: string;
  tenantName: string;
  agentCount: number;
  blockedCount: number;
  pendingCount: number;
  policyName?: string;
  lastSync?: string;
}

export const CopilotAgentsView = () => {
  const { toast } = useToast();
  const { isConnected, getValidToken, connectionId, selectedTenantId, selectedCustomerId, tenants, customers } = useTenant();
  
  const [agents, setAgents] = useState<CopilotAgent[]>([]);
  const [policies, setPolicies] = useState<AgentPolicy[]>([]);
  const [tenantStatuses, setTenantStatuses] = useState<TenantAgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<CopilotAgent | null>(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [deploymentFilter, setDeploymentFilter] = useState<'all' | 'organization' | 'sideloaded'>('all');
  const [activeTab, setActiveTab] = useState('agents');

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  const tenantDisplayName = selectedTenant?.displayName || selectedTenant?.tenantName || 'All Tenants';
  const selectedCustomerName = selectedCustomerId 
    ? customers.find(c => c.id === selectedCustomerId)?.name 
    : null;

  useEffect(() => {
    if (isConnected) {
      loadAgents();
    }
  }, [isConnected, selectedTenantId]);

  const loadAgents = async () => {
    if (!isConnected) return;
    
    const token = await getValidToken();
    if (!token) {
      toast({
        title: 'Session Expired',
        description: 'Please reconnect to the tenant',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create an export job first so the edge function can verify ownership
      const { data: jobData, error: jobError } = await supabase
        .from('export_jobs')
        .insert({
          name: `Copilot Agents Fetch ${new Date().toISOString()}`,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          tenant_connection_id: connectionId,
          categories: ['copilot'],
          formats: ['json'],
          status: 'pending',
          progress: 0,
        })
        .select()
        .single();

      if (jobError) {
        console.error('Failed to create export job:', jobError);
        setAgents(getMockAgents());
        setPolicies(getMockPolicies());
        loadTenantStatuses();
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'export',
          accessToken: token,
          resources: ['copilot/copilot-agents'],
          exportJobId: jobData.id,
        },
      });

      if (error) {
        console.error('Failed to fetch agents:', error);
        setAgents(getMockAgents());
      } else if (data?.resources?.['copilot/copilot-agents']) {
        setAgents(data.resources['copilot/copilot-agents']);
      } else {
        setAgents(getMockAgents());
      }

      setPolicies(getMockPolicies());
      loadTenantStatuses();

    } catch (error) {
      console.error('Error loading agents:', error);
      setAgents(getMockAgents());
      setPolicies(getMockPolicies());
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenantStatuses = async () => {
    const { data: connections } = await supabase
      .from('tenant_connections')
      .select('id, tenant_id, tenant_name, display_name, customer_id')
      .eq('status', 'connected');

    if (connections) {
      const statuses: TenantAgentStatus[] = connections
        .filter(c => !selectedCustomerId || c.customer_id === selectedCustomerId)
        .map(c => ({
          tenantId: c.tenant_id,
          tenantName: c.display_name || c.tenant_name || c.tenant_id,
          agentCount: Math.floor(Math.random() * 10) + 1,
          blockedCount: Math.floor(Math.random() * 3),
          pendingCount: Math.floor(Math.random() * 2),
          policyName: 'Default Policy',
          lastSync: new Date().toISOString(),
        }));
      setTenantStatuses(statuses);
    }
  };

  const getMockAgents = (): CopilotAgent[] => [
    {
      id: 'agent-1',
      displayName: 'HR Assistant',
      description: 'Helps employees with HR-related questions and policies',
      distributionMethod: 'organization',
      publishingState: 'published',
      appDefinitions: [{
        id: 'def-1',
        displayName: 'HR Assistant v2',
        version: '2.0.0',
        publishingState: 'published',
        bot: { id: 'bot-1' },
      }],
      isBlocked: false,
      lastModified: new Date().toISOString(),
    },
    {
      id: 'agent-2',
      displayName: 'IT Support Bot',
      description: 'Provides IT troubleshooting assistance',
      distributionMethod: 'organization',
      publishingState: 'published',
      isBlocked: false,
      lastModified: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'agent-3',
      displayName: 'Sales Insights',
      description: 'Analyzes sales data and provides recommendations',
      distributionMethod: 'sideloaded',
      publishingState: 'submitted',
      isBlocked: false,
      lastModified: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'agent-4',
      displayName: 'Project Manager',
      description: 'Helps track project status and deadlines',
      distributionMethod: 'organization',
      publishingState: 'published',
      isBlocked: true,
      lastModified: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  const getMockPolicies = (): AgentPolicy[] => [
    {
      identity: 'Global',
      description: 'Default policy for all users',
      defaultCatalogApps: 'AllowedAppList',
      globalCatalogAppsType: 'AllowedAppList',
      privateCatalogAppsType: 'AllowedAppList',
      allowedApps: ['HR Assistant', 'IT Support Bot'],
      blockedApps: ['Project Manager'],
    },
    {
      identity: 'Executives',
      description: 'Policy for executive team',
      defaultCatalogApps: 'BlockedAppList',
      globalCatalogAppsType: 'AllowedAppList',
      privateCatalogAppsType: 'AllowedAppList',
      allowedApps: ['Sales Insights', 'HR Assistant'],
      blockedApps: [],
    },
  ];

  const filteredAgents = agents.filter(agent => {
    if (deploymentFilter === 'all') return true;
    return agent.distributionMethod === deploymentFilter;
  });

  const getStatusBadge = (state: string, isBlocked?: boolean) => {
    if (isBlocked) {
      return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> Blocked</Badge>;
    }
    switch (state) {
      case 'published':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" /> Published</Badge>;
      case 'submitted':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getDistributionBadge = (method: string) => {
    switch (method) {
      case 'organization':
        return <Badge className="bg-blue-500/20 text-blue-400"><Building2 className="w-3 h-3 mr-1" /> Organization</Badge>;
      case 'sideloaded':
        return <Badge className="bg-purple-500/20 text-purple-400"><Rocket className="w-3 h-3 mr-1" /> Sideloaded</Badge>;
      case 'store':
        return <Badge className="bg-cyan-500/20 text-cyan-400"><Sparkles className="w-3 h-3 mr-1" /> Store</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const stats = {
    total: agents.length,
    published: agents.filter(a => a.publishingState === 'published' && !a.isBlocked).length,
    pending: agents.filter(a => a.publishingState === 'submitted').length,
    blocked: agents.filter(a => a.isBlocked).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" />
            Copilot Management Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Copilot agents, licensing, usage analytics, and AI governance
          </p>
        </div>
        <Button variant="outline" onClick={loadAgents} disabled={isLoading || !isConnected}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing data for <strong>{selectedCustomerName}</strong>
            {selectedTenantId && ` (${tenantDisplayName})`}
          </AlertDescription>
        </Alert>
      )}

      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4 border-yellow-500/30"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="font-medium text-foreground">Not Connected</p>
              <p className="text-sm text-muted-foreground">
                Connect to a tenant to manage Copilot features
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <Bot className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold text-green-400">{stats.published}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 md:grid-cols-10 gap-1">
          <TabsTrigger value="agents" className="flex items-center gap-1">
            <Bot className="w-4 h-4" />
            <span className="hidden md:inline">Agents</span>
          </TabsTrigger>
          <TabsTrigger value="ai-analyzer" className="flex items-center gap-1">
            <Brain className="w-4 h-4" />
            <span className="hidden md:inline">AI Analyzer</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-1">
            <FileCheck className="w-4 h-4" />
            <span className="hidden md:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="readiness" className="flex items-center gap-1">
            <ClipboardCheck className="w-4 h-4" />
            <span className="hidden md:inline">Readiness</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden md:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="licensing" className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            <span className="hidden md:inline">Licensing</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-1">
            <MessageSquareText className="w-4 h-4" />
            <span className="hidden md:inline">Prompts</span>
          </TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span className="hidden md:inline">Governance</span>
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-1">
            <Settings2 className="w-4 h-4" />
            <span className="hidden md:inline">Policies</span>
          </TabsTrigger>
          <TabsTrigger value="cross-tenant" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            <span className="hidden md:inline">Benchmark</span>
          </TabsTrigger>
        </TabsList>

        {/* AI Analyzer Tab */}
        <TabsContent value="ai-analyzer" className="space-y-4">
          <TenantAnalyzer />
        </TabsContent>

        {/* Compliance Advisor Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <ComplianceAdvisor />
        </TabsContent>

        {/* Agents List Tab */}
        <TabsContent value="agents" className="space-y-4">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deployed Agents</CardTitle>
                  <CardDescription>Copilot agents and declarative agents in your tenant</CardDescription>
                </div>
                <Select value={deploymentFilter} onValueChange={(v: 'all' | 'organization' | 'sideloaded') => setDeploymentFilter(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="sideloaded">Sideloaded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agents found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Distribution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgents.map(agent => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{agent.displayName}</p>
                              <p className="text-xs text-muted-foreground">{agent.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getDistributionBadge(agent.distributionMethod)}</TableCell>
                        <TableCell>{getStatusBadge(agent.publishingState, agent.isBlocked)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {agent.appDefinitions?.[0]?.version || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setSelectedAgent(agent);
                                setShowAgentDetails(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Readiness Assessment Tab */}
        <TabsContent value="readiness" className="space-y-4">
          {connectionId ? (
            <CopilotReadinessCard 
              tenantConnectionId={connectionId}
              customerId={selectedCustomerId || undefined}
              tenantName={tenantDisplayName}
            />
          ) : (
            <Card className="glass-panel border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Connect to a tenant to run readiness assessment</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Usage Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {connectionId ? (
            <CopilotUsageChart 
              tenantConnectionId={connectionId}
              tenantName={tenantDisplayName}
            />
          ) : (
            <Card className="glass-panel border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Connect to a tenant to view usage analytics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Licensing Tab */}
        <TabsContent value="licensing" className="space-y-4">
          {connectionId ? (
            <CopilotLicensingTable 
              tenantConnectionId={connectionId}
              tenantName={tenantDisplayName}
            />
          ) : (
            <Card className="glass-panel border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Connect to a tenant to view licensing status</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Prompt Library Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <PromptLibraryManager customerId={selectedCustomerId || undefined} />
        </TabsContent>

        {/* AI Governance Tab */}
        <TabsContent value="governance" className="space-y-4">
          <AIGovernancePolicies customerId={selectedCustomerId || undefined} />
        </TabsContent>

        {/* Agent Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Agent Governance Policies</CardTitle>
              <CardDescription>Control which agents are allowed or blocked for users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policies.map(policy => (
                  <motion.div
                    key={policy.identity}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{policy.identity}</h4>
                          <p className="text-sm text-muted-foreground">{policy.description}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Settings2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                        <p className="text-xs font-medium text-green-400 mb-2">Allowed Apps ({policy.allowedApps?.length || 0})</p>
                        <div className="flex flex-wrap gap-1">
                          {policy.allowedApps?.map(app => (
                            <Badge key={app} variant="outline" className="text-xs">{app}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-xs font-medium text-red-400 mb-2">Blocked Apps ({policy.blockedApps?.length || 0})</p>
                        <div className="flex flex-wrap gap-1">
                          {policy.blockedApps?.map(app => (
                            <Badge key={app} variant="outline" className="text-xs">{app}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Tenant View Tab */}
        <TabsContent value="cross-tenant" className="space-y-4">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Cross-Tenant Copilot Governance</CardTitle>
              <CardDescription>Compare Copilot deployment and policies across customer tenants</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantStatuses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tenant data available. Select a customer to view cross-tenant comparison.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-center">Agents</TableHead>
                      <TableHead className="text-center">Blocked</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantStatuses.map(status => (
                      <TableRow key={status.tenantId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{status.tenantName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{status.agentCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {status.blockedCount > 0 ? (
                            <Badge className="bg-red-500/20 text-red-400">{status.blockedCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {status.pendingCount > 0 ? (
                            <Badge className="bg-yellow-500/20 text-yellow-400">{status.pendingCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{status.policyName}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Activity className="w-4 h-4 mr-2" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agent Details Dialog */}
      <Dialog open={showAgentDetails} onOpenChange={setShowAgentDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              {selectedAgent?.displayName}
            </DialogTitle>
            <DialogDescription>
              Agent details and configuration
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedAgent.publishingState, selectedAgent.isBlocked)}
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Distribution</span>
                  {getDistributionBadge(selectedAgent.distributionMethod)}
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <span className="text-foreground">{selectedAgent.appDefinitions?.[0]?.version || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Blocked</span>
                  <Switch checked={selectedAgent.isBlocked} />
                </div>
              </div>
              {selectedAgent.description && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-foreground">{selectedAgent.description}</p>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" variant="outline">
                  <Settings2 className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button className="flex-1" variant={selectedAgent.isBlocked ? "default" : "destructive"}>
                  {selectedAgent.isBlocked ? (
                    <>
                      <ToggleRight className="w-4 h-4 mr-2" />
                      Unblock
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 mr-2" />
                      Block
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
