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
  batchHasStoredCredentials
} from '@/lib/database';
import { getCustomers } from '@/lib/customerDatabase';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  TenantConnectionInfo,
  ActiveConnection,
  TenantState,
  TenantContextValue,
} from './tenantTypes';
import {
  saveLastSelection,
  loadLastSelection,
  TOKEN_REFRESH_BUFFER_MS,
} from './tenantHelpers';

// Re-export types for backward compatibility
export type { TenantConnectionInfo, ActiveConnection } from './tenantTypes';

const TenantContext = createContext<TenantContextValue | null>(null);

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

  useEffect(() => {
    return () => {
      refreshTimersRef.current.forEach(timer => clearTimeout(timer));
      refreshTimersRef.current.clear();
    };
  }, []);

  // ---------- Token Management ----------

  const scheduleTokenRefresh = useCallback((expiryDate: Date, connectionId: string) => {
    const existing = refreshTimersRef.current.get(connectionId);
    if (existing) clearTimeout(existing);

    const delay = Math.max(expiryDate.getTime() - TOKEN_REFRESH_BUFFER_MS - Date.now(), 0);
    if (delay > 0) {
      const timer = setTimeout(async () => {
        await refreshToken(connectionId);
      }, delay);
      refreshTimersRef.current.set(connectionId, timer);
    }
  }, []);

  const refreshToken = useCallback(async (connectionId?: string): Promise<string | null> => {
    const connId = connectionId || state.focusedConnectionId;
    if (!connId) return null;

    setIsRefreshing(true);
    try {
      const result = await refreshTokenFromStoredCredentials(connId);
      if (result.error || !result.accessToken) {
        setState(prev => {
          const newMap = new Map(prev.activeConnections);
          newMap.delete(connId);
          return { ...prev, activeConnections: newMap };
        });
        toast({ title: 'Session Expired', description: 'Please reconnect to continue.', variant: 'destructive' });
        return null;
      }

      const newExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      setState(prev => {
        const newMap = new Map(prev.activeConnections);
        const existing = newMap.get(connId);
        if (existing) {
          newMap.set(connId, { ...existing, accessToken: result.accessToken!, tokenExpiry: newExpiry });
        }
        return { ...prev, activeConnections: newMap };
      });
      scheduleTokenRefresh(newExpiry, connId);
      return result.accessToken;
    } catch (error) {
      console.error('Token refresh exception:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [state.focusedConnectionId, scheduleTokenRefresh, toast]);

  const getValidToken = useCallback(async (connectionId?: string): Promise<string | null> => {
    const connId = connectionId || state.focusedConnectionId;
    if (!connId) return null;

    const active = state.activeConnections.get(connId);
    if (active?.accessToken && active?.tokenExpiry) {
      if (active.tokenExpiry.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
        return active.accessToken;
      }
    }

    if (active?.hasStoredCredentials) return await refreshToken(connId);

    const tenant = state.tenants.find(t => t.id === connId);
    if (tenant?.hasCredentials) return await refreshToken(connId);

    toast({ title: 'Credentials Required', description: 'Your session has expired. Please disconnect and reconnect with your credentials.', variant: 'destructive' });
    return null;
  }, [state.activeConnections, state.focusedConnectionId, state.tenants, refreshToken, toast]);

  // ---------- Connection Activation ----------

  const activateConnection = useCallback(async (tenantInfo: TenantConnectionInfo, setAsFocused = true): Promise<boolean> => {
    if (tenantInfo.status !== 'connected' || !tenantInfo.hasCredentials) return false;

    if (state.activeConnections.has(tenantInfo.id)) {
      if (setAsFocused) setState(prev => ({ ...prev, focusedConnectionId: tenantInfo.id }));
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

  // ---------- Data Loading ----------

  const loadCustomersAndTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      const customersData = await getCustomers();
      const customers = customersData.map(c => ({ id: c.id, name: c.name, tier: c.tier }));

      const tenantsData = await getTenantConnections();
      const tenants: TenantConnectionInfo[] = (tenantsData || []).map(t => ({
        id: t.id, tenantId: t.tenant_id, tenantName: t.tenant_name,
        displayName: t.display_name, customerId: t.customer_id,
        tenantGroupId: t.tenant_group_id, status: t.status,
      }));

      // Batch check credentials (avoids N+1)
      const connectedTenants = tenants.filter(t => t.status === 'connected');
      const credentialsMap = await batchHasStoredCredentials(connectedTenants.map(t => t.id));
      for (const tenant of connectedTenants) {
        tenant.hasCredentials = credentialsMap.get(tenant.id) || false;
      }

      setState(prev => ({ ...prev, customers, tenants }));

      // Restore last selection
      const lastSelection = loadLastSelection();
      if (lastSelection) {
        const customerExists = !lastSelection.customerId || customers.some(c => c.id === lastSelection.customerId);
        const tenantExists = !lastSelection.tenantId || tenants.some(t => t.id === lastSelection.tenantId);
        if (customerExists && tenantExists) {
          setState(prev => ({ ...prev, selectedCustomerId: lastSelection.customerId, selectedTenantId: lastSelection.tenantId }));
          if (lastSelection.tenantId) {
            const selectedTenant = tenants.find(t => t.id === lastSelection.tenantId);
            if (selectedTenant?.status === 'connected' && selectedTenant.hasCredentials) {
              const result = await refreshTokenFromStoredCredentials(selectedTenant.id);
              if (result.accessToken) {
                const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
                setState(prev => {
                  const newMap = new Map(prev.activeConnections);
                  newMap.set(selectedTenant.id, {
                    connectionId: selectedTenant.id, tenantId: selectedTenant.tenantId,
                    tenantName: selectedTenant.displayName || selectedTenant.tenantName,
                    accessToken: result.accessToken!, tokenExpiry, hasStoredCredentials: true,
                  });
                  return { ...prev, activeConnections: newMap, focusedConnectionId: selectedTenant.id };
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

  // ---------- Selection ----------

  const selectCustomer = useCallback((customerId: string | null) => {
    setState(prev => ({ ...prev, selectedCustomerId: customerId, selectedTenantId: null }));
    saveLastSelection({ customerId, tenantId: null });
  }, []);

  const selectTenant = useCallback(async (tenantConnectionId: string | null) => {
    if (!tenantConnectionId) {
      setState(prev => ({ ...prev, selectedTenantId: null, focusedConnectionId: null }));
      saveLastSelection({ customerId: state.selectedCustomerId, tenantId: null });
      return;
    }

    const tenant = state.tenants.find(t => t.id === tenantConnectionId);
    if (!tenant) return;

    setState(prev => ({ ...prev, selectedTenantId: tenantConnectionId, selectedCustomerId: tenant.customerId || prev.selectedCustomerId }));

    if (tenant.status === 'connected' && tenant.hasCredentials) {
      const activated = await activateConnection(tenant, true);
      if (activated) {
        toast({ title: 'Tenant Activated', description: `Connected to ${tenant.displayName || tenant.tenantName}` });
      } else {
        setState(prev => ({ ...prev, focusedConnectionId: tenantConnectionId }));
        toast({ title: 'Connection Issue', description: 'Could not refresh token. You may need to reconnect.', variant: 'destructive' });
      }
    } else {
      setState(prev => ({ ...prev, focusedConnectionId: tenantConnectionId }));
    }

    saveLastSelection({ customerId: tenant.customerId, tenantId: tenantConnectionId });
  }, [state.tenants, state.selectedCustomerId, activateConnection, toast]);

  // ---------- Connect / Disconnect ----------

  const connect = useCallback(async (
    tenantId: string, clientId: string, clientSecret: string, customerId?: string
  ): Promise<TestConnectionResult> => {
    setIsConnecting(true);
    try {
      const result = await testTenantConnection(tenantId, clientId, clientSecret);
      if (!result.success || !result.accessToken) {
        toast({ title: 'Connection Failed', description: result.error || 'Failed to connect to tenant', variant: 'destructive' });
        return result;
      }

      const existingTenant = state.tenants.find(t => t.tenantId === tenantId);
      let newConnectionId: string;
      if (existingTenant) {
        await updateTenantConnection(existingTenant.id, { status: 'connected', tenantName: result.tenantName, lastSync: new Date() });
        newConnectionId = existingTenant.id;
      } else {
        const connection = await createTenantConnection({
          tenantId: result.tenantId || tenantId, tenantName: result.tenantName,
          authMethod: 'app', clientId, status: 'connected', lastSync: new Date(),
          customerId: customerId || state.selectedCustomerId || undefined,
        });
        newConnectionId = connection.id;
      }

      try { await storeEncryptedCredential(newConnectionId, clientId, clientSecret); }
      catch (credError) {
        console.error('Failed to store credentials:', credError);
        toast({ title: 'Warning', description: 'Credentials could not be stored. You may need to reconnect after the session expires.', variant: 'destructive' });
      }

      const tokenExpiry = new Date(Date.now() + (result.expiresIn || 3600) * 1000);
      setState(prev => {
        const newMap = new Map(prev.activeConnections);
        newMap.set(newConnectionId, {
          connectionId: newConnectionId, tenantId: result.tenantId || tenantId,
          tenantName: result.tenantName || null, accessToken: result.accessToken!,
          tokenExpiry, hasStoredCredentials: true,
        });
        return {
          ...prev, activeConnections: newMap, focusedConnectionId: newConnectionId,
          selectedTenantId: newConnectionId, selectedCustomerId: customerId || prev.selectedCustomerId,
        };
      });

      await loadCustomersAndTenants();
      scheduleTokenRefresh(tokenExpiry, newConnectionId);
      toast({ title: 'Connected Successfully', description: `Connected to ${result.tenantName || tenantId}` });
      saveLastSelection({ customerId: customerId || state.selectedCustomerId, tenantId: newConnectionId });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      toast({ title: 'Connection Error', description: errorMessage, variant: 'destructive' });
      return { success: false, error: errorMessage };
    } finally {
      setIsConnecting(false);
    }
  }, [toast, scheduleTokenRefresh, state.tenants, state.selectedCustomerId, loadCustomersAndTenants]);

  const disconnectTenant = useCallback(async (connectionId: string) => {
    const timer = refreshTimersRef.current.get(connectionId);
    if (timer) { clearTimeout(timer); refreshTimersRef.current.delete(connectionId); }

    setState(prev => {
      const newMap = new Map(prev.activeConnections);
      newMap.delete(connectionId);
      let newFocused = prev.focusedConnectionId;
      if (newFocused === connectionId) {
        const remaining = Array.from(newMap.keys());
        newFocused = remaining.length > 0 ? remaining[0] : null;
      }
      return {
        ...prev, activeConnections: newMap, focusedConnectionId: newFocused,
        selectedTenantId: prev.selectedTenantId === connectionId ? newFocused : prev.selectedTenantId,
      };
    });

    const tenant = state.tenants.find(t => t.id === connectionId);
    toast({ title: 'Tenant Disconnected', description: `Disconnected from ${tenant?.displayName || tenant?.tenantName || 'tenant'}` });
  }, [state.tenants, toast]);

  const disconnect = useCallback(async () => {
    if (state.focusedConnectionId) await disconnectTenant(state.focusedConnectionId);
  }, [state.focusedConnectionId, disconnectTenant]);

  // ---------- Helpers ----------

  const isConnectionActive = useCallback((connectionId: string) => state.activeConnections.has(connectionId), [state.activeConnections]);
  const getTenantsForCustomer = useCallback((customerId: string) => state.tenants.filter(t => t.customerId === customerId), [state.tenants]);
  const getAllConnectedTenants = useCallback(() => state.tenants.filter(t => t.status === 'connected'), [state.tenants]);

  // ---------- Context Value ----------

  const focused = state.focusedConnectionId ? state.activeConnections.get(state.focusedConnectionId) : undefined;

  const value: TenantContextValue = {
    isConnected: state.activeConnections.size > 0,
    tenantId: focused?.tenantId || null,
    tenantName: focused?.tenantName || null,
    connectionId: state.focusedConnectionId,
    accessToken: focused?.accessToken || null,
    tokenExpiry: focused?.tokenExpiry || null,
    hasStoredCredentials: focused?.hasStoredCredentials || false,
    activeConnections: Array.from(state.activeConnections.values()),
    focusedConnectionId: state.focusedConnectionId,
    isConnectionActive,
    selectedCustomerId: state.selectedCustomerId,
    selectedTenantId: state.selectedTenantId,
    customers: state.customers,
    tenants: state.tenants,
    isConnecting, isRefreshing, isLoading,
    connect, disconnect, disconnectTenant, refreshToken, getValidToken,
    selectCustomer, selectTenant, loadCustomersAndTenants,
    getTenantsForCustomer, getAllConnectedTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
}
