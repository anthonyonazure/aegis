import { useState } from 'react';
import { NaturalLanguageQuery } from '@/components/ai/NaturalLanguageQuery';
import { TenantMultiSelector, SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

export function NaturalLanguageQueryView() {
  const [selectedTenants, setSelectedTenants] = useState<SelectedTenantInfo[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Natural Language Query</h1>
        <p className="text-muted-foreground">
          Query your tenant data using plain English
        </p>
      </div>
      <TenantMultiSelector
        selectedTenantIds={selectedTenants.map(t => t.id)}
        onSelectionChange={setSelectedTenants}
        multiSelect={false}
        label="Select tenant to query"
      />
      <NaturalLanguageQuery selectedTenants={selectedTenants} />
    </div>
  );
}
