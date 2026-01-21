import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { getPolicyTemplateByName } from '@/lib/policyDatabase';
import { saveGovernanceMetrics, getGovernanceHistory, GovernanceMetricsHistory } from '@/lib/governanceDatabase';
import { GovernanceScheduleManager } from '@/components/GovernanceScheduleManager';
import { TenantComparisonView } from '@/components/TenantComparisonView';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { getRemediationGuide, RemediationGuide } from '@/lib/remediationGuides';
import { RemediationGuideDialog } from '@/components/RemediationGuideDialog';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Users,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Activity,
  XCircle,
  Zap,
  ExternalLink,
  ChevronRight,
  Lock,
  Key,
  UserCheck,
  ShieldAlert,
  FileCheck,
  Gauge,
  Target,
  BarChart3,
  PieChart,
  AlertCircle,
  Lightbulb,
  Wrench,
  Rocket,
  FileText,
  Play,
  ClipboardList,
  DollarSign,
  Settings,
  Edit2,
  History,
  LineChart,
  Calendar,
  Grid3X3
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  Area,
  AreaChart
} from 'recharts';

interface LicenseBreakdown {
  productName: string;
  total: number;
  assigned: number;
  available: number;
  monthlyPrice: number;
}

interface GovernanceStats {
  totalTenants: number;
  healthyTenants: number;
  avgComplianceScore: number;
  avgSecureScore: number;
  licenseUtilization: number;
  activeAlerts: number;
  pendingActions: number;
  totalUsers: number;
  adminUsers: number;
  guestUsers: number;
  mfaEnabled: number;
  riskyUsers: number;
  totalLicenses: number;
  assignedLicenses: number;
  unusedLicenses: number;
  licensesByProduct: LicenseBreakdown[];
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'security' | 'compliance' | 'identity' | 'licensing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actionType: 'policy' | 'config' | 'review' | 'remediate';
  policyTemplateId?: string;
  reportTemplateId?: string;
}

export interface RemediationContext {
  actionTitle: string;
  actionDescription: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'compliance' | 'identity' | 'licensing';
  suggestedTenantIds?: string[];
}

interface GovernanceCenterViewProps {
  onNavigate?: (view: string) => void;
  onDeployPolicy?: (templateId: string, context?: RemediationContext) => void;
}

