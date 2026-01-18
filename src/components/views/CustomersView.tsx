import { useState } from 'react';
import { CustomerManager } from '@/components/CustomerManager';
import { TenantGroupManager } from '@/components/TenantGroupManager';
import { TenantConfigPanel } from '@/components/TenantConfigPanel';
import { Customer } from '@/types/tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderTree, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewMode = 'list' | 'customer-detail';

export const CustomersView = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState('tenants');

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setViewMode('customer-detail');
    setActiveTab('tenants');
  };

  const handleBack = () => {
    setSelectedCustomer(null);
    setViewMode('list');
  };

  if (viewMode === 'customer-detail' && selectedCustomer) {
    return (
      <div className="space-y-6">
        {/* Header with breadcrumb */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <button 
                onClick={handleBack} 
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Customers
              </button>
              <span>/</span>
              <span className="text-foreground">{selectedCustomer.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{selectedCustomer.name}</h1>
            <p className="text-muted-foreground mt-1">
              Manage tenant connections and groups
            </p>
          </div>
        </div>

        {/* Tabs for Tenants and Groups */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tenants" className="gap-2">
              <Settings className="w-4 h-4" />
              Tenant Connections
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Tenant Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="mt-6">
            <TenantConfigPanel customer={selectedCustomer} onBack={handleBack} />
          </TabsContent>

          <TabsContent value="groups" className="mt-6">
            <TenantGroupManager customer={selectedCustomer} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <CustomerManager
      onSelectCustomer={handleSelectCustomer}
      selectedCustomerId={selectedCustomer?.id}
    />
  );
};
