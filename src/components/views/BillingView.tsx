import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw,
  DollarSign,
  Users,
  Laptop,
  Package,
  TrendingUp,
  Building2,
  Download,
  Calendar
} from 'lucide-react';
import { 
  getBillingUsage,
  BillingUsage
} from '@/lib/reportDatabase';
import { getCustomers } from '@/lib/customerDatabase';
import { Customer } from '@/types/tenant';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const BillingView = () => {
  const { toast } = useToast();
  const [usage, setUsage] = useState<BillingUsage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const getPeriodDates = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'current':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last3':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'last6':
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodDates();
      const [usageData, customersData] = await Promise.all([
        getBillingUsage({
          periodStart: format(start, 'yyyy-MM-dd'),
          periodEnd: format(end, 'yyyy-MM-dd'),
        }),
        getCustomers(),
      ]);
      setUsage(usageData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load billing data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalResources = usage.reduce((sum, u) => sum + u.total_resources, 0);
    const totalUsers = usage.reduce((sum, u) => sum + u.total_users, 0);
    const totalDevices = usage.reduce((sum, u) => sum + u.total_devices, 0);
    const totalBillable = usage.reduce((sum, u) => sum + (u.billable_amount || 0), 0);
    
    return { totalResources, totalUsers, totalDevices, totalBillable };
  }, [usage]);

  const customerBreakdown = useMemo(() => {
    const breakdown = new Map<string, { resources: number; users: number; devices: number; billable: number }>();
    
    for (const record of usage) {
      if (record.customer_id) {
        const existing = breakdown.get(record.customer_id) || { resources: 0, users: 0, devices: 0, billable: 0 };
        breakdown.set(record.customer_id, {
          resources: existing.resources + record.total_resources,
          users: existing.users + record.total_users,
          devices: existing.devices + record.total_devices,
          billable: existing.billable + (record.billable_amount || 0),
        });
      }
    }
    
    return Array.from(breakdown.entries()).map(([customerId, data]) => ({
      customerId,
      customerName: customers.find(c => c.id === customerId)?.name || 'Unknown',
      ...data,
    }));
  }, [usage, customers]);

  const pieChartData = useMemo(() => {
    return customerBreakdown
      .sort((a, b) => b.resources - a.resources)
      .slice(0, 5)
      .map(c => ({
        name: c.customerName,
        value: c.resources,
      }));
  }, [customerBreakdown]);

  const barChartData = useMemo(() => {
    return customerBreakdown
      .sort((a, b) => b.billable - a.billable)
      .slice(0, 10)
      .map(c => ({
        name: c.customerName.length > 15 ? c.customerName.slice(0, 15) + '...' : c.customerName,
        amount: c.billable,
      }));
  }, [customerBreakdown]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Usage</h1>
          <p className="text-muted-foreground">Track resource counts and billing across tenants</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="last3">Last 3 Months</SelectItem>
              <SelectItem value="last6">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalResources.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Resources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Laptop className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDevices.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalBillable.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Billable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resources by Customer</CardTitle>
            <CardDescription>Top 5 customers by resource count</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billable Amount by Customer</CardTitle>
            <CardDescription>Top 10 customers by billable amount</CardDescription>
          </CardHeader>
          <CardContent>
            {barChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} layout="vertical">
                  <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Breakdown</CardTitle>
          <CardDescription>Detailed usage by customer</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : customerBreakdown.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Usage Data</h3>
              <p className="text-muted-foreground">
                Usage data will appear here as exports are run
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Resources</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Devices</TableHead>
                    <TableHead className="text-right">Billable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerBreakdown.map((row) => (
                    <TableRow key={row.customerId}>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell className="text-right">{row.resources.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.users.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.devices.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">${row.billable.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
