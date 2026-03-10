import { useState, useEffect } from 'react';
import { Building2, CheckSquare, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

export interface SelectedTenantInfo {
  id: string;
  tenantId: string;
  name: string;
  customerId: string | null;
  hasCredentials: boolean;
}

interface TenantMultiSelectorProps {
  selectedTenantIds: string[];
  onSelectionChange: (tenants: SelectedTenantInfo[]) => void;
  multiSelect?: boolean;
  label?: string;
}

export const TenantMultiSelector = ({
  selectedTenantIds,
  onSelectionChange,
  multiSelect = true,
  label = 'Select Tenants',
}: TenantMultiSelectorProps) => {
  const { tenants, customers, isLoading } = useTenant();

  const connectedTenants: SelectedTenantInfo[] = tenants
    .filter(t => t.status === 'connected' && t.hasCredentials)
    .map(t => ({
      id: t.id,
      tenantId: t.tenantId,
      name: t.displayName || t.tenantName || t.tenantId,
      customerId: t.customerId,
      hasCredentials: t.hasCredentials || false,
    }));

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId)?.name || null;
  };

  const toggleTenant = (tenant: SelectedTenantInfo) => {
    if (multiSelect) {
      const isSelected = selectedTenantIds.includes(tenant.id);
      const newSelection = isSelected
        ? connectedTenants.filter(t => selectedTenantIds.includes(t.id) && t.id !== tenant.id)
        : [...connectedTenants.filter(t => selectedTenantIds.includes(t.id)), tenant];
      onSelectionChange(newSelection);
    } else {
      onSelectionChange(selectedTenantIds.includes(tenant.id) ? [] : [tenant]);
    }
  };

  const selectAll = () => onSelectionChange(connectedTenants);
  const clearAll = () => onSelectionChange([]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading tenants...
      </div>
    );
  }

  if (connectedTenants.length === 0) {
    return (
      <Card className="glass-panel border-border/50">
        <CardContent className="py-6 text-center text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No connected tenants with credentials found.</p>
          <p className="text-xs mt-1">Connect a tenant and store credentials first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel border-border/50">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {multiSelect && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                <CheckSquare className="w-3 h-3 mr-1" /> All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">
                <Square className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {connectedTenants.map(tenant => {
            const isSelected = selectedTenantIds.includes(tenant.id);
            const customerName = getCustomerName(tenant.customerId);
            return (
              <button
                key={tenant.id}
                onClick={() => toggleTenant(tenant)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Checkbox checked={isSelected} className="pointer-events-none h-3.5 w-3.5" />
                <Building2 className="w-3.5 h-3.5" />
                <span>{tenant.name}</span>
                {customerName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {customerName}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        {selectedTenantIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedTenantIds.length} tenant{selectedTenantIds.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </CardContent>
    </Card>
  );
};
