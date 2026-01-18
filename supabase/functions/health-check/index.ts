import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  tenantConnectionId: string;
  tenantName: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTimeMs: number;
  details: {
    tokenValid: boolean;
    graphApiReachable: boolean;
    licenseInfo?: { hasLicenses: boolean; totalLicenses: number };
    organizationInfo?: { displayName: string; verifiedDomains: number };
    errorCode?: string;
    errorMessage?: string;
  };
}

async function verifyAuth(req: Request): Promise<{ userId: string; supabase: any } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.error('Auth verification failed:', error);
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: user.id, supabase };
}

async function getStoredCredentials(
  supabase: any,
  tenantConnectionId: string,
  userId: string
): Promise<{ clientId: string; clientSecret: string; tenantId: string } | null> {
  const { data, error } = await supabase.rpc('get_decrypted_credential', {
    p_tenant_connection_id: tenantConnectionId,
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    console.error('Failed to get credentials:', error);
    return null;
  }

  return {
    clientId: data[0].client_id,
    clientSecret: data[0].client_secret,
    tenantId: data[0].tenant_id,
  };
}

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string; responseTime: number } | { error: string; responseTime: number }> {
  const startTime = Date.now();
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    if (!response.ok) {
      return { 
        error: data.error_description || data.error || 'Token request failed',
        responseTime 
      };
    }

    return { token: data.access_token, responseTime };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : 'Network error',
      responseTime: Date.now() - startTime 
    };
  }
}

interface GraphCheckResult {
  reachable: boolean;
  organizationInfo?: { displayName: string; verifiedDomains: number };
  licenseInfo?: { hasLicenses: boolean; totalLicenses: number };
  error?: string;
}

