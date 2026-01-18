import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketRequest {
  integrationId: string;
  title: string;
  description: string;
  priority?: string;
  ticketType?: string;
  customerId?: string;
  sourceType: 'drift' | 'compliance' | 'manual' | 'scheduled_drift';
  sourceId?: string;
}

interface PSAIntegration {
  id: string;
  user_id: string;
  provider: string;
  api_url: string;
  default_ticket_type: string | null;
  default_priority: string | null;
}

// PSA-specific ticket creation functions
async function createHaloPSATicket(
  integration: PSAIntegration,
  ticket: TicketRequest,
  apiKey: string
): Promise<{ ticketId: string } | { error: string }> {
  try {
    const response = await fetch(`${integration.api_url}/Tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: ticket.title,
        details: ticket.description,
        tickettype_id: ticket.ticketType === 'incident' ? 1 : 2,
        priority_id: ticket.priority === 'critical' ? 1 : ticket.priority === 'high' ? 2 : ticket.priority === 'medium' ? 3 : 4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HaloPSA API error:', errorText);
      return { error: `HaloPSA API error: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result.id?.toString() || 'unknown' };
  } catch (error) {
    console.error('HaloPSA ticket creation failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function createAutotaskTicket(
  integration: PSAIntegration,
  ticket: TicketRequest,
  apiKey: string
): Promise<{ ticketId: string } | { error: string }> {
  try {
    const response = await fetch(`${integration.api_url}/v1.0/Tickets`, {
      method: 'POST',
      headers: {
        'ApiIntegrationCode': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Title: ticket.title,
        Description: ticket.description,
        Priority: ticket.priority === 'critical' ? 1 : ticket.priority === 'high' ? 2 : ticket.priority === 'medium' ? 3 : 4,
        TicketType: ticket.ticketType === 'incident' ? 1 : 2,
        Status: 1, // New
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Autotask API error:', errorText);
      return { error: `Autotask API error: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result.itemId?.toString() || 'unknown' };
  } catch (error) {
    console.error('Autotask ticket creation failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function createConnectWiseTicket(
  integration: PSAIntegration,
  ticket: TicketRequest,
  apiKey: string
): Promise<{ ticketId: string } | { error: string }> {
  try {
    const response = await fetch(`${integration.api_url}/v4_6_release/apis/3.0/service/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: ticket.title,
        initialDescription: ticket.description,
        priority: { id: ticket.priority === 'critical' ? 1 : ticket.priority === 'high' ? 2 : ticket.priority === 'medium' ? 3 : 4 },
        type: { id: ticket.ticketType === 'incident' ? 1 : 2 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ConnectWise API error:', errorText);
      return { error: `ConnectWise API error: ${response.status}` };
    }

    const result = await response.json();
    return { ticketId: result.id?.toString() || 'unknown' };
  } catch (error) {
    console.error('ConnectWise ticket creation failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TicketRequest = await req.json();
    console.log('Creating PSA ticket:', body);

    // Get the PSA integration
    const { data: integration, error: integrationError } = await supabase
      .from('psa_integrations')
      .select('*')
      .eq('id', body.integrationId)
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare ticket data
    const ticketData: TicketRequest = {
      ...body,
      priority: body.priority || integration.default_priority || 'medium',
      ticketType: body.ticketType || integration.default_ticket_type || 'incident',
    };

    // For now, we'll simulate ticket creation since we don't have actual API keys
    // In production, you would retrieve the API key from a secure store and call the actual PSA API
    let externalTicketId: string | null = null;
    let ticketError: string | null = null;

    // Simulate API call based on provider
    // In production, uncomment and use the actual API calls above
    console.log(`Would create ticket in ${integration.provider}:`, ticketData);
    
    // Simulated ticket ID for demo
    externalTicketId = `${integration.provider.toUpperCase()}-${Date.now()}`;

    // Create local ticket record
    const { data: ticket, error: ticketInsertError } = await supabase
      .from('psa_tickets')
      .insert({
        user_id: user.id,
        psa_integration_id: body.integrationId,
        customer_id: body.customerId || null,
        external_ticket_id: externalTicketId,
        title: body.title,
        description: body.description,
        status: 'open',
        priority: ticketData.priority,
        ticket_type: ticketData.ticketType,
        source_type: body.sourceType,
        source_id: body.sourceId || null,
      })
      .select()
      .single();

    if (ticketInsertError) {
      console.error('Failed to create ticket record:', ticketInsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ticket created successfully:', ticket);

    return new Response(
      JSON.stringify({
        success: true,
        ticket,
        externalTicketId,
        message: ticketError || 'Ticket created successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create PSA ticket error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
