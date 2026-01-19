import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { History, ChevronRight, Clock, TrendingUp, TrendingDown, Minus, X, BarChart3, Eye } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getRecentAnalyses, type AIAnalysisResult } from '@/lib/aiApi';

interface AIAnalysisHistoryPanelProps {
  analysisType: string;
  currentResult?: unknown;
  onLoadResult?: (result: AIAnalysisResult) => void;
  scoreExtractor?: (result: Record<string, unknown>) => number | undefined;
  titleExtractor?: (result: Record<string, unknown>) => string;
}

export function AIAnalysisHistoryPanel({
  analysisType,
  currentResult,
  onLoadResult,
  scoreExtractor,
  titleExtractor,
}: AIAnalysisHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<AIAnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<AIAnalysisResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, analysisType]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const results = await getRecentAnalyses({ analysisType });
      setHistory(results);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreFromResult = (result: unknown): number | undefined => {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as Record<string, unknown>;
    if (scoreExtractor) {
      return scoreExtractor(r);
    }
    // Try common score field patterns
    if (typeof r.score === 'number') return r.score;
    if (typeof r.overallScore === 'number') return r.overallScore;
    if (typeof r.riskScore === 'number') return r.riskScore;
    if (typeof r.healthScore === 'number') return r.healthScore;
    if (r.summary && typeof (r.summary as Record<string, unknown>).overallScore === 'number') {
      return (r.summary as Record<string, unknown>).overallScore as number;
    }
    return undefined;
  };

  const getTitleFromResult = (result: unknown, index: number): string => {
    if (!result || typeof result !== 'object') return `Analysis #${history.length - index}`;
    const r = result as Record<string, unknown>;
    if (titleExtractor) {
      return titleExtractor(r);
    }
    // Try common title field patterns
    if (typeof r.title === 'string') return r.title;
    if (typeof r.name === 'string') return r.name;
    if (r.summary && typeof (r.summary as Record<string, unknown>).title === 'string') {
      return (r.summary as Record<string, unknown>).title as string;
    }
    return `Analysis #${history.length - index}`;
  };

  const getScoreTrend = (currentScore: number | undefined, previousScore: number | undefined) => {
    if (currentScore === undefined || previousScore === undefined) return 'stable';
    if (currentScore > previousScore) return 'up';
    if (currentScore < previousScore) return 'down';
    return 'stable';
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-muted text-muted-foreground';
    if (score >= 80) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  const handleLoadResult = (result: AIAnalysisResult) => {
    if (onLoadResult) {
      onLoadResult(result);
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          History
          {history.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Analysis History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {selectedForCompare && (
            <Card className="mb-4 border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Comparing with:</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedForCompare(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getTitleFromResult(selectedForCompare.result, 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedForCompare.createdAt), 'PPp')}
                </p>
                {currentResult && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Previous</p>
                      <Badge className={cn('mt-1', getScoreColor(getScoreFromResult(selectedForCompare.result)))}>
                        {getScoreFromResult(selectedForCompare.result)?.toFixed(0) ?? 'N/A'}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Current</p>
                      <Badge className={cn('mt-1', getScoreColor(getScoreFromResult(currentResult)))}>
                        {getScoreFromResult(currentResult)?.toFixed(0) ?? 'N/A'}
                      </Badge>
                    </div>
                    <TrendIcon
                      trend={getScoreTrend(
                        getScoreFromResult(currentResult),
                        getScoreFromResult(selectedForCompare.result)
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">No analysis history yet</p>
                <p className="text-xs mt-1">Run an analysis to see results here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => {
                  const score = getScoreFromResult(item.result);
                  const previousScore = index < history.length - 1
                    ? getScoreFromResult(history[index + 1].result)
                    : undefined;
                  const trend = getScoreTrend(score, previousScore);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
                        selectedForCompare?.id === item.id && 'ring-2 ring-primary'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {getTitleFromResult(item.result, index)}
                            </p>
                            {index === 0 && (
                              <Badge variant="secondary" className="text-xs">Latest</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(item.createdAt), 'PPp')}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {score !== undefined && (
                            <div className="flex items-center gap-1">
                              <Badge className={cn('font-mono', getScoreColor(score))}>
                                {score.toFixed(0)}
                              </Badge>
                              <TrendIcon trend={trend} />
                            </div>
                          )}
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="flex items-center gap-2">
                        {onLoadResult && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 text-xs h-7"
                            onClick={() => handleLoadResult(item)}
                          >
                            <Eye className="w-3 h-3" />
                            Load
                          </Button>
                        )}
                        <Button
                          variant={selectedForCompare?.id === item.id ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 gap-1 text-xs h-7"
                          onClick={() => setSelectedForCompare(
                            selectedForCompare?.id === item.id ? null : item
                          )}
                        >
                          <BarChart3 className="w-3 h-3" />
                          {selectedForCompare?.id === item.id ? 'Selected' : 'Compare'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
