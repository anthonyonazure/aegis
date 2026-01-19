import { IncidentResponder } from '@/components/ai/IncidentResponder';

export default function IncidentResponderView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Incident Responder</h1>
        <p className="text-muted-foreground">
          Get AI-guided response to security incidents with containment, investigation, and remediation steps
        </p>
      </div>
      
      <IncidentResponder />
    </div>
  );
}
