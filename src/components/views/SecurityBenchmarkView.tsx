import { SecurityBenchmark } from '@/components/ai/SecurityBenchmark';

export default function SecurityBenchmarkView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Security Benchmark</h1>
        <p className="text-muted-foreground">
          Compare your security posture against industry standards and peer organizations
        </p>
      </div>
      
      <SecurityBenchmark />
    </div>
  );
}
