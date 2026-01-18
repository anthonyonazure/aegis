import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketRequest {
  action: 'create-ticket' | 'test-connection';
  integrationId: string;
  title?: string;
  description?: string;
  priority?: string;
  ticketType?: string;
  customerId?: string;
  sourceType?: 'drift' | 'compliance' | 'manual' | 'scheduled_drift';
  sourceId?: string;
}

interface PSAIntegration {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  api_url: string;
  default_ticket_type: string | null;
  default_priority: string | null;
}

interface PSACredentials {
  api_key: string;
  api_secret: string;
}

// HaloPSA API implementation
async function testHaloPSAConnection(
  apiUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; message: string }> {
  try {
    // HaloPSA uses OAuth2 client credentials flow
    const tokenResponse = await fetch(`${apiUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: apiSecret,
        scope: 'all',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('HaloPSA auth error:', error);
      return { success: false, message: `Authentication failed: ${tokenResponse.status}` };
    }

    const tokenData = await tokenResponse.json();
    
    // Test API access by getting ticket types
    const testResponse = await fetch(`${apiUrl}/TicketType`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (testResponse.ok) {
      return { success: true, message: 'Connected successfully to HaloPSA' };
    } else {
      return { success: false, message: `API access test failed: ${testResponse.status}` };
    }
  } catch (error) {
    console.error('HaloPSA connection test error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Connection failed' };
  }
}

async function createHaloPSATicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<{ ticketId: string } | { error: string }> {
  try {
    // Get access token
    const tokenResponse = await fetch(`${apiUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: apiSecret,
        scope: 'all',
      }),
    });

    if (!tokenResponse.ok) {
      return { error: `Authentication failed: ${tokenResponse.status}` };
    }

    const tokenData = await tokenResponse.json();
    
    // Map priority to HaloPSA priority IDs (these may vary by instance)
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    // Create ticket
    const response = await fetch(`${apiUrl}/Tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        summary: ticket.title,
        details: ticket.description,
        tickettype_id: ticket.ticketType === 'incident' ? 1 : 
                       ticket.ticketType === 'service_request' ? 2 : 
                       ticket.ticketType === 'problem' ? 3 : 4,
        priority_id: priorityMap[ticket.priority] || 3,
      }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HaloPSA ticket creation error:', errorText);
      return { error: `Ticket creation failed: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result[0]?.id?.toString() || 'unknown' };
  } catch (error) {
    console.error('HaloPSA ticket creation error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Autotask/Datto API implementation
async function testAutotaskConnection(
  apiUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Autotask uses API user integration credentials
    const response = await fetch(`${apiUrl}/v1.0/Tickets/query`, {
      method: 'POST',
      headers: {
        'ApiIntegrationCode': apiKey,
        'UserName': apiKey,
        'Secret': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        MaxRecords: 1,
        Filter: [{ field: 'id', op: 'gte', value: 0 }],
      }),
    });

    if (response.ok) {
      return { success: true, message: 'Connected successfully to Autotask' };
    } else {
      const error = await response.text();
      console.error('Autotask test error:', error);
      return { success: false, message: `Connection test failed: ${response.status}` };
    }
  } catch (error) {
    console.error('Autotask connection test error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Connection failed' };
  }
}

