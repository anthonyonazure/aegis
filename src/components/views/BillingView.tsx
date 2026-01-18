import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { 
  RefreshCw,
  DollarSign,
  Users,
  Laptop,
  Package,
  Building2,
  Download,
  Calendar,
  Plus,
  Loader2,
  Zap,
  Trash2,
  Edit,
  Filter
} from 'lucide-react';
import { 
  getBillingUsage,
  createBillingUsage,
  updateBillingUsage,
  deleteBillingUsage,
  BillingUsage
} from '@/lib/reportDatabase';
import { getCustomers } from '@/lib/customerDatabase';
import { Customer } from '@/types/tenant';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { collectUsage, exportToCsv, formatCurrency } from '@/lib/billingApi';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const BillingView = () => {
  const { toast } = useToast();
  const { selectedCustomerId, customers: tenantCustomers } = useTenant();
  const [allUsage, setAllUsage] = useState<BillingUsage[]>([]);
  const [usage, setUsage] = useState<BillingUsage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingUsage | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    total_resources: 0,
    total_users: 0,
    total_devices: 0,
    billable_amount: 0,
    notes: '',
  });

  const selectedCustomerName = tenantCustomers.find(c => c.id === selectedCustomerId)?.name;

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  // Filter usage when customer selection changes
  useEffect(() => {
    if (selectedCustomerId) {
      setUsage(allUsage.filter(u => u.customer_id === selectedCustomerId));
    } else {
      setUsage(allUsage);
    }
  }, [selectedCustomerId, allUsage]);

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
      case 'year':
        return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) };
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
      setAllUsage(usageData);
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

  const handleCollectUsage = async () => {
    setCollecting(true);
    try {
      const result = await collectUsage();
      
      if (result.collected > 0) {
        toast({
          title: 'Usage Collected',
          description: `Collected data from ${result.collected} tenant(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        });
        loadData();
      } else if (result.failed > 0) {
        toast({
          title: 'Collection Failed',
          description: `Failed to collect from ${result.failed} tenant(s). Check credentials.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'No Tenants',
          description: 'No connected tenants found to collect usage from',
        });
      }
    } catch (error) {
      console.error('Failed to collect usage:', error);
      toast({
        title: 'Error',
        description: 'Failed to collect usage data',
        variant: 'destructive',
      });
    } finally {
      setCollecting(false);
    }
  };

  const handleAddRecord = async () => {
    try {
      const { start, end } = getPeriodDates();
      await createBillingUsage({
        customer_id: formData.customer_id || null,
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
        resource_counts: {},
        total_resources: formData.total_resources,
        total_users: formData.total_users,
        total_devices: formData.total_devices,
        billable_amount: formData.billable_amount,
        notes: formData.notes || null,
      });
      
      toast({ title: 'Success', description: 'Billing record added' });
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to add record:', error);
      toast({
        title: 'Error',
        description: 'Failed to add billing record',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;
    
    try {
      await updateBillingUsage(editingRecord.id, {
        total_resources: formData.total_resources,
        total_users: formData.total_users,
        total_devices: formData.total_devices,
        billable_amount: formData.billable_amount,
        notes: formData.notes || null,
      });
      
      toast({ title: 'Success', description: 'Billing record updated' });
      setEditingRecord(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to update record:', error);
      toast({
        title: 'Error',
        description: 'Failed to update billing record',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteBillingUsage(id);
      toast({ title: 'Success', description: 'Billing record deleted' });
      loadData();
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete billing record',
        variant: 'destructive',
      });
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      customerBreakdown.map(c => ({
        customerName: c.customerName,
        resources: c.resources,
        users: c.users,
        devices: c.devices,
        billable: c.billable,
      })),
      `billing_usage_${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
    toast({ title: 'Exported', description: 'CSV file downloaded' });
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      total_resources: 0,
      total_users: 0,
      total_devices: 0,
      billable_amount: 0,
      notes: '',
    });
  };

  const openEditDialog = (record: BillingUsage) => {
    setEditingRecord(record);
    setFormData({
      customer_id: record.customer_id || '',
      total_resources: record.total_resources,
      total_users: record.total_users,
      total_devices: record.total_devices,
      billable_amount: record.billable_amount || 0,
      notes: record.notes || '',
    });
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
      const customerId = record.customer_id || 'unassigned';
      const existing = breakdown.get(customerId) || { resources: 0, users: 0, devices: 0, billable: 0 };
      breakdown.set(customerId, {
        resources: existing.resources + record.total_resources,
        users: existing.users + record.total_users,
        devices: existing.devices + record.total_devices,
        billable: existing.billable + (record.billable_amount || 0),
      });
    }
    
    return Array.from(breakdown.entries()).map(([customerId, data]) => ({
      customerId,
      customerName: customerId === 'unassigned' ? 'Unassigned' : customers.find(c => c.id === customerId)?.name || 'Unknown',
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

  const trendData = useMemo(() => {
    const grouped = new Map<string, { resources: number; users: number; devices: number }>();
    
    for (const record of usage) {
      const month = format(new Date(record.period_start), 'MMM yyyy');
      const existing = grouped.get(month) || { resources: 0, users: 0, devices: 0 };
      grouped.set(month, {
        resources: existing.resources + record.total_resources,
        users: existing.users + record.total_users,
        devices: existing.devices + record.total_devices,
      });
    }
    
    return Array.from(grouped.entries())
      .map(([month, data]) => ({ month, ...data }))
      .reverse();
  }, [usage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Usage</h1>
          <p className="text-muted-foreground">Track resource counts and billing across tenants</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="last3">Last 3 Months</SelectItem>
              <SelectItem value="last6">Last 6 Months</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={customerBreakdown.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleCollectUsage} disabled={collecting}>
            {collecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Collect Usage
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Billing Record</DialogTitle>
                <DialogDescription>Manually add a billing usage record</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resources</Label>
                    <Input type="number" value={formData.total_resources} onChange={(e) => setFormData({ ...formData, total_resources: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Users</Label>
                    <Input type="number" value={formData.total_users} onChange={(e) => setFormData({ ...formData, total_users: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Devices</Label>
                    <Input type="number" value={formData.total_devices} onChange={(e) => setFormData({ ...formData, total_devices: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Billable Amount ($)</Label>
                    <Input type="number" step="0.01" value={formData.billable_amount} onChange={(e) => setFormData({ ...formData, billable_amount: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddRecord}>Add Record</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Showing billing data for customer: <strong>{selectedCustomerName || 'Selected Customer'}</strong>
          </AlertDescription>
        </Alert>
      )}

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
                <p className="text-2xl font-bold">{formatCurrency(stats.totalBillable)}</p>
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
                    {pieChartData.map((_, index) => (
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
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Trend</CardTitle>
            <CardDescription>Resource counts over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="resources" stroke="hsl(var(--primary))" name="Resources" />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-2))" name="Users" />
                <Line type="monotone" dataKey="devices" stroke="hsl(var(--chart-3))" name="Devices" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
              <p className="text-muted-foreground mb-4">
                Click "Collect Usage" to gather data from connected tenants, or add records manually.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleCollectUsage} disabled={collecting}>
                  {collecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Collect Usage
                </Button>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manually
                </Button>
              </div>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerBreakdown.map((row) => (
                    <TableRow key={row.customerId}>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell className="text-right">{row.resources.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.users.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.devices.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.billable)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            const record = usage.find(u => u.customer_id === row.customerId || (!u.customer_id && row.customerId === 'unassigned'));
                            if (record) openEditDialog(record);
                          }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Raw Usage Records */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Records</CardTitle>
          <CardDescription>Individual billing records</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Resources</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Devices</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {format(new Date(record.period_start), 'MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {customers.find(c => c.id === record.customer_id)?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-right">{record.total_resources.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{record.total_users.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{record.total_devices.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.billable_amount || 0)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {record.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(record)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRecord(record.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Record</DialogTitle>
            <DialogDescription>Update the billing usage record</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resources</Label>
                <Input type="number" value={formData.total_resources} onChange={(e) => setFormData({ ...formData, total_resources: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Users</Label>
                <Input type="number" value={formData.total_users} onChange={(e) => setFormData({ ...formData, total_users: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Devices</Label>
                <Input type="number" value={formData.total_devices} onChange={(e) => setFormData({ ...formData, total_devices: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Billable Amount ($)</Label>
                <Input type="number" step="0.01" value={formData.billable_amount} onChange={(e) => setFormData({ ...formData, billable_amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button onClick={handleUpdateRecord}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
