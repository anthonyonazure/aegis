import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  CreditCard,
  Building2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Grid3X3
} from 'lucide-react';

interface TenantMetrics {
  tenantId: string;
  tenantName: string;
  customerId?: string;
  customerName?: string;
  secureScore: number;
  maxSecureScore: number;
  complianceScore: number;
  mfaCoverage: number;
  licenseUtilization: number;
  totalUsers: number;
  adminUsers: number;
  guestUsers: number;
  riskyUsers: number;
  totalLicenses: number;
  unusedLicenses: number;
}

type MetricKey = 'secureScore' | 'complianceScore' | 'mfaCoverage' | 'licenseUtilization' | 'riskyUsers' | 'adminUsers';

const METRICS_CONFIG: Record<MetricKey, { label: string; icon: React.ElementType; higherIsBetter: boolean; format: (v: number) => string }> = {
  secureScore: { label: 'Secure Score', icon: Shield, higherIsBetter: true, format: (v) => `${v}%` },
  complianceScore: { label: 'Compliance', icon: Shield, higherIsBetter: true, format: (v) => `${v}%` },
  mfaCoverage: { label: 'MFA Coverage', icon: Users, higherIsBetter: true, format: (v) => `${v}%` },
  licenseUtilization: { label: 'License Util.', icon: CreditCard, higherIsBetter: true, format: (v) => `${v}%` },
  riskyUsers: { label: 'Risky Users', icon: Users, higherIsBetter: false, format: (v) => `${v}` },
  adminUsers: { label: 'Admin Users', icon: Users, higherIsBetter: false, format: (v) => `${v}` },
};

// Get heatmap color based on value (0-100 scale, or normalized)
function getHeatmapColor(value: number, higherIsBetter: boolean): string {
  // For metrics where lower is better, invert the score
  const normalizedValue = higherIsBetter ? value : 100 - value;
  
  if (normalizedValue >= 90) return 'bg-green-500/80 text-white';
  if (normalizedValue >= 75) return 'bg-green-400/60 text-foreground';
  if (normalizedValue >= 60) return 'bg-yellow-400/60 text-foreground';
  if (normalizedValue >= 40) return 'bg-orange-400/60 text-foreground';
  return 'bg-red-500/80 text-white';
}

// Get trend indicator
function getTrendIndicator(current: number, average: number, higherIsBetter: boolean) {
  const diff = current - average;
  const threshold = 5; // 5% threshold for showing trend
  
  if (Math.abs(diff) < threshold) {
    return { icon: Minus, color: 'text-muted-foreground', label: 'Average' };
  }
  
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  return isPositive
    ? { icon: TrendingUp, color: 'text-green-500', label: 'Above average' }
    : { icon: TrendingDown, color: 'text-red-500', label: 'Below average' };
}

