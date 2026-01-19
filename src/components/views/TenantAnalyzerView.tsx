import { TenantAnalyzerFull } from '@/components/ai/TenantAnalyzerFull';

export const TenantAnalyzerView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">AI Tenant Analyzer</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive AI-powered analysis of your M365 tenant configuration
        </p>
      </div>
      <TenantAnalyzerFull />
    </div>
  );
};
