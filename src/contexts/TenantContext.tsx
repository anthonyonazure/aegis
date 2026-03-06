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

export interface TenantConnectionInfo {
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

export interface ActiveConnection {
  connectionId: string;
  tenantId: string;
  tenantName: string | null;
  accessToken: string;
  tokenExpiry: Date;
  hasStoredCredentials: boolean;
}

interface TenantState {
  // Multi-tenant active connections
  activeConnections: Map<string, ActiveConnection>;
  focusedConnectionId: string | null;
  
  // Customer & tenant selection (UI)
  selectedCustomerId: string | null;
  selectedTenantId: string | null;
  customers: CustomerInfo[];
  tenants: TenantConnectionInfo[];
}

interface TenantContextValue {
  // Backward-compatible single-tenant accessors (use focused tenant)
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  connectionId: string | null;
  accessToken: string | null;
  tokenExpiry: Date | null;
  hasStoredCredentials: boolean;
  
  // Multi-tenant accessors
  activeConnections: ActiveConnection[];
  focusedConnectionId: string | null;
  isConnectionActive: (connectionId: string) => boolean;
  
  // Customer & tenant selection
  selectedCustomerId: string | null;
  selectedTenantId: string | null;
  customers: CustomerInfo[];
  tenants: TenantConnectionInfo[];
  
  // Status
  isConnecting: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
  
  // Connection methods
  connect: (tenantId: string, clientId: string, clientSecret: string, customerId?: string) => Promise<TestConnectionResult>;
  disconnect: () => Promise<void>;
  disconnectTenant: (connectionId: string) => Promise<void>;
  refreshToken: (connectionId?: string) => Promise<string | null>;
  getValidToken: (connectionId?: string) => Promise<string | null>;
  
  // Selection methods
  selectCustomer: (customerId: string | null) => void;
  selectTenant: (tenantConnectionId: string | null) => Promise<void>;
  loadCustomersAndTenants: () => Promise<void>;
  
  // Helpers
  getTenantsForCustomer: (customerId: string) => TenantConnectionInfo[];
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
    activeConnections: new Map(),
    focusedConnectionId: null,
    selectedCustomerId: null,
    selectedTenantId: null,
    customers: [],
    tenants: [],
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { toast } = useToast();

  // Clear all refresh timers on unmount
  useEffect(() => {
    return () => {
      refreshTimersRef.current.forEach(timer => clearTimeout(timer));
      refreshTimersRef.current.clear();
    };
  }, []);

  // Schedule automatic token refresh for a specific connection
  const scheduleTokenRefresh = useCallback((expiryDate: Date, connectionId: string) => {
    // Clear existing timer for this connection
    const existing = refreshTimersRef.current.get(connectionId);
    if (existing) clearTimeout(existing);

    const now = Date.now();
    const expiryTime = expiryDate.getTime();
    const refreshTime = expiryTime - TOKEN_REFRESH_BUFFER_MS;
    const delay = Math.max(refreshTime - now, 0);

    if (delay > 0) {
      console.log(`Token refresh for ${connectionId} scheduled in ${Math.round(delay / 1000 / 60)} minutes`);
      const timer = setTimeout(async () => {
        console.log(`Auto-refreshing token for ${connectionId}...`);
        await refreshToken(connectionId);
      }, delay);
      refreshTimersRef.current.set(connectionId, timer);
    }
  }, []);

