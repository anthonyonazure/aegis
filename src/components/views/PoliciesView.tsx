import { useState } from 'react';
import { PolicyTemplatesView } from './PolicyTemplatesView';
import { PolicyDeploymentView } from './PolicyDeploymentView';

export const PoliciesView = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  if (selectedTemplateId) {
    return (
      <PolicyDeploymentView
        templateId={selectedTemplateId}
        onBack={() => setSelectedTemplateId(null)}
      />
    );
  }

  return (
    <PolicyTemplatesView
      onNavigateToDeployment={(templateId) => setSelectedTemplateId(templateId)}
    />
  );
};
