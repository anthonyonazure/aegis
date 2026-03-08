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

export interface CustomerInfo {
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

export interface TenantState {
  activeConnections: Map<string, ActiveConnection>;
  focusedConnectionId: string | null;
  selectedCustomerId: string | null;
  selectedTenantId: string | null;
  customers: CustomerInfo[];
  tenants: TenantConnectionInfo[];
}

export interface LastSelection {
  customerId: string | null;
  tenantId: string | null;
}

export interface TenantContextValue {
  // Backward-compatible single-tenant accessors
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
  connect: (tenantId: string, clientId: string, clientSecret: string, customerId?: string) => Promise<any>;
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
