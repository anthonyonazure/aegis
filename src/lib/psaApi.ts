import { supabase } from '@/integrations/supabase/client';

const PSA_FUNCTION = 'create-psa-ticket';

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface CreateTicketRequest {
  integrationId: string;
  title: string;
  description?: string;
  priority?: string;
  ticketType?: string;
  customerId?: string;
  sourceType: 'drift' | 'compliance' | 'manual' | 'scheduled_drift' | 'anomaly';
  sourceId?: string;
}

export interface CreateTicketResult {
  success: boolean;
  ticket?: {
    id: string;
    title: string;
    status: string;
    external_ticket_id?: string;
  };
  externalTicketId?: string;
  error?: string;
  message?: string;
}

/**
 * Test PSA integration connection
 */
export async function testPSAConnection(integrationId: string): Promise<TestConnectionResult> {
  try {
    const { data, error } = await supabase.functions.invoke(PSA_FUNCTION, {
      body: {
        action: 'test-connection',
        integrationId,
      },
    });

    if (error) {
      console.error('PSA connection test error:', error);
      return { success: false, message: 'Connection test failed. Please try again.' };
    }

    return data as TestConnectionResult;
  } catch (err) {
    console.error('PSA connection test exception:', err);
    return { success: false, message: 'Connection test failed. Please try again.' };
  }
}

/**
 * Create a ticket in the PSA system
 */
export async function createPSATicket(request: CreateTicketRequest): Promise<CreateTicketResult> {
  try {
    const { data, error } = await supabase.functions.invoke(PSA_FUNCTION, {
      body: {
        action: 'create-ticket',
        ...request,
      },
    });

    if (error) {
      console.error('PSA ticket creation error:', error);
      return { success: false, error: 'Ticket creation failed. Please try again.' };
    }

    return data as CreateTicketResult;
  } catch (err) {
    console.error('PSA ticket creation exception:', err);
    return { success: false, error: 'Ticket creation failed. Please try again.' };
  }
}

/**
 * Store PSA API credentials securely
 */
export async function storePSACredentials(
  integrationId: string,
  apiKey: string,
  apiSecret?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('store_psa_credential', {
      p_integration_id: integrationId,
      p_api_key: apiKey,
      p_api_secret: apiSecret || null,
    });

    if (error) {
      console.error('Failed to store PSA credentials:', error);
      return { success: false, error: 'Failed to store credentials. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Store PSA credentials exception:', err);
    return { success: false, error: 'Failed to store credentials. Please try again.' };
  }
}

/**
 * Check if credentials are stored for an integration
 */
export async function hasPSACredentials(integrationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('psa_integrations')
      .select('vault_secret_id')
      .eq('id', integrationId)
      .single();

    if (error) return false;
    return !!data?.vault_secret_id;
  } catch {
    return false;
  }
}