async function createAutotaskTicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<{ ticketId: string } | { error: string }> {
  try {
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const response = await fetch(`${apiUrl}/v1.0/Tickets`, {
      method: 'POST',
      headers: {
        'ApiIntegrationCode': apiKey,
        'UserName': apiKey,
        'Secret': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Title: ticket.title,
        Description: ticket.description,
        Priority: priorityMap[ticket.priority] || 3,
        TicketType: ticket.ticketType === 'incident' ? 1 : 2,
        Status: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Autotask ticket creation error:', errorText);
      return { error: `Ticket creation failed: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result.itemId?.toString() || 'unknown' };
  } catch (error) {
    console.error('Autotask ticket creation error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ConnectWise Manage API implementation
async function testConnectWiseConnection(
  apiUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; message: string }> {
  try {
    // ConnectWise uses Basic auth with company+publicKey:privateKey
    const authString = btoa(`${apiKey}:${apiSecret}`);
    
    const response = await fetch(`${apiUrl}/v4_6_release/apis/3.0/system/info`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'clientId': apiKey.split('+')[0] || apiKey, // Company ID is often prefixed
      },
    });

    if (response.ok) {
      const info = await response.json();
      return { success: true, message: `Connected to ConnectWise v${info.version || 'unknown'}` };
    } else {
      const error = await response.text();
      console.error('ConnectWise test error:', error);
      return { success: false, message: `Connection test failed: ${response.status}` };
    }
  } catch (error) {
    console.error('ConnectWise connection test error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Connection failed' };
  }
}

async function createConnectWiseTicket(
  apiUrl: string,
  apiKey: string,
  apiSecret: string,
  ticket: { title: string; description: string; priority: string; ticketType: string }
): Promise<{ ticketId: string } | { error: string }> {
  try {
    const authString = btoa(`${apiKey}:${apiSecret}`);
    
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const response = await fetch(`${apiUrl}/v4_6_release/apis/3.0/service/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'clientId': apiKey.split('+')[0] || apiKey,
      },
      body: JSON.stringify({
        summary: ticket.title,
        initialDescription: ticket.description,
        priority: { id: priorityMap[ticket.priority] || 3 },
        type: { id: ticket.ticketType === 'incident' ? 1 : 2 },
        board: { id: 1 }, // Default board - may need to be configurable
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ConnectWise ticket creation error:', errorText);
      return { error: `Ticket creation failed: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result.id?.toString() || 'unknown' };
  } catch (error) {
    console.error('ConnectWise ticket creation error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TicketRequest = await req.json();
    console.log('PSA request:', body.action, body.integrationId);

    // Get the PSA integration
    const { data: integration, error: integrationError } = await supabase
      .from('psa_integrations')
      .select('*')
      .eq('id', body.integrationId)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get stored credentials
    const { data: credentials, error: credError } = await supabase.rpc('get_psa_credential', {
      p_integration_id: body.integrationId,
    });

    if (credError || !credentials || credentials.length === 0) {
      console.error('Failed to get PSA credentials:', credError);
      return new Response(
        JSON.stringify({ error: 'No API credentials configured. Please add API credentials first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creds = credentials[0] as PSACredentials;
    const provider = integration.provider as string;

    // Handle test connection
    if (body.action === 'test-connection') {
      let testResult: { success: boolean; message: string };

      switch (provider) {
        case 'halopsa':
          testResult = await testHaloPSAConnection(integration.api_url, creds.api_key, creds.api_secret);
          break;
        case 'autotask':
          testResult = await testAutotaskConnection(integration.api_url, creds.api_key, creds.api_secret);
          break;
        case 'connectwise':
          testResult = await testConnectWiseConnection(integration.api_url, creds.api_key, creds.api_secret);
          break;
        default:
          testResult = { success: false, message: `Unknown provider: ${provider}` };
      }

      // Update connection status
      await supabase
        .from('psa_integrations')
        .update({
          connection_status: testResult.success ? 'connected' : 'failed',
          last_connection_test: new Date().toISOString(),
        })
        .eq('id', body.integrationId);

      return new Response(
        JSON.stringify(testResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle create ticket
    if (body.action === 'create-ticket') {
      if (!body.title || !body.sourceType) {
        return new Response(
          JSON.stringify({ error: 'Title and sourceType are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const ticketData = {
        title: body.title,
        description: body.description || '',
        priority: body.priority || integration.default_priority || 'medium',
        ticketType: body.ticketType || integration.default_ticket_type || 'incident',
      };

      let ticketResult: { ticketId: string } | { error: string };

      switch (provider) {
        case 'halopsa':
          ticketResult = await createHaloPSATicket(integration.api_url, creds.api_key, creds.api_secret, ticketData);
          break;
        case 'autotask':
          ticketResult = await createAutotaskTicket(integration.api_url, creds.api_key, creds.api_secret, ticketData);
          break;
        case 'connectwise':
          ticketResult = await createConnectWiseTicket(integration.api_url, creds.api_key, creds.api_secret, ticketData);
          break;
        default:
          ticketResult = { error: `Unknown provider: ${provider}` };
      }

      const externalTicketId = 'ticketId' in ticketResult ? ticketResult.ticketId : null;
      const ticketError = 'error' in ticketResult ? ticketResult.error : null;

      // Create local ticket record
      const { data: ticket, error: ticketInsertError } = await supabase
        .from('psa_tickets')
        .insert({
          user_id: user.id,
          psa_integration_id: body.integrationId,
          customer_id: body.customerId || null,
          external_ticket_id: externalTicketId,
          title: body.title,
          description: body.description || null,
          status: ticketError ? 'failed' : 'open',
          priority: ticketData.priority,
          ticket_type: ticketData.ticketType,
          source_type: body.sourceType,
          source_id: body.sourceId || null,
        })
        .select()
        .single();

      if (ticketInsertError) {
        console.error('Failed to create ticket record:', ticketInsertError);
      }

      if (ticketError) {
        return new Response(
          JSON.stringify({ success: false, error: ticketError, ticket }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          ticket,
          externalTicketId,
          message: 'Ticket created successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PSA function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
