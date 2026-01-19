import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Users, 
  RefreshCw, 
  Loader2,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  UserX
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchLicensingStatus, LicensingStatus } from '@/lib/copilotApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';

interface CopilotLicensingTableProps {
  tenantConnectionId: string;
  tenantName: string;
}

export const CopilotLicensingTable = ({ tenantConnectionId, tenantName }: CopilotLicensingTableProps) => {
  const { toast } = useToast();
  const [licensing, setLicensing] = useState<LicensingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadLicensing = async () => {
    setIsLoading(true);
    try {
      const data = await fetchLicensingStatus(tenantConnectionId);
      setLicensing(data);
    } catch (error) {
      console.error('Failed to load licensing:', error);
      toast({
        title: 'Error',
        description: 'Failed to load licensing status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLicensing();
  }, [tenantConnectionId]);

  const getUtilizationColor = (rate: number) => {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const isInactive = (lastActive?: string) => {
    if (!lastActive) return true;
    return differenceInDays(new Date(), parseISO(lastActive)) > 30;
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Copilot Licensing Dashboard
            </CardTitle>
            <CardDescription>
              License inventory and user assignments for {tenantName}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={loadLicensing} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !licensing ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : licensing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* License Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm">Total Licenses</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{licensing.totalCopilotLicenses}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <UserCheck className="w-4 h-4" />
                  <span className="text-sm">Assigned</span>
                </div>
                <div className="text-2xl font-bold text-green-400">{licensing.assignedLicenses}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <UserX className="w-4 h-4" />
                  <span className="text-sm">Available</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">{licensing.availableLicenses}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Utilization</span>
                </div>
                <div className={cn("text-2xl font-bold", getUtilizationColor(licensing.utilizationRate))}>
                  {licensing.utilizationRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Utilization Progress */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">License Utilization</span>
                <Badge variant="outline">
                  {licensing.assignedLicenses} / {licensing.totalCopilotLicenses}
                </Badge>
              </div>
              <Progress value={licensing.utilizationRate} className="h-3" />
              {licensing.utilizationRate < 50 && (
                <div className="flex items-center gap-2 mt-3 text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Low utilization - consider reassigning unused licenses
                </div>
              )}
            </div>

            {/* SKU Breakdown */}
            {licensing.skuBreakdown.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium text-foreground mb-4">License SKU Breakdown</h4>
                <div className="space-y-3">
                  {licensing.skuBreakdown.map((sku) => (
                    <div key={sku.name} className="flex items-center justify-between">
                      <span className="text-foreground">{sku.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {sku.assigned} / {sku.total} assigned
                        </span>
                        <Progress 
                          value={sku.total > 0 ? (sku.assigned / sku.total) * 100 : 0} 
                          className="w-24 h-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Licensed Users Table */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="p-4 bg-muted/30 border-b border-border/50">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Licensed Users ({licensing.licensedUsers.length})
                </h4>
              </div>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licensing.licensedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No licensed users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      licensing.licensedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-foreground">
                            {user.displayName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.lastActive 
                              ? format(parseISO(user.lastActive), 'MMM d, yyyy')
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell>
                            {isInactive(user.lastActive) ? (
                              <Badge className="bg-yellow-500/20 text-yellow-400">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500/20 text-green-400">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </motion.div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No licensing data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
