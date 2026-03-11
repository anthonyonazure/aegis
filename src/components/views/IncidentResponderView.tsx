import { useState } from 'react';
import { IncidentResponder } from '@/components/ai/IncidentResponder';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export default function IncidentResponderView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Incident Responder</h1>
        <p className="text-muted-foreground">
          Get AI-guided response to security incidents with containment, investigation, and remediation steps
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={true}
        label="Select affected tenants"
      />
      <IncidentResponder selectedTenants={selectedTenants} />
    </div>
  );
}
