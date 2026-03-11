import { useState } from 'react';
import { ChangeImpactAnalyzer } from '@/components/ai/ChangeImpactAnalyzer';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export default function ChangeImpactView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Change Impact Analyzer</h1>
        <p className="text-muted-foreground">
          Predict the impact of configuration changes before deployment
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant"
      />
      <ChangeImpactAnalyzer selectedTenants={selectedTenants} />
    </div>
  );
}
