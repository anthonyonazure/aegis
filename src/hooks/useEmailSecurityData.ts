import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

interface UseEmailSecurityDataOptions {
  action: string;
}

export function useEmailSecurityData<T>({ action }: UseEmailSecurityDataOptions) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connectionId } = useTenant();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!connectionId) {
      setError('No tenant connected. Please connect a tenant first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('email-security', {
        body: {
          action,
          tenantConnectionId: connectionId,
        },
      });

      if (fnError) throw fnError;

      if (result?.error) {
        throw new Error(result.error);
      }

      setData(result?.data ?? result);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch email security data';
      setError(msg);
      toast({
        title: 'Error fetching email security data',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [action, connectionId, toast]);

  return { data, isLoading, error, fetchData, setData };
}
