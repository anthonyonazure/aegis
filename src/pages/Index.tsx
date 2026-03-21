import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { ResourcesView } from '@/components/views/ResourcesView';
import { ExportView } from '@/components/views/ExportView';
import { AuthView } from '@/components/views/AuthView';
import { GitView } from '@/components/views/GitView';
import { JobsView } from '@/components/views/JobsView';
import { ImportView } from '@/components/views/ImportView';
import { ValidationView } from '@/components/views/ValidationView';
import { DriftDetectionView } from '@/components/views/DriftDetectionView';
import { ComplianceView } from '@/components/views/ComplianceView';
import { ComplianceDashboardView } from '@/components/views/ComplianceDashboardView';
import { AuditView } from '@/components/views/AuditView';
import { ScheduledExportsView } from '@/components/views/ScheduledExportsView';
import { WebhooksView } from '@/components/views/WebhooksView';
import { CustomersView } from '@/components/views/CustomersView';
import { ScheduledDriftView } from '@/components/views/ScheduledDriftView';
import { PolicyTemplatesView } from '@/components/views/PolicyTemplatesView';
import { PolicyDeploymentView } from '@/components/views/PolicyDeploymentView';
import { PolicyBrowserView } from '@/components/views/PolicyBrowserView';
import { ScheduledDeploymentsView } from '@/components/views/ScheduledDeploymentsView';
import { PSAIntegrationsView } from '@/components/views/PSAIntegrationsView';
import { ReportsView } from '@/components/views/ReportsView';
import { BillingView } from '@/components/views/BillingView';
import { TenantHealthDashboardView } from '@/components/views/TenantHealthDashboardView';
import { SecureScoreDashboardView } from '@/components/views/SecureScoreDashboardView';
import { AutomatedBackupsView } from '@/components/views/AutomatedBackupsView';
import { PermissionHealthView } from '@/components/views/PermissionHealthView';
import { PermissionsReferenceView } from '@/components/views/PermissionsReferenceView';
import { PermissionsChecklistView } from '@/components/views/PermissionsChecklistView';
import { DocumentationView } from '@/components/views/DocumentationView';
import { GovernanceCenterView, RemediationContext } from '@/components/views/GovernanceCenterView';
import { CopilotAgentsView } from '@/components/views/CopilotAgentsView';
import { PolicyGeneratorView } from '@/components/views/PolicyGeneratorView';
import { AnomalyDetectionView } from '@/components/views/AnomalyDetectionView';
import { NaturalLanguageQueryView } from '@/components/views/NaturalLanguageQueryView';
import { RemediationScriptsView } from '@/components/views/RemediationScriptsView';
import { LicenseOptimizerView } from '@/components/views/LicenseOptimizerView';
import { DriftExplainerView } from '@/components/views/DriftExplainerView';
import { ExecutiveReportView } from '@/components/views/ExecutiveReportView';
import { SecurityPredictorView } from '@/components/views/SecurityPredictorView';
import { MigrationPlannerView } from '@/components/views/MigrationPlannerView';
import { CopilotReadinessAdvisorView } from '@/components/views/CopilotReadinessAdvisorView';
import { TenantAnalyzerView } from '@/components/views/TenantAnalyzerView';
import { ComplianceAdvisorView } from '@/components/views/ComplianceAdvisorView';
import CostPredictorView from '@/components/views/CostPredictorView';
import SecurityBenchmarkView from '@/components/views/SecurityBenchmarkView';
import ChangeImpactView from '@/components/views/ChangeImpactView';
import IncidentResponderView from '@/components/views/IncidentResponderView';
import UserRiskProfilerView from '@/components/views/UserRiskProfilerView';
import ConfigOptimizerView from '@/components/views/ConfigOptimizerView';
import AIChatView from '@/components/views/AIChatView';
import CrossTenantInsightsView from '@/components/views/CrossTenantInsightsView';
import { AISchedulesView } from '@/components/views/AISchedulesView';
import { IntuneView } from '@/components/views/IntuneView';
import { MispView } from '@/components/views/MispView';
import { DudeManagerView } from '@/components/views/DudeManagerView';
import { EmailSecurityView } from '@/components/views/EmailSecurityView';
import { SettingsView } from '@/components/views/SettingsView';
import { PreflightCheckDialog } from '@/components/PreflightCheckDialog';
import { filterSupportedResourceIds } from '@/lib/resourceSupport';
import { motion, AnimatePresence } from 'framer-motion';
import { useExport } from '@/hooks/useTenant';
import { useTenant } from '@/contexts/TenantContext';
import { useResourceSelection } from '@/hooks/useResourceSelection';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { TenantSelector } from '@/components/TenantSelector';

