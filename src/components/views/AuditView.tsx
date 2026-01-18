import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  History, 
  Search,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  FileText,
  Shield,
  Upload,
  Link,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatAuditAction } from '@/lib/auditLog';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  tenant_connection_id: string | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  tenant_connect: <Link className="w-4 h-4" />,
  tenant_disconnect: <XCircle className="w-4 h-4" />,
  export_start: <Download className="w-4 h-4" />,
  export_complete: <CheckCircle2 className="w-4 h-4" />,
  export_failed: <XCircle className="w-4 h-4" />,
  import_start: <Upload className="w-4 h-4" />,
  import_complete: <CheckCircle2 className="w-4 h-4" />,
  import_failed: <XCircle className="w-4 h-4" />,
  import_rollback: <RefreshCw className="w-4 h-4" />,
  validation_run: <Shield className="w-4 h-4" />,
  compliance_check: <Shield className="w-4 h-4" />,
  drift_detection: <AlertTriangle className="w-4 h-4" />,
  resource_download: <FileText className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  tenant_connect: 'text-green-400',
  tenant_disconnect: 'text-red-400',
  export_start: 'text-blue-400',
  export_complete: 'text-green-400',
  export_failed: 'text-red-400',
  import_start: 'text-purple-400',
  import_complete: 'text-green-400',
  import_failed: 'text-red-400',
  import_rollback: 'text-orange-400',
  validation_run: 'text-blue-400',
  compliance_check: 'text-cyan-400',
  drift_detection: 'text-yellow-400',
  resource_download: 'text-muted-foreground',
};

export const AuditView = () => {
  const { toast } = useToast();
  const { selectedCustomerId, selectedTenantId, customers } = useTenant();
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tenantConnectionIds, setTenantConnectionIds] = useState<string[]>([]);

  // Load tenant connection IDs for the selected customer
  useEffect(() => {
    const loadTenantConnections = async () => {
      if (!selectedCustomerId) {
        setTenantConnectionIds([]);
        return;
      }
      
      const { data } = await supabase
        .from('tenant_connections')
        .select('id')
        .eq('customer_id', selectedCustomerId);
      
      setTenantConnectionIds((data || []).map(t => t.id));
    };
    
    loadTenantConnections();
  }, [selectedCustomerId]);

  // Filter logs when selection or allLogs changes
  useEffect(() => {
    if (selectedTenantId) {
      setLogs(allLogs.filter(log => log.tenant_connection_id === selectedTenantId));
    } else if (selectedCustomerId && tenantConnectionIds.length > 0) {
      setLogs(allLogs.filter(log => 
        log.tenant_connection_id && tenantConnectionIds.includes(log.tenant_connection_id)
      ));
    } else {
      setLogs(allLogs);
    }
  }, [allLogs, selectedTenantId, selectedCustomerId, tenantConnectionIds]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAllLogs((data || []).map(log => ({
        ...log,
        details: (log.details as Record<string, unknown>) || {},
      })));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'Resource Type', 'Resource ID', 'Details'].join(','),
      ...filteredLogs.map(log => [
        log.created_at,
        log.action,
        log.resource_type || '',
        log.resource_id || '',
        JSON.stringify(log.details),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported',
      description: `Exported ${filteredLogs.length} audit log entries`,
    });
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
          <p className="text-muted-foreground mt-1">
            Track all actions performed in your M365 configuration management
          </p>
        </div>

      {/* Customer/Tenant Filter Alert */}
      {(selectedCustomerId || selectedTenantId) && (
        <Alert className="mb-4 border-primary/50 bg-primary/5">
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            {selectedTenantId 
              ? 'Showing audit logs for the selected tenant only.'
              : `Showing audit logs for customer: ${selectedCustomerName || 'Selected Customer'}`
            }
          </AlertDescription>
        </Alert>
      )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-panel border-border/50">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {formatAuditAction(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Activity Log
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} entries {searchQuery || actionFilter !== 'all' ? '(filtered)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredLogs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className={cn("mt-1", ACTION_COLORS[log.action] || 'text-muted-foreground')}>
                      {ACTION_ICONS[log.action] || <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {formatAuditAction(log.action)}
                        </span>
                        {log.resource_type && (
                          <Badge variant="outline" className="text-xs">
                            {log.resource_type}
                          </Badge>
                        )}
                      </div>
                      {log.resource_id && (
                        <p className="text-sm text-muted-foreground truncate">
                          Resource: {log.resource_id}
                        </p>
                      )}
                      {Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(log.details).slice(0, 100)}
                          {JSON.stringify(log.details).length > 100 && '...'}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
