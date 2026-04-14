import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

export interface TenantUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  accountEnabled: boolean;
  jobTitle: string | null;
}

export function useTenantUsers() {
  const { accessToken, isConnected, tenantId } = useTenant();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!accessToken || !isConnected) return;

    setIsLoading(true);
    try {
      const { data } = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'proxy',
          accessToken,
          endpoint: '/users?$top=200&$select=id,displayName,userPrincipalName,mail,accountEnabled,jobTitle&$orderby=displayName',
        },
      });

      if (data?.value) {
        setUsers(
          (data.value || []).map((u: any) => ({
            id: u.id,
            displayName: u.displayName || '',
            userPrincipalName: u.userPrincipalName || '',
            mail: u.mail || null,
            accountEnabled: u.accountEnabled ?? true,
            jobTitle: u.jobTitle || null,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch tenant users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isConnected]);

  useEffect(() => {
    if (accessToken && isConnected) {
      fetchUsers();
    }
  }, [accessToken, isConnected, tenantId]);

  return { users, isLoading, refresh: fetchUsers };
}
