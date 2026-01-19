import React from 'react';
import { CrossTenantInsights } from '@/components/ai/CrossTenantInsights';

const CrossTenantInsightsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Cross-Tenant Insights</h1>
        <p className="text-muted-foreground">
          Analyze patterns, benchmarks, and optimization opportunities across your entire tenant portfolio
        </p>
      </div>
      <CrossTenantInsights />
    </div>
  );
};

export default CrossTenantInsightsView;
