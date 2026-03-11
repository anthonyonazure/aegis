import { useState } from 'react';
import { LicenseOptimizer } from '@/components/ai/LicenseOptimizer';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function LicenseOptimizerView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI License Optimizer</h1>
        <p className="text-muted-foreground">
          Optimize license allocation and identify savings across tenants
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to optimize"
      />
      <LicenseOptimizer selectedTenants={selectedTenants} />
    </div>
  );
}
