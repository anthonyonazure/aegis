import { CostPredictor } from '@/components/ai/CostPredictor';

export default function CostPredictorView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Cost Predictor</h1>
        <p className="text-muted-foreground">
          Predict license costs, identify savings opportunities, and get AI-powered budget forecasts
        </p>
      </div>
      
      <CostPredictor />
    </div>
  );
}
