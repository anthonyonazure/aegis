import { useState } from 'react';
import { AnomalyDetector } from '@/components/ai/AnomalyDetector';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function AnomalyDetectionView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Anomaly Detection</h1>
        <p className="text-muted-foreground">
          Scan tenants for anomalous sign-ins, configuration changes, and permission grants
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select tenants to scan"
      />
      <AnomalyDetector selectedTenants={selectedTenants} />
    </div>
  );
}
