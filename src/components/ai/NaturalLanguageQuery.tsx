import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Loader2,
  Table,
  BarChart3,
  Lightbulb,
  Code,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { getLastAnalysis, saveAnalysisResult } from '@/lib/aiApi';

interface QueryResult {
  interpretation: string;
  graphQueries: Array<{
    endpoint: string;
    filter?: string;
    select?: string;
    description: string;
  }>;
  results: {
    type: 'table' | 'list' | 'stats' | 'chart' | 'text';
    columns?: string[];
    data?: Record<string, unknown>[];
    content?: string;
    summary?: {
      total: number;
      matching: number;
      percentage: number;
    };
  };
  insights: string[];
  recommendations: string[];
  relatedQueries: string[];
}

const exampleQueries = [
  "Show me all users without MFA enabled",
  "Which devices haven't synced in the last 30 days?",
  "List all guest users and when they were created",
  "Find users with Global Admin role",
  "Show conditional access policies that are disabled",
  "Which apps have the most permissions?",
  "Users who haven't signed in for 90 days",
  "Groups with more than 100 members"
];

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface NaturalLanguageQueryProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function NaturalLanguageQuery({ selectedTenants }: NaturalLanguageQueryProps) {
  const { toast } = useToast();
  const { selectedTenantId, tenants } = useTenant();
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [copiedQuery, setCopiedQuery] = useState<number | null>(null);

  // Load last query result on mount
  useEffect(() => {
    const loadLastResult = async () => {
      try {
        const lastAnalysis = await getLastAnalysis('nl-query');
        if (lastAnalysis?.result) {
          setResult(lastAnalysis.result as unknown as QueryResult);
        }
      } catch (error) {
        console.error('Failed to load last result:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastResult();
  }, []);

  const runQuery = async (queryText?: string) => {
    const q = queryText || query;
    if (!q.trim()) {
      toast({
        title: 'Enter a Query',
        description: 'Please type a question about your tenant data',
        variant: 'destructive',
      });
      return;
    }

    setIsQuerying(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-nl-query', {
        body: { 
          query: q,
          tenantId: selectedTenantId,
          context: selectedTenant ? { name: selectedTenant.displayName } : undefined
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      
      // Save to database for persistence
      await saveAnalysisResult({
        analysisType: 'nl-query',
        result: data,
        tenantConnectionId: selectedTenantId || undefined,
      });
      
      // Add to history
      setQueryHistory(prev => {
        const updated = [q, ...prev.filter(h => h !== q)].slice(0, 10);
        return updated;
      });

      toast({
        title: 'Query Complete',
        description: data.interpretation,
      });
    } catch (error) {
      console.error('Query error:', error);
      toast({
        title: 'Query Failed',
        description: error instanceof Error ? error.message : 'Failed to process query',
        variant: 'destructive',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const copyGraphQuery = async (index: number) => {
    if (!result?.graphQueries[index]) return;
    const gq = result.graphQueries[index];
    const fullQuery = `${gq.endpoint}?${gq.filter || ''}${gq.select ? '&' + gq.select : ''}`;
    
    await navigator.clipboard.writeText(fullQuery);
    setCopiedQuery(index);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Search className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Natural Language Query</h2>
          <p className="text-muted-foreground">
            Ask questions about {selectedTenant?.displayName || 'your tenant'} in plain English
          </p>
        </div>
      </div>

      {/* Query Input */}
      <Card className="glass-panel border-border/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Ask anything... e.g., 'Show me all users without MFA'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 h-12 text-base bg-background/50"
                disabled={isQuerying}
              />
            </div>
            <Button 
              onClick={() => runQuery()} 
              disabled={isQuerying || !query.trim()}
              size="lg"
              className="px-8"
            >
              {isQuerying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Ask AI
                </>
              )}
            </Button>
          </div>

          {/* Example Queries */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.slice(0, 4).map((example, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => {
                    setQuery(example);
                    runQuery(example);
                  }}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isQuerying && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Processing Query</h3>
            <p className="text-sm text-muted-foreground text-center">
              AI is interpreting your question and generating results...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !isQuerying && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Interpretation */}
          <Card className="glass-panel border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">AI understood your query as:</p>
                  <p className="text-foreground font-medium mt-1">{result.interpretation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Tabs */}
          <Card className="glass-panel border-border/50">
            <Tabs defaultValue="results" className="w-full">
              <CardHeader className="pb-0">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="results" className="text-xs">
                    <Table className="w-3 h-3 mr-1" />
                    Results
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="text-xs">
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Insights
                  </TabsTrigger>
                  <TabsTrigger value="graph" className="text-xs">
                    <Code className="w-3 h-3 mr-1" />
                    Graph API
                  </TabsTrigger>
                  <TabsTrigger value="related" className="text-xs">
                    <ChevronRight className="w-3 h-3 mr-1" />
                    Related
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-4">
                <TabsContent value="results" className="mt-0">
                  {/* Summary Stats */}
                  {result.results.summary && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <p className="text-2xl font-bold text-foreground">{result.results.summary.total}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <p className="text-2xl font-bold text-primary">{result.results.summary.matching}</p>
                        <p className="text-xs text-muted-foreground">Matching</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <p className="text-2xl font-bold text-foreground">{result.results.summary.percentage}%</p>
                        <p className="text-xs text-muted-foreground">Percentage</p>
                      </div>
                    </div>
                  )}

                  {/* Data Table */}
                  {result.results.type === 'table' && result.results.data && (
                    <div className="overflow-x-auto rounded-lg border border-border/50">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            {result.results.columns?.map((col, i) => (
                              <th key={i} className="px-4 py-3 text-left font-medium text-muted-foreground">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.results.data.map((row, i) => (
                            <tr key={i} className="border-t border-border/30">
                              {result.results.columns?.map((col, j) => (
                                <td key={j} className="px-4 py-3 text-foreground">
                                  {String(row[col] ?? '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Text Content */}
                  {result.results.type === 'text' && result.results.content && (
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{result.results.content}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="mt-0 space-y-4">
                  {/* Insights */}
                  {result.insights.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Key Insights
                      </p>
                      <div className="space-y-2">
                        {result.insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                            <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                            <p className="text-sm text-foreground">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
                      <div className="space-y-2">
                        {result.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                              {i + 1}
                            </span>
                            <p className="text-sm text-foreground">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="graph" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    These Microsoft Graph API calls would retrieve the requested data:
                  </p>
                  <div className="space-y-3">
                    {result.graphQueries.map((gq, i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted/30 font-mono text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">GET</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyGraphQuery(i)}
                            className="h-6 px-2"
                          >
                            {copiedQuery === i ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <code className="text-primary break-all">{gq.endpoint}</code>
                        {gq.filter && (
                          <div className="mt-1 text-xs text-muted-foreground break-all">
                            {gq.filter}
                          </div>
                        )}
                        {gq.select && (
                          <div className="mt-1 text-xs text-muted-foreground break-all">
                            {gq.select}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground font-sans">{gq.description}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="related" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    You might also want to ask:
                  </p>
                  <div className="space-y-2">
                    {result.relatedQueries.map((rq, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setQuery(rq);
                          runQuery(rq);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
                      >
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm text-foreground">{rq}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && !result && !isQuerying && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Recent Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queryHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(h);
                    runQuery(h);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{h}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!result && !isQuerying && queryHistory.length === 0 && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Ask Anything</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Use natural language to query your Microsoft 365 tenant. Ask about users, groups, devices, policies, and more.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {exampleQueries.slice(0, 4).map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-2 px-3"
                  onClick={() => {
                    setQuery(example);
                    runQuery(example);
                  }}
                >
                  <span className="text-xs truncate">{example}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}