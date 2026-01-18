import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  testTenantConnection, 
  exportResources,
  exportResourcesHybrid,
  refreshTokenFromStoredCredentials,
  categorizeResources,
  getAvailableAutomationConfig,
  TestConnectionResult 
} from '@/lib/graphApi';
import { 
  createTenantConnection, 
  updateTenantConnection,
  createExportJob,
  getExportJob,
  getActiveTenantConnection,
  subscribeToExportJob,
  storeEncryptedCredential,
  hasStoredCredentials
} from '@/lib/database';
import { useToast } from '@/hooks/use-toast';

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  connectionId: string | null;
  accessToken: string | null;
  tokenExpiry: Date | null;
  hasStoredCredentials: boolean;
}

export function useTenantConnection() {
  const [state, setState] = useState<TenantState>({
    isConnected: false,
    tenantId: null,
    tenantName: null,
    connectionId: null,
    accessToken: null,
    tokenExpiry: null,
    hasStoredCredentials: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Clear refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Schedule automatic token refresh
  const scheduleTokenRefresh = useCallback((expiryDate: Date, connectionId: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const now = Date.now();
    const expiryTime = expiryDate.getTime();
    const refreshTime = expiryTime - TOKEN_REFRESH_BUFFER_MS;
    const delay = Math.max(refreshTime - now, 0);

    if (delay > 0) {
      console.log(`Token refresh scheduled in ${Math.round(delay / 1000 / 60)} minutes`);
      refreshTimerRef.current = setTimeout(async () => {
        console.log('Auto-refreshing token...');
        await refreshToken(connectionId);
      }, delay);
    }
  }, []);

  // Refresh token using stored credentials
  const refreshToken = useCallback(async (connectionId?: string): Promise<string | null> => {
    const connId = connectionId || state.connectionId;
    if (!connId) {
      console.error('No connection ID for token refresh');
      return null;
    }

    setIsRefreshing(true);
    try {
      const result = await refreshTokenFromStoredCredentials(connId);
      
      if (result.error || !result.accessToken) {
        console.error('Token refresh failed:', result.error);
        toast({
          title: 'Session Expired',
          description: 'Please reconnect to continue.',
          variant: 'destructive',
        });
        return null;
      }

      const newExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      
      setState(prev => ({
        ...prev,
        accessToken: result.accessToken!,
        tokenExpiry: newExpiry,
      }));

      // Schedule next refresh
      scheduleTokenRefresh(newExpiry, connId);

      console.log('Token refreshed successfully');
      return result.accessToken;
    } catch (error) {
      console.error('Token refresh exception:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [state.connectionId, scheduleTokenRefresh, toast]);

  // Get a valid token, refreshing if needed
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!state.connectionId) return null;

    // Check if current token is still valid
    if (state.accessToken && state.tokenExpiry) {
      const now = Date.now();
      const expiryTime = state.tokenExpiry.getTime();
      
      // If token expires in more than 5 minutes, it's still valid
      if (expiryTime - now > TOKEN_REFRESH_BUFFER_MS) {
        return state.accessToken;
      }
    }

    // Token is missing or about to expire, refresh it
    if (state.hasStoredCredentials) {
      return await refreshToken();
    }

    return null;
  }, [state.accessToken, state.tokenExpiry, state.connectionId, state.hasStoredCredentials, refreshToken]);

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

      // Store encrypted credentials server-side for future sessions
      try {
        await storeEncryptedCredential(connection.id, clientId, clientSecret);
      } catch (credError) {
        console.error('Failed to store credentials:', credError);
        // Continue - credentials storage is optional enhancement
      }

      const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      
      setState({
        isConnected: true,
        tenantId: result.tenantId || tenantId,
        tenantName: result.tenantName || null,
        connectionId: connection.id,
        accessToken: result.accessToken,
        tokenExpiry,
        hasStoredCredentials: true,
      });

      // Schedule automatic token refresh
      scheduleTokenRefresh(tokenExpiry, connection.id);

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
    // Clear any scheduled refresh
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

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
      hasStoredCredentials: false,
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
        // Check if we have stored credentials for this connection
        const hasCredentials = await hasStoredCredentials(connection.id);
        
        // Set initial state
        setState({
          isConnected: true,
          tenantId: connection.tenant_id,
          tenantName: connection.tenant_name,
          connectionId: connection.id,
          accessToken: null,
          tokenExpiry: null,
          hasStoredCredentials: hasCredentials,
        });

        // Auto-refresh token if credentials are available
        if (hasCredentials) {
          console.log('Restoring session with stored credentials...');
          const result = await refreshTokenFromStoredCredentials(connection.id);
          
          if (result.accessToken) {
            const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
            
            setState(prev => ({
              ...prev,
              accessToken: result.accessToken!,
              tokenExpiry,
            }));

            // Schedule automatic token refresh
            scheduleTokenRefresh(tokenExpiry, connection.id);
            console.log('Session restored successfully');
          } else {
            console.warn('Failed to restore session:', result.error);
          }
        }
        
        return connection;
      }
    } catch (error) {
      console.error('Failed to check existing connection:', error);
    }
    return null;
  }, [scheduleTokenRefresh]);

  return {
    ...state,
    isConnecting,
    isRefreshing,
    connect,
    disconnect,
    checkExistingConnection,
    refreshToken,
    getValidToken,
  };
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string>('');
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

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
    setExportMessage('Preparing export...');

    try {
      // Check what resources we're dealing with
      const { graphResources, powerShellResources } = categorizeResources(resources);
      const hasPowerShellResources = powerShellResources.length > 0;
      
      // Check for automation config if we have PowerShell resources
      let automationAvailable = false;
      if (hasPowerShellResources) {
        const automationConfig = await getAvailableAutomationConfig();
        automationAvailable = !!automationConfig;
        
        if (!automationAvailable) {
          toast({
            title: 'PowerShell Resources Detected',
            description: `${powerShellResources.length} resources require Azure Automation. Configure it in Settings to export these.`,
          });
        }
      }

      // Create export job in database
      const job = await createExportJob({
        name: `Export ${new Date().toLocaleString()}`,
        tenantConnectionId: connectionId,
        categories: [...new Set(resources.map(r => r.split('/')[0]))],
        formats,
      });

      setCurrentJobId(job.id);

      // Start polling for progress updates (more reliable than realtime)
      pollingRef.current = setInterval(async () => {
        try {
          const updatedJob = await getExportJob(job.id);
          if (updatedJob) {
            // Only update from polling if not getting updates from hybrid export
            if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
              // Stop polling
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              setIsExporting(false);
            }
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      }, 2000); // Poll every 2 seconds

      // Also subscribe to realtime updates as a backup
      const unsubscribe = subscribeToExportJob(job.id, (updatedJob: { progress?: number; status?: string; error?: string }) => {
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsExporting(false);
          unsubscribe();
        }
      });

      // Use hybrid export if we have PowerShell resources and automation is available
      const useHybrid = hasPowerShellResources && automationAvailable && connectionId;
      
      let graphSuccessCount = 0;
      let graphFailedCount = 0;
      let automationSuccessCount = 0;
      let automationFailedCount = 0;
      let automationSkipReason: string | undefined;

      if (useHybrid) {
        // Use hybrid export for both Graph and PowerShell resources
        setExportMessage('Starting hybrid export (Graph API + Azure Automation)...');
        
        const result = await exportResourcesHybrid(
          accessToken,
          resources,
          job.id,
          connectionId,
          (prog, message) => {
            setProgress(prog);
            setExportMessage(message);
          }
        );

        // Stop polling since export function returned
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        if (!result.success) {
          toast({
            title: 'Export Failed',
            description: result.error || 'Failed to export resources',
            variant: 'destructive',
          });
          setIsExporting(false);
          unsubscribe();
          return null;
        }

        graphSuccessCount = result.graphResults?.filter(r => r.success).length || 0;
        graphFailedCount = result.graphResults?.filter(r => !r.success).length || 0;
        automationSuccessCount = result.automationResults?.filter(r => r.success).length || 0;
        automationFailedCount = result.automationResults?.filter(r => !r.success).length || 0;
        automationSkipReason = result.automationSkipReason;
      } else {
        // Standard Graph API only export
        setExportMessage('Exporting via Graph API...');
        
        // If we have PowerShell resources but no automation, only export Graph resources
        const resourcesToExport = hasPowerShellResources && !automationAvailable 
          ? graphResources 
          : resources;

        if (resourcesToExport.length === 0) {
          toast({
            title: 'No Exportable Resources',
            description: 'All selected resources require Azure Automation which is not configured.',
            variant: 'destructive',
          });
          setIsExporting(false);
          unsubscribe();
          return null;
        }

        const result = await exportResources(accessToken, resourcesToExport, job.id);

        // Stop polling since export function returned
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        if (!result.success) {
          toast({
            title: 'Export Failed',
            description: result.error || 'Failed to export resources',
            variant: 'destructive',
          });
          setIsExporting(false);
          unsubscribe();
          return null;
        }

        graphSuccessCount = result.results?.filter(r => r.success).length || 0;
        graphFailedCount = result.results?.filter(r => !r.success).length || 0;
        
        // Mark PowerShell resources as skipped
        if (hasPowerShellResources && !automationAvailable) {
          automationFailedCount = powerShellResources.length;
          automationSkipReason = 'Azure Automation not configured';
        }
      }

      // Export function completed - update state directly
      setProgress(100);
      setExportMessage('Export complete');
      setIsExporting(false);
      unsubscribe();

      // Calculate totals
      const totalSuccess = graphSuccessCount + automationSuccessCount;
      const totalFailed = graphFailedCount + automationFailedCount;
      
      // Show appropriate toast based on results
      if (totalFailed > 0 && totalSuccess > 0) {
        let description = `Exported ${totalSuccess} resources, ${totalFailed} failed`;
        if (automationSkipReason) {
          description += `. Note: ${automationSkipReason}`;
        }
        toast({
          title: 'Export Complete (with errors)',
          description,
        });
      } else if (totalFailed > 0 && totalSuccess === 0) {
        toast({
          title: 'Export Failed',
          description: automationSkipReason || `All ${totalFailed} resources failed to export`,
          variant: 'destructive',
        });
      } else {
        let description = `Successfully exported ${totalSuccess} resources`;
        if (automationSuccessCount > 0) {
          description = `Exported ${graphSuccessCount} via Graph API, ${automationSuccessCount} via Azure Automation`;
        }
        toast({
          title: 'Export Complete',
          description,
        });
      }

      return job.id;
    } catch (error) {
      // Stop polling on error
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
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
    exportMessage,
    startExport,
  };
}
