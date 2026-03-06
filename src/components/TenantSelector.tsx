import { useState, useEffect } from 'react';
import {
  Building2,
  Server,
  ChevronDown,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  Unplug,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface TenantSelectorProps {
  onNavigateToAuth?: () => void;
  onNavigateToCustomers?: () => void;
  collapsed?: boolean;
}

export const TenantSelector = ({ 
  onNavigateToAuth, 
  onNavigateToCustomers,
  collapsed = false 
}: TenantSelectorProps) => {
  const {
    isConnected,
    isLoading,
    isRefreshing,
    customers,
    tenants,
    selectedCustomerId,
    selectedTenantId,
    tenantName,
    activeConnections,
    focusedConnectionId,
    isConnectionActive,
    selectCustomer,
    selectTenant,
    disconnectTenant,
    loadCustomersAndTenants,
    getTenantsForCustomer,
  } = useTenant();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadCustomersAndTenants();
  }, [loadCustomersAndTenants]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  
  const handleSelectCustomer = (customerId: string) => {
    selectCustomer(customerId);
  };

  const handleSelectTenant = async (tenantId: string) => {
    await selectTenant(tenantId);
    setOpen(false);
  };

  const handleDisconnectTenant = async (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await disconnectTenant(connectionId);
  };

  const handleClearSelection = () => {
    selectCustomer(null);
    setOpen(false);
  };

  const getDisplayText = () => {
    if (selectedCustomer && selectedTenant) {
      const displayName = selectedTenant.displayName || selectedTenant.tenantName || 'Unnamed Tenant';
      return `${selectedCustomer.name} / ${displayName}`;
    }
    if (selectedCustomer) {
      return selectedCustomer.name;
    }
    return 'Select Customer & Tenant';
  };

  const getConnectionStatus = () => {
    if (!selectedTenantId) return null;
    if (isConnectionActive(selectedTenantId)) {
      return <Badge variant="default" className="bg-success/20 text-success text-xs">Connected</Badge>;
    }
    if (selectedTenant?.status === 'connected') {
      return <Badge variant="secondary" className="text-xs">Ready</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Not Configured</Badge>;
  };

  const activeCount = activeConnections.length;

  if (collapsed) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className={cn(
              "h-10 w-10 relative",
              isConnected && "text-success"
            )}
          >
            {isLoading || isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : selectedCustomerId ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            )}
            {activeCount > 1 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <TenantSelectorContent
            customers={customers}
            tenants={tenants}
            selectedCustomerId={selectedCustomerId}
            selectedTenantId={selectedTenantId}
            focusedConnectionId={focusedConnectionId}
            isConnectionActive={isConnectionActive}
            activeCount={activeCount}
            getTenantsForCustomer={getTenantsForCustomer}
            onSelectCustomer={handleSelectCustomer}
            onSelectTenant={handleSelectTenant}
            onDisconnectTenant={handleDisconnectTenant}
            onClearSelection={handleClearSelection}
            onNavigateToAuth={onNavigateToAuth}
            onNavigateToCustomers={onNavigateToCustomers}
            onRefresh={loadCustomersAndTenants}
            isLoading={isLoading}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "w-full justify-between gap-2 h-auto py-2 px-3 bg-sidebar-accent/50",
            isConnected && "border-success/50"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            ) : selectedCustomerId ? (
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-muted-foreground">
                {activeCount > 1 ? `${activeCount} Active Tenants` : selectedCustomerId ? 'Active Tenant' : 'No Selection'}
              </span>
              <span className="text-sm font-medium truncate max-w-full">
                {getDisplayText()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getConnectionStatus()}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <TenantSelectorContent
          customers={customers}
          tenants={tenants}
          selectedCustomerId={selectedCustomerId}
          selectedTenantId={selectedTenantId}
          focusedConnectionId={focusedConnectionId}
          isConnectionActive={isConnectionActive}
          activeCount={activeCount}
          getTenantsForCustomer={getTenantsForCustomer}
          onSelectCustomer={handleSelectCustomer}
          onSelectTenant={handleSelectTenant}
          onDisconnectTenant={handleDisconnectTenant}
          onClearSelection={handleClearSelection}
          onNavigateToAuth={onNavigateToAuth}
          onNavigateToCustomers={onNavigateToCustomers}
          onRefresh={loadCustomersAndTenants}
          isLoading={isLoading}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface TenantInfo {
  id: string; 
  displayName: string | null; 
  tenantName: string | null;
  customerId: string | null;
  status: string;
  hasCredentials?: boolean;
}

interface TenantSelectorContentProps {
  customers: { id: string; name: string; tier: string }[];
  tenants: TenantInfo[];
  selectedCustomerId: string | null;
  selectedTenantId: string | null;
  focusedConnectionId: string | null;
  isConnectionActive: (id: string) => boolean;
  activeCount: number;
  getTenantsForCustomer: (customerId: string) => TenantInfo[];
  onSelectCustomer: (customerId: string) => void;
  onSelectTenant: (tenantId: string) => Promise<void>;
  onDisconnectTenant: (e: React.MouseEvent, connectionId: string) => Promise<void>;
  onClearSelection: () => void;
  onNavigateToAuth?: () => void;
  onNavigateToCustomers?: () => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

const TenantSelectorContent = ({
  customers,
  tenants,
  selectedCustomerId,
  selectedTenantId,
  focusedConnectionId,
  isConnectionActive,
  activeCount,
  getTenantsForCustomer,
  onSelectCustomer,
  onSelectTenant,
  onDisconnectTenant,
  onClearSelection,
  onNavigateToAuth,
  onNavigateToCustomers,
  onRefresh,
  isLoading,
}: TenantSelectorContentProps) => {
  return (
    <>
      <DropdownMenuLabel className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>Select Tenant</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {activeCount} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRefresh();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </Button>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      {customers.length === 0 ? (
        <>
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No customers yet</p>
            <p className="text-xs">Create a customer to get started</p>
          </div>
          {onNavigateToCustomers && (
            <DropdownMenuItem onClick={onNavigateToCustomers} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </DropdownMenuItem>
          )}
        </>
      ) : (
        <>
          <DropdownMenuGroup>
            {customers.map((customer) => {
              const customerTenants = getTenantsForCustomer(customer.id);
              const isSelected = selectedCustomerId === customer.id;

              if (customerTenants.length === 0) {
                return (
                  <DropdownMenuItem 
                    key={customer.id}
                    onClick={() => onSelectCustomer(customer.id)}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    <div className="flex-1">
                      <span>{customer.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        No tenants
                      </span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuSub key={customer.id}>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="flex-1">{customer.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {customer.name} Tenants
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {customerTenants.map((tenant) => {
                      const isFocused = focusedConnectionId === tenant.id;
                      const isActive = isConnectionActive(tenant.id);
                      const displayName = tenant.displayName || tenant.tenantName || 'Unnamed Tenant';
                      const isReady = tenant.status === 'connected' && tenant.hasCredentials;

                      return (
                        <DropdownMenuItem
                          key={tenant.id}
                          onClick={() => onSelectTenant(tenant.id)}
                          className={cn("gap-2", isFocused && "bg-accent")}
                        >
                          <div className="relative">
                            <Server className={cn(
                              "h-4 w-4",
                              isActive ? "text-success" : isReady ? "text-muted-foreground" : "text-muted-foreground/50"
                            )} />
                            {isActive && (
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={cn("truncate block", isFocused && "font-semibold")}>
                              {displayName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {isActive ? (isFocused ? 'Focused' : 'Active') : isReady ? 'Ready' : 'Not configured'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={(e) => onDisconnectTenant(e, tenant.id)}
                              >
                                <Unplug className="h-3 w-3" />
                              </Button>
                            )}
                            {isFocused && (
                              <Zap className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                    {onNavigateToAuth && (
                      <DropdownMenuItem onClick={onNavigateToAuth} className="gap-2 text-primary">
                        <Plus className="h-4 w-4" />
                        Add Tenant
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          
          {onNavigateToCustomers && (
            <DropdownMenuItem onClick={onNavigateToCustomers} className="gap-2">
              <Plus className="h-4 w-4" />
              Manage Customers
            </DropdownMenuItem>
          )}
          
          {selectedCustomerId && (
            <DropdownMenuItem onClick={onClearSelection} className="gap-2 text-muted-foreground">
              Clear Selection
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  );
};
