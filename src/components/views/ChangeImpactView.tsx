import { ChangeImpactAnalyzer } from '@/components/ai/ChangeImpactAnalyzer';

export default function ChangeImpactView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Change Impact Analyzer</h1>
        <p className="text-muted-foreground">
          Predict the impact of configuration changes before deployment
        </p>
      </div>
      
      <ChangeImpactAnalyzer />
    </div>
  );
}
