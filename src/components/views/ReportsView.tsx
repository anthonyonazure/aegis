import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
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
  Loader2,
  Eye,
  Filter,
  Search,
  Users,
  Laptop,
  Mail,
  HardDrive,
  MessageSquare,
  CreditCard,
  Sparkles,
  Activity,
  Play,
  FileBarChart
} from 'lucide-react';
import { 
  getReports, 
  createReport, 
  deleteReport,
  Report,
  REPORT_TYPES,
  ReportType
} from '@/lib/reportDatabase';
import { 
  REPORT_TEMPLATES, 
  REPORT_CATEGORIES, 
  ReportTemplate, 
  ReportCategory,
  getTemplatesByCategory,
  searchTemplates,
  getTemplateCount,
  getCategoryStats
} from '@/lib/reportTemplates';
import { getCustomers } from '@/lib/customerDatabase';
import { Customer } from '@/types/tenant';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ReportViewerDialog } from '@/components/ReportViewerDialog';
import { generateReportPdf } from '@/lib/reportPdfGenerator';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'security': return <Shield className="w-4 h-4" />;
    case 'compliance': return <CheckCircle2 className="w-4 h-4" />;
    case 'identity': return <Users className="w-4 h-4" />;
    case 'devices': return <Laptop className="w-4 h-4" />;
    case 'exchange': return <Mail className="w-4 h-4" />;
    case 'sharepoint': return <HardDrive className="w-4 h-4" />;
    case 'teams': return <MessageSquare className="w-4 h-4" />;
    case 'licensing': return <CreditCard className="w-4 h-4" />;
    case 'copilot': return <Sparkles className="w-4 h-4" />;
    case 'drift': return <GitCompare className="w-4 h-4" />;
    case 'tenant_health': return <Activity className="w-4 h-4" />;
    case 'billing': return <BarChart3 className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

