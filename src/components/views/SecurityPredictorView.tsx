import { useState } from 'react';
import { SecurityPosturePredictor } from '@/components/ai/SecurityPosturePredictor';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function SecurityPredictorView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Security Posture Predictor</h1>
        <p className="text-muted-foreground">
          Predict security risks and posture changes across your tenants
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to analyze"
      />
      <SecurityPosturePredictor selectedTenants={selectedTenants} />
    </div>
  );
}