// Default license prices (USD per user/month) based on Microsoft list prices
const DEFAULT_LICENSE_PRICES: Record<string, number> = {
  'ENTERPRISEPREMIUM': 57.00,      // Microsoft 365 E5
  'ENTERPRISEPACK': 38.00,          // Microsoft 365 E3
  'SPE_E3': 38.00,                  // Microsoft 365 E3
  'SPE_E5': 57.00,                  // Microsoft 365 E5
  'EMSPREMIUM': 16.40,              // EMS E5
  'EMS': 11.00,                     // EMS E3
  'AAD_PREMIUM': 9.00,              // Azure AD Premium P1
  'AAD_PREMIUM_P2': 12.00,          // Azure AD Premium P2
  'EXCHANGESTANDARD': 4.00,         // Exchange Online Plan 1
  'EXCHANGEENTERPRISE': 8.00,       // Exchange Online Plan 2
  'POWER_BI_PRO': 10.00,            // Power BI Pro
  'POWER_BI_PREMIUM_PER_USER': 20.00, // Power BI Premium Per User
  'PROJECTPREMIUM': 55.00,          // Project Plan 5
  'VISIOCLIENT': 15.00,             // Visio Plan 2
  'MICROSOFT_BUSINESS_CENTER': 12.50, // Microsoft 365 Business Basic
  'O365_BUSINESS_ESSENTIALS': 6.00, // Microsoft 365 Business Basic
  'O365_BUSINESS_PREMIUM': 22.00,   // Microsoft 365 Business Standard
  'SMB_BUSINESS_PREMIUM': 22.00,    // Microsoft 365 Business Premium
  'TEAMS_EXPLORATORY': 0,           // Teams Exploratory (Free)
  'FLOW_FREE': 0,                   // Power Automate Free
  'POWERAPPS_VIRAL': 0,             // Power Apps Trial
  'DEFAULT': 15.00,                 // Default for unknown SKUs
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const CATEGORY_ICONS = {
  security: Shield,
  compliance: FileCheck,
  identity: Users,
  licensing: CreditCard,
};

// Action items with links to policy templates (by name) and reports
const GOVERNANCE_ACTIONS: ActionItem[] = [
  {
    id: 'enable-mfa-admins',
    title: 'Enable MFA for all admin accounts',
    description: '3 admin accounts do not have MFA enabled, exposing privileged access to potential compromise.',
    category: 'security',
    severity: 'critical',
    impact: 'Prevents 99.9% of account compromise attacks',
    effort: 'low',
    actionType: 'policy',
    policyTemplateId: 'MFA Enforcement Policy', // Template name, will be looked up
  },
  {
    id: 'configure-conditional-access',
    title: 'Review Conditional Access policies',
    description: '2 tenants have no Conditional Access policies configured.',
    category: 'security',
    severity: 'high',
    impact: 'Enforces security controls based on user, device, and location',
    effort: 'medium',
    actionType: 'config',
    policyTemplateId: 'Conditional Access Baseline',
    reportTemplateId: 'sec-conditional-access-summary',
  },
  {
    id: 'remove-stale-guests',
    title: 'Remove stale guest accounts',
    description: '47 guest users have not signed in for over 90 days.',
    category: 'identity',
    severity: 'medium',
    impact: 'Reduces attack surface and maintains clean directory',
    effort: 'low',
    actionType: 'remediate',
    policyTemplateId: 'Guest User Access Restriction',
    reportTemplateId: 'id-guest-users',
  },
  {
    id: 'optimize-licenses',
    title: 'Optimize license assignments',
    description: '23 E5 licenses assigned to users who only use basic features.',
    category: 'licensing',
    severity: 'low',
    impact: 'Potential savings of $3,450/month',
    effort: 'medium',
    actionType: 'review',
    policyTemplateId: 'License Optimization Policy',
    reportTemplateId: 'lic-e5-usage',
  },
  {
    id: 'fix-iso-compliance',
    title: 'Address compliance gaps for ISO 27001',
    description: '5 controls are not met in the latest compliance scan.',
    category: 'compliance',
    severity: 'high',
    impact: 'Required for ISO 27001 certification',
    effort: 'high',
    actionType: 'remediate',
    reportTemplateId: 'comp-iso-27001',
  },
  {
    id: 'block-legacy-auth',
    title: 'Block legacy authentication',
    description: 'Legacy authentication protocols are still allowed in 4 tenants.',
    category: 'security',
    severity: 'high',
    impact: 'Legacy auth bypasses MFA and is a common attack vector',
    effort: 'low',
    actionType: 'policy',
    policyTemplateId: 'Block Legacy Authentication',
  },
  {
    id: 'review-privileged-roles',
    title: 'Review privileged role holders',
    description: '12 users have Global Administrator role - consider using PIM.',
    category: 'identity',
    severity: 'medium',
    impact: 'Reduces standing privilege and improves security posture',
    effort: 'medium',
    actionType: 'review',
    policyTemplateId: 'Privileged Identity Management',
    reportTemplateId: 'id-privileged-users',
  },
  {
    id: 'reclaim-unused-licenses',
    title: 'Reclaim unused licenses',
    description: '34 licenses assigned to inactive users (no sign-in 60+ days).',
    category: 'licensing',
    severity: 'medium',
    impact: 'Potential savings of $1,870/month',
    effort: 'low',
    actionType: 'remediate',
    policyTemplateId: 'License Optimization Policy',
    reportTemplateId: 'lic-inactive-users',
  },
];

const CHART_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

export function GovernanceCenterView({ onNavigate, onDeployPolicy }: GovernanceCenterViewProps) {
  const { toast } = useToast();
  const { selectedCustomerId, selectedTenantId, customers, tenants, hasStoredCredentials } = useTenant();
  const [loading, setLoading] = useState(true);
  const [fetchingLiveData, setFetchingLiveData] = useState(false);
  const [dynamicActions, setDynamicActions] = useState<ActionItem[]>([]);
  const [licensePrices, setLicensePrices] = useState<Record<string, number>>(DEFAULT_LICENSE_PRICES);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [stats, setStats] = useState<GovernanceStats>({
    totalTenants: 0,
    healthyTenants: 0,
    avgComplianceScore: 0,
    avgSecureScore: 0,
    licenseUtilization: 0,
    activeAlerts: 0,
    pendingActions: 0,
    totalUsers: 0,
    adminUsers: 0,
    guestUsers: 0,
    mfaEnabled: 0,
    riskyUsers: 0,
    totalLicenses: 0,
    assignedLicenses: 0,
    unusedLicenses: 0,
    licensesByProduct: [],
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [historyRange, setHistoryRange] = useState<'7' | '14' | '30' | '90'>('30');
  const [metricsHistory, setMetricsHistory] = useState<GovernanceMetricsHistory[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionWorkflow, setActionWorkflow] = useState<'deploy' | 'report' | 'manual'>('deploy');
  const [showRemediationGuide, setShowRemediationGuide] = useState(false);
  const [activeRemediationGuide, setActiveRemediationGuide] = useState<RemediationGuide | null>(null);

  useEffect(() => {
    loadGovernanceData();
  }, [selectedCustomerId, selectedTenantId]);

  useEffect(() => {
    loadMetricsHistory();
  }, [historyRange, selectedCustomerId, selectedTenantId]);

  const loadMetricsHistory = async () => {
    const history = await getGovernanceHistory({
      customerId: selectedCustomerId || undefined,
      tenantConnectionId: selectedTenantId || undefined,
      days: parseInt(historyRange),
    });
    setMetricsHistory(history);
  };

  const loadGovernanceData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load tenant connections
      let tenantQuery = supabase
        .from('tenant_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected');
      
      if (selectedCustomerId) {
        tenantQuery = tenantQuery.eq('customer_id', selectedCustomerId);
      }
      
      const { data: tenantConnections } = await tenantQuery;

      // Load compliance results for scores
      const { data: complianceData } = await supabase
        .from('compliance_results')
        .select('passed_count, total_checks')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Load billing usage for license info
      const { data: billingData } = await supabase
        .from('billing_usage')
        .select('total_users, total_resources')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false })
        .limit(1);

      // Calculate stats
      const totalTenants = tenantConnections?.length || 0;
      const healthyTenants = tenantConnections?.filter(t => t.health_status === 'healthy').length || 0;
      
      // Calculate compliance score from results
      const avgComplianceScore = complianceData?.length 
        ? Math.round(complianceData.reduce((sum, c) => {
            const score = c.total_checks && c.total_checks > 0 
              ? (c.passed_count / c.total_checks) * 100 
              : 0;
            return sum + score;
          }, 0) / complianceData.length)
        : 75; // Default demo value
      
      // Default values (will be overwritten by live data)
      const totalUsers = billingData?.[0]?.total_users || 150; // Default demo value
      const totalLicenses = Math.floor(totalUsers * 1.2);
      const assignedLicenses = totalUsers;
      
      // Create default license breakdown for demo - always show sample data
      const defaultLicenses: LicenseBreakdown[] = [
        { productName: 'ENTERPRISEPREMIUM', total: Math.max(1, Math.floor(totalUsers * 0.3)), assigned: Math.floor(totalUsers * 0.28), available: Math.max(1, Math.floor(totalUsers * 0.02)), monthlyPrice: licensePrices['ENTERPRISEPREMIUM'] || 57 },
        { productName: 'ENTERPRISEPACK', total: Math.max(1, Math.floor(totalUsers * 0.5)), assigned: Math.floor(totalUsers * 0.45), available: Math.max(1, Math.floor(totalUsers * 0.05)), monthlyPrice: licensePrices['ENTERPRISEPACK'] || 38 },
        { productName: 'AAD_PREMIUM_P2', total: Math.max(1, Math.floor(totalUsers * 0.2)), assigned: Math.floor(totalUsers * 0.15), available: Math.max(1, Math.floor(totalUsers * 0.05)), monthlyPrice: licensePrices['AAD_PREMIUM_P2'] || 12 },
        { productName: 'POWER_BI_PRO', total: Math.max(1, Math.floor(totalUsers * 0.1)), assigned: Math.floor(totalUsers * 0.08), available: Math.max(1, Math.floor(totalUsers * 0.02)), monthlyPrice: licensePrices['POWER_BI_PRO'] || 10 },
        { productName: 'EXCHANGEENTERPRISE', total: Math.max(1, Math.floor(totalUsers * 0.4)), assigned: Math.floor(totalUsers * 0.35), available: Math.max(1, Math.floor(totalUsers * 0.05)), monthlyPrice: licensePrices['EXCHANGEENTERPRISE'] || 8 },
        { productName: 'TEAMS_EXPLORATORY', total: Math.max(1, Math.floor(totalUsers * 0.15)), assigned: Math.floor(totalUsers * 0.1), available: Math.max(1, Math.floor(totalUsers * 0.05)), monthlyPrice: licensePrices['TEAMS_EXPLORATORY'] || 0 },
      ];

      setStats({
        totalTenants,
        healthyTenants,
        avgComplianceScore,
        avgSecureScore: 72, // Demo value
        licenseUtilization: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 83,
        activeAlerts: 3,
        pendingActions: GOVERNANCE_ACTIONS.length,
        totalUsers,
        adminUsers: Math.max(5, Math.floor(totalUsers * 0.05)),
        guestUsers: Math.max(10, Math.floor(totalUsers * 0.1)),
        mfaEnabled: Math.floor(totalUsers * 0.75),
        riskyUsers: Math.max(2, Math.floor(totalUsers * 0.02)),
        totalLicenses,
        assignedLicenses,
        unusedLicenses: totalLicenses - assignedLicenses,
        licensesByProduct: defaultLicenses,
      });

      // If we have a selected tenant with credentials, fetch live data
      // Check if the selected tenant has credentials using context tenants list
      const selectedTenantInfo = selectedTenantId 
        ? tenants.find(t => t.id === selectedTenantId)
        : null;
      
      // Only fetch if we have a tenant with credentials
      if (selectedTenantId && (hasStoredCredentials || selectedTenantInfo?.hasCredentials)) {
        await fetchLiveGovernanceMetrics(selectedTenantId);
      } else {
        // Use static actions if no tenant with credentials
        setDynamicActions([]);
      }
    } catch (error) {
      console.error('Failed to load governance data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load governance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveGovernanceMetrics = async (tenantConnectionId: string) => {
    setFetchingLiveData(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-governance-metrics', {
        body: { tenantConnectionId },
      });

      if (error) {
        console.error('Failed to fetch live governance metrics:', error);
        // Fall back to static actions
        setDynamicActions([]);
        return;
      }

      if (data?.success && data.metrics) {
        const metrics = data.metrics;
        
        // Map license breakdown with prices
        const licenseBreakdown: LicenseBreakdown[] = (metrics.licensing.licensesByProduct || []).map((lic: any) => ({
          productName: lic.productName,
          total: lic.total,
          assigned: lic.assigned,
          available: lic.available,
          monthlyPrice: licensePrices[lic.productName] || licensePrices['DEFAULT'] || 15,
        }));
        
        // Update stats with live data
        setStats(prev => ({
          ...prev,
          avgSecureScore: metrics.security.maxSecureScore > 0 
            ? Math.round((metrics.security.secureScore / metrics.security.maxSecureScore) * 100)
            : 0,
          totalUsers: metrics.identity.totalUsers,
          adminUsers: metrics.identity.adminUsers,
          guestUsers: metrics.identity.guestUsers,
          mfaEnabled: metrics.identity.mfaEnabledUsers,
          riskyUsers: metrics.identity.riskyUsers,
          totalLicenses: metrics.licensing.totalLicenses,
          assignedLicenses: metrics.licensing.assignedLicenses,
          unusedLicenses: metrics.licensing.unusedLicenses,
          licenseUtilization: metrics.licensing.utilizationRate,
          activeAlerts: metrics.security.riskySignInsCount,
          pendingActions: data.actions?.length || GOVERNANCE_ACTIONS.length,
          licensesByProduct: licenseBreakdown,
        }));

        // Use dynamic actions from API
        if (data.actions && data.actions.length > 0) {
          setDynamicActions(data.actions);
        } else {
          setDynamicActions([]);
        }

        // Save metrics to history for trend tracking
        const licenseMonthlyCost = licenseBreakdown.reduce((sum, lic) => sum + (lic.total * lic.monthlyPrice), 0);
        const actionCounts = (data.actions || []).reduce((counts: Record<string, number>, action: any) => {
          counts[action.severity] = (counts[action.severity] || 0) + 1;
          return counts;
        }, {});

        await saveGovernanceMetrics({
          tenant_connection_id: tenantConnectionId,
          customer_id: selectedCustomerId || undefined,
          secure_score: metrics.security.secureScore,
          max_secure_score: metrics.security.maxSecureScore,
          risky_sign_ins: metrics.security.riskySignInsCount,
          conditional_access_policies: metrics.security.conditionalAccessPolicies,
          total_users: metrics.identity.totalUsers,
          admin_users: metrics.identity.adminUsers,
          guest_users: metrics.identity.guestUsers,
          mfa_enabled_users: metrics.identity.mfaEnabledUsers,
          risky_users: metrics.identity.riskyUsers,
          stale_accounts: metrics.identity.staleGuestAccounts + metrics.identity.staleUserAccounts,
          total_licenses: metrics.licensing.totalLicenses,
          assigned_licenses: metrics.licensing.assignedLicenses,
          unused_licenses: metrics.licensing.unusedLicenses,
          license_utilization: metrics.licensing.utilizationRate,
          license_cost_monthly: licenseMonthlyCost,
          compliance_score: 75, // Will be updated when we have live compliance data
          critical_actions: actionCounts.critical || 0,
          high_actions: actionCounts.high || 0,
          medium_actions: actionCounts.medium || 0,
          low_actions: actionCounts.low || 0,
        });

        // Refresh history after saving
        await loadMetricsHistory();

        toast({
          title: 'Live Data Loaded',
          description: `Fetched real-time metrics from Microsoft Graph`,
        });
      }
    } catch (error) {
      console.error('Error fetching live metrics:', error);
      setDynamicActions([]);
    } finally {
      setFetchingLiveData(false);
    }
  };

  // Generate dynamic licensing actions based on current prices
  const dynamicLicensingActions = useMemo((): ActionItem[] => {
    const potentialSavings = stats.licensesByProduct.reduce((sum, lic) => {
      return sum + (lic.available * lic.monthlyPrice);
    }, 0);
    
    return [
      {
        id: 'optimize-licenses',
        title: 'Optimize license assignments',
        description: `${Math.floor(stats.unusedLicenses * 0.7)} licenses assigned to users who only use basic features.`,
        category: 'licensing',
        severity: 'low',
        impact: `Potential savings of $${Math.floor(potentialSavings * 0.6).toLocaleString()}/month`,
        effort: 'medium',
        actionType: 'review',
        policyTemplateId: 'License Optimization Policy',
        reportTemplateId: 'lic-e5-usage',
      },
      {
        id: 'reclaim-unused-licenses',
        title: 'Reclaim unused licenses',
        description: `${stats.unusedLicenses} licenses assigned to inactive users (no sign-in 60+ days).`,
        category: 'licensing',
        severity: 'medium',
        impact: `Potential savings of $${potentialSavings.toLocaleString()}/month`,
        effort: 'low',
        actionType: 'remediate',
        policyTemplateId: 'License Optimization Policy',
        reportTemplateId: 'lic-inactive-users',
      },
    ];
  }, [stats.licensesByProduct, stats.unusedLicenses]);

  // Combine dynamic actions with static fallbacks, but use dynamic licensing actions
  const allActions = useMemo(() => {
    if (dynamicActions.length > 0) {
      // Replace licensing actions with our dynamic ones
      const nonLicensingActions = dynamicActions.filter(a => a.category !== 'licensing');
      return [...nonLicensingActions, ...dynamicLicensingActions];
    }
    // For static actions, replace licensing with dynamic
    const staticNonLicensing = GOVERNANCE_ACTIONS.filter(a => a.category !== 'licensing');
    return [...staticNonLicensing, ...dynamicLicensingActions];
  }, [dynamicActions, dynamicLicensingActions]);

  const actionsByCategory = useMemo(() => {
    return {
      security: allActions.filter(a => a.category === 'security'),
      compliance: allActions.filter(a => a.category === 'compliance'),
      identity: allActions.filter(a => a.category === 'identity'),
      licensing: allActions.filter(a => a.category === 'licensing'),
    };
  }, [allActions]);

  const criticalActions = useMemo(() => {
    return allActions.filter(a => a.severity === 'critical' || a.severity === 'high');
  }, [allActions]);

  // Calculate total license cost and potential savings
  const licenseCostAnalysis = useMemo(() => {
    const totalMonthlyCost = stats.licensesByProduct.reduce((sum, lic) => {
      return sum + (lic.total * lic.monthlyPrice);
    }, 0);
    
    const unusedCost = stats.licensesByProduct.reduce((sum, lic) => {
      return sum + (lic.available * lic.monthlyPrice);
    }, 0);
    
    return {
      totalMonthlyCost,
      unusedCost,
      potentialSavings: unusedCost,
    };
  }, [stats.licensesByProduct]);

  const complianceChartData = [
    { name: 'Passed', value: stats.avgComplianceScore, fill: '#22c55e' },
    { name: 'Failed', value: 100 - stats.avgComplianceScore, fill: '#ef4444' },
  ];

  const mfaChartData = useMemo(() => {
    const mfaDisabled = Math.max(0, stats.totalUsers - stats.mfaEnabled - stats.riskyUsers);
    return [
      { name: 'MFA Enabled', value: stats.mfaEnabled, fill: '#22c55e' },
      { name: 'MFA Disabled', value: mfaDisabled, fill: '#f59e0b' },
      { name: 'Risky', value: stats.riskyUsers, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const userDistributionChartData = useMemo(() => {
    const regularUsers = Math.max(0, stats.totalUsers - stats.adminUsers - stats.guestUsers);
    return [
      { name: 'Regular Users', value: regularUsers, fill: '#3b82f6' },
      { name: 'Admins', value: stats.adminUsers, fill: '#ef4444' },
      { name: 'Guests', value: stats.guestUsers, fill: '#6b7280' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const licensingChartData = [
    { name: 'Assigned', value: stats.assignedLicenses, fill: '#3b82f6' },
    { name: 'Unused', value: stats.unusedLicenses, fill: '#6b7280' },
  ];

  const handlePriceUpdate = (productName: string, newPrice: number) => {
    setLicensePrices(prev => ({ ...prev, [productName]: newPrice }));
    setStats(prev => ({
      ...prev,
      licensesByProduct: prev.licensesByProduct.map(lic => 
        lic.productName === productName ? { ...lic, monthlyPrice: newPrice } : lic
      ),
    }));
    setEditingPrice(null);
  };

  const getLicenseDisplayName = (skuName: string): string => {
    const displayNames: Record<string, string> = {
      'ENTERPRISEPREMIUM': 'Microsoft 365 E5',
      'ENTERPRISEPACK': 'Microsoft 365 E3',
      'SPE_E3': 'Microsoft 365 E3',
      'SPE_E5': 'Microsoft 365 E5',
      'EMSPREMIUM': 'EMS E5',
      'EMS': 'EMS E3',
      'AAD_PREMIUM': 'Azure AD Premium P1',
      'AAD_PREMIUM_P2': 'Azure AD Premium P2',
      'EXCHANGESTANDARD': 'Exchange Online Plan 1',
      'EXCHANGEENTERPRISE': 'Exchange Online Plan 2',
      'POWER_BI_PRO': 'Power BI Pro',
      'POWER_BI_PREMIUM_PER_USER': 'Power BI Premium Per User',
      'PROJECTPREMIUM': 'Project Plan 5',
      'VISIOCLIENT': 'Visio Plan 2',
      'O365_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
      'O365_BUSINESS_PREMIUM': 'Microsoft 365 Business Standard',
      'SMB_BUSINESS_PREMIUM': 'Microsoft 365 Business Premium',
      'TEAMS_EXPLORATORY': 'Teams Exploratory',
      'FLOW_FREE': 'Power Automate Free',
      'POWERAPPS_VIRAL': 'Power Apps Trial',
    };
    return displayNames[skuName] || skuName.replace(/_/g, ' ');
  };

  const handleActionClick = (action: ActionItem) => {
    setSelectedAction(action);
    // Set default workflow based on action type
    if (action.policyTemplateId && (action.actionType === 'policy' || action.actionType === 'config')) {
      setActionWorkflow('deploy');
    } else if (action.reportTemplateId) {
      setActionWorkflow('report');
    } else {
      setActionWorkflow('manual');
    }
    setShowActionDialog(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedAction) return;

    if (actionWorkflow === 'deploy' && selectedAction.policyTemplateId) {
      // Look up the template by name to get its database ID
      const template = await getPolicyTemplateByName(selectedAction.policyTemplateId);
      
      if (template) {
        // Build remediation context
        const context: RemediationContext = {
          actionTitle: selectedAction.title,
          actionDescription: selectedAction.description,
          severity: selectedAction.severity,
          category: selectedAction.category,
          suggestedTenantIds: selectedTenantId ? [selectedTenantId] : undefined,
        };

        if (onDeployPolicy) {
          onDeployPolicy(template.id, context);
        } else if (onNavigate) {
          onNavigate('policy-deployment');
        }
        toast({
          title: 'Navigating to Policy Deployment',
          description: `Deploy "${template.name}" to remediate: ${selectedAction.title}`,
        });
      } else {
        // Template not found - navigate to templates view to create it
        if (onNavigate) {
          onNavigate('policy-templates');
        }
        toast({
          title: 'Template Not Found',
          description: `Navigate to Policy Templates to create "${selectedAction.policyTemplateId}"`,
          variant: 'destructive',
        });
      }
    } else if (actionWorkflow === 'report' && selectedAction.reportTemplateId) {
      // Navigate to reports
      if (onNavigate) {
        onNavigate('reports');
      }
      toast({
        title: 'Opening Reports',
        description: `Generate report for: ${selectedAction.title}`,
      });
    } else {
      // Manual action - show detailed remediation guide
      const guide = getRemediationGuide(selectedAction.id);
      if (guide) {
        setActiveRemediationGuide(guide);
        setShowRemediationGuide(true);
      } else {
        toast({
          title: 'Manual Remediation',
          description: `Review the documentation and follow manual steps for: ${selectedAction.title}`,
        });
      }
    }

    setShowActionDialog(false);
    setSelectedAction(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Governance Center</h1>
          <p className="text-muted-foreground">
            Unified view of compliance, security, identity, and licensing across your tenants
            {dynamicActions.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                <Activity className="w-3 h-3 mr-1" />
                Live Data
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchingLiveData && (
            <Badge variant="secondary" className="animate-pulse">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Fetching live data...
            </Badge>
          )}
          <Button variant="outline" onClick={loadGovernanceData} disabled={fetchingLiveData}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fetchingLiveData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTenants}</p>
                  <p className="text-xs text-muted-foreground">Managed Tenants</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {stats.healthyTenants} healthy
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getScoreBg(stats.avgComplianceScore)}`}>
                  <FileCheck className={`w-5 h-5 ${getScoreColor(stats.avgComplianceScore)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(stats.avgComplianceScore)}`}>
                    {stats.avgComplianceScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Compliance</p>
                </div>
              </div>
              <Progress value={stats.avgComplianceScore} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getScoreBg(stats.avgSecureScore)}`}>
                  <Shield className={`w-5 h-5 ${getScoreColor(stats.avgSecureScore)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(stats.avgSecureScore)}`}>
                    {stats.avgSecureScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Secure Score</p>
                </div>
              </div>
              <Progress value={stats.avgSecureScore} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.licenseUtilization}%</p>
                  <p className="text-xs text-muted-foreground">License Utilization</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.unusedLicenses} unused licenses
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-orange-500/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{stats.pendingActions}</p>
                  <p className="text-xs text-muted-foreground">Pending Actions</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {criticalActions.length} critical/high
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Priority Actions Alert */}
      {criticalActions.length > 0 && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/5">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Priority Actions Required</AlertTitle>
          <AlertDescription>
            {criticalActions.length} critical or high priority actions need your attention. 
            Review the Actions tab to remediate security and compliance risks.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview" className="gap-2">
            <Gauge className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <Grid3X3 className="w-4 h-4" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <LineChart className="w-4 h-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2">
            <Calendar className="w-4 h-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <FileCheck className="w-4 h-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="identity" className="gap-2">
            <Users className="w-4 h-4" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="licensing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Licensing
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Governance Overview
                </CardTitle>
                <CardDescription>Key metrics across all governance areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.totalUsers}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.adminUsers}</p>
                    <p className="text-sm text-muted-foreground">Admins</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.guestUsers}</p>
                    <p className="text-sm text-muted-foreground">Guests</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats.licensesByProduct.length || '-'}</p>
                    <p className="text-sm text-muted-foreground">License Types</p>
                    <p className="text-xs text-muted-foreground">{stats.totalLicenses} total</p>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Compliance Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">Compliance Score</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={complianceChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {complianceChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className={`text-2xl font-bold ${getScoreColor(stats.avgComplianceScore)}`}>
                      {stats.avgComplianceScore}%
                    </p>
                  </div>

                  {/* MFA Coverage Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">MFA Coverage</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={mfaChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {mfaChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-2xl font-bold text-green-500">
                      {stats.totalUsers > 0 ? Math.round((stats.mfaEnabled / stats.totalUsers) * 100) : 0}%
                    </p>
                  </div>

                  {/* License Donut */}
                  <div className="text-center">
                    <h4 className="text-sm font-medium mb-2">License Usage</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={licensingChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {licensingChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-2xl font-bold text-blue-500">
                      {stats.licenseUtilization}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Priority Actions
                </CardTitle>
                <CardDescription>Top items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {(criticalActions.length > 0 ? criticalActions : allActions).slice(0, 5).map((action) => {
                      const Icon = CATEGORY_ICONS[action.category];
                      return (
                        <div
                          key={action.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleActionClick(action)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${SEVERITY_COLORS[action.severity]}`}>
                              <Icon className="w-3 h-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{action.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {action.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {action.effort} effort
                                </Badge>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                    {allActions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">No priority actions required</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="mt-6">
          <TenantComparisonView />
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-6">
          <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {metricsHistory.length} data points in the last {historyRange} days
                </span>
              </div>
              <Select value={historyRange} onValueChange={(v) => setHistoryRange(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {metricsHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Historical Data Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Governance metrics are saved each time you refresh data from a connected tenant.
                    Connect a tenant and click Refresh to start tracking trends.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Score Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-500" />
                        Secure Score Trend
                      </CardTitle>
                      <CardDescription>Microsoft Secure Score over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metricsHistory.map(m => ({
                            date: format(new Date(m.recorded_at), 'MMM dd'),
                            score: m.max_secure_score > 0 ? Math.round((m.secure_score / m.max_secure_score) * 100) : 0,
                            raw: m.secure_score,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                    <p className="text-sm font-medium">{payload[0].payload.date}</p>
                                    <p className="text-sm text-blue-500">Score: {payload[0].value}%</p>
                                    <p className="text-xs text-muted-foreground">Raw: {payload[0].payload.raw}</p>
                                  </div>
                                );
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="score" 
                              stroke="#3b82f6" 
                              fill="#3b82f6" 
                              fillOpacity={0.2} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-500" />
                        MFA Coverage Trend
                      </CardTitle>
                      <CardDescription>MFA-enabled users over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metricsHistory.map(m => ({
                            date: format(new Date(m.recorded_at), 'MMM dd'),
                            coverage: m.total_users > 0 ? Math.round((m.mfa_enabled_users / m.total_users) * 100) : 0,
                            enabled: m.mfa_enabled_users,
                            total: m.total_users,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                    <p className="text-sm font-medium">{payload[0].payload.date}</p>
                                    <p className="text-sm text-green-500">Coverage: {payload[0].value}%</p>
                                    <p className="text-xs text-muted-foreground">
                                      {payload[0].payload.enabled} / {payload[0].payload.total} users
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="coverage" 
                              stroke="#22c55e" 
                              fill="#22c55e" 
                              fillOpacity={0.2} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* License & Risk Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-500" />
                        License Utilization Trend
                      </CardTitle>
                      <CardDescription>License usage efficiency over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={metricsHistory.map(m => ({
                            date: format(new Date(m.recorded_at), 'MMM dd'),
                            utilization: m.license_utilization,
                            unused: m.unused_licenses,
                            cost: m.license_cost_monthly,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                    <p className="text-sm font-medium">{payload[0].payload.date}</p>
                                    <p className="text-sm text-purple-500">Utilization: {payload[0].value}%</p>
                                    <p className="text-xs text-muted-foreground">
                                      Unused: {payload[0].payload.unused} licenses
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Cost: ${payload[0].payload.cost?.toLocaleString()}/mo
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="utilization" 
                              stroke="#8b5cf6" 
                              strokeWidth={2}
                              dot={false}
                            />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Risk Indicators Trend
                      </CardTitle>
                      <CardDescription>Risky sign-ins and users over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={metricsHistory.map(m => ({
                            date: format(new Date(m.recorded_at), 'MMM dd'),
                            riskySignIns: m.risky_sign_ins,
                            riskyUsers: m.risky_users,
                            staleAccounts: m.stale_accounts,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                    <p className="text-sm font-medium">{payload[0].payload.date}</p>
                                    <p className="text-sm text-red-500">Risky Sign-ins: {payload[0].payload.riskySignIns}</p>
                                    <p className="text-sm text-orange-500">Risky Users: {payload[0].payload.riskyUsers}</p>
                                    <p className="text-sm text-yellow-500">Stale Accounts: {payload[0].payload.staleAccounts}</p>
                                  </div>
                                );
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="riskySignIns" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              dot={false}
                              name="Risky Sign-ins"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="riskyUsers" 
                              stroke="#f59e0b" 
                              strokeWidth={2}
                              dot={false}
                              name="Risky Users"
                            />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Action Items Trend
                    </CardTitle>
                    <CardDescription>Outstanding governance actions over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metricsHistory.map(m => ({
                          date: format(new Date(m.recorded_at), 'MMM dd'),
                          critical: m.critical_actions,
                          high: m.high_actions,
                          medium: m.medium_actions,
                          low: m.low_actions,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
                          <Bar dataKey="high" stackId="a" fill="#f59e0b" name="High" />
                          <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium" />
                          <Bar dataKey="low" stackId="a" fill="#3b82f6" name="Low" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="mt-6">
          <GovernanceScheduleManager onRunComplete={loadMetricsHistory} />
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Compliance Status by Framework</CardTitle>
                <CardDescription>Compliance scores across different regulatory frameworks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'CIS Microsoft 365', score: 78 },
                    { name: 'ISO 27001', score: 65 },
                    { name: 'SOC 2 Type II', score: 82 },
                    { name: 'GDPR', score: 71 },
                    { name: 'HIPAA', score: 58 },
                  ].map((framework) => (
                    <div key={framework.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{framework.name}</span>
                        <span className={`text-sm font-bold ${getScoreColor(framework.score)}`}>
                          {framework.score}%
                        </span>
                      </div>
                      <Progress value={framework.score} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Compliance Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {(actionsByCategory.compliance.length > 0 ? actionsByCategory.compliance : GOVERNANCE_ACTIONS.filter(a => a.category === 'compliance')).map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Wrench className="w-3 h-3 mr-1" />
                          Remediate
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(stats.avgSecureScore)}`}>
                    {stats.avgSecureScore}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Average Secure Score</p>
                  <Progress value={stats.avgSecureScore} className="mt-4" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">MFA Coverage</span>
                    <Badge variant={stats.mfaEnabled / stats.totalUsers > 0.9 ? 'default' : 'destructive'}>
                      {Math.round((stats.mfaEnabled / stats.totalUsers) * 100)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Risky Users</span>
                    <Badge variant={stats.riskyUsers === 0 ? 'default' : 'destructive'}>
                      {stats.riskyUsers}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Admin Accounts</span>
                    <Badge variant="outline">{stats.adminUsers}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Alerts</span>
                    <Badge variant={stats.activeAlerts === 0 ? 'default' : 'secondary'}>
                      {stats.activeAlerts}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Security Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {(actionsByCategory.security.length > 0 ? actionsByCategory.security : GOVERNANCE_ACTIONS.filter(a => a.category === 'security')).map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Zap className="w-3 h-3 mr-1" />
                          Fix Now
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Identity Tab */}
        <TabsContent value="identity" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.totalUsers > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={userDistributionChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        />
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">No user data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Identity Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Total Users</span>
                    </div>
                    <span className="font-bold">{stats.totalUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-red-500" />
                      <span className="text-sm">Privileged Users</span>
                    </div>
                    <span className="font-bold">{stats.adminUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">MFA Enabled</span>
                    </div>
                    <span className="font-bold">{stats.mfaEnabled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">Stale Accounts (est.)</span>
                    </div>
                    <span className="font-bold">{Math.floor(stats.totalUsers * 0.08)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Identity Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {(actionsByCategory.identity.length > 0 ? actionsByCategory.identity : GOVERNANCE_ACTIONS.filter(a => a.category === 'identity')).map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                          <p className="text-sm font-medium">{action.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                          <Wrench className="w-3 h-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Licensing Tab */}
        <TabsContent value="licensing" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            {/* License Breakdown Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      License Breakdown
                    </CardTitle>
                    <CardDescription>All licenses by type with cost analysis</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowPriceEditor(!showPriceEditor)}>
                    <Settings className="w-4 h-4 mr-2" />
                    {showPriceEditor ? 'Hide Prices' : 'Edit Prices'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>License Type</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">
                        Price/User/Mo
                        {showPriceEditor && <span className="text-xs text-muted-foreground ml-1">(click to edit)</span>}
                      </TableHead>
                      <TableHead className="text-right">Monthly Cost</TableHead>
                      <TableHead className="text-right">Waste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.licensesByProduct.map((lic) => {
                      const monthlyCost = lic.total * lic.monthlyPrice;
                      const wasteCost = lic.available * lic.monthlyPrice;
                      return (
                        <TableRow key={lic.productName}>
                          <TableCell className="font-medium">
                            {getLicenseDisplayName(lic.productName)}
                            <span className="text-xs text-muted-foreground block">{lic.productName}</span>
                          </TableCell>
                          <TableCell className="text-right">{lic.total}</TableCell>
                          <TableCell className="text-right text-green-600">{lic.assigned}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{lic.available}</TableCell>
                          <TableCell className="text-right">
                            {editingPrice === lic.productName ? (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-20 h-7 text-right"
                                defaultValue={lic.monthlyPrice}
                                autoFocus
                                onBlur={(e) => handlePriceUpdate(lic.productName, parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handlePriceUpdate(lic.productName, parseFloat((e.target as HTMLInputElement).value) || 0);
                                  }
                                }}
                              />
                            ) : (
                              <span 
                                className={showPriceEditor ? "cursor-pointer hover:text-primary" : ""}
                                onClick={() => showPriceEditor && setEditingPrice(lic.productName)}
                              >
                                ${lic.monthlyPrice.toFixed(2)}
                                {showPriceEditor && <Edit2 className="w-3 h-3 inline ml-1 text-muted-foreground" />}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">${monthlyCost.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-red-500">${wasteCost.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    {stats.licensesByProduct.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No license data available. Connect a tenant to see license breakdown.
                        </TableCell>
                      </TableRow>
                    )}
                    {stats.licensesByProduct.length > 0 && (
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{stats.totalLicenses}</TableCell>
                        <TableCell className="text-right text-green-600">{stats.assignedLicenses}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{stats.unusedLicenses}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">${licenseCostAnalysis.totalMonthlyCost.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-500">${licenseCostAnalysis.unusedCost.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>License Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-blue-500">{stats.licenseUtilization}%</div>
                    <p className="text-sm text-muted-foreground">Utilization Rate</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Licenses</span>
                      <span className="font-bold">{stats.totalLicenses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Assigned</span>
                      <span className="font-bold text-green-500">{stats.assignedLicenses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Unused</span>
                      <span className="font-bold text-muted-foreground">{stats.unusedLicenses}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    Cost Analysis
                  </CardTitle>
                  <CardDescription>Monthly licensing costs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Monthly Cost</span>
                      <span className="font-bold text-lg">${licenseCostAnalysis.totalMonthlyCost.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Annual Cost</span>
                      <span className="font-bold">${(licenseCostAnalysis.totalMonthlyCost * 12).toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">Potential Savings</span>
                      </div>
                      <p className="text-2xl font-bold text-green-500">${licenseCostAnalysis.potentialSavings.toLocaleString()}/mo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${(licenseCostAnalysis.potentialSavings * 12).toLocaleString()}/year from unused licenses
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-500" />
                    Licensing Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {(actionsByCategory.licensing.length > 0 ? actionsByCategory.licensing : GOVERNANCE_ACTIONS.filter(a => a.category === 'licensing')).map((action) => (
                        <div
                          key={action.id}
                          className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[action.severity]}`} />
                            <p className="text-sm font-medium">{action.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                          <p className="text-xs text-green-500 mt-1">{action.impact}</p>
                          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => handleActionClick(action)}>
                            <Target className="w-3 h-3 mr-1" />
                            Optimize
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Workflow Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction && (
                <>
                  <div className={`p-1.5 rounded ${SEVERITY_COLORS[selectedAction.severity]}`}>
                    {(() => {
                      const Icon = CATEGORY_ICONS[selectedAction.category];
                      return <Icon className="w-4 h-4 text-white" />;
                    })()}
                  </div>
                  {selectedAction.title}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-6 py-4">
              {/* Impact & Effort */}
              <div className="flex items-center gap-4">
                <Badge variant={selectedAction.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {selectedAction.severity} priority
                </Badge>
                <Badge variant="outline">{selectedAction.effort} effort</Badge>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Impact:</strong> {selectedAction.impact}
                </p>
              </div>

              {/* Workflow Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Choose Remediation Workflow</Label>
                <RadioGroup value={actionWorkflow} onValueChange={(v) => setActionWorkflow(v as 'deploy' | 'report' | 'manual')}>
                  {selectedAction.policyTemplateId && (
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="deploy" id="deploy" />
                      <Label htmlFor="deploy" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-primary" />
                          <span className="font-medium">Deploy Policy</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Deploy a policy template to automatically remediate this issue across selected tenants
                        </p>
                      </Label>
                    </div>
                  )}
                  
                  {selectedAction.reportTemplateId && (
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="report" id="report" />
                      <Label htmlFor="report" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="font-medium">Generate Report</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Generate a detailed report to review affected resources before taking action
                        </p>
                      </Label>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Manual Remediation</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        View guidance and perform manual remediation steps
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteAction}>
              <Play className="w-4 h-4 mr-2" />
              {actionWorkflow === 'deploy' ? 'Start Deployment' : 
               actionWorkflow === 'report' ? 'Generate Report' : 'View Guidance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remediation Guide Dialog */}
      <RemediationGuideDialog
        guide={activeRemediationGuide}
        open={showRemediationGuide}
        onOpenChange={setShowRemediationGuide}
      />
    </div>
  );
}
