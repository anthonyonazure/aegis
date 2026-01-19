import { ComplianceAdvisorFull } from '@/components/ai/ComplianceAdvisorFull';

export const ComplianceAdvisorView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">AI Compliance Advisor</h1>
        <p className="text-muted-foreground mt-2">
          Analyze your M365 tenant against major compliance frameworks
        </p>
      </div>
      <ComplianceAdvisorFull />
    </div>
  );
};
