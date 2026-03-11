import { useState } from 'react';
import { CostPredictor } from '@/components/ai/CostPredictor';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export default function CostPredictorView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Cost Predictor</h1>
        <p className="text-muted-foreground">
          Predict license costs, identify savings opportunities, and get AI-powered budget forecasts
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to forecast"
      />
      <CostPredictor selectedTenants={selectedTenants} />
    </div>
  );
}
