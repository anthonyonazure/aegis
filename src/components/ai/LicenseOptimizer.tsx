import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingDown, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Target,
  BarChart3,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Settings,
  Edit2,
  RefreshCw,
  Database
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { getLastAnalysis, saveAnalysisResult, type AIAnalysisResult } from '@/lib/aiApi';
import { AIAnalysisHistoryPanel } from './AIAnalysisHistoryPanel';

// Default license prices (USD per user/month) based on Microsoft list prices
const DEFAULT_LICENSE_PRICES: Record<string, number> = {
  'ENTERPRISEPREMIUM': 57.00,
  'ENTERPRISEPACK': 38.00,
  'SPE_E3': 38.00,
  'SPE_E5': 57.00,
  'EMSPREMIUM': 16.40,
  'EMS': 11.00,
  'AAD_PREMIUM': 9.00,
  'AAD_PREMIUM_P2': 12.00,
  'EXCHANGESTANDARD': 4.00,
  'EXCHANGEENTERPRISE': 8.00,
  'POWER_BI_PRO': 10.00,
  'POWER_BI_PREMIUM_PER_USER': 20.00,
  'PROJECTPREMIUM': 55.00,
  'PROJECTPROFESSIONAL': 30.00,
  'VISIOCLIENT': 15.00,
  'MICROSOFT_BUSINESS_CENTER': 12.50,
  'O365_BUSINESS_ESSENTIALS': 6.00,
  'O365_BUSINESS_PREMIUM': 22.00,
  'SMB_BUSINESS_PREMIUM': 22.00,
  'TEAMS_EXPLORATORY': 0,
  'FLOW_FREE': 0,
  'POWERAPPS_VIRAL': 0,
  'Microsoft 365 E5': 57.00,
  'Microsoft 365 E3': 38.00,
  'Microsoft 365 E1': 10.00,
  'Power BI Pro': 10.00,
  'Project Plan 3': 30.00,
  'Visio Plan 2': 15.00,
  'DEFAULT': 15.00,
};

interface LicenseData {
  name: string;
  sku?: string;
  total: number;
  assigned: number;
  pricePerUser: number;
}

interface LicenseType {
  name: string;
  total: number;
  assigned: number;
  monthlyPerUserCost: number;
  totalMonthlyCost: number;
}

interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  currentState: string;
  proposedAction: string;
  estimatedSavings: number;
  affectedUsers: number;
  implementationSteps: string[];
  risks: string[];
  timeToImplement: string;
}

interface QuickWin {
  action: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
}

interface OptimizationResult {
  summary: {
    totalMonthlySpend: number;
    potentialSavings: number;
    savingsPercentage: number;
    optimizationScore: number;
    urgency: 'high' | 'medium' | 'low';
  };
  currentState: {
    totalLicenses: number;
    assignedLicenses: number;
    unassignedLicenses: number;
    utilizationRate: number;
    licensesByType: LicenseType[];
  };
  recommendations: Recommendation[];
  quickWins: QuickWin[];
  longTermStrategy: {
    recommendations: string[];
    projectedAnnualSavings: number;
    timeline: string;
  };
  benchmarks: {
    industryAvgUtilization: number;
    yourUtilization: number;
    industryAvgCostPerUser: number;
    yourCostPerUser: number;
  };
}

import { SelectedTenantInfo } from '@/components/copilot/TenantMultiSelector';

interface LicenseOptimizerProps {
  selectedTenants?: SelectedTenantInfo[];
}