// Simple views that require no parent state
const SIMPLE_VIEWS: Record<string, React.ComponentType> = {
  'customers': CustomersView,
  'intune': IntuneView,
  'dude': DudeManagerView,
  'email-security': EmailSecurityView,
  'nl-query': NaturalLanguageQueryView,
  'ai-chat': AIChatView,
  'cross-tenant-insights': CrossTenantInsightsView,
  'ai-schedules': AISchedulesView,
  'tenant-analyzer': TenantAnalyzerView,
  'secure-score': SecureScoreDashboardView,
  'security-predictor': SecurityPredictorView,
  'security-benchmark': SecurityBenchmarkView,
  'policy-generator': PolicyGeneratorView,
  'remediation-scripts': RemediationScriptsView,
  'scheduled-deployments': ScheduledDeploymentsView,
  'change-impact': ChangeImpactView,
  'policy-browser': PolicyBrowserView,
  'migration-planner': MigrationPlannerView,
  'jobs': JobsView,
  'import': ImportView,
  'validation': ValidationView,
  'anomaly-detection': AnomalyDetectionView,
  'incident-responder': IncidentResponderView,
  'user-risk-profiler': UserRiskProfilerView,
  'config-optimizer': ConfigOptimizerView,
  'drift': DriftDetectionView,
  'drift-explainer': DriftExplainerView,
  'scheduled-drift': ScheduledDriftView,
  'compliance': ComplianceView,
  'compliance-advisor': ComplianceAdvisorView,
  'compliance-dashboard': ComplianceDashboardView,
  'audit': AuditView,
  'permission-health': PermissionHealthView,
  'copilot-agents': CopilotAgentsView,
  'copilot-advisor': CopilotReadinessAdvisorView,
  'permissions-reference': PermissionsReferenceView,
  'permissions-checklist': PermissionsChecklistView,
  'schedules': ScheduledExportsView,
  'automated-backups': AutomatedBackupsView,
  'webhooks': WebhooksView,
  'reports': ReportsView,
  'executive-report': ExecutiveReportView,
  'license-optimizer': LicenseOptimizerView,
  'cost-predictor': CostPredictorView,
  'billing': BillingView,
  'git': GitView,
  'documentation': DocumentationView,
  'auth': AuthView,
  'settings': SettingsView,
};

