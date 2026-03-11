import { useState } from 'react';
import { DriftExplainer } from '@/components/ai/DriftExplainer';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function DriftExplainerView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Drift Explainer</h1>
        <p className="text-muted-foreground">
          Understand and explain configuration drift in your tenant
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant"
      />
      <DriftExplainer selectedTenants={selectedTenants} />
    </div>
  );
}