  // Refresh token using stored credentials
  const refreshToken = useCallback(async (connectionId?: string): Promise<string | null> => {
    const connId = connectionId || state.focusedConnectionId;
    if (!connId) {
      console.error('No connection ID for token refresh');
      return null;
    }

    setIsRefreshing(true);
    try {
      const result = await refreshTokenFromStoredCredentials(connId);
      
      if (result.error || !result.accessToken) {
        console.error('Token refresh failed:', result.error);
        // Remove this connection from active map
        setState(prev => {
          const newMap = new Map(prev.activeConnections);
          newMap.delete(connId);
          return { ...prev, activeConnections: newMap };
        });
        toast({
          title: 'Session Expired',
          description: 'Please reconnect to continue.',
          variant: 'destructive',
        });
        return null;
      }

      const newExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      
      setState(prev => {
        const newMap = new Map(prev.activeConnections);
        const existing = newMap.get(connId);
        if (existing) {
          newMap.set(connId, {
            ...existing,
            accessToken: result.accessToken!,
            tokenExpiry: newExpiry,
          });
        }
        return { ...prev, activeConnections: newMap };
      });

      scheduleTokenRefresh(newExpiry, connId);
      console.log(`Token refreshed successfully for ${connId}`);
      return result.accessToken;
    } catch (error) {
      console.error('Token refresh exception:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [state.focusedConnectionId, scheduleTokenRefresh, toast]);

  // Get a valid token, refreshing if needed
  const getValidToken = useCallback(async (connectionId?: string): Promise<string | null> => {
    const connId = connectionId || state.focusedConnectionId;
    if (!connId) {
      console.log('getValidToken: No connection ID');
      return null;
    }

    const active = state.activeConnections.get(connId);
    
    // Check if current token is still valid
    if (active?.accessToken && active?.tokenExpiry) {
      const now = Date.now();
      const expiryTime = active.tokenExpiry.getTime();
      if (expiryTime - now > TOKEN_REFRESH_BUFFER_MS) {
        return active.accessToken;
      }
    }

    // Token is missing or about to expire, try to refresh
    if (active?.hasStoredCredentials) {
      console.log(`getValidToken: Refreshing token for ${connId}...`);
      return await refreshToken(connId);
    }

    // Check if tenant info says it has credentials even if not in active map
    const tenant = state.tenants.find(t => t.id === connId);
    if (tenant?.hasCredentials) {
      console.log(`getValidToken: Refreshing token for non-active connection ${connId}...`);
      return await refreshToken(connId);
    }

    console.warn('getValidToken: No stored credentials available');
    toast({
      title: 'Credentials Required',
      description: 'Your session has expired. Please disconnect and reconnect with your credentials.',
      variant: 'destructive',
    });
    return null;
  }, [state.activeConnections, state.focusedConnectionId, state.tenants, refreshToken, toast]);

  // Activate a connection (add to active map)
  const activateConnection = useCallback(async (
    tenantInfo: TenantConnectionInfo,
    setAsFocused: boolean = true
  ): Promise<boolean> => {
    if (tenantInfo.status !== 'connected' || !tenantInfo.hasCredentials) {
      return false;
    }

    // Check if already active
    if (state.activeConnections.has(tenantInfo.id)) {
      if (setAsFocused) {
        setState(prev => ({ ...prev, focusedConnectionId: tenantInfo.id }));
      }
      return true;
    }

    setIsRefreshing(true);
    try {
      const result = await refreshTokenFromStoredCredentials(tenantInfo.id);
      
      if (result.accessToken) {
        const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
        
        setState(prev => {
          const newMap = new Map(prev.activeConnections);
          newMap.set(tenantInfo.id, {
            connectionId: tenantInfo.id,
            tenantId: tenantInfo.tenantId,
            tenantName: tenantInfo.displayName || tenantInfo.tenantName,
            accessToken: result.accessToken!,
            tokenExpiry,
            hasStoredCredentials: true,
          });
          return {
            ...prev,
            activeConnections: newMap,
            focusedConnectionId: setAsFocused ? tenantInfo.id : prev.focusedConnectionId,
          };
        });

        scheduleTokenRefresh(tokenExpiry, tenantInfo.id);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to activate tenant:', error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [state.activeConnections, scheduleTokenRefresh]);

  // Load customers and tenants
  const loadCustomersAndTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const customersData = await getCustomers();
      const customers: CustomerInfo[] = customersData.map(c => ({
        id: c.id,
        name: c.name,
        tier: c.tier,
      }));
      
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
        const customerExists = !lastSelection.customerId || customers.some(c => c.id === lastSelection.customerId);
        const tenantExists = !lastSelection.tenantId || tenants.some(t => t.id === lastSelection.tenantId);
        
        if (customerExists && tenantExists) {
          setState(prev => ({
            ...prev,
            selectedCustomerId: lastSelection.customerId,
            selectedTenantId: lastSelection.tenantId,
          }));

          // Auto-activate the last selected tenant
          if (lastSelection.tenantId) {
            const selectedTenant = tenants.find(t => t.id === lastSelection.tenantId);
            if (selectedTenant?.status === 'connected' && selectedTenant.hasCredentials) {
              const result = await refreshTokenFromStoredCredentials(selectedTenant.id);
              if (result.accessToken) {
                const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
                setState(prev => {
                  const newMap = new Map(prev.activeConnections);
                  newMap.set(selectedTenant.id, {
                    connectionId: selectedTenant.id,
                    tenantId: selectedTenant.tenantId,
                    tenantName: selectedTenant.displayName || selectedTenant.tenantName,
                    accessToken: result.accessToken!,
                    tokenExpiry,
                    hasStoredCredentials: true,
                  });
                  return {
                    ...prev,
                    activeConnections: newMap,
                    focusedConnectionId: selectedTenant.id,
                  };
                });
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

  // Select a customer — no longer disconnects active tenants
  const selectCustomer = useCallback((customerId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedCustomerId: customerId,
      selectedTenantId: null,
      // Don't clear active connections — they stay alive
    }));
    saveLastSelection({ customerId, tenantId: null });
  }, []);

  // Select and activate a tenant (adds to active map, sets as focused)
  const selectTenant = useCallback(async (tenantConnectionId: string | null) => {
    if (!tenantConnectionId) {
      setState(prev => ({
        ...prev,
        selectedTenantId: null,
        // Don't clear active connections, just unfocus
        focusedConnectionId: null,
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

    // If tenant has stored credentials, activate it
    if (tenant.status === 'connected' && tenant.hasCredentials) {
      const activated = await activateConnection(tenant, true);
      
      if (activated) {
        toast({
          title: 'Tenant Activated',
          description: `Connected to ${tenant.displayName || tenant.tenantName}`,
        });
      } else {
        setState(prev => ({
          ...prev,
          focusedConnectionId: tenantConnectionId,
        }));
        toast({
          title: 'Connection Issue',
          description: 'Could not refresh token. You may need to reconnect.',
          variant: 'destructive',
        });
      }
    } else {
      // Not connected or no credentials — just set as focused
      setState(prev => ({
        ...prev,
        focusedConnectionId: tenantConnectionId,
      }));
    }

    saveLastSelection({ customerId: tenant.customerId, tenantId: tenantConnectionId });
  }, [state.tenants, state.selectedCustomerId, activateConnection, toast]);

  // Disconnect a specific tenant from the active map
  const disconnectTenant = useCallback(async (connectionId: string) => {
    // Clear refresh timer
    const timer = refreshTimersRef.current.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      refreshTimersRef.current.delete(connectionId);
    }

    setState(prev => {
      const newMap = new Map(prev.activeConnections);
      newMap.delete(connectionId);
      
      // If we just disconnected the focused tenant, pick another or null
      let newFocused = prev.focusedConnectionId;
      if (newFocused === connectionId) {
        const remaining = Array.from(newMap.keys());
        newFocused = remaining.length > 0 ? remaining[0] : null;
      }

      return {
        ...prev,
        activeConnections: newMap,
        focusedConnectionId: newFocused,
        selectedTenantId: prev.selectedTenantId === connectionId ? newFocused : prev.selectedTenantId,
      };
    });

    const tenant = state.tenants.find(t => t.id === connectionId);
    toast({
      title: 'Tenant Disconnected',
      description: `Disconnected from ${tenant?.displayName || tenant?.tenantName || 'tenant'}`,
    });
  }, [state.tenants, toast]);

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
      let newConnectionId: string;
      
      if (existingTenant) {
        await updateTenantConnection(existingTenant.id, { 
          status: 'connected',
          tenantName: result.tenantName,
          lastSync: new Date(),
        });
        newConnectionId = existingTenant.id;
      } else {
        const connection = await createTenantConnection({
          tenantId: result.tenantId || tenantId,
          tenantName: result.tenantName,
          authMethod: 'app',
          clientId,
          status: 'connected',
          lastSync: new Date(),
          customerId: customerId || state.selectedCustomerId || undefined,
        });
        newConnectionId = connection.id;
      }

      // Store encrypted credentials
      try {
        await storeEncryptedCredential(newConnectionId, clientId, clientSecret);
      } catch (credError) {
        console.error('Failed to store credentials:', credError);
        toast({
          title: 'Warning',
          description: 'Credentials could not be stored. You may need to reconnect after the session expires.',
          variant: 'destructive',
        });
      }

      const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      
      // Add to active connections map
      setState(prev => {
        const newMap = new Map(prev.activeConnections);
        newMap.set(newConnectionId, {
          connectionId: newConnectionId,
          tenantId: result.tenantId || tenantId,
          tenantName: result.tenantName || null,
          accessToken: result.accessToken!,
          tokenExpiry,
          hasStoredCredentials: true,
        });
        return {
          ...prev,
          activeConnections: newMap,
          focusedConnectionId: newConnectionId,
          selectedTenantId: newConnectionId,
          selectedCustomerId: customerId || prev.selectedCustomerId,
        };
      });

      await loadCustomersAndTenants();
      scheduleTokenRefresh(tokenExpiry, newConnectionId);

      toast({
        title: 'Connected Successfully',
        description: `Connected to ${result.tenantName || tenantId}`,
      });

      saveLastSelection({ 
        customerId: customerId || state.selectedCustomerId, 
        tenantId: newConnectionId 
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

  // Disconnect the focused tenant (backward compat)
  const disconnect = useCallback(async () => {
    if (state.focusedConnectionId) {
      await disconnectTenant(state.focusedConnectionId);
    }
  }, [state.focusedConnectionId, disconnectTenant]);

  // Check if a specific connection is active
  const isConnectionActive = useCallback((connectionId: string): boolean => {
    return state.activeConnections.has(connectionId);
  }, [state.activeConnections]);

  // Derived backward-compatible values from focused connection
  const focused = state.focusedConnectionId 
    ? state.activeConnections.get(state.focusedConnectionId) 
    : undefined;
  
  const value: TenantContextValue = {
    // Backward-compatible single-tenant accessors
    isConnected: state.activeConnections.size > 0,
    tenantId: focused?.tenantId || null,
    tenantName: focused?.tenantName || null,
    connectionId: state.focusedConnectionId,
    accessToken: focused?.accessToken || null,
    tokenExpiry: focused?.tokenExpiry || null,
    hasStoredCredentials: focused?.hasStoredCredentials || false,
    
    // Multi-tenant accessors
    activeConnections: Array.from(state.activeConnections.values()),
    focusedConnectionId: state.focusedConnectionId,
    isConnectionActive,
    
    // Selection
    selectedCustomerId: state.selectedCustomerId,
    selectedTenantId: state.selectedTenantId,
    customers: state.customers,
    tenants: state.tenants,
    
    // Status
    isConnecting,
    isRefreshing,
    isLoading,
    
    // Methods
    connect,
    disconnect,
    disconnectTenant,
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