// Alias mappings for tabs that share a component
const TAB_ALIASES: Record<string, string> = {
  'health-dashboard': 'tenant-health',
  'policies': 'policy-templates',
  'policy-templates': 'policy-templates',
  'psa': 'psa-integrations',
  'psa-integrations': 'psa-integrations',
};

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPreflightCheck, setShowPreflightCheck] = useState(false);
  const [preflightToken, setPreflightToken] = useState<string | null>(null);
  const [preflightResources, setPreflightResources] = useState<string[]>([]);
  const [selectedPolicyTemplateId, setSelectedPolicyTemplateId] = useState<string | null>(null);
  const [remediationContext, setRemediationContext] = useState<RemediationContext | null>(null);

  const {
    selectedResources, setSelectedResources, selectedFormats,
    handleResourceSelect, handleSelectAll, handleSelectAllResources, handleFormatToggle,
  } = useResourceSelection();

  const { isConnected, connectionId, loadCustomersAndTenants, getValidToken } = useTenant();
  const { isExporting, progress, exportMessage, startExport } = useExport();
  const { toast } = useToast();
  usePageTitle(activeTab === 'dashboard' ? undefined : activeTab.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) loadCustomersAndTenants();
  }, [isAuthenticated, loadCustomersAndTenants]);

  const handleStartExport = async () => {
    if (!isConnected) {
      toast({ title: 'Not Connected', description: 'Please connect to a tenant first', variant: 'destructive' });
      setActiveTab('auth');
      return;
    }
    const validToken = await getValidToken();
    if (!validToken) {
      toast({ title: 'Session Expired', description: 'Please reconnect to the tenant', variant: 'destructive' });
      setActiveTab('auth');
      return;
    }
    const { supported, unsupported } = filterSupportedResourceIds(selectedResources);
    if (unsupported.length > 0) {
      setSelectedResources(supported);
      toast({ title: 'Some resources skipped', description: `${unsupported.length} unsupported resources were removed from this export (Coming Soon).` });
    }
    if (supported.length === 0) {
      toast({ title: 'No Supported Resources', description: 'Please select at least one supported (Graph API) resource to export.', variant: 'destructive' });
      setActiveTab('resources');
      return;
    }
    setPreflightResources(supported);
    setPreflightToken(validToken);
    setShowPreflightCheck(true);
  };

  const handlePreflightProceed = () => {
    setShowPreflightCheck(false);
    if (preflightToken) {
      startExport(preflightToken, preflightResources, selectedFormats, connectionId || undefined).catch(() => {});
      setActiveTab('jobs');
    }
  };

  const renderContent = () => {
    // Check aliases
    const resolvedTab = TAB_ALIASES[activeTab] || activeTab;

    // Simple views (no parent state needed)
    const SimpleView = SIMPLE_VIEWS[resolvedTab];
    if (SimpleView) {
      // Special cases for aliased tabs
      if (resolvedTab === 'tenant-health') return <TenantHealthDashboardView />;
      if (resolvedTab === 'policy-templates') return <PolicyTemplatesView />;
      if (resolvedTab === 'psa-integrations') return <PSAIntegrationsView />;
      return <SimpleView />;
    }

    // Complex views requiring parent state
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={setActiveTab}
            isConnected={isConnected}
            selectedResourcesCount={selectedResources.length}
            selectedFormatsCount={selectedFormats.length}
          />
        );
      case 'governance':
        return (
          <GovernanceCenterView
            onNavigate={setActiveTab}
            onDeployPolicy={(templateId, context) => {
              setSelectedPolicyTemplateId(templateId);
              setRemediationContext(context || null);
              setActiveTab('policy-deployment');
            }}
          />
        );
      case 'policy-deployment':
        return (
          <PolicyDeploymentView
            templateId={selectedPolicyTemplateId || undefined}
            remediationContext={remediationContext || undefined}
            onBack={() => {
              setSelectedPolicyTemplateId(null);
              setRemediationContext(null);
              setActiveTab('governance');
            }}
          />
        );
      case 'resources':
        return (
          <ResourcesView
            selectedResources={selectedResources}
            onResourceSelect={handleResourceSelect}
            onSelectAll={handleSelectAll}
            onSelectAllResources={handleSelectAllResources}
            onNavigateToExport={() => setActiveTab('export')}
            onSetResources={setSelectedResources}
          />
        );
      case 'export':
        return (
          <ExportView
            selectedResources={selectedResources}
            selectedFormats={selectedFormats}
            onFormatToggle={handleFormatToggle}
            onStartExport={handleStartExport}
            isExporting={isExporting}
            progress={progress}
            exportMessage={exportMessage}
          />
        );
      default:
        return (
          <DashboardView
            onNavigate={setActiveTab}
            isConnected={isConnected}
            selectedResourcesCount={selectedResources.length}
            selectedFormatsCount={selectedFormats.length}
          />
        );
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isConnected={isConnected} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-md">
              <TenantSelector
                onNavigateToAuth={() => setActiveTab('auth')}
                onNavigateToCustomers={() => setActiveTab('customers')}
              />
            </div>
            <div className="flex items-center gap-4 justify-end">
              <span className="text-sm text-muted-foreground truncate max-w-[60vw] md:max-w-none">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/login'); }}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <PreflightCheckDialog
        open={showPreflightCheck}
        onOpenChange={(open) => { if (!open) { setShowPreflightCheck(false); setPreflightToken(null); setPreflightResources([]); } }}
        onProceed={handlePreflightProceed}
        onCancel={() => { setShowPreflightCheck(false); setPreflightToken(null); setPreflightResources([]); }}
        selectedResources={preflightResources}
        accessToken={preflightToken}
      />
    </div>
  );
};

export default Index;
