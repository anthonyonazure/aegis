import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

interface Recommendation {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  action: string;
}

export const RecommendationsSection = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { connectionId } = useTenant();
  const { toast } = useToast();

  const severityColor: Record<string, string> = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  };

  const runAnalysis = async () => {
    if (!connectionId) {
      toast({ title: 'No tenant connected', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-security', {
        body: { action: 'ai-recommendations', tenantConnectionId: connectionId },
      });

      if (error) throw error;
      setRecommendations(data?.data?.recommendations || data?.recommendations || []);
    } catch (err: any) {
      toast({ title: 'Analysis failed', description: err?.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">AI Recommendations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered analysis of your email security configuration with prioritized hardening advice
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((rec, idx) => (
            <Card key={idx} className="p-4 border-border/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground">{rec.title}</h3>
                <Badge variant={severityColor[rec.severity] as any}>{rec.severity}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
              <div className="bg-muted/30 rounded-md p-3 border border-border/50">
                <p className="text-sm text-foreground"><span className="font-medium">Action: </span>{rec.action}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Click "Run Analysis" to get AI-powered recommendations for strengthening your email security.</p>
        </Card>
      )}
    </div>
  );
};
