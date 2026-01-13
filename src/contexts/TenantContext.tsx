import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { 
  testTenantConnection, 
  refreshTokenFromStoredCredentials,
  TestConnectionResult 
} from '@/lib/graphApi';
import { 
  createTenantConnection, 
  updateTenantConnection,
  getActiveTenantConnection,
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

interface TenantContextValue extends TenantState {
  isConnecting: boolean;
  isRefreshing: boolean;
  connect: (tenantId: string, clientId: string, clientSecret: string) => Promise<TestConnectionResult>;
  disconnect: () => Promise<void>;
  checkExistingConnection: () => Promise<any>;
  refreshToken: (connectionId?: string) => Promise<string | null>;
  getValidToken: () => Promise<string | null>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
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
  }, [toast, scheduleTokenRefresh]);

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

  const value: TenantContextValue = {
    ...state,
    isConnecting,
    isRefreshing,
    connect,
    disconnect,
    checkExistingConnection,
    refreshToken,
    getValidToken,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