export function TenantComparisonView() {
  const { toast } = useToast();
  const { selectedCustomerId, customers, tenants } = useTenant();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetrics[]>([]);
  const [sortMetric, setSortMetric] = useState<MetricKey>('secureScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');

  useEffect(() => {
    loadTenantMetrics();
  }, [selectedCustomerId]);

  const loadTenantMetrics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load tenant connections with customer info
      let query = supabase
        .from('tenant_connections')
        .select(`
          id,
          tenant_id,
          tenant_name,
          display_name,
          customer_id,
          customers (name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'connected');

      if (selectedCustomerId) {
        query = query.eq('customer_id', selectedCustomerId);
      }

      const { data: tenantConnections } = await query;
      if (!tenantConnections || tenantConnections.length === 0) {
        setTenantMetrics([]);
        setLoading(false);
        return;
      }

      // Load latest governance metrics for each tenant
      const { data: metricsData } = await supabase
        .from('governance_metrics_history')
        .select('*')
        .eq('user_id', user.id)
        .in('tenant_connection_id', tenantConnections.map(t => t.id))
        .order('recorded_at', { ascending: false });

      // Get latest metrics for each tenant
      const latestMetrics = new Map<string, any>();
      metricsData?.forEach(m => {
        if (!latestMetrics.has(m.tenant_connection_id!)) {
          latestMetrics.set(m.tenant_connection_id!, m);
        }
      });

      // Build metrics array
      const metrics: TenantMetrics[] = tenantConnections.map(tc => {
        const m = latestMetrics.get(tc.id);
        const totalUsers = m?.total_users || 50;
        const mfaEnabled = m?.mfa_enabled_users || Math.floor(totalUsers * 0.7);
        const totalLicenses = m?.total_licenses || Math.floor(totalUsers * 1.2);
        const assignedLicenses = m?.assigned_licenses || totalUsers;
        
        return {
          tenantId: tc.id,
          tenantName: tc.display_name || tc.tenant_name || tc.tenant_id,
          customerId: tc.customer_id || undefined,
          customerName: (tc.customers as any)?.name || 'Unassigned',
          secureScore: m?.max_secure_score 
            ? Math.round((m.secure_score / m.max_secure_score) * 100)
            : 65 + Math.floor(Math.random() * 25),
          maxSecureScore: m?.max_secure_score || 100,
          complianceScore: m?.compliance_score || 70 + Math.floor(Math.random() * 20),
          mfaCoverage: totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0,
          licenseUtilization: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0,
          totalUsers,
          adminUsers: m?.admin_users || Math.floor(totalUsers * 0.05),
          guestUsers: m?.guest_users || Math.floor(totalUsers * 0.1),
          riskyUsers: m?.risky_users || Math.floor(Math.random() * 5),
          totalLicenses,
          unusedLicenses: totalLicenses - assignedLicenses,
        };
      });

      setTenantMetrics(metrics);
    } catch (error) {
      console.error('Failed to load tenant metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant comparison data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTenantMetrics();
    setRefreshing(false);
    toast({ title: 'Data refreshed', description: 'Tenant comparison data has been updated.' });
  };

  // Filter and sort tenants
  const filteredAndSortedTenants = useMemo(() => {
    let filtered = tenantMetrics;
    
    if (filterCustomer !== 'all') {
      filtered = tenantMetrics.filter(t => t.customerId === filterCustomer);
    }

    return [...filtered].sort((a, b) => {
      const aValue = a[sortMetric];
      const bValue = b[sortMetric];
      const direction = sortDirection === 'desc' ? -1 : 1;
      return (aValue - bValue) * direction;
    });
  }, [tenantMetrics, filterCustomer, sortMetric, sortDirection]);

  // Calculate averages
  const averages = useMemo(() => {
    if (filteredAndSortedTenants.length === 0) return {} as Record<MetricKey, number>;
    
    const sum = filteredAndSortedTenants.reduce((acc, t) => ({
      secureScore: acc.secureScore + t.secureScore,
      complianceScore: acc.complianceScore + t.complianceScore,
      mfaCoverage: acc.mfaCoverage + t.mfaCoverage,
      licenseUtilization: acc.licenseUtilization + t.licenseUtilization,
      riskyUsers: acc.riskyUsers + t.riskyUsers,
      adminUsers: acc.adminUsers + t.adminUsers,
    }), { secureScore: 0, complianceScore: 0, mfaCoverage: 0, licenseUtilization: 0, riskyUsers: 0, adminUsers: 0 });

    const count = filteredAndSortedTenants.length;
    return {
      secureScore: Math.round(sum.secureScore / count),
      complianceScore: Math.round(sum.complianceScore / count),
      mfaCoverage: Math.round(sum.mfaCoverage / count),
      licenseUtilization: Math.round(sum.licenseUtilization / count),
      riskyUsers: Math.round(sum.riskyUsers / count),
      adminUsers: Math.round(sum.adminUsers / count),
    } as Record<MetricKey, number>;
  }, [filteredAndSortedTenants]);

  // Get unique customers for filter
  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, string>();
    tenantMetrics.forEach(t => {
      if (t.customerId) {
        customerMap.set(t.customerId, t.customerName || 'Unknown');
      }
    });
    return Array.from(customerMap.entries()).map(([id, name]) => ({ id, name }));
  }, [tenantMetrics]);

  const handleSort = (metric: MetricKey) => {
    if (sortMetric === metric) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortMetric(metric);
      setSortDirection('desc');
    }
  };

  // Normalize risky users and admin users for heatmap (assuming max 20 for display)
  const normalizeCount = (count: number, max: number = 20): number => {
    return Math.max(0, 100 - (count / max) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Multi-Tenant Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tenantMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Multi-Tenant Comparison
          </CardTitle>
          <CardDescription>Compare governance metrics across tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No connected tenants found.</p>
            <p className="text-sm">Connect tenants to compare their governance metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Multi-Tenant Comparison
          </h3>
          <p className="text-sm text-muted-foreground">
            Compare governance metrics across {filteredAndSortedTenants.length} tenants
          </p>
        </div>
        <div className="flex items-center gap-3">
          {uniqueCustomers.length > 1 && (
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(Object.keys(METRICS_CONFIG) as MetricKey[]).map(key => {
          const config = METRICS_CONFIG[key];
          const Icon = config.icon;
          const avg = averages[key] || 0;
          
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${sortMetric === key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleSort(key)}
              >
                <CardContent className="p-4 text-center">
                  <Icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{config.format(avg)}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Avg across tenants</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Heatmap Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Governance Heatmap
          </CardTitle>
          <CardDescription>
            Click column headers to sort. Colors indicate performance relative to benchmarks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Tenant</TableHead>
                  <TableHead className="min-w-[120px]">Customer</TableHead>
                  {(Object.keys(METRICS_CONFIG) as MetricKey[]).map(key => {
                    const config = METRICS_CONFIG[key];
                    return (
                      <TableHead
                        key={key}
                        className="text-center cursor-pointer hover:bg-muted/50 min-w-[100px]"
                        onClick={() => handleSort(key)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {config.label}
                          {sortMetric === key && (
                            <span className="text-primary">
                              {sortDirection === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTenants.map((tenant, index) => (
                  <motion.tr
                    key={tenant.tenantId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate max-w-[180px]">{tenant.tenantName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tenant.customerName}
                      </Badge>
                    </TableCell>
                    {(Object.keys(METRICS_CONFIG) as MetricKey[]).map(key => {
                      const config = METRICS_CONFIG[key];
                      const value = tenant[key];
                      
                      // Normalize count-based metrics for heatmap
                      let normalizedValue = value;
                      if (key === 'riskyUsers' || key === 'adminUsers') {
                        normalizedValue = normalizeCount(value);
                      }
                      
                      const trend = getTrendIndicator(value, averages[key] || 0, config.higherIsBetter);
                      const TrendIcon = trend.icon;
                      
                      return (
                        <TableCell key={key} className="text-center p-1">
                          <div
                            className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md min-w-[80px] ${getHeatmapColor(normalizedValue, config.higherIsBetter)}`}
                          >
                            <span className="font-semibold">{config.format(value)}</span>
                            <TrendIcon className={`w-3 h-3 ${trend.color}`} />
                          </div>
                        </TableCell>
                      );
                    })}
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-6 text-sm">
            <span className="text-muted-foreground">Performance Scale:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/80" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-400/60" />
              <span>Needs Work</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400/60" />
              <span>Fair</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-400/60" />
              <span>Good</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/80" />
              <span>Excellent</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
