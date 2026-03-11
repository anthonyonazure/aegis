import { useState } from 'react';
import { PolicyGenerator } from '@/components/ai/PolicyGenerator';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function PolicyGeneratorView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Policy Generator</h1>
        <p className="text-muted-foreground">
          Generate M365 policies using natural language descriptions
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant"
      />
      <PolicyGenerator selectedTenants={selectedTenants} />
    </div>
  );
}
