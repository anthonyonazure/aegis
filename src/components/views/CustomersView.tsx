import { useState } from 'react';
import { CustomerManager } from '@/components/CustomerManager';
import { TenantGroupManager } from '@/components/TenantGroupManager';
import { Customer } from '@/types/tenant';

export const CustomersView = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  if (selectedCustomer) {
    return (
      <TenantGroupManager
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <CustomerManager
      onSelectCustomer={setSelectedCustomer}
      selectedCustomerId={selectedCustomer?.id}
    />
  );
};
