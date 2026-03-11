import { useState } from 'react';
import { SecurityBenchmark } from '@/components/ai/SecurityBenchmark';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export default function SecurityBenchmarkView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Security Benchmark</h1>
        <p className="text-muted-foreground">
          Compare your security posture against industry standards and peer organizations
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to benchmark"
      />
      <SecurityBenchmark selectedTenants={selectedTenants} />
    </div>
  );
}
