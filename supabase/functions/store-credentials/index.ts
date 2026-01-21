import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create client with user's auth token to verify identity
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

    // Create admin client with service role for vault operations
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

    // Check if there's an existing credential with vault secret
    const { data: existingCred } = await adminClient
      .from('tenant_credentials')
      .select('vault_secret_id')
      .eq('tenant_connection_id', tenantConnectionId)
      .single();

    // Delete old vault secret if exists
    if (existingCred?.vault_secret_id) {
      await adminClient
        .from('vault.secrets')
        .delete()
        .eq('id', existingCred.vault_secret_id);
      console.log('Deleted old vault secret');
    }

    // Store secret in Vault using service role (has permission)
    const { data: vaultSecret, error: vaultError } = await adminClient
      .from('vault.secrets')
      .insert({
        secret: clientSecret,
        name: `tenant_credential_${tenantConnectionId}`,
        description: 'Service principal client secret for tenant connection',
      })
      .select('id')
      .single();

    if (vaultError) {
      console.error('Vault insert error:', vaultError);
      
      // Fallback: store as base64 encoded (version 1 encryption)
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

    // Insert/update credential with vault reference
    const { data: credData, error: credError } = await adminClient
      .from('tenant_credentials')
      .upsert({
        tenant_connection_id: tenantConnectionId,
        user_id: user.id,
        client_id: clientId,
        encrypted_secret: null,
        vault_secret_id: vaultSecret.id,
        encryption_version: 2,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_connection_id',
      })
      .select('id')
      .single();

    if (credError) {
      console.error('Credential upsert error:', credError);
      // Clean up vault secret
      await adminClient
        .from('vault.secrets')
        .delete()
        .eq('id', vaultSecret.id);

      return new Response(
        JSON.stringify({ error: 'Failed to store credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully stored credentials for ${tenantConnectionId}`);

    return new Response(
      JSON.stringify({ success: true, credentialId: credData.id, method: 'vault' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
