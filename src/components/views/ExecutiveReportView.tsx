import { useState } from 'react';
import { ExecutiveReportGenerator } from '@/components/ai/ExecutiveReportGenerator';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function ExecutiveReportView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Executive Report</h1>
        <p className="text-muted-foreground">
          Generate comprehensive executive reports spanning multiple tenants
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to include in report"
      />
      <ExecutiveReportGenerator selectedTenants={selectedTenants} />
    </div>
  );
}
