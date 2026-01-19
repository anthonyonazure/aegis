import { CopilotReadinessAdvisor } from '@/components/ai/CopilotReadinessAdvisor';

export const CopilotReadinessAdvisorView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Copilot Readiness Advisor</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered assessment and recommendations for M365 Copilot deployment
        </p>
      </div>
      <CopilotReadinessAdvisor />
    </div>
  );
};
