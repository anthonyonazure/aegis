import { useState } from 'react';
import { TenantAnalyzerFull } from '@/components/ai/TenantAnalyzerFull';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export const TenantAnalyzerView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">AI Tenant Analyzer</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive AI-powered analysis of your M365 tenant configuration
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to analyze"
      />
      <TenantAnalyzerFull selectedTenants={selectedTenants} />
    </div>
  );
};
