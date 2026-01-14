import { supabase } from '@/integrations/supabase/client';
import { AzureSubscription } from '@/types/tenant';

export interface AzureConnectionResult {
  success: boolean;
  error?: string;
  accessToken?: string;
  expiresIn?: number;
  subscriptions?: AzureSubscription[];
}

export interface AzureExportResult {
  success: boolean;
  error?: string;
  results?: Array<{
    resource: string;
    subscription: string;
    success: boolean;
    error?: string;
    count?: number;
  }>;
}

export async function testAzureConnection(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<AzureConnectionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('azure-api', {
      body: {
        action: 'test-connection',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      console.error('Azure connection error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Connection failed' };
    }

    return {
      success: true,
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
      subscriptions: data.subscriptions?.map((sub: any) => ({
        subscriptionId: sub.subscriptionId,
        displayName: sub.displayName,
        state: sub.state,
      })),
    };
  } catch (error) {
    console.error('Azure connection exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<AzureConnectionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('azure-api', {
      body: {
        action: 'get-token',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Token request failed' };
    }

    return {
      success: true,
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token request failed',
    };
  }
}

export async function listAzureSubscriptions(
  accessToken: string
): Promise<{ success: boolean; subscriptions?: AzureSubscription[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('azure-api', {
      body: {
        action: 'list-subscriptions',
        accessToken,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      subscriptions: data.subscriptions?.map((sub: any) => ({
        subscriptionId: sub.subscriptionId,
        displayName: sub.displayName,
        state: sub.state,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list subscriptions',
    };
  }
}

export async function exportAzureResources(
  accessToken: string,
  subscriptionIds: string[],
  resources: string[],
  exportJobId: string
): Promise<AzureExportResult> {
  try {
    const { data, error } = await supabase.functions.invoke('azure-api', {
      body: {
        action: 'export',
        accessToken,
        subscriptionIds,
        resources,
        exportJobId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: data.success,
      error: data.error,
      results: data.results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
