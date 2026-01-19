import React from 'react';
import { UserRiskProfiler } from '@/components/ai/UserRiskProfiler';

const UserRiskProfilerView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI User Risk Profiler</h1>
        <p className="text-muted-foreground">
          Analyze individual user behavior patterns and generate comprehensive risk assessments
        </p>
      </div>
      <UserRiskProfiler />
    </div>
  );
};

export default UserRiskProfilerView;
