import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

interface UseIntuneDataOptions {
  resource: string;
}

export function useIntuneData<T>({ resource }: UseIntuneDataOptions) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getValidToken, connectionId } = useTenant();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getValidToken();
      if (!token) {
        setError('No valid token. Please connect a tenant first.');
        return;
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'fetch',
          accessToken: token,
          resources: [resource],
        },
      });

      if (fnError) throw fnError;

      if (result?.results?.[resource]) {
        const items = result.results[resource];
        setData(Array.isArray(items) ? items : []);
      } else {
        setData([]);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch data';
      setError(msg);
      toast({
        title: 'Error fetching Intune data',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [resource, getValidToken, connectionId, toast]);

  return { data, isLoading, error, fetchData, setData };
}
