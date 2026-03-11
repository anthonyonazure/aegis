import { useState } from 'react';
import { ComplianceAdvisorFull } from '@/components/ai/ComplianceAdvisorFull';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export const ComplianceAdvisorView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">AI Compliance Advisor</h1>
        <p className="text-muted-foreground mt-2">
          Analyze your M365 tenant against major compliance frameworks
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to analyze"
      />
      <ComplianceAdvisorFull selectedTenants={selectedTenants} />
    </div>
  );
};