export function LicenseOptimizer({ selectedTenants }: LicenseOptimizerProps) {
  const { toast } = useToast();
  const { connectionId: globalConnectionId, tenantName: globalTenantName, hasStoredCredentials } = useTenant();

  const effectiveConnectionId = selectedTenants?.[0]?.id || globalConnectionId;
  const effectiveTenantName = selectedTenants?.[0]?.name || globalTenantName;
  const effectiveHasCredentials = selectedTenants?.[0]?.hasCredentials ?? hasStoredCredentials;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingLicenses, setIsFetchingLicenses] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  
  // License data state
  const [licenses, setLicenses] = useState<LicenseData[]>([]);
  const [licensePrices, setLicensePrices] = useState<Record<string, number>>({ ...DEFAULT_LICENSE_PRICES });
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'sample' | 'tenant'>('sample');

  const handleLoadHistoricalResult = (historicalResult: AIAnalysisResult) => {
    setResult(historicalResult.result as unknown as OptimizationResult);
    setLastAnalyzedAt(historicalResult.createdAt);
  };

  // Load saved prices from localStorage
  useEffect(() => {
    const savedPrices = localStorage.getItem('license-optimizer-prices');
    if (savedPrices) {
      try {
        setLicensePrices({ ...DEFAULT_LICENSE_PRICES, ...JSON.parse(savedPrices) });
      } catch (e) {
        console.error('Failed to parse saved prices:', e);
      }
    }
  }, []);

  // Load last analysis when tenant changes
  useEffect(() => {
    const loadLastAnalysisForTenant = async () => {
      setIsLoading(true);
      try {
        // Load last analysis for this specific tenant (or global if no tenant selected)
        const lastAnalysis = await getLastAnalysis('license-optimizer', effectiveConnectionId || undefined);
        if (lastAnalysis?.result) {
          setResult(lastAnalysis.result as unknown as OptimizationResult);
          setLastAnalyzedAt(lastAnalysis.createdAt);
        } else {
          setResult(null);
          setLastAnalyzedAt(null);
        }
      } catch (error) {
        console.error('Failed to load last analysis:', error);
        setResult(null);
        setLastAnalyzedAt(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadLastAnalysisForTenant();
  }, [effectiveConnectionId]);

  // Auto-fetch licenses when tenant changes or is connected with credentials
  useEffect(() => {
    if (effectiveConnectionId && effectiveHasCredentials) {
      setLicenses([]);
      setDataSource('sample');
      fetchTenantLicenses();
    } else {
      setLicenses([]);
      setDataSource('sample');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConnectionId, effectiveHasCredentials]);

  // Fetch licenses from tenant
  const fetchTenantLicenses = async () => {
    if (!effectiveConnectionId || !effectiveHasCredentials) {
      toast({
        title: 'No Tenant Credentials',
        description: 'Please configure App Registration credentials for this tenant in Tenant Config',
        variant: 'destructive',
      });
      return;
    }

    setIsFetchingLicenses(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-governance-metrics', {
        body: { tenantConnectionId: effectiveConnectionId }
      });

      if (error) throw error;

      // Function returns: { success: true, metrics: { licensing: { licensesByProduct: [...] } }, actions: [...] }
      const metrics = (data as any)?.metrics ?? data;
      const products = metrics?.licensing?.licensesByProduct;

      if (Array.isArray(products) && products.length > 0) {
        const fetchedLicenses: LicenseData[] = products.map((lic: { productName: string; total: number; assigned: number }) => ({
          name: lic.productName,
          sku: lic.productName,
          total: lic.total,
          assigned: lic.assigned,
          pricePerUser: licensePrices[lic.productName] || licensePrices['DEFAULT'] || 15,
        }));
        setLicenses(fetchedLicenses);
        setDataSource('tenant');
        toast({
          title: 'Licenses Loaded',
          description: `Loaded ${fetchedLicenses.length} license types from ${effectiveTenantName || 'tenant'}`,
        });
      } else {
        toast({
          title: 'No License Data Returned',
          description: 'The tenant metrics call succeeded, but no license SKUs were returned.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
      toast({
        title: 'Failed to Fetch Licenses',
        description: error instanceof Error ? error.message : 'Could not fetch license data',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingLicenses(false);
    }
  };

  // Load sample data
  const loadSampleData = () => {
    const sampleLicenses: LicenseData[] = [
      { name: 'Microsoft 365 E5', sku: 'SPE_E5', total: 150, assigned: 120, pricePerUser: licensePrices['SPE_E5'] || 57 },
      { name: 'Microsoft 365 E3', sku: 'SPE_E3', total: 300, assigned: 250, pricePerUser: licensePrices['SPE_E3'] || 38 },
      { name: 'Microsoft 365 E1', sku: 'STANDARDPACK', total: 100, assigned: 45, pricePerUser: 10 },
      { name: 'Power BI Pro', sku: 'POWER_BI_PRO', total: 80, assigned: 35, pricePerUser: licensePrices['POWER_BI_PRO'] || 10 },
      { name: 'Project Plan 3', sku: 'PROJECTPROFESSIONAL', total: 50, assigned: 20, pricePerUser: licensePrices['PROJECTPROFESSIONAL'] || 30 },
      { name: 'Visio Plan 2', sku: 'VISIOCLIENT', total: 40, assigned: 15, pricePerUser: licensePrices['VISIOCLIENT'] || 15 },
    ];
    setLicenses(sampleLicenses);
    setDataSource('sample');
    toast({
      title: 'Sample Data Loaded',
      description: 'Using sample license data for demonstration',
    });
  };

  // Update license price
  const handlePriceUpdate = (licenseName: string, newPrice: number) => {
    const updatedPrices = { ...licensePrices, [licenseName]: newPrice };
    setLicensePrices(updatedPrices);
    localStorage.setItem('license-optimizer-prices', JSON.stringify(updatedPrices));
    
    // Update the license data with new price
    setLicenses(licenses.map(lic => 
      lic.name === licenseName || lic.sku === licenseName 
        ? { ...lic, pricePerUser: newPrice } 
        : lic
    ));
    setEditingPrice(null);
  };

  const analyzeAndOptimize = async () => {
    if (licenses.length === 0) {
      toast({
        title: 'No License Data',
        description: 'Please load license data first (from tenant or sample)',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const licenseDataForAI = {
        licenses: licenses.map(lic => ({
          name: lic.name,
          total: lic.total,
          assigned: lic.assigned,
          pricePerUser: lic.pricePerUser,
        }))
      };

      const { data, error } = await supabase.functions.invoke('ai-license-optimizer', {
        body: { 
          licenseData: licenseDataForAI,
          userCount: licenses.reduce((sum, lic) => sum + lic.assigned, 0),
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      setLastAnalyzedAt(new Date().toISOString());
      
      await saveAnalysisResult({
        analysisType: 'license-optimizer',
        result: data,
        score: data.summary?.optimizationScore,
        tenantConnectionId: connectionId || undefined,
      });

      toast({
        title: 'Analysis Complete',
        description: `Found $${data.summary?.potentialSavings?.toLocaleString() || 0}/month in potential savings`,
      });
    } catch (error) {
      console.error('License optimization error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze licenses',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalMonthlyCost = licenses.reduce((sum, lic) => sum + (lic.total * lic.pricePerUser), 0);
  const totalWaste = licenses.reduce((sum, lic) => sum + ((lic.total - lic.assigned) * lic.pricePerUser), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI License Optimizer</h2>
            <p className="text-muted-foreground">Analyze and optimize M365 license costs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastAnalyzedAt && (
            <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(new Date(lastAnalyzedAt), 'MMM d, h:mm a')}
            </Badge>
          )}
          <AIAnalysisHistoryPanel
            analysisType="license-optimizer"
            currentResult={result}
            onLoadResult={handleLoadHistoricalResult}
            scoreExtractor={(r) => (r as unknown as OptimizationResult).summary?.optimizationScore}
            titleExtractor={(r) => {
              const data = r as unknown as OptimizationResult;
              return `$${data.summary?.potentialSavings?.toLocaleString() || 0} savings`;
            }}
          />
          <Button onClick={analyzeAndOptimize} disabled={isAnalyzing || licenses.length === 0}>
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Licenses
              </>
            )}
          </Button>
        </div>
      </div>

      {/* License Data Configuration */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                License Data
                {dataSource === 'tenant' && (
                  <Badge variant="secondary" className="ml-2">From Tenant</Badge>
                )}
                {dataSource === 'sample' && (
                  <Badge variant="outline" className="ml-2">Sample Data</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Load your license data and customize pricing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadSampleData}
                disabled={isFetchingLicenses}
              >
                Load Sample
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchTenantLicenses}
                disabled={isFetchingLicenses || !connectionId}
              >
                {isFetchingLicenses ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Fetch from Tenant
              </Button>
              {licenses.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowPriceEditor(!showPriceEditor)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {showPriceEditor ? 'Hide Prices' : 'Edit Prices'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {licenses.length > 0 && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Total Licenses</p>
                <p className="text-xl font-bold">{licenses.reduce((sum, lic) => sum + lic.total, 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Monthly Cost (at list prices)</p>
                <p className="text-xl font-bold">{formatCurrency(totalMonthlyCost)}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-orange-400">Unused License Cost</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(totalWaste)}/mo</p>
              </div>
            </div>
            
            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Unused</TableHead>
                    <TableHead className="text-right">
                      Price/User/Mo
                      {showPriceEditor && <Edit2 className="w-3 h-3 inline ml-1" />}
                    </TableHead>
                    <TableHead className="text-right">Monthly Cost</TableHead>
                    <TableHead className="text-right">Waste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((lic, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{lic.name}</TableCell>
                      <TableCell className="text-right">{lic.total}</TableCell>
                      <TableCell className="text-right">{lic.assigned}</TableCell>
                      <TableCell className="text-right text-orange-400">
                        {lic.total - lic.assigned}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingPrice === lic.name ? (
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20 h-7 text-right"
                            defaultValue={lic.pricePerUser}
                            autoFocus
                            onBlur={(e) => handlePriceUpdate(lic.name, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handlePriceUpdate(lic.name, parseFloat((e.target as HTMLInputElement).value) || 0);
                              }
                              if (e.key === 'Escape') {
                                setEditingPrice(null);
                              }
                            }}
                          />
                        ) : (
                          <span 
                            className={showPriceEditor ? 'cursor-pointer hover:text-primary' : ''}
                            onClick={() => showPriceEditor && setEditingPrice(lic.name)}
                          >
                            {formatCurrency(lic.pricePerUser)}
                            {showPriceEditor && <Edit2 className="w-3 h-3 inline ml-1 text-muted-foreground" />}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lic.total * lic.pricePerUser)}
                      </TableCell>
                      <TableCell className="text-right text-orange-400">
                        {formatCurrency((lic.total - lic.assigned) * lic.pricePerUser)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        )}
        {licenses.length === 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm mb-2">No license data loaded</p>
              <p className="text-xs mb-4">Load sample data or fetch from your connected tenant</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadSampleData}>
                  Load Sample Data
                </Button>
                {connectionId && (
                  <Button variant="default" size="sm" onClick={fetchTenantLicenses}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Fetch from Tenant
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {isAnalyzing && (
        <Card className="glass-panel border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing license allocations and finding savings...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Spend</p>
                    <p className="text-2xl font-bold">{formatCurrency(result.summary.totalMonthlySpend)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-green-500/20 border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Potential Savings</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(result.summary.potentialSavings)}</p>
                    <p className="text-xs text-green-400/70">{result.summary.savingsPercentage}% reduction</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-green-400/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Optimization Score</p>
                    <p className="text-2xl font-bold">{result.summary.optimizationScore}/100</p>
                  </div>
                  <Target className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <Progress value={result.summary.optimizationScore} className="mt-2 h-1.5" />
              </CardContent>
            </Card>

            <Card className="glass-panel border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Utilization Rate</p>
                    <p className="text-2xl font-bold">{result.currentState?.utilizationRate || 0}%</p>
                  </div>
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <Progress value={result.currentState?.utilizationRate || 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Wins */}
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Quick Wins
                </CardTitle>
                <CardDescription>Low-effort, high-impact savings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.quickWins?.slice(0, 5).map((win, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <p className="text-sm">{win.action}</p>
                        <p className={`text-xs ${getEffortColor(win.effort)}`}>
                          {win.effort} effort
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-400 border-green-400/30">
                        {formatCurrency(win.savings)}/mo
                      </Badge>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">No quick wins found</p>}
                </div>
              </CardContent>
            </Card>

            {/* License Breakdown from AI */}
            <Card className="glass-panel border-border/50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  AI License Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {result.currentState?.licensesByType?.map((license, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{license.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(license.totalMonthlyCost)}/mo
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{license.assigned}/{license.total} assigned</span>
                          <span>{formatCurrency(license.monthlyPerUserCost)}/user</span>
                        </div>
                        <Progress 
                          value={(license.assigned / license.total) * 100} 
                          className="mt-2 h-1"
                        />
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No license data</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Optimization Recommendations</CardTitle>
              <CardDescription>Prioritized actions to reduce license costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.recommendations?.map((rec) => (
                  <Collapsible
                    key={rec.id}
                    open={expandedRec === rec.id}
                    onOpenChange={(open) => setExpandedRec(open ? rec.id : null)}
                  >
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                            <div className="text-left">
                              <p className="text-sm font-medium">{rec.title}</p>
                              <p className="text-xs text-muted-foreground">{rec.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium text-green-400">
                                {formatCurrency(rec.estimatedSavings)}/mo
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.affectedUsers} users
                              </p>
                            </div>
                            {expandedRec === rec.id ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground mb-1">Current State</p>
                              <p className="text-sm">{rec.currentState}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-primary/10">
                              <p className="text-xs text-muted-foreground mb-1">Proposed Action</p>
                              <p className="text-sm">{rec.proposedAction}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Implementation Steps</p>
                            <div className="space-y-2">
                              {rec.implementationSteps?.map((step, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                  {step}
                                </div>
                              ))}
                            </div>
                          </div>

                          {rec.risks?.length > 0 && (
                            <div className="p-3 rounded-lg bg-orange-500/10">
                              <p className="text-xs text-orange-400 mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Risks
                              </p>
                              <ul className="text-sm space-y-1">
                                {rec.risks.map((risk, i) => (
                                  <li key={i} className="text-orange-300/80">• {risk}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Time to implement: {rec.timeToImplement}</span>
                            <Badge variant="outline">{rec.category}</Badge>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )) || <p className="text-sm text-muted-foreground">No recommendations available</p>}
              </div>
            </CardContent>
          </Card>

          {/* Long-term Strategy */}
          {result.longTermStrategy && (
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Long-term Strategy
                </CardTitle>
                <CardDescription>
                  Timeline: {result.longTermStrategy.timeline} • 
                  Projected Annual Savings: {formatCurrency(result.longTermStrategy.projectedAnnualSavings)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.longTermStrategy.recommendations?.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benchmarks */}
          {result.benchmarks && (
            <Card className="glass-panel border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Industry Benchmarks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">License Utilization</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold">{result.benchmarks.yourUtilization}%</p>
                        <p className="text-xs text-muted-foreground">Your rate</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold text-muted-foreground">{result.benchmarks.industryAvgUtilization}%</p>
                        <p className="text-xs text-muted-foreground">Industry avg</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">Cost Per User</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold">{formatCurrency(result.benchmarks.yourCostPerUser)}</p>
                        <p className="text-xs text-muted-foreground">Your cost</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(result.benchmarks.industryAvgCostPerUser)}</p>
                        <p className="text-xs text-muted-foreground">Industry avg</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
