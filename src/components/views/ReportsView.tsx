import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Download,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarIcon,
  BarChart3,
  Shield,
  GitCompare,
  DollarSign,
  FileCheck,
  Loader2
} from 'lucide-react';
import { 
  getReports, 
  createReport, 
  deleteReport,
  Report,
  REPORT_TYPES,
  ReportType
} from '@/lib/reportDatabase';
import { getCustomers } from '@/lib/customerDatabase';
import { Customer } from '@/types/tenant';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export const ReportsView = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    report_type: 'executive_summary' as ReportType,
    customer_id: '' as string | undefined,
    date_range_start: undefined as Date | undefined,
    date_range_end: undefined as Date | undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsData, customersData] = await Promise.all([
        getReports(),
        getCustomers(),
      ]);
      setReports(reportsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Create the report record
      const report = await createReport({
        name: formData.name || `${REPORT_TYPES.find(t => t.id === formData.report_type)?.name} - ${format(new Date(), 'MMM d, yyyy')}`,
        report_type: formData.report_type,
        customer_id: formData.customer_id || null,
        date_range_start: formData.date_range_start?.toISOString() || null,
        date_range_end: formData.date_range_end?.toISOString() || null,
        status: 'generating',
        data: {},
      });

      // Call edge function to generate report
      const { error } = await supabase.functions.invoke('generate-report', {
        body: {
          reportId: report.id,
          reportType: formData.report_type,
          customerId: formData.customer_id,
          dateRangeStart: formData.date_range_start?.toISOString(),
          dateRangeEnd: formData.date_range_end?.toISOString(),
        },
      });

      if (error) {
        console.error('Failed to generate report:', error);
        toast({
          title: 'Generation Started',
          description: 'Report generation has been queued. Refresh to see status.',
        });
      } else {
        toast({ title: 'Success', description: 'Report generated successfully' });
      }

      setShowGenerateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id);
      toast({ title: 'Success', description: 'Report deleted' });
      loadData();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete report',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      report_type: 'executive_summary',
      customer_id: undefined,
      date_range_start: undefined,
      date_range_end: undefined,
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'executive_summary':
        return <FileText className="w-4 h-4" />;
      case 'compliance':
        return <FileCheck className="w-4 h-4" />;
      case 'drift':
        return <GitCompare className="w-4 h-4" />;
      case 'billing':
        return <DollarSign className="w-4 h-4" />;
      case 'security':
        return <Shield className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'generating':
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReportTypeBadge = (type: string) => {
    const reportType = REPORT_TYPES.find(t => t.id === type);
    return (
      <Badge variant="outline" className="gap-1">
        {getReportTypeIcon(type)}
        {reportType?.name || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Generate executive summaries, compliance reports, and more</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate Report</DialogTitle>
                <DialogDescription>
                  Create a professional report for your clients
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select
                    value={formData.report_type}
                    onValueChange={(value) => setFormData({ ...formData, report_type: value as ReportType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            {getReportTypeIcon(type.id)}
                            <div>
                              <div>{type.name}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Report Name (Optional)</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Auto-generated if left blank"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Customer (Optional)</Label>
                  <Select
                    value={formData.customer_id || 'all'}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value === 'all' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.date_range_start && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_range_start ? format(formData.date_range_start, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date_range_start}
                          onSelect={(date) => setFormData({ ...formData, date_range_start: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.date_range_end && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_range_end ? format(formData.date_range_end, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date_range_end}
                          onSelect={(date) => setFormData({ ...formData, date_range_end: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'completed').length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'generating').length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <BarChart3 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.report_type === 'executive_summary').length}</p>
                <p className="text-sm text-muted-foreground">Executive Summaries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>View and download your generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Reports Yet</h3>
              <p className="text-muted-foreground mb-4">
                Generate your first report to get started
              </p>
              <Button onClick={() => setShowGenerateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const customer = customers.find(c => c.id === report.customer_id);
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell>{getReportTypeBadge(report.report_type)}</TableCell>
                        <TableCell>
                          {customer ? (
                            <span>{customer.name}</span>
                          ) : (
                            <span className="text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(report.generated_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {report.status === 'completed' && (
                              <Button variant="ghost" size="sm">
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(report.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