export const ReportsView = () => {
  const { toast } = useToast();
  const { selectedCustomerId, customers: contextCustomers } = useTenant();
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  
  // Template browsing state
  const [activeTab, setActiveTab] = useState<'templates' | 'generated'>('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  // Get selected customer name for display
  const selectedCustomerName = selectedCustomerId 
    ? contextCustomers.find(c => c.id === selectedCustomerId)?.name 
    : null;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    report_type: 'executive_summary' as ReportType,
    customer_id: '' as string | undefined,
    date_range_start: undefined as Date | undefined,
    date_range_end: undefined as Date | undefined,
  });

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates = REPORT_TEMPLATES;
    
    if (selectedCategory !== 'all') {
      templates = getTemplatesByCategory(selectedCategory);
    }
    
    if (searchQuery) {
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return templates;
  }, [searchQuery, selectedCategory]);

  // Category stats for sidebar
  const categoryStats = useMemo(() => getCategoryStats(), []);

  useEffect(() => {
    loadData();
  }, []);

  // Filter reports when customer selection changes
  useEffect(() => {
    if (selectedCustomerId) {
      setReports(allReports.filter(report => report.customer_id === selectedCustomerId));
    } else {
      setReports(allReports);
    }
  }, [selectedCustomerId, allReports]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsData, customersData] = await Promise.all([
        getReports(),
        getCustomers(),
      ]);
      setAllReports(reportsData);
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

  const handleGenerateFromTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: '',
      report_type: 'executive_summary', // Will be overridden
      customer_id: undefined,
      date_range_start: undefined,
      date_range_end: undefined,
    });
    setShowGenerateDialog(true);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const reportName = formData.name || 
        (selectedTemplate ? `${selectedTemplate.name} - ${format(new Date(), 'MMM d, yyyy')}` : 
        `${REPORT_TYPES.find(t => t.id === formData.report_type)?.name} - ${format(new Date(), 'MMM d, yyyy')}`);
      
      const reportType = selectedTemplate ? 
        (selectedTemplate.category === 'compliance' ? 'compliance' :
         selectedTemplate.category === 'security' ? 'security' :
         selectedTemplate.category === 'drift' ? 'drift' :
         selectedTemplate.category === 'billing' ? 'billing' :
         selectedTemplate.category === 'tenant_health' ? 'tenant_summary' :
         'executive_summary') as ReportType : formData.report_type;

      // Create the report record
      const report = await createReport({
        name: reportName,
        report_type: reportType,
        customer_id: formData.customer_id || null,
        date_range_start: formData.date_range_start?.toISOString() || null,
        date_range_end: formData.date_range_end?.toISOString() || null,
        status: 'generating',
        data: selectedTemplate ? { templateId: selectedTemplate.id, templateName: selectedTemplate.name } : {},
      });

      // Call edge function to generate report
      const { error } = await supabase.functions.invoke('generate-report', {
        body: {
          reportId: report.id,
          reportType: reportType,
          templateId: selectedTemplate?.id,
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
      setSelectedTemplate(null);
      resetForm();
      loadData();
      setActiveTab('generated');
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
      case 'executive_summary': return <FileText className="w-4 h-4" />;
      case 'tenant_summary': return <BarChart3 className="w-4 h-4" />;
      case 'compliance': return <FileCheck className="w-4 h-4" />;
      case 'drift': return <GitCompare className="w-4 h-4" />;
      case 'billing': return <DollarSign className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'psa_tickets': return <Clock className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'generating': return <Badge variant="outline" className="text-blue-500 border-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
      case 'completed': return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
          <p className="text-muted-foreground">
            {getTemplateCount()} out-of-the-box report templates across {REPORT_CATEGORIES.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Customer filter indicator */}
      {selectedCustomerId && (
        <Alert className="border-primary/50 bg-primary/5">
          <Filter className="h-4 w-4" />
          <AlertDescription>
            Filtering by <strong>{selectedCustomerName}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileBarChart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{getTemplateCount()}</p>
                <p className="text-sm text-muted-foreground">Report Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-sm text-muted-foreground">Generated Reports</p>
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
              <div className="p-2 rounded-lg bg-orange-500/10">
                <RefreshCw className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'generating').length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'generated')}>
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <FileBarChart className="w-4 h-4" />
            Report Templates ({getTemplateCount()})
          </TabsTrigger>
          <TabsTrigger value="generated" className="gap-2">
            <FileText className="w-4 h-4" />
            Generated Reports ({reports.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Category Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Categories</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1 p-2">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                          selectedCategory === 'all' 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          All Reports
                        </span>
                        <Badge variant="secondary" className="text-xs">{getTemplateCount()}</Badge>
                      </button>
                      
                      {REPORT_CATEGORIES.map((category) => {
                        const stats = categoryStats.find(s => s.category === category.id);
                        return (
                          <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                              selectedCategory === category.id 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {getCategoryIcon(category.id)}
                              {category.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">{stats?.count || 0}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Templates Grid */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search report templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'} found
                  {selectedCategory !== 'all' && ` in ${REPORT_CATEGORIES.find(c => c.id === selectedCategory)?.name}`}
                </p>
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                )}
              </div>

              {/* Templates Grid */}
              <ScrollArea className="h-[600px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                  {filteredTemplates.map((template) => (
                    <Card key={template.id} className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getCategoryIcon(template.category)}
                              <h3 className="font-medium text-sm truncate">{template.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {REPORT_CATEGORIES.find(c => c.id === template.category)?.name}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {template.estimatedTime}
                              </Badge>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleGenerateFromTemplate(template)}
                            className="shrink-0"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Generate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No templates found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or category filter</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        {/* Generated Reports Tab */}
        <TabsContent value="generated" className="mt-4">
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
                    Generate your first report from the templates
                  </p>
                  <Button onClick={() => setActiveTab('templates')}>
                    <FileBarChart className="w-4 h-4 mr-2" />
                    Browse Templates
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
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
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedReport(report); setShowViewer(true); }}>
                                      <Eye className="w-4 h-4 mr-1" />
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => generateReportPdf(report, customers.find(c => c.id === report.customer_id)?.name)}>
                                      <Download className="w-4 h-4 mr-1" />
                                      PDF
                                    </Button>
                                  </>
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
        </TabsContent>
      </Tabs>

      {/* Generate Report Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={(open) => { setShowGenerateDialog(open); if (!open) setSelectedTemplate(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              {selectedTemplate ? (
                <span className="flex items-center gap-2 mt-2">
                  {getCategoryIcon(selectedTemplate.category)}
                  {selectedTemplate.name}
                </span>
              ) : (
                'Create a professional report for your clients'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedTemplate && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                {selectedTemplate.description}
              </div>
            )}

            <div className="space-y-2">
              <Label>Report Name (Optional)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={selectedTemplate ? selectedTemplate.name : "Auto-generated if left blank"}
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

            {selectedTemplate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Estimated generation time: {selectedTemplate.estimatedTime}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGenerateDialog(false); setSelectedTemplate(null); }}>
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
                  <Play className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportViewerDialog
        report={selectedReport}
        customerName={customers.find(c => c.id === selectedReport?.customer_id)?.name}
        open={showViewer}
        onOpenChange={setShowViewer}
      />
    </div>
  );
};
