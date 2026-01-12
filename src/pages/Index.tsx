import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { ResourcesView } from '@/components/views/ResourcesView';
import { ExportView } from '@/components/views/ExportView';
import { AuthView } from '@/components/views/AuthView';
import { GitView } from '@/components/views/GitView';
import { JobsView } from '@/components/views/JobsView';
import { RESOURCE_CATEGORIES, ExportFormat } from '@/types/tenant';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat['id'][]>(['json']);

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

    const categoryResources = category.subcategories.map(sub => `${categoryId}/${sub.id}`);
    const allSelected = categoryResources.every(r => selectedResources.includes(r));

    if (allSelected) {
      setSelectedResources(prev => prev.filter(r => !categoryResources.includes(r)));
    } else {
      setSelectedResources(prev => [...new Set([...prev, ...categoryResources])]);
    }
  };

  const handleFormatToggle = (format: ExportFormat['id']) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handleStartExport = () => {
    console.log('Starting export...', { selectedResources, selectedFormats });
    // TODO: Implement actual export logic
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveTab} />;
      case 'resources':
        return (
          <ResourcesView 
            selectedResources={selectedResources}
            onResourceSelect={handleResourceSelect}
            onSelectAll={handleSelectAll}
          />
        );
      case 'export':
        return (
          <ExportView 
            selectedResources={selectedResources}
            selectedFormats={selectedFormats}
            onFormatToggle={handleFormatToggle}
            onStartExport={handleStartExport}
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
        return <DashboardView onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
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
    </div>
  );
};

export default Index;
