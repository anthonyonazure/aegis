import { useState } from 'react';
import { UserRiskProfiler } from '@/components/ai/UserRiskProfiler';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

const UserRiskProfilerView = () => {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI User Risk Profiler</h1>
        <p className="text-muted-foreground">
          Analyze individual user behavior patterns and generate comprehensive risk assessments
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant"
      />
      <UserRiskProfiler selectedTenants={selectedTenants} />
    </div>
  );
};

export default UserRiskProfilerView;
