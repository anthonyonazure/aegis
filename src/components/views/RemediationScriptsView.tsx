import { useState } from 'react';
import { RemediationScriptGenerator } from '@/components/ai/RemediationScriptGenerator';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function RemediationScriptsView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Remediation Scripts</h1>
        <p className="text-muted-foreground">
          Generate remediation scripts for security and compliance issues
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant"
      />
      <RemediationScriptGenerator selectedTenants={selectedTenants} />
    </div>
  );
}
