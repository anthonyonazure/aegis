import { useState } from 'react';
import { MigrationPlanner } from '@/components/ai/MigrationPlanner';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function MigrationPlannerView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Migration Planner</h1>
        <p className="text-muted-foreground">
          Plan tenant-to-tenant migrations with AI-powered analysis
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select source tenant"
      />
      <MigrationPlanner selectedTenants={selectedTenants} />
    </div>
  );
}
