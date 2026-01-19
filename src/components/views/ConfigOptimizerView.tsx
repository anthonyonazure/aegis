import React from 'react';
import { ConfigOptimizer } from '@/components/ai/ConfigOptimizer';

const ConfigOptimizerView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Configuration Optimizer</h1>
        <p className="text-muted-foreground">
          Get AI-powered recommendations to optimize your M365 configuration for security, performance, and cost
        </p>
      </div>
      <ConfigOptimizer />
    </div>
  );
};

export default ConfigOptimizerView;
