import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Lock,
  Laptop,
  Settings,
  FileJson,
  FileCode,
  Terminal,
  Download,
  Loader2,
  Search,
  Filter,
  Check,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Eye,
  CheckSquare,
  Square,
  Building2,
  FileText,
  FolderOpen,
  Cloud,
  History,
  Upload,
  Mail,
  MessageSquare,
  Users,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  downloadBlobFallback,
  isFileSystemAccessSupported,
  promptSaveFileHandle,
  writeBlobToHandle,
  buildExportFilename,
} from '@/lib/saveFile';
import { PolicyDeployDialog } from '@/components/PolicyDeployDialog';
import type { PolicyItem as DeployPolicyItem } from '@/lib/policyDeployment';

// Policy categories with their Graph API endpoints
const POLICY_CATEGORIES = [
  {
    id: 'conditional-access',
    name: 'Conditional Access',
    icon: Lock,
    color: 'text-blue-500',
    policies: [
      { id: 'ca-policies', name: 'CA Policies', endpoint: '/identity/conditionalAccess/policies' },
      { id: 'named-locations', name: 'Named Locations', endpoint: '/identity/conditionalAccess/namedLocations' },
      { id: 'auth-contexts', name: 'Auth Contexts', endpoint: '/identity/conditionalAccess/authenticationContextClassReferences' },
      { id: 'auth-strengths', name: 'Auth Strengths', endpoint: '/identity/conditionalAccess/authenticationStrengths/policies' },
    ],
  },
  {
    id: 'intune',
    name: 'Intune / Endpoint',
    icon: Laptop,
    color: 'text-green-500',
    policies: [
      { id: 'device-configurations', name: 'Device Configurations', endpoint: '/deviceManagement/deviceConfigurations' },
      { id: 'compliance-policies', name: 'Compliance Policies', endpoint: '/deviceManagement/deviceCompliancePolicies' },
      { id: 'app-configurations', name: 'App Configuration Policies', endpoint: '/deviceAppManagement/mobileAppConfigurations' },
      { id: 'autopilot', name: 'Autopilot Profiles', endpoint: '/deviceManagement/windowsAutopilotDeploymentProfiles' },
      { id: 'enrollment-restrictions', name: 'Enrollment Restrictions', endpoint: '/deviceManagement/deviceEnrollmentConfigurations' },
      { id: 'scripts', name: 'PowerShell Scripts', endpoint: '/deviceManagement/deviceManagementScripts' },
      { id: 'win32-apps', name: 'Win32 Applications', endpoint: '/deviceAppManagement/mobileApps' },
      { id: 'update-rings', name: 'Update Rings', endpoint: '/deviceManagement/deviceConfigurations' },
    ],
  },
  {
    id: 'defender',
    name: 'Defender',
    icon: ShieldCheck,
    color: 'text-red-500',
    policies: [
      { id: 'security-baselines', name: 'Security Baselines', endpoint: '/deviceManagement/configurationPolicies', useBeta: true },
      { id: 'asr-policies', name: 'ASR Policies', endpoint: '/deviceManagement/configurationPolicies', useBeta: true },
      { id: 'antivirus-policies', name: 'Antivirus Policies', endpoint: '/deviceManagement/configurationPolicies', useBeta: true },
      { id: 'firewall-policies', name: 'Firewall Policies', endpoint: '/deviceManagement/configurationPolicies', useBeta: true },
      { id: 'edr-policies', name: 'EDR Policies', endpoint: '/deviceManagement/configurationPolicies', useBeta: true },
    ],
  },
  {
    id: 'entra-id',
    name: 'Entra ID',
    icon: Users,
    color: 'text-purple-500',
    policies: [
      { id: 'groups', name: 'Groups', endpoint: '/groups' },
      { id: 'app-registrations', name: 'App Registrations', endpoint: '/applications' },
      { id: 'enterprise-apps', name: 'Enterprise Applications', endpoint: '/servicePrincipals' },
      { id: 'admin-units', name: 'Admin Units', endpoint: '/administrativeUnits' },
      { id: 'roles', name: 'Directory Roles', endpoint: '/directoryRoles' },
      { id: 'directory-settings', name: 'Directory Settings', endpoint: '/groupSettings' },
      { id: 'auth-methods-policy', name: 'Auth Methods Policy', endpoint: '/policies/authenticationMethodsPolicy' },
      { id: 'cross-tenant-access', name: 'Cross-Tenant Access', endpoint: '/policies/crossTenantAccessPolicy' },
      { id: 'permission-grant-policies', name: 'Permission Grant Policies', endpoint: '/policies/permissionGrantPolicies' },
    ],
  },
  {
    id: 'exchange',
    name: 'Exchange Online',
    icon: Mail,
    color: 'text-yellow-500',
    policies: [
      { id: 'transport-rules', name: 'Transport Rules', endpoint: '', isExo: true },
      { id: 'connectors', name: 'Connectors', endpoint: '', isExo: true },
      { id: 'accepted-domains', name: 'Accepted Domains', endpoint: '/domains' },
      { id: 'anti-spam', name: 'Anti-Spam Policies', endpoint: '', isExo: true },
      { id: 'anti-phishing', name: 'Anti-Phishing Policies', endpoint: '', isExo: true },
      { id: 'anti-malware', name: 'Anti-Malware Policies', endpoint: '', isExo: true },
      { id: 'safe-links', name: 'Safe Links Policies', endpoint: '', isExo: true },
      { id: 'safe-attachments', name: 'Safe Attachments Policies', endpoint: '', isExo: true },
      { id: 'dlp-policies', name: 'DLP Policies', endpoint: '', isExo: true },
      { id: 'org-config', name: 'Organization Config', endpoint: '', isExo: true },
      { id: 'owa-policies', name: 'OWA Mailbox Policies', endpoint: '', isExo: true },
      { id: 'mobile-device-policies', name: 'Mobile Device Policies', endpoint: '', isExo: true },
      { id: 'retention-policies', name: 'Retention Policies', endpoint: '', isExo: true },
      { id: 'mailbox-policies', name: 'Mailbox Policies', endpoint: '', isExo: true },
    ],
  },
  {
    id: 'purview',
    name: 'Microsoft Purview',
    icon: Eye,
    color: 'text-teal-500',
    policies: [
      { id: 'sensitivity-labels', name: 'Sensitivity Labels', endpoint: '/security/informationProtection/sensitivityLabels', useBeta: true },
      { id: 'retention-policies', name: 'Retention Labels', endpoint: '/security/labels/retentionLabels', useBeta: true },
    ],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: MessageSquare,
    color: 'text-indigo-500',
    policies: [
      { id: 'app-policies', name: 'App Permission Policies', endpoint: '/appCatalogs/teamsApps' },
      { id: 'guest-policies', name: 'Guest Access Settings', endpoint: '/teamwork/teamSettings', useBeta: true },
      { id: 'external-access', name: 'External Access Settings', endpoint: '/teamwork/teamSettings', useBeta: true },
    ],
  },
];

