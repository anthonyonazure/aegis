import { useState } from 'react';
import { ConfigOptimizer } from '@/components/ai/ConfigOptimizer';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

const ConfigOptimizerView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Configuration Optimizer</h1>
        <p className="text-muted-foreground">
          Get AI-powered recommendations to optimize your M365 configuration for security, performance, and cost
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to optimize"
      />
      <ConfigOptimizer selectedTenants={selectedTenants} />
    </div>
  );
};

export default ConfigOptimizerView;
