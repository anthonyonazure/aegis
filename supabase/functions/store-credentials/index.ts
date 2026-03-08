import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantConnectionId, clientId, clientSecret } = await req.json();

    if (!tenantConnectionId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user owns the tenant connection
    const { data: connection, error: connError } = await adminClient
      .from('tenant_connections')
      .select('id, user_id')
      .eq('id', tenantConnectionId)
      .single();

    if (connError || !connection) {
      console.error('Connection lookup error:', connError);
      return new Response(
        JSON.stringify({ error: 'Tenant connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (connection.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Storing credentials for tenant connection ${tenantConnectionId}`);

    // Use the existing RPC function which handles vault operations properly
    try {
      const { data: credId, error: rpcError } = await adminClient.rpc('store_encrypted_credential', {
        p_tenant_connection_id: tenantConnectionId,
        p_client_id: clientId,
        p_client_secret: clientSecret,
        p_user_id: user.id,
      });

      if (rpcError) {
        console.error('RPC store_encrypted_credential error:', rpcError);
        throw rpcError;
      }

      console.log(`Successfully stored credentials via vault RPC for ${tenantConnectionId}`);
      return new Response(
        JSON.stringify({ success: true, credentialId: credId, method: 'vault' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (vaultError) {
      console.error('Vault RPC failed, falling back to base64:', vaultError);

      // Fallback: store as base64 encoded
      const encodedSecret = btoa(clientSecret);

      const { data: credData, error: credError } = await adminClient
        .from('tenant_credentials')
        .upsert({
          tenant_connection_id: tenantConnectionId,
          user_id: user.id,
          client_id: clientId,
          encrypted_secret: encodedSecret,
          vault_secret_id: null,
          encryption_version: 1,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_connection_id',
        })
        .select('id')
        .single();

      if (credError) {
        console.error('Credential upsert error:', credError);
        return new Response(
          JSON.stringify({ error: 'Failed to store credentials' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Stored credentials with base64 encoding (fallback)');
      return new Response(
        JSON.stringify({ success: true, credentialId: credData.id, method: 'base64' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
