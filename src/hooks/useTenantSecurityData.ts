import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SecurityAlert {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low' | 'informational';
  status: string;
  category: string;
  description: string;
  createdDateTime: string;
  source: string;
}

export interface RiskyUser {
  id: string;
  userDisplayName: string;
  userPrincipalName: string;
  riskLevel: string;
  riskState: string;
  riskDetail: string;
  riskLastUpdatedDateTime: string;
}

export interface RiskySignIn {
  id: string;
  userDisplayName: string;
  userPrincipalName: string;
  ipAddress: string;
  location: { city?: string; countryOrRegion?: string };
  riskLevelDuringSignIn: string;
  riskState: string;
  createdDateTime: string;
  appDisplayName: string;
}

export interface TenantSecurityData {
  alerts: SecurityAlert[];
  riskyUsers: RiskyUser[];
  riskySignIns: RiskySignIn[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastRefreshed: Date | null;
}

export function useTenantSecurityData(): TenantSecurityData {
  const { accessToken, isConnected, tenantId } = useTenant();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [riskyUsers, setRiskyUsers] = useState<RiskyUser[]>([]);
  const [riskySignIns, setRiskySignIns] = useState<RiskySignIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !isConnected) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all three in parallel via the graph-api edge function
      const [alertsRes, riskyUsersRes, riskySignInsRes] = await Promise.allSettled([
        supabase.functions.invoke('graph-api', {
          body: {
            action: 'proxy',
            accessToken,
            endpoint: '/security/alerts_v2?$top=50&$orderby=createdDateTime desc',
          },
        }),
        supabase.functions.invoke('graph-api', {
          body: {
            action: 'proxy',
            accessToken,
            endpoint: '/identityProtection/riskyUsers?$top=50&$orderby=riskLastUpdatedDateTime desc',
          },
        }),
        supabase.functions.invoke('graph-api', {
          body: {
            action: 'proxy',
            accessToken,
            endpoint: '/auditLogs/signIns?$top=50&$filter=riskLevelDuringSignIn ne \'none\'&$orderby=createdDateTime desc',
          },
        }),
      ]);

      // Process alerts
      if (alertsRes.status === 'fulfilled' && alertsRes.value.data?.value) {
        const mapped: SecurityAlert[] = (alertsRes.value.data.value || []).map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled Alert',
          severity: (a.severity || 'informational').toLowerCase(),
          status: a.status || 'unknown',
          category: a.category || 'General',
          description: a.description || '',
          createdDateTime: a.createdDateTime || '',
          source: a.detectionSource || a.serviceSource || 'Microsoft 365',
        }));
        setAlerts(mapped);
      }

      // Process risky users
      if (riskyUsersRes.status === 'fulfilled' && riskyUsersRes.value.data?.value) {
        const mapped: RiskyUser[] = (riskyUsersRes.value.data.value || []).map((u: any) => ({
          id: u.id,
          userDisplayName: u.userDisplayName || 'Unknown',
          userPrincipalName: u.userPrincipalName || '',
          riskLevel: u.riskLevel || 'none',
          riskState: u.riskState || 'none',
          riskDetail: u.riskDetail || '',
          riskLastUpdatedDateTime: u.riskLastUpdatedDateTime || '',
        }));
        setRiskyUsers(mapped);
      }

      // Process risky sign-ins
      if (riskySignInsRes.status === 'fulfilled' && riskySignInsRes.value.data?.value) {
        const mapped: RiskySignIn[] = (riskySignInsRes.value.data.value || []).map((s: any) => ({
          id: s.id,
          userDisplayName: s.userDisplayName || 'Unknown',
          userPrincipalName: s.userPrincipalName || '',
          ipAddress: s.ipAddress || '',
          location: s.location || {},
          riskLevelDuringSignIn: s.riskLevelDuringSignIn || 'none',
          riskState: s.riskState || 'none',
          createdDateTime: s.createdDateTime || '',
          appDisplayName: s.appDisplayName || '',
        }));
        setRiskySignIns(mapped);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch security data';
      setError(msg);
      console.error('Security data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isConnected]);

  useEffect(() => {
    if (accessToken && isConnected) {
      fetchData();
    }
  }, [accessToken, isConnected, tenantId]);

  return { alerts, riskyUsers, riskySignIns, isLoading, error, refresh: fetchData, lastRefreshed };
}
