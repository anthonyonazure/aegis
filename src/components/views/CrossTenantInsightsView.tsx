import { useState } from 'react';
import { CrossTenantInsights } from '@/components/ai/CrossTenantInsights';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

const CrossTenantInsightsView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Cross-Tenant Insights</h1>
        <p className="text-muted-foreground">
          Analyze patterns, benchmarks, and optimization opportunities across your entire tenant portfolio
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to compare"
      />
      <CrossTenantInsights selectedTenants={selectedTenants} />
    </div>
  );
};

export default CrossTenantInsightsView;