interface PolicyItem {
  id: string;
  displayName: string;
  description?: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  state?: string;
  data: Record<string, unknown>;
}

interface LoadedCategory {
  categoryId: string;
  policyTypeId: string;
  policies: PolicyItem[];
  loading: boolean;
  error?: string;
}

interface ExportJob {
  id: string;
  name: string;
  created_at: string;
  status: string;
  tenant_connection_id: string | null;
  categories: string[];
  tenant_connection?: {
    display_name?: string;
    tenant_name?: string;
    customer?: {
      name: string;
    };
  } | null;
}

type ExportFormat = 'json' | 'terraform' | 'bicep' | 'powershell';
type DataSource = 'live' | 'export';

const EXPORT_FORMATS: { id: ExportFormat; name: string; icon: React.ElementType; description: string }[] = [
  { id: 'json', name: 'JSON', icon: FileJson, description: 'Raw Graph API export' },
  { id: 'terraform', name: 'Terraform', icon: FileCode, description: 'HashiCorp HCL format' },
  { id: 'bicep', name: 'Bicep', icon: FileCode, description: 'Azure native IaC' },
  { id: 'powershell', name: 'PowerShell', icon: Terminal, description: 'Executable scripts' },
];

export const PolicyBrowserView = () => {
  const { selectedTenantId, tenants, isConnected, tenantName, accessToken, connectionId } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  const displayTenantName = tenantName || selectedTenant?.displayName || selectedTenant?.tenantName;
  // Customer name will come from loaded export source info or we'll fetch it separately

  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [selectedExportJobId, setSelectedExportJobId] = useState<string | null>(null);
  const [loadingExportJobs, setLoadingExportJobs] = useState(false);
  const [loadingFromExport, setLoadingFromExport] = useState(false);
  
  const [loadedCategories, setLoadedCategories] = useState<LoadedCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedPolicies, setSelectedPolicies] = useState<Map<string, PolicyItem>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewPolicy, setPreviewPolicy] = useState<PolicyItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Export state
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(['json']));
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Cross-tenant warning state
  const [pendingExportJobId, setPendingExportJobId] = useState<string | null>(null);
  const [crossTenantWarningOpen, setCrossTenantWarningOpen] = useState(false);
  const [loadedExportSourceInfo, setLoadedExportSourceInfo] = useState<{
    tenantName: string;
    customerName?: string;
    tenantConnectionId: string | null;
  } | null>(null);
  
  // Export confirmation dialog state
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  
  // Deploy dialog state
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  
  const { toast } = useToast();

  // Check if the selected export is from a different tenant
  const getExportSourceInfo = (jobId: string) => {
    const job = exportJobs.find(j => j.id === jobId);
    if (!job) return null;
    
    const customerName = job.tenant_connection?.customer?.name;
    const tenantName = job.tenant_connection?.display_name || job.tenant_connection?.tenant_name || 'Unknown Tenant';
    
    return {
      tenantName,
      customerName,
      tenantConnectionId: job.tenant_connection_id,
    };
  };

  const isCrossTenantExport = (jobId: string) => {
    const job = exportJobs.find(j => j.id === jobId);
    if (!job || !selectedTenantId) return false;
    return job.tenant_connection_id !== selectedTenantId;
  };

  // Fetch available export jobs
  useEffect(() => {
    const fetchExportJobs = async () => {
      setLoadingExportJobs(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('export_jobs')
          .select(`
            id, 
            name, 
            created_at, 
            status, 
            tenant_connection_id, 
            categories,
            tenant_connections:tenant_connection_id (
              display_name,
              tenant_name,
              customers:customer_id (
                name
              )
            )
          `)
          .eq('user_id', session.user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        
        // Transform the data to match our interface
        const transformedData: ExportJob[] = (data || []).map(job => ({
          id: job.id,
          name: job.name,
          created_at: job.created_at,
          status: job.status,
          tenant_connection_id: job.tenant_connection_id,
          categories: job.categories,
          tenant_connection: job.tenant_connections as ExportJob['tenant_connection'],
        }));
        
        setExportJobs(transformedData);
      } catch (err) {
        console.error('Failed to fetch export jobs:', err);
      } finally {
        setLoadingExportJobs(false);
      }
    };

    fetchExportJobs();
  }, []);

  // Load policies from an export job
  const loadFromExportJob = async (jobId: string) => {
    setLoadingFromExport(true);
    setLoadedCategories([]);
    setSelectedPolicies(new Map());
    setExpandedCategories(new Set());

    try {
      const { data: resources, error } = await supabase
        .from('exported_resources')
        .select('*')
        .eq('export_job_id', jobId);

      if (error) throw error;
      if (!resources || resources.length === 0) {
        toast({
          title: 'No resources found',
          description: 'This export does not contain any policy resources',
          variant: 'destructive',
        });
        return;
      }

      // Group resources by category/type
      const grouped: Record<string, LoadedCategory> = {};

      for (const resource of resources) {
        const categoryId = resource.category;
        const policyTypeId = resource.resource_type;
        const key = `${categoryId}/${policyTypeId}`;

        if (!grouped[key]) {
          grouped[key] = {
            categoryId,
            policyTypeId,
            policies: [],
            loading: false,
          };
        }

        const rawData = resource.data;
        
        // Handle array of policies (most common case from Graph API exports)
        if (Array.isArray(rawData)) {
          for (const item of rawData) {
            const data = item as Record<string, unknown>;
            grouped[key].policies.push({
              id: (data.id as string) || `${resource.id}-${grouped[key].policies.length}`,
              displayName: (data.displayName as string) || (data.name as string) || (data.id as string) || 'Unnamed Policy',
              description: data.description as string | undefined,
              createdDateTime: data.createdDateTime as string | undefined,
              modifiedDateTime: (data.modifiedDateTime as string) || (data.lastModifiedDateTime as string) || undefined,
              state: data.state as string | undefined,
              data,
            });
          }
        } 
        // Handle single object (less common)
        else if (rawData && typeof rawData === 'object') {
          const data = rawData as Record<string, unknown>;
          grouped[key].policies.push({
            id: resource.resource_id || resource.id,
            displayName: resource.resource_name || (data.displayName as string) || (data.name as string) || resource.id,
            description: data.description as string | undefined,
            createdDateTime: data.createdDateTime as string | undefined,
            modifiedDateTime: data.modifiedDateTime as string | undefined,
            state: data.state as string | undefined,
            data,
          });
        }
      }

      setLoadedCategories(Object.values(grouped));
      
      // Auto-expand categories that have loaded data
      const categoriesToExpand = new Set<string>();
      Object.values(grouped).forEach(cat => categoriesToExpand.add(cat.categoryId));
      setExpandedCategories(categoriesToExpand);

      toast({
        title: 'Export loaded',
        description: `Loaded ${resources.length} resources from export`,
      });
    } catch (err) {
      console.error('Failed to load export:', err);
      toast({
        title: 'Failed to load export',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingFromExport(false);
    }
  };

  // Handle data source change
  const handleDataSourceChange = (source: DataSource) => {
    setDataSource(source);
    setLoadedCategories([]);
    setSelectedPolicies(new Map());
    setExpandedCategories(new Set());
    setSelectedExportJobId(null);
  };

  const fetchPolicies = async (categoryId: string, policyTypeId: string, endpoint: string, useBeta = false, isExo = false) => {
    if (!selectedTenantId) return;
    // EXO policies need connectionId, Graph policies need accessToken
    if (!isExo && !accessToken) return;
    if (isExo && !connectionId) return;

    const key = `${categoryId}/${policyTypeId}`;
    
    // Mark as loading
    setLoadedCategories(prev => {
      const existing = prev.find(c => c.categoryId === categoryId && c.policyTypeId === policyTypeId);
      if (existing) {
        return prev.map(c => 
          c.categoryId === categoryId && c.policyTypeId === policyTypeId 
            ? { ...c, loading: true, error: undefined } 
            : c
        );
      }
      return [...prev, { categoryId, policyTypeId, policies: [], loading: true }];
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let policies: PolicyItem[] = [];

      if (isExo) {
        // Route through email-security edge function
        const exoAction = `fetch-${policyTypeId}`;
        const response = await supabase.functions.invoke('email-security', {
          body: {
            action: exoAction,
            tenantConnectionId: connectionId,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to fetch EXO policies');
        }

        const items = response.data?.data ?? response.data;
        if (Array.isArray(items)) {
          for (const item of items) {
            policies.push({
              id: item.id || `exo-${policies.length}`,
              displayName: item.displayName || item.name || item.Name || 'Unnamed Policy',
              description: item.description || item.adminDisplayName || undefined,
              state: item.isEnabled === false ? 'disabled' : item.isEnabled === true ? 'enabled' : undefined,
              data: item.rawData || item,
            });
          }
        }
      } else {
        // Route through graph-api edge function
        const response = await supabase.functions.invoke('graph-api', {
          body: {
            action: 'fetch',
            accessToken,
            resources: [`${categoryId}/${policyTypeId}`],
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to fetch policies');
        }

        const results = response.data?.results || [];
        
        for (const result of results) {
          if (result.success && result.data?.value) {
            for (const item of result.data.value) {
              policies.push({
                id: item.id,
                displayName: item.displayName || item.name || item.id,
                description: item.description,
                createdDateTime: item.createdDateTime,
                modifiedDateTime: item.modifiedDateTime || item.lastModifiedDateTime,
                state: item.state,
                data: item,
              });
            }
          } else if (result.success && result.data && !result.data.value) {
            // Single object response
            const item = result.data;
            if (item.id) {
              policies.push({
                id: item.id,
                displayName: item.displayName || item.name || item.id,
                description: item.description,
                createdDateTime: item.createdDateTime,
                modifiedDateTime: item.modifiedDateTime,
                state: item.state,
                data: item,
              });
            }
          }
        }
      }

      setLoadedCategories(prev => 
        prev.map(c => 
          c.categoryId === categoryId && c.policyTypeId === policyTypeId 
            ? { ...c, policies, loading: false } 
            : c
        )
      );
    } catch (error) {
      console.error('Failed to fetch policies:', error);
      setLoadedCategories(prev => 
        prev.map(c => 
          c.categoryId === categoryId && c.policyTypeId === policyTypeId 
            ? { ...c, loading: false, error: error instanceof Error ? error.message : 'Failed to fetch' } 
            : c
        )
      );
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
      // Auto-load policies when expanding (only for live mode)
      if (dataSource === 'live') {
        const category = POLICY_CATEGORIES.find(c => c.id === categoryId);
        if (category) {
          for (const policyType of category.policies) {
            const existing = loadedCategories.find(
              c => c.categoryId === categoryId && c.policyTypeId === policyType.id
            );
            if (!existing) {
              fetchPolicies(categoryId, policyType.id, policyType.endpoint);
            }
          }
        }
      }
    }
    setExpandedCategories(newExpanded);
  };

  const togglePolicySelection = (policy: PolicyItem, categoryId: string, policyTypeId: string) => {
    const key = `${categoryId}/${policyTypeId}/${policy.id}`;
    const newSelected = new Map(selectedPolicies);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.set(key, policy);
    }
    setSelectedPolicies(newSelected);
  };

  const selectAllInCategory = (categoryId: string, policyTypeId: string) => {
    const policies = loadedCategories.find(
      c => c.categoryId === categoryId && c.policyTypeId === policyTypeId
    )?.policies || [];
    
    const newSelected = new Map(selectedPolicies);
    for (const policy of policies) {
      const key = `${categoryId}/${policyTypeId}/${policy.id}`;
      newSelected.set(key, policy);
    }
    setSelectedPolicies(newSelected);
  };

  const deselectAllInCategory = (categoryId: string, policyTypeId: string) => {
    const newSelected = new Map(selectedPolicies);
    for (const [key] of newSelected) {
      if (key.startsWith(`${categoryId}/${policyTypeId}/`)) {
        newSelected.delete(key);
      }
    }
    setSelectedPolicies(newSelected);
  };

  const toggleFormat = (format: ExportFormat) => {
    const newFormats = new Set(selectedFormats);
    if (newFormats.has(format)) {
      if (newFormats.size > 1) {
        newFormats.delete(format);
      }
    } else {
      newFormats.add(format);
    }
    setSelectedFormats(newFormats);
  };

  // Show confirmation dialog before export
  const handleExportClick = () => {
    if (selectedPolicies.size === 0) {
      toast({
        title: 'No policies selected',
        description: 'Select at least one policy to export',
        variant: 'destructive',
      });
      return;
    }
    setExportConfirmOpen(true);
  };

  const handleExport = async () => {
    setExportConfirmOpen(false);

    setExporting(true);
    setExportProgress(0);

    try {
      // Build smart filename with customer/tenant name and timestamp
      const sourceCustomerName = loadedExportSourceInfo?.customerName;
      const sourceTenantName = loadedExportSourceInfo?.tenantName || displayTenantName;
      const defaultZipFilename = buildExportFilename(
        sourceCustomerName,
        sourceTenantName,
        'm365-policies'
      );

      // IMPORTANT: Prompt the save dialog immediately (user activation), before any long async work.
      // This avoids browsers blocking the picker and helps prevent incomplete .crdownload files.
      let saveHandle: FileSystemFileHandle | null = null;
      if (isFileSystemAccessSupported()) {
        try {
          saveHandle = await promptSaveFileHandle({
            suggestedName: defaultZipFilename,
            types: [
              {
                description: 'ZIP Archive',
                accept: { 'application/zip': ['.zip'] },
              },
            ],
          });
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setExporting(false);
            return;
          }
          // If the picker fails for any other reason, continue with fallback download.
          saveHandle = null;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Group policies by category/type for export
      const groupedPolicies: Record<string, { categoryId: string; policyTypeId: string; policies: PolicyItem[] }> = {};
      
      for (const [key, policy] of selectedPolicies) {
        const [categoryId, policyTypeId] = key.split('/');
        const groupKey = `${categoryId}/${policyTypeId}`;
        if (!groupedPolicies[groupKey]) {
          groupedPolicies[groupKey] = { categoryId, policyTypeId, policies: [] };
        }
        groupedPolicies[groupKey].policies.push(policy);
      }

      const formats = Array.from(selectedFormats);
      const exportData: Record<string, { filename: string; content: string }> = {};
      let processed = 0;
      const total = Object.keys(groupedPolicies).length * formats.length;

      for (const [groupKey, { categoryId, policyTypeId, policies }] of Object.entries(groupedPolicies)) {
        for (const format of formats) {
          if (format === 'json') {
            // JSON is just the raw data
            exportData[`${groupKey}_${format}`] = {
              filename: `${categoryId}_${policyTypeId}.json`,
              content: JSON.stringify(policies.map(p => p.data), null, 2),
            };
          } else {
            // Convert using the convert-format edge function
            try {
              const response = await supabase.functions.invoke('convert-format', {
                body: {
                  data: policies.map(p => p.data),
                  resourceType: `${categoryId}/${policyTypeId}`,
                  format,
                },
              });

              if (response.data?.output) {
                const ext = format === 'terraform' ? 'tf' : format === 'bicep' ? 'bicep' : 'ps1';
                exportData[`${groupKey}_${format}`] = {
                  filename: `${categoryId}_${policyTypeId}.${ext}`,
                  content: response.data.output,
                };
              }
            } catch (err) {
              console.error(`Failed to convert ${groupKey} to ${format}:`, err);
            }
          }

          processed++;
          setExportProgress(Math.round((processed / total) * 100));
        }
      }

      // Create ZIP file using static imports
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default;
      const zip = new JSZip();
      
      // Add README with source info
      const readmeContent = `# M365 Policy Export
Export Date: ${new Date().toISOString()}
${sourceCustomerName ? `Customer: ${sourceCustomerName}` : ''}
Tenant: ${sourceTenantName || 'Unknown'}
Policies: ${selectedPolicies.size}
Formats: ${formats.join(', ')}
Source: ${dataSource === 'export' ? 'Previous Export' : 'Live Tenant'}
`;
      zip.file('README.md', readmeContent);

      // Add files organized by format
      for (const [key, { filename, content }] of Object.entries(exportData)) {
        const format = key.split('_').pop();
        const folder = zip.folder(format);
        if (folder && content) {
          folder.file(filename, content);
        }
      }

      // Generate blob and trigger download with save dialog
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      if (saveHandle) {
        await writeBlobToHandle(saveHandle, blob);
      } else {
        downloadBlobFallback(blob, defaultZipFilename);
      }

      toast({
        title: 'Export complete',
        description: `Exported ${selectedPolicies.size} policies to ${formats.length} format(s)`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export policies',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportSingle = async (policy: PolicyItem, categoryId: string, policyTypeId: string, format: ExportFormat) => {
    try {
      const safeName = (policy.displayName || policy.id).replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const ext = format === 'json' ? 'json' : format === 'terraform' ? 'tf' : format === 'bicep' ? 'bicep' : 'ps1';
      const filename = `${safeName}.${ext}`;

      // Prompt save location immediately for best reliability.
      let saveHandle: FileSystemFileHandle | null = null;
      if (isFileSystemAccessSupported()) {
        try {
          saveHandle = await promptSaveFileHandle({
            suggestedName: filename,
            types: [
              {
                description: ext.toUpperCase(),
                accept: { 'text/plain': [`.${ext}`] },
              },
            ],
          });
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          saveHandle = null;
        }
      }

      let content: string;

      if (format === 'json') {
        content = JSON.stringify(policy.data, null, 2);
      } else {
        const response = await supabase.functions.invoke('convert-format', {
          body: {
            data: policy.data,
            resourceType: `${categoryId}/${policyTypeId}`,
            format,
          },
        });

        if (!response.data?.output) {
          throw new Error('Conversion failed');
        }

        content = response.data.output;
      }

      // Download file
      const blob = new Blob([content], { type: 'text/plain' });

      if (saveHandle) {
        await writeBlobToHandle(saveHandle, blob);
      } else {
        downloadBlobFallback(blob, filename);
      }

      toast({
        title: 'Downloaded',
        description: `Exported ${policy.displayName} as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Single export failed:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export policy',
        variant: 'destructive',
      });
    }
  };

  // Filter policies based on search - handle both live and export modes
  const filteredCategories = useMemo(() => {
    // For export mode, build categories dynamically from loaded data
    if (dataSource === 'export') {
      // Group loaded categories by their categoryId
      const categoryMap = new Map<string, { policies: Array<{ id: string; name: string }> }>();
      
      for (const loaded of loadedCategories) {
        if (!categoryMap.has(loaded.categoryId)) {
          categoryMap.set(loaded.categoryId, { policies: [] });
        }
        // Add this policy type with its policy count
        categoryMap.get(loaded.categoryId)!.policies.push({
          id: loaded.policyTypeId,
          name: loaded.policyTypeId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        });
      }

      // Build dynamic categories from loaded data
      const dynamicCategories = Array.from(categoryMap.entries()).map(([catId, data]) => {
        // Try to find matching static category for icon/color
        const staticCat = POLICY_CATEGORIES.find(c => c.id === catId);
        return {
          id: catId,
          name: staticCat?.name || catId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: staticCat?.icon || FileText,
          color: staticCat?.color || 'text-gray-500',
          policies: data.policies.map(p => ({
            id: p.id,
            name: p.name,
            endpoint: '',
          })),
        };
      });

      // Apply search filter
      if (!searchQuery && categoryFilter === 'all') return dynamicCategories;
      
      return dynamicCategories
        .filter(cat => categoryFilter === 'all' || cat.id === categoryFilter)
        .map(cat => ({
          ...cat,
          policies: cat.policies.filter(p => {
            const loaded = loadedCategories.find(
              c => c.categoryId === cat.id && c.policyTypeId === p.id
            );
            if (!loaded) return true;
            return loaded.policies.some(pol => 
              pol.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              pol.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }),
        }))
        .filter(cat => cat.policies.length > 0);
    }

    // For live mode, use static categories
    if (!searchQuery && categoryFilter === 'all') return POLICY_CATEGORIES;
    
    return POLICY_CATEGORIES
      .filter(cat => categoryFilter === 'all' || cat.id === categoryFilter)
      .map(cat => ({
        ...cat,
        policies: cat.policies.filter(p => {
          const loaded = loadedCategories.find(
            c => c.categoryId === cat.id && c.policyTypeId === p.id
          );
          if (!loaded) return true; // Show unloaded categories
          return loaded.policies.some(pol => 
            pol.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pol.description?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }),
      }))
      .filter(cat => cat.policies.length > 0);
  }, [searchQuery, categoryFilter, loadedCategories, dataSource]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Policy Browser</h1>
          <p className="text-muted-foreground mt-1">
            View, compare, and export M365 policies across formats
          </p>
          {dataSource === 'live' && displayTenantName && (
            <div className="flex items-center gap-2 mt-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                {displayTenantName}
              </span>
            </div>
          )}
          {dataSource === 'export' && selectedExportJobId && (
            <div className="flex items-center gap-2 mt-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                From Export: {exportJobs.find(j => j.id === selectedExportJobId)?.name || 'Selected Export'}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            {selectedPolicies.size} selected
          </Badge>
          <Button
            variant="outline"
            onClick={() => setDeployDialogOpen(true)}
            disabled={selectedPolicies.size === 0}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Deploy to Tenant
          </Button>
          <Button
            onClick={handleExportClick}
            disabled={selectedPolicies.size === 0 || exporting}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting... {exportProgress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Selected
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Data Source Toggle */}
      <Card className="glass-panel">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Load policies from:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleDataSourceChange('live')}
                className={cn(
                  "flex-1 p-4 rounded-lg border-2 transition-all flex items-center gap-3",
                  dataSource === 'live'
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  dataSource === 'live' ? "bg-primary/20" : "bg-secondary"
                )}>
                  <Cloud className={cn(
                    "w-5 h-5",
                    dataSource === 'live' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Fetch Live</p>
                  <p className="text-xs text-muted-foreground">Query policies directly from Graph API</p>
                </div>
                {dataSource === 'live' && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </button>
              
              <button
                onClick={() => handleDataSourceChange('export')}
                className={cn(
                  "flex-1 p-4 rounded-lg border-2 transition-all flex items-center gap-3",
                  dataSource === 'export'
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  dataSource === 'export' ? "bg-primary/20" : "bg-secondary"
                )}>
                  <History className={cn(
                    "w-5 h-5",
                    dataSource === 'export' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Load from Export</p>
                  <p className="text-xs text-muted-foreground">Browse policies from a previous export</p>
                </div>
                {dataSource === 'export' && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </button>
            </div>

            {/* Export Job Selector (only shown when "Load from Export" is selected) */}
            {dataSource === 'export' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2"
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select
                    value={selectedExportJobId || ''}
                    onValueChange={(value) => {
                      if (value && isCrossTenantExport(value)) {
                        // Show confirmation dialog for cross-tenant export
                        setPendingExportJobId(value);
                        setCrossTenantWarningOpen(true);
                      } else {
                        setSelectedExportJobId(value);
                        setLoadedExportSourceInfo(value ? getExportSourceInfo(value) : null);
                        if (value) loadFromExportJob(value);
                      }
                    }}
                    disabled={loadingExportJobs || loadingFromExport}
                  >
                    <SelectTrigger className="flex-1 bg-secondary/50">
                      {loadingExportJobs ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Loading exports...</span>
                        </div>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Select an export job..." />
                        </>
                      )}
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {exportJobs.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          No completed exports found
                        </div>
                      ) : (
                        exportJobs.map(job => {
                          const tenantInfo = job.tenant_connection?.customer?.name 
                            || job.tenant_connection?.display_name 
                            || job.tenant_connection?.tenant_name;
                          const isCrossTenant = job.tenant_connection_id !== selectedTenantId;
                          
                          return (
                            <SelectItem key={job.id} value={job.id}>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{job.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                                  </span>
                                  {isCrossTenant && (
                                    <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px] px-1.5 py-0">
                                      <AlertTriangle className="w-3 h-3 mr-0.5" />
                                      Different Tenant
                                    </Badge>
                                  )}
                                </div>
                                {tenantInfo && (
                                  <span className={cn(
                                    "text-xs flex items-center gap-1",
                                    isCrossTenant ? "text-amber-500" : "text-muted-foreground"
                                  )}>
                                    <Building2 className="w-3 h-3" />
                                    {tenantInfo}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  {loadingFromExport && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading policies...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Warning (only for live mode) */}
      {dataSource === 'live' && !isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20"
        >
          <AlertCircle className="w-5 h-5 text-warning" />
          <div>
            <p className="font-medium text-warning">No tenant connected</p>
            <p className="text-sm text-muted-foreground">
              Connect a tenant to browse live policies, or load from a previous export
            </p>
          </div>
        </motion.div>
      )}

      {/* Cross-Tenant Warning Banner */}
      {dataSource === 'export' && loadedExportSourceInfo && selectedTenantId && loadedExportSourceInfo.tenantConnectionId !== selectedTenantId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 p-4 rounded-lg bg-amber-500/10 border-2 border-amber-500/40"
        >
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-600 dark:text-amber-400 text-lg">
              ⚠️ Cross-Tenant Data Loaded
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You are viewing policies from <strong className="font-semibold">{loadedExportSourceInfo.customerName || loadedExportSourceInfo.tenantName}</strong> 
              {displayTenantName && (
                <> while connected to <strong className="font-semibold">{displayTenantName}</strong></>
              )}.
            </p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-2">
              Be careful when importing or deploying these policies - they will be applied to the currently connected tenant.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Policy Browser */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Filters */}
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search policies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-secondary/50"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-secondary/50">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {POLICY_CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Empty State for Export Mode */}
          {dataSource === 'export' && !selectedExportJobId && (
            <Card className="glass-panel">
              <CardContent className="p-8 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select an Export</h3>
                <p className="text-sm text-muted-foreground">
                  Choose an export job from the dropdown above to browse and re-export policies
                </p>
              </CardContent>
            </Card>
          )}

          {dataSource === 'export' && selectedExportJobId && filteredCategories.length === 0 && !loadingFromExport && (
            <Card className="glass-panel">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Policies Found</h3>
                <p className="text-sm text-muted-foreground">
                  This export does not contain any policy resources, or they don't match your search criteria
                </p>
              </CardContent>
            </Card>
          )}

          {/* Policy Categories */}
          <div className="space-y-3">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isExpanded = expandedCategories.has(category.id);

              // Calculate total policies in this category
              const totalPoliciesInCategory = loadedCategories
                .filter(lc => lc.categoryId === category.id)
                .reduce((sum, lc) => sum + lc.policies.length, 0);

              return (
                <Card key={category.id} className="glass-panel overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                    disabled={dataSource === 'live' && !isConnected}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-secondary", category.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-foreground">{category.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {category.policies.length} policy types
                          {totalPoliciesInCategory > 0 && (
                            <span className="ml-1">• {totalPoliciesInCategory} policies</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border"
                      >
                        {category.policies.map((policyType) => {
                          const loaded = loadedCategories.find(
                            c => c.categoryId === category.id && c.policyTypeId === policyType.id
                          );
                          const policies = loaded?.policies || [];
                          const isLoading = loaded?.loading;
                          const error = loaded?.error;

                          return (
                            <div key={policyType.id} className="border-b border-border/50 last:border-0">
                              <div className="px-4 py-3 bg-secondary/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{policyType.name}</span>
                                  {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                  {!isLoading && policies.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {policies.length}
                                    </Badge>
                                  )}
                                </div>
                                {policies.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => selectAllInCategory(category.id, policyType.id)}
                                    >
                                      <CheckSquare className="w-3 h-3 mr-1" />
                                      Select All
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => deselectAllInCategory(category.id, policyType.id)}
                                    >
                                      <Square className="w-3 h-3 mr-1" />
                                      Clear
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {error && (
                                <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
                                  {error}
                                </div>
                              )}

                              {policies.length > 0 && (
                                <div className="divide-y divide-border/50">
                                  {policies.map((policy) => {
                                    const key = `${category.id}/${policyType.id}/${policy.id}`;
                                    const isSelected = selectedPolicies.has(key);

                                    return (
                                      <div
                                        key={policy.id}
                                        className={cn(
                                          "px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors",
                                          isSelected && "bg-primary/5"
                                        )}
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => 
                                              togglePolicySelection(policy, category.id, policyType.id)
                                            }
                                          />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">
                                              {policy.displayName}
                                            </p>
                                            {policy.description && (
                                              <p className="text-xs text-muted-foreground truncate">
                                                {policy.description}
                                              </p>
                                            )}
                                          </div>
                                          {policy.state && (
                                            <Badge
                                              variant={policy.state === 'enabled' ? 'default' : 'secondary'}
                                              className="text-xs"
                                            >
                                              {policy.state}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                              setPreviewPolicy(policy);
                                              setPreviewOpen(true);
                                            }}
                                          >
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => 
                                              handleExportSingle(policy, category.id, policyType.id, 'json')
                                            }
                                          >
                                            <Download className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {!isLoading && policies.length === 0 && !error && (
                                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                  No policies found
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Export Options */}
        <div className="space-y-4">
          <Card className="glass-panel sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Export Options
              </CardTitle>
              <CardDescription>
                Choose formats for bulk export
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format Selection */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Export Formats</p>
                {EXPORT_FORMATS.map((format) => {
                  const Icon = format.icon;
                  const isSelected = selectedFormats.has(format.id);

                  return (
                    <button
                      key={format.id}
                      onClick={() => toggleFormat(format.id)}
                      className={cn(
                        "w-full p-3 rounded-lg border transition-all flex items-center gap-3",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-primary/20" : "bg-secondary"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{format.name}</p>
                        <p className="text-xs text-muted-foreground">{format.description}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Policies Summary */}
              {selectedPolicies.size > 0 && (
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-sm font-medium mb-2">Selection Summary</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{selectedPolicies.size} policies selected</p>
                    <p>{selectedFormats.size} export format(s)</p>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <Button
                onClick={handleExportClick}
                disabled={selectedPolicies.size === 0 || exporting || !isConnected}
                className="w-full gap-2"
                size="lg"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting... {exportProgress}%
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export {selectedPolicies.size} Policies
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Policy Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewPolicy?.displayName}</DialogTitle>
            <DialogDescription>{previewPolicy?.description}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="json" className="mt-4">
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="terraform">Terraform</TabsTrigger>
              <TabsTrigger value="bicep">Bicep</TabsTrigger>
              <TabsTrigger value="powershell">PowerShell</TabsTrigger>
            </TabsList>
            <TabsContent value="json">
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {previewPolicy ? JSON.stringify(previewPolicy.data, null, 2) : ''}
                </pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="terraform">
              <PolicyFormatPreview
                policy={previewPolicy}
                format="terraform"
              />
            </TabsContent>
            <TabsContent value="bicep">
              <PolicyFormatPreview
                policy={previewPolicy}
                format="bicep"
              />
            </TabsContent>
            <TabsContent value="powershell">
              <PolicyFormatPreview
                policy={previewPolicy}
                format="powershell"
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Cross-Tenant Confirmation Dialog */}
      <AlertDialog open={crossTenantWarningOpen} onOpenChange={setCrossTenantWarningOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Loading Policies from Different Customer
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {pendingExportJobId && (() => {
                const sourceInfo = getExportSourceInfo(pendingExportJobId);
                return (
                  <>
                    <p className="text-foreground">
                      You are about to load policies exported from{' '}
                      <strong className="text-amber-600 dark:text-amber-400">
                        {sourceInfo?.customerName || sourceInfo?.tenantName || 'another tenant'}
                      </strong>
                      {displayTenantName && (
                        <> into your session connected to{' '}
                          <strong className="text-primary">
                            {displayTenantName}
                          </strong>
                        </>
                      )}.
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        ⚠️ Important Warning
                      </p>
                      <p className="text-sm text-amber-600/90 dark:text-amber-400/90 mt-1">
                        If you export or import these policies, they will be applied to your{' '}
                        <strong>currently connected tenant</strong>, not the original source tenant.
                      </p>
                    </div>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingExportJobId(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                if (pendingExportJobId) {
                  setSelectedExportJobId(pendingExportJobId);
                  setLoadedExportSourceInfo(getExportSourceInfo(pendingExportJobId));
                  loadFromExportJob(pendingExportJobId);
                }
                setPendingExportJobId(null);
                setCrossTenantWarningOpen(false);
              }}
            >
              I Understand, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Confirmation Dialog */}
      <AlertDialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Save Policies to Disk
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to export <strong className="text-foreground">{selectedPolicies.size} policies</strong> in{' '}
                <strong className="text-foreground">{selectedFormats.size} format(s)</strong>.
              </p>
              
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">Export Details:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Formats: {Array.from(selectedFormats).join(', ').toUpperCase()}
                  </li>
                  <li className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Source: {dataSource === 'export' && loadedExportSourceInfo 
                      ? loadedExportSourceInfo.customerName || loadedExportSourceInfo.tenantName
                      : displayTenantName || 'Current Tenant'}
                  </li>
                </ul>
              </div>

              {dataSource === 'export' && loadedExportSourceInfo && selectedTenantId && 
                loadedExportSourceInfo.tenantConnectionId !== selectedTenantId && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Cross-Tenant Export
                  </p>
                  <p className="text-xs text-amber-600/90 dark:text-amber-400/90 mt-1">
                    These policies are from a different tenant than your current session.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                A ZIP file will be downloaded containing your policies organized by format.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Save to Disk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Policy Deploy Dialog */}
      <PolicyDeployDialog
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        selectedPolicies={selectedPolicies as Map<string, DeployPolicyItem>}
        sourceInfo={{
          tenantName: loadedExportSourceInfo?.tenantName || displayTenantName || undefined,
          customerName: loadedExportSourceInfo?.customerName,
          tenantConnectionId: loadedExportSourceInfo?.tenantConnectionId || selectedTenantId,
        }}
      />
    </div>
  );
};

// Helper component for format previews
const PolicyFormatPreview = ({ 
  policy, 
  format 
}: { 
  policy: PolicyItem | null; 
  format: ExportFormat;
}) => {
  const [content, setContent] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!policy) return;

    const convert = async () => {
      setLoading(true);
      try {
        // For preview, we just show placeholder until actual conversion
        const response = await supabase.functions.invoke('convert-format', {
          body: {
            data: policy.data,
            resourceType: 'conditional-access/ca-policies', // Generic type for preview
            format,
          },
        });

        if (response.data?.output) {
          setContent(response.data.output);
        } else {
          setContent('# Conversion not available for this resource type');
        }
      } catch (err) {
        setContent('# Failed to generate preview');
      } finally {
        setLoading(false);
      }
    };

    convert();
  }, [policy, format]);

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <pre className="text-xs font-mono whitespace-pre-wrap">{content}</pre>
      )}
    </ScrollArea>
  );
};
