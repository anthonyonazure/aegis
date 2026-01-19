import React from 'react';
import { AIChatAssistant } from '@/components/ai/AIChatAssistant';

const AIChatView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Chat Assistant</h1>
        <p className="text-muted-foreground">
          Get instant answers to your M365 configuration, security, and compliance questions
        </p>
      </div>
      <AIChatAssistant />
    </div>
  );
};

export default AIChatView;