async function checkGraphApi(accessToken: string): Promise<GraphCheckResult> {
  try {
    // Check organization endpoint
    const orgResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orgResponse.ok) {
      const errorData = await orgResponse.json().catch(() => ({}));
      return { 
        reachable: false, 
        error: errorData.error?.message || `HTTP ${orgResponse.status}` 
      };
    }

    const orgData = await orgResponse.json();
    const org = orgData.value?.[0];

    // Check subscribed SKUs (licenses)
    let licenseInfo = { hasLicenses: false, totalLicenses: 0 };
    try {
      const skuResponse = await fetch('https://graph.microsoft.com/v1.0/subscribedSkus', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (skuResponse.ok) {
        const skuData = await skuResponse.json();
        const skus = skuData.value || [];
        const totalUnits = skus.reduce((sum: number, sku: any) => {
          return sum + (sku.prepaidUnits?.enabled || 0);
        }, 0);
        licenseInfo = { hasLicenses: skus.length > 0, totalLicenses: totalUnits };
      }
    } catch (e) {
      // License check is optional, continue without it
      console.log('License check skipped:', e);
    }

    return {
      reachable: true,
      organizationInfo: {
        displayName: org?.displayName || 'Unknown',
        verifiedDomains: org?.verifiedDomains?.length || 0,
      },
      licenseInfo,
    };
  } catch (error) {
    return { 
      reachable: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

function determineHealthStatus(
  tokenResult: { token?: string; error?: string },
  graphResult: { reachable: boolean; error?: string }
): 'healthy' | 'warning' | 'critical' | 'unknown' {
  // Critical: Can't get token at all
  if (tokenResult.error) {
    return 'critical';
  }

  // Critical: Graph API not reachable
  if (!graphResult.reachable) {
    // Warning if it's a permission issue (might be partial access)
    if (graphResult.error?.includes('403') || graphResult.error?.includes('Forbidden')) {
      return 'warning';
    }
    return 'critical';
  }

  // Healthy: Everything works
  return 'healthy';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, supabase } = authResult;
    const body = await req.json();
    const { action, tenantConnectionIds } = body;

    if (action === 'check-single') {
      // Single tenant health check
      const { tenantConnectionId } = body;
      
      if (!tenantConnectionId) {
        return new Response(
          JSON.stringify({ error: 'tenantConnectionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get tenant connection info
      const { data: connection, error: connError } = await supabase
        .from('tenant_connections')
        .select('id, tenant_id, tenant_name, display_name')
        .eq('id', tenantConnectionId)
        .single();

      if (connError || !connection) {
        return new Response(
          JSON.stringify({ error: 'Tenant connection not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get stored credentials
      const credentials = await getStoredCredentials(supabase, tenantConnectionId, userId);
      
      if (!credentials) {
        // No credentials stored - return unknown status
        const result: HealthCheckResult = {
          tenantConnectionId,
          tenantName: connection.display_name || connection.tenant_name,
          healthStatus: 'unknown',
          responseTimeMs: 0,
          details: {
            tokenValid: false,
            graphApiReachable: false,
            errorMessage: 'No credentials stored for this tenant',
          },
        };

        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get access token
      const tokenResult = await getAccessToken(
        credentials.tenantId,
        credentials.clientId,
        credentials.clientSecret
      );

      let graphResult: GraphCheckResult = { reachable: false, error: 'Token not available' };
      
      if ('token' in tokenResult) {
        // Check Graph API
        graphResult = await checkGraphApi(tokenResult.token);
      }

      const healthStatus = determineHealthStatus(
        'token' in tokenResult ? { token: tokenResult.token } : { error: tokenResult.error },
        graphResult
      );

      const totalResponseTime = 'responseTime' in tokenResult ? tokenResult.responseTime : 0;

      const result: HealthCheckResult = {
        tenantConnectionId,
        tenantName: connection.display_name || connection.tenant_name,
        healthStatus,
        responseTimeMs: totalResponseTime,
        details: {
          tokenValid: 'token' in tokenResult,
          graphApiReachable: graphResult.reachable,
          organizationInfo: graphResult.organizationInfo,
          licenseInfo: graphResult.licenseInfo,
          errorCode: 'error' in tokenResult ? 'TOKEN_ERROR' : graphResult.error ? 'GRAPH_ERROR' : undefined,
          errorMessage: 'error' in tokenResult ? tokenResult.error : graphResult.error,
        },
      };

      // Update tenant connection health status
      await supabase
        .from('tenant_connections')
        .update({
          health_status: healthStatus,
          last_health_check: new Date().toISOString(),
        })
        .eq('id', tenantConnectionId);

      // Record health check in history
      await supabase
        .from('tenant_health_checks')
        .insert([{
          user_id: userId,
          tenant_connection_id: tenantConnectionId,
          health_status: healthStatus,
          response_time_ms: totalResponseTime,
          check_type: 'manual',
          details: result.details,
          error_message: result.details.errorMessage || null,
        }]);

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check-bulk') {
      // Bulk health check for multiple tenants
      const connectionIds = tenantConnectionIds as string[];
      
      if (!Array.isArray(connectionIds) || connectionIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'tenantConnectionIds array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limit to 50 tenants per request
      const limitedIds = connectionIds.slice(0, 50);
      const results: HealthCheckResult[] = [];

      for (const tenantConnectionId of limitedIds) {
        try {
          // Get tenant connection info
          const { data: connection } = await supabase
            .from('tenant_connections')
            .select('id, tenant_id, tenant_name, display_name')
            .eq('id', tenantConnectionId)
            .single();

          if (!connection) continue;

          // Get stored credentials
          const credentials = await getStoredCredentials(supabase, tenantConnectionId, userId);
          
          if (!credentials) {
            results.push({
              tenantConnectionId,
              tenantName: connection.display_name || connection.tenant_name,
              healthStatus: 'unknown',
              responseTimeMs: 0,
              details: {
                tokenValid: false,
                graphApiReachable: false,
                errorMessage: 'No credentials stored',
              },
            });
            continue;
          }

          // Get access token
          const tokenResult = await getAccessToken(
            credentials.tenantId,
            credentials.clientId,
            credentials.clientSecret
          );

          let graphResult: GraphCheckResult = { reachable: false, error: 'Token not available' };
          
          if ('token' in tokenResult) {
            graphResult = await checkGraphApi(tokenResult.token);
          }

          const healthStatus = determineHealthStatus(
            'token' in tokenResult ? { token: tokenResult.token } : { error: tokenResult.error },
            graphResult
          );

          const totalResponseTime = 'responseTime' in tokenResult ? tokenResult.responseTime : 0;

          const result: HealthCheckResult = {
            tenantConnectionId,
            tenantName: connection.display_name || connection.tenant_name,
            healthStatus,
            responseTimeMs: totalResponseTime,
            details: {
              tokenValid: 'token' in tokenResult,
              graphApiReachable: graphResult.reachable,
              organizationInfo: graphResult.organizationInfo,
              licenseInfo: graphResult.licenseInfo,
              errorMessage: 'error' in tokenResult ? tokenResult.error : graphResult.error,
            },
          };

          results.push(result);

          // Update tenant connection health status
          await supabase
            .from('tenant_connections')
            .update({
              health_status: healthStatus,
              last_health_check: new Date().toISOString(),
            })
            .eq('id', tenantConnectionId);

          // Record health check in history
          await supabase
            .from('tenant_health_checks')
            .insert([{
              user_id: userId,
              tenant_connection_id: tenantConnectionId,
              health_status: healthStatus,
              response_time_ms: totalResponseTime,
              check_type: 'manual',
              details: result.details,
              error_message: result.details.errorMessage || null,
            }]);

        } catch (err) {
          console.error(`Health check failed for ${tenantConnectionId}:`, err);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          checked: results.length,
          total: limitedIds.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use check-single or check-bulk' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ error: 'Health check failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
