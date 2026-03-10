import { useState } from 'react';
import { CopilotReadinessAdvisor } from '@/components/ai/CopilotReadinessAdvisor';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export const CopilotReadinessAdvisorView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Copilot Readiness Advisor</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered assessment and recommendations for M365 Copilot deployment
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        label="Select tenants to analyze"
      />
      <CopilotReadinessAdvisor selectedTenants={selectedTenants} />
    </div>
  );
};
