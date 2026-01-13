import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { ResourcesView } from '@/components/views/ResourcesView';
import { ExportView } from '@/components/views/ExportView';
import { AuthView } from '@/components/views/AuthView';
import { GitView } from '@/components/views/GitView';
import { JobsView } from '@/components/views/JobsView';
import { PreflightCheckDialog } from '@/components/PreflightCheckDialog';
import { RESOURCE_CATEGORIES, ExportFormat } from '@/types/tenant';
import { filterSupportedResourceIds } from '@/lib/resourceSupport';
import { motion, AnimatePresence } from 'framer-motion';
import { useExport } from '@/hooks/useTenant';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat['id'][]>(['json']);
  const [showPreflightCheck, setShowPreflightCheck] = useState(false);
  const [preflightToken, setPreflightToken] = useState<string | null>(null);
  const [preflightResources, setPreflightResources] = useState<string[]>([]);
  
  // Use shared tenant context
  const { 
    isConnected, 
    connectionId,
    checkExistingConnection,
    getValidToken,
    refreshToken
  } = useTenant();

  const { isExporting, progress, startExport } = useExport();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Check for existing connection on mount
  useEffect(() => {
    if (isAuthenticated) {
      checkExistingConnection();
    }
  }, [isAuthenticated, checkExistingConnection]);

  const handleResourceSelect = (resourceId: string) => {
    setSelectedResources(prev => 
      prev.includes(resourceId)
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const handleSelectAll = (categoryId: string) => {
    const category = RESOURCE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    // Only select supported resources (has graphEndpoint or explicit supported: true)
    const supportedResources = category.subcategories
      .filter(sub => {
        if (sub.supported === false) return false;
        if (sub.supported === true) return true;
        return !!sub.graphEndpoint;
      })
      .map(sub => `${categoryId}/${sub.id}`);

    if (supportedResources.length === 0) return;

    const allSelected = supportedResources.every(r => selectedResources.includes(r));

    if (allSelected) {
      setSelectedResources(prev => prev.filter(r => !supportedResources.includes(r)));
    } else {
      setSelectedResources(prev => [...new Set([...prev, ...supportedResources])]);
    }
  };

  const handleSelectAllResources = () => {
    // Get all supported resource IDs across all categories
    const allSupportedResources = RESOURCE_CATEGORIES.flatMap(category =>
      category.subcategories
        .filter(sub => {
          if (sub.supported === false) return false;
          if (sub.supported === true) return true;
          return !!sub.graphEndpoint;
        })
        .map(sub => `${category.id}/${sub.id}`)
    );

    const allSelected = allSupportedResources.every(r => selectedResources.includes(r));

    if (allSelected) {
      setSelectedResources([]);
    } else {
      setSelectedResources(allSupportedResources);
    }
  };

  const handleFormatToggle = (format: ExportFormat['id']) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handleStartExport = async () => {
    if (!isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to a tenant first',
        variant: 'destructive',
      });
      setActiveTab('auth');
      return;
    }

    // Get a valid token (will refresh if needed)
    const validToken = await getValidToken();
    if (!validToken) {
      toast({
        title: 'Session Expired',
        description: 'Please reconnect to the tenant',
        variant: 'destructive',
      });
      setActiveTab('auth');
      return;
    }

    const { supported, unsupported } = filterSupportedResourceIds(selectedResources);

    // If user had previously selected "Coming Soon" resources, remove them now so exports don't fail.
    if (unsupported.length > 0) {
      setSelectedResources(supported);
      toast({
        title: 'Some resources skipped',
        description: `${unsupported.length} unsupported resources were removed from this export (Coming Soon).`,
      });
    }

    if (supported.length === 0) {
      toast({
        title: 'No Supported Resources',
        description: 'Please select at least one supported (Graph API) resource to export.',
        variant: 'destructive',
      });
      setActiveTab('resources');
      return;
    }

    // Show preflight check dialog (only supported resources)
    setPreflightResources(supported);
    setPreflightToken(validToken);
    setShowPreflightCheck(true);
  };

  const handlePreflightProceed = async () => {
    setShowPreflightCheck(false);
    if (preflightToken) {
      await startExport(preflightToken, preflightResources, selectedFormats, connectionId || undefined);
      setActiveTab('jobs');
    }
  };

  const handlePreflightCancel = () => {
    setShowPreflightCheck(false);
    setPreflightToken(null);
    setPreflightResources([]);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const renderContent = () => {
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
      case 'resources':
        return (
          <ResourcesView 
            selectedResources={selectedResources}
            onResourceSelect={handleResourceSelect}
            onSelectAll={handleSelectAll}
            onSelectAllResources={handleSelectAllResources}
            onNavigateToExport={() => setActiveTab('export')}
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
          />
        );
      case 'jobs':
        return <JobsView />;
      case 'git':
        return <GitView />;
      case 'auth':
        return <AuthView />;
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Settings</h2>
              <p className="text-muted-foreground">Application settings coming soon</p>
            </div>
          </div>
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isConnected={isConnected} />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {/* User info and sign out */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
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

      {/* Preflight Check Dialog */}
      <PreflightCheckDialog
        open={showPreflightCheck}
        onOpenChange={setShowPreflightCheck}
        accessToken={preflightToken}
        selectedResources={preflightResources}
        onProceed={handlePreflightProceed}
        onCancel={handlePreflightCancel}
        onRefreshToken={refreshToken}
      />
    </div>
  );
};

export default Index;