import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { 
  testTenantConnection, 
  refreshTokenFromStoredCredentials,
  TestConnectionResult 
} from '@/lib/graphApi';
import { 
  createTenantConnection, 
  updateTenantConnection,
  getTenantConnections,
  storeEncryptedCredential,
  hasStoredCredentials
} from '@/lib/database';
import { getCustomers } from '@/lib/customerDatabase';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const LAST_SELECTION_KEY = 'msp_last_tenant_selection';

interface TenantConnectionInfo {
  id: string;
  tenantId: string;
  tenantName: string | null;
  displayName: string | null;
  customerId: string | null;
  tenantGroupId: string | null;
  status: string;
  hasCredentials?: boolean;
}

interface CustomerInfo {
  id: string;
  name: string;
  tier: string;
}

interface TenantState {
  // Current active tenant
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  connectionId: string | null;
  accessToken: string | null;
  tokenExpiry: Date | null;
  hasStoredCredentials: boolean;
  
  // Customer & tenant selection
  selectedCustomerId: string | null;
  selectedTenantId: string | null;
  customers: CustomerInfo[];
  tenants: TenantConnectionInfo[];
}

interface TenantContextValue extends TenantState {
  isConnecting: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
  
  // Connection methods
  connect: (tenantId: string, clientId: string, clientSecret: string, customerId?: string) => Promise<TestConnectionResult>;
  disconnect: () => Promise<void>;
  refreshToken: (connectionId?: string) => Promise<string | null>;
  getValidToken: () => Promise<string | null>;
  
  // Selection methods
  selectCustomer: (customerId: string | null) => void;
  selectTenant: (tenantConnectionId: string | null) => Promise<void>;
  loadCustomersAndTenants: () => Promise<void>;
  
  // Helper to get tenants for current customer
  getTenantsForCustomer: (customerId: string) => TenantConnectionInfo[];
  
  // Get all connected tenants (for cross-tenant features like backups)
  getAllConnectedTenants: () => TenantConnectionInfo[];
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface LastSelection {
  customerId: string | null;
  tenantId: string | null;
}

function saveLastSelection(selection: LastSelection) {
  try {
    localStorage.setItem(LAST_SELECTION_KEY, JSON.stringify(selection));
  } catch (e) {
    console.warn('Failed to save tenant selection to localStorage');
  }
}

function loadLastSelection(): LastSelection | null {
  try {
    const saved = localStorage.getItem(LAST_SELECTION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load tenant selection from localStorage');
  }
  return null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TenantState>({
    isConnected: false,
    tenantId: null,
    tenantName: null,
    connectionId: null,
    accessToken: null,
    tokenExpiry: null,
    hasStoredCredentials: false,
    selectedCustomerId: null,
    selectedTenantId: null,
    customers: [],
    tenants: [],
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    if (!state.connectionId) {
      console.log('getValidToken: No connection ID');
      return null;
    }

    // Check if current token is still valid
    if (state.accessToken && state.tokenExpiry) {
      const now = Date.now();
      const expiryTime = state.tokenExpiry.getTime();
      
      // If token expires in more than 5 minutes, it's still valid
      if (expiryTime - now > TOKEN_REFRESH_BUFFER_MS) {
        return state.accessToken;
      }
    }

    // Token is missing or about to expire, try to refresh it
    if (state.hasStoredCredentials) {
      console.log('getValidToken: Refreshing token with stored credentials...');
      return await refreshToken();
    }

    // No stored credentials - user needs to reconnect
    console.warn('getValidToken: No stored credentials available, user must reconnect');
    toast({
      title: 'Credentials Required',
      description: 'Your session has expired. Please disconnect and reconnect with your credentials.',
      variant: 'destructive',
    });
    return null;
  }, [state.accessToken, state.tokenExpiry, state.connectionId, state.hasStoredCredentials, refreshToken, toast]);

  // Load customers and tenants
  const loadCustomersAndTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load customers
      const customersData = await getCustomers();
      const customers: CustomerInfo[] = customersData.map(c => ({
        id: c.id,
        name: c.name,
        tier: c.tier,
      }));
      
      // Load all tenant connections
      const tenantsData = await getTenantConnections();
      const tenants: TenantConnectionInfo[] = (tenantsData || []).map(t => ({
        id: t.id,
        tenantId: t.tenant_id,
        tenantName: t.tenant_name,
        displayName: t.display_name,
        customerId: t.customer_id,
        tenantGroupId: t.tenant_group_id,
        status: t.status,
      }));

      // Check for stored credentials for connected tenants
      const connectedTenants = tenants.filter(t => t.status === 'connected');
      for (const tenant of connectedTenants) {
        try {
          tenant.hasCredentials = await hasStoredCredentials(tenant.id);
        } catch {
          tenant.hasCredentials = false;
        }
      }

      setState(prev => ({
        ...prev,
        customers,
        tenants,
      }));

      // Try to restore last selection
      const lastSelection = loadLastSelection();
      if (lastSelection) {
        // Verify the selection is still valid
        const customerExists = !lastSelection.customerId || customers.some(c => c.id === lastSelection.customerId);
        const tenantExists = !lastSelection.tenantId || tenants.some(t => t.id === lastSelection.tenantId);
        
        if (customerExists && tenantExists) {
          setState(prev => ({
            ...prev,
            selectedCustomerId: lastSelection.customerId,
            selectedTenantId: lastSelection.tenantId,
          }));

          // Auto-connect if there's a selected tenant with credentials
          if (lastSelection.tenantId) {
            const selectedTenant = tenants.find(t => t.id === lastSelection.tenantId);
            if (selectedTenant?.status === 'connected' && selectedTenant.hasCredentials) {
              // Auto-activate this tenant
              const result = await refreshTokenFromStoredCredentials(selectedTenant.id);
              if (result.accessToken) {
                const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
                setState(prev => ({
                  ...prev,
                  isConnected: true,
                  tenantId: selectedTenant.tenantId,
                  tenantName: selectedTenant.displayName || selectedTenant.tenantName,
                  connectionId: selectedTenant.id,
                  accessToken: result.accessToken!,
                  tokenExpiry,
                  hasStoredCredentials: true,
                }));
                scheduleTokenRefresh(tokenExpiry, selectedTenant.id);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load customers and tenants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleTokenRefresh]);

  // Select a customer
  const selectCustomer = useCallback((customerId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedCustomerId: customerId,
      // Clear tenant selection if customer changes
      selectedTenantId: null,
      // Reset active connection state when switching customers
      isConnected: false,
      connectionId: null,
      accessToken: null,
      tokenExpiry: null,
    }));
    
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    saveLastSelection({ customerId, tenantId: null });
  }, []);

  // Select and activate a tenant
  const selectTenant = useCallback(async (tenantConnectionId: string | null) => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!tenantConnectionId) {
      setState(prev => ({
        ...prev,
        selectedTenantId: null,
        isConnected: false,
        tenantId: null,
        tenantName: null,
        connectionId: null,
        accessToken: null,
        tokenExpiry: null,
        hasStoredCredentials: false,
      }));
      saveLastSelection({ customerId: state.selectedCustomerId, tenantId: null });
      return;
    }

    const tenant = state.tenants.find(t => t.id === tenantConnectionId);
    if (!tenant) {
      console.error('Tenant not found:', tenantConnectionId);
      return;
    }

    setState(prev => ({
      ...prev,
      selectedTenantId: tenantConnectionId,
      selectedCustomerId: tenant.customerId || prev.selectedCustomerId,
    }));

    // If tenant has stored credentials, try to get an access token
    if (tenant.status === 'connected' && tenant.hasCredentials) {
      setIsRefreshing(true);
      try {
        const result = await refreshTokenFromStoredCredentials(tenantConnectionId);
        
        if (result.accessToken) {
          const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
          
          setState(prev => ({
            ...prev,
            isConnected: true,
            tenantId: tenant.tenantId,
            tenantName: tenant.displayName || tenant.tenantName,
            connectionId: tenantConnectionId,
            accessToken: result.accessToken!,
            tokenExpiry,
            hasStoredCredentials: true,
          }));

          scheduleTokenRefresh(tokenExpiry, tenantConnectionId);
          
          toast({
            title: 'Tenant Activated',
            description: `Connected to ${tenant.displayName || tenant.tenantName}`,
          });
        } else {
          // Credentials exist but token refresh failed
          setState(prev => ({
            ...prev,
            isConnected: false,
            tenantId: tenant.tenantId,
            tenantName: tenant.displayName || tenant.tenantName,
            connectionId: tenantConnectionId,
            hasStoredCredentials: true,
          }));
          
          toast({
            title: 'Connection Issue',
            description: 'Could not refresh token. You may need to reconnect.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to activate tenant:', error);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // Tenant exists but not connected or no credentials
      setState(prev => ({
        ...prev,
        isConnected: false,
        tenantId: tenant.tenantId,
        tenantName: tenant.displayName || tenant.tenantName,
        connectionId: tenantConnectionId,
        hasStoredCredentials: false,
      }));
    }

    saveLastSelection({ customerId: tenant.customerId, tenantId: tenantConnectionId });
  }, [state.tenants, state.selectedCustomerId, scheduleTokenRefresh, toast]);

  // Get tenants for a specific customer
  const getTenantsForCustomer = useCallback((customerId: string): TenantConnectionInfo[] => {
    return state.tenants.filter(t => t.customerId === customerId);
  }, [state.tenants]);

  // Get all connected tenants (for cross-tenant features)
  const getAllConnectedTenants = useCallback((): TenantConnectionInfo[] => {
    return state.tenants.filter(t => t.status === 'connected');
  }, [state.tenants]);

  const connect = useCallback(async (
    tenantId: string,
    clientId: string,
    clientSecret: string,
    customerId?: string
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

      // Check if this tenant already exists
      const existingTenant = state.tenants.find(t => t.tenantId === tenantId);
      let connectionId: string;
      
      if (existingTenant) {
        // Update existing connection
        await updateTenantConnection(existingTenant.id, { 
          status: 'connected',
          tenantName: result.tenantName,
          lastSync: new Date(),
        });
        connectionId = existingTenant.id;
      } else {
        // Create new connection
        const connection = await createTenantConnection({
          tenantId: result.tenantId || tenantId,
          tenantName: result.tenantName,
          authMethod: 'app',
          clientId,
          status: 'connected',
          lastSync: new Date(),
          customerId: customerId || state.selectedCustomerId || undefined,
        });
        connectionId = connection.id;
      }

      // Store encrypted credentials
      try {
        await storeEncryptedCredential(connectionId, clientId, clientSecret);
      } catch (credError) {
        console.error('Failed to store credentials:', credError);
        toast({
          title: 'Warning',
          description: 'Credentials could not be stored. You may need to reconnect after the session expires.',
          variant: 'destructive',
        });
      }

      const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        tenantId: result.tenantId || tenantId,
        tenantName: result.tenantName || null,
        connectionId,
        accessToken: result.accessToken,
        tokenExpiry,
        hasStoredCredentials: true,
        selectedTenantId: connectionId,
        selectedCustomerId: customerId || prev.selectedCustomerId,
      }));

      // Reload tenants to get the updated list
      await loadCustomersAndTenants();

      // Schedule automatic token refresh
      scheduleTokenRefresh(tokenExpiry, connectionId);

      toast({
        title: 'Connected Successfully',
        description: `Connected to ${result.tenantName || tenantId}`,
      });

      saveLastSelection({ 
        customerId: customerId || state.selectedCustomerId, 
        tenantId: connectionId 
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
  }, [toast, scheduleTokenRefresh, state.tenants, state.selectedCustomerId, loadCustomersAndTenants]);

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

    setState(prev => ({
      ...prev,
      isConnected: false,
      tenantId: null,
      tenantName: null,
      connectionId: null,
      accessToken: null,
      tokenExpiry: null,
      hasStoredCredentials: false,
      // Keep customer selection but clear tenant selection
      selectedTenantId: null,
    }));

    // Reload tenants to reflect disconnected status
    await loadCustomersAndTenants();

    toast({
      title: 'Disconnected',
      description: 'Disconnected from tenant',
    });

    saveLastSelection({ customerId: state.selectedCustomerId, tenantId: null });
  }, [state.connectionId, state.selectedCustomerId, toast, loadCustomersAndTenants]);

  const value: TenantContextValue = {
    ...state,
    isConnecting,
    isRefreshing,
    isLoading,
    connect,
    disconnect,
    refreshToken,
    getValidToken,
    selectCustomer,
    selectTenant,
    loadCustomersAndTenants,
    getTenantsForCustomer,
    getAllConnectedTenants,
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
