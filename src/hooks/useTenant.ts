import { useState, useCallback } from 'react';
import { 
  testTenantConnection, 
  exportResources,
  TestConnectionResult 
} from '@/lib/graphApi';
import { 
  createTenantConnection, 
  updateTenantConnection,
  createExportJob,
  getActiveTenantConnection,
  subscribeToExportJob
} from '@/lib/database';
import { useToast } from '@/hooks/use-toast';

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  connectionId: string | null;
  accessToken: string | null;
  tokenExpiry: Date | null;
}

export function useTenantConnection() {
  const [state, setState] = useState<TenantState>({
    isConnected: false,
    tenantId: null,
    tenantName: null,
    connectionId: null,
    accessToken: null,
    tokenExpiry: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const connect = useCallback(async (
    tenantId: string,
    clientId: string,
    clientSecret: string
  ): Promise<TestConnectionResult> => {
    setIsConnecting(true);
    
    try {
      const result = await testTenantConnection(tenantId, clientId, clientSecret);
      
      if (!result.success || !result.accessToken) {
        toast({
          title: 'Connection Failed',
          description: result.error || 'Failed to connect to tenant',
          variant: 'destructive',
        });
        return result;
      }

      // Save connection to database
      const connection = await createTenantConnection({
        tenantId: result.tenantId || tenantId,
        tenantName: result.tenantName,
        authMethod: 'app',
        clientId,
        status: 'connected',
        lastSync: new Date(),
      });

      setState({
        isConnected: true,
        tenantId: result.tenantId || tenantId,
        tenantName: result.tenantName || null,
        connectionId: connection.id,
        accessToken: result.accessToken,
        tokenExpiry: new Date(Date.now() + (result.expiresIn || 3600) * 1000),
      });

      toast({
        title: 'Connected Successfully',
        description: `Connected to ${result.tenantName || tenantId}`,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      toast({
        title: 'Connection Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    if (state.connectionId) {
      try {
        await updateTenantConnection(state.connectionId, { status: 'disconnected' });
      } catch (error) {
        console.error('Failed to update connection status:', error);
      }
    }

    setState({
      isConnected: false,
      tenantId: null,
      tenantName: null,
      connectionId: null,
      accessToken: null,
      tokenExpiry: null,
    });

    toast({
      title: 'Disconnected',
      description: 'Disconnected from tenant',
    });
  }, [state.connectionId, toast]);

  const checkExistingConnection = useCallback(async () => {
    try {
      const connection = await getActiveTenantConnection();
      if (connection) {
        setState({
          isConnected: true,
          tenantId: connection.tenant_id,
          tenantName: connection.tenant_name,
          connectionId: connection.id,
          accessToken: null, // Would need to re-authenticate
          tokenExpiry: null,
        });
        return connection;
      }
    } catch (error) {
      console.error('Failed to check existing connection:', error);
    }
    return null;
  }, []);

  return {
    ...state,
    isConnecting,
    connect,
    disconnect,
    checkExistingConnection,
  };
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const startExport = useCallback(async (
    accessToken: string,
    resources: string[],
    formats: string[],
    connectionId?: string
  ) => {
    if (!accessToken) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to a tenant first',
        variant: 'destructive',
      });
      return null;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      // Create export job in database
      const job = await createExportJob({
        name: `Export ${new Date().toLocaleString()}`,
        tenantConnectionId: connectionId,
        categories: [...new Set(resources.map(r => r.split('/')[0]))],
        formats,
      });

      setCurrentJobId(job.id);

      // Subscribe to job updates
      const unsubscribe = subscribeToExportJob(job.id, (updatedJob) => {
        setProgress(updatedJob.progress);
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          setIsExporting(false);
          unsubscribe();
          
          if (updatedJob.status === 'completed') {
            toast({
              title: 'Export Complete',
              description: `Successfully exported ${resources.length} resources`,
            });
          } else {
            toast({
              title: 'Export Failed',
              description: updatedJob.error || 'Export encountered errors',
              variant: 'destructive',
            });
          }
        }
      });

      // Start the export
      const result = await exportResources(accessToken, resources, job.id);

      if (!result.success) {
        toast({
          title: 'Export Failed',
          description: result.error || 'Failed to export resources',
          variant: 'destructive',
        });
        setIsExporting(false);
        return null;
      }

      return job.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      toast({
        title: 'Export Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsExporting(false);
      return null;
    }
  }, [toast]);

  return {
    isExporting,
    currentJobId,
    progress,
    startExport,
  };
}
