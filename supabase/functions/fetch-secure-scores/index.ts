import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecureScoreRequest {
  tenantConnectionIds?: string[];
  refreshAll?: boolean;
}

interface ControlScore {
  controlCategory: string;
  controlName: string;
  score: number;
  maxScore: number;
  description?: string;
}

interface ImprovementAction {
  id: string;
  title: string;
  category: string;
  scoreImpact: number;
  implementationStatus: string;
  userImpact: string;
  implementationCost: string;
  threats: string[];
}

async function getGraphAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token acquisition failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchSecureScore(accessToken: string): Promise<{
  currentScore: number;
  maxScore: number;
  controlScores: ControlScore[];
}> {
  // Fetch the latest secure score
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/security/secureScores?$top=1&$orderby=createdDateTime desc',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Secure score fetch error:', error);
    throw new Error(`Failed to fetch secure score: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.value || data.value.length === 0) {
    return { currentScore: 0, maxScore: 0, controlScores: [] };
  }

  const latestScore = data.value[0];
  console.log('Raw secure score response:', JSON.stringify(latestScore, null, 2));
  
  // Parse control scores - Microsoft returns score and maxScore for each control
  const controlScores: ControlScore[] = (latestScore.controlScores || []).map((cs: any) => ({
    controlCategory: cs.controlCategory || 'Unknown',
    controlName: cs.controlName || 'Unknown',
    score: parseFloat(cs.score) || 0,
    maxScore: parseFloat(cs.maxScore) || 0,
    description: cs.description,
  }));

  // Calculate max score from control scores if not provided directly
  // Microsoft Graph API provides maxScore per control, sum them up
  const calculatedMaxScore = controlScores.reduce((sum, cs) => sum + cs.maxScore, 0);
  
  // Use maxScore from API or calculated from controls
  const maxScore = latestScore.maxScore || latestScore.maxPossibleScore || calculatedMaxScore || 0;
  const currentScore = parseFloat(latestScore.currentScore) || 0;

  console.log(`Parsed scores - current: ${currentScore}, max: ${maxScore}, controls: ${controlScores.length}`);

  return {
    currentScore,
    maxScore,
    controlScores,
  };
}

async function fetchImprovementActions(accessToken: string): Promise<ImprovementAction[]> {
  try {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/security/secureScoreControlProfiles?$top=50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log('Improvement actions not available');
      return [];
    }

    const data = await response.json();
    
    return (data.value || []).map((action: any) => ({
      id: action.id || '',
      title: action.title || action.id || 'Unknown',
      category: action.controlCategory || 'Unknown',
      scoreImpact: action.maxScore || 0,
      implementationStatus: action.implementationStatus || 'unknown',
      userImpact: action.userImpact || 'Unknown',
      implementationCost: action.implementationCost || 'Unknown',
      threats: action.threats || [],
    }));
  } catch (error) {
    console.error('Error fetching improvement actions:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantConnectionIds, refreshAll } = await req.json() as SecureScoreRequest;

    // Get tenant connections to fetch scores for
    let query = supabase
      .from('tenant_connections')
      .select('id, tenant_id, tenant_name, display_name, customer_id')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    if (tenantConnectionIds && tenantConnectionIds.length > 0 && !refreshAll) {
      query = query.in('id', tenantConnectionIds);
    }

    const { data: tenants, error: tenantsError } = await query;

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No connected tenants found', scores: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const tenant of tenants) {
      try {
        // Get credentials for this tenant
        const { data: credentials } = await supabase
          .rpc('get_decrypted_credential', {
            p_tenant_connection_id: tenant.id,
            p_user_id: user.id,
          });

        if (!credentials || credentials.length === 0) {
          errors.push({ tenantId: tenant.id, error: 'No credentials found' });
          continue;
        }

        const cred = credentials[0];
        const accessToken = await getGraphAccessToken(cred.client_id, cred.client_secret, cred.tenant_id);

        // Fetch secure score and improvement actions
        const [scoreData, improvementActions] = await Promise.all([
          fetchSecureScore(accessToken),
          fetchImprovementActions(accessToken),
        ]);

        // Calculate score percentage (for response); the DB column is generated and cannot be written directly
        const scorePercentage = scoreData.maxScore > 0 
          ? (scoreData.currentScore / scoreData.maxScore) * 100 
          : 0;

        const secureScorePayload = {
          user_id: user.id,
          tenant_connection_id: tenant.id,
          current_score: scoreData.currentScore,
          max_score: scoreData.maxScore,
          control_scores: scoreData.controlScores,
          improvement_actions: improvementActions,
          updated_at: new Date().toISOString(),
        };

        // Persist the secure score (update existing row; otherwise insert)
        const { data: updatedRows, error: updateError } = await supabase
          .from('tenant_secure_scores')
          .update(secureScorePayload)
          .eq('tenant_connection_id', tenant.id)
          .eq('user_id', user.id)
          .select('id');

        if (updateError) {
          console.error('Failed to update tenant_secure_scores:', updateError);
          throw new Error(`Failed to persist secure score (update): ${updateError.message}`);
        }

        if (!updatedRows || updatedRows.length === 0) {
          const { error: insertError } = await supabase
            .from('tenant_secure_scores')
            .insert(secureScorePayload);

          if (insertError) {
            console.error('Failed to insert tenant_secure_scores:', insertError);
            throw new Error(`Failed to persist secure score (insert): ${insertError.message}`);
          }
        }

        // Record history
        const { error: historyError } = await supabase
          .from('secure_score_history')
          .insert({
            user_id: user.id,
            tenant_connection_id: tenant.id,
            score: scoreData.currentScore,
            max_score: scoreData.maxScore,
          });

        if (historyError) {
          console.error('Failed to insert secure_score_history:', historyError);
        }

        results.push({
          tenantConnectionId: tenant.id,
          tenantName: tenant.display_name || tenant.tenant_name || tenant.tenant_id,
          currentScore: scoreData.currentScore,
          maxScore: scoreData.maxScore,
          percentage: scoreData.maxScore > 0 
            ? ((scoreData.currentScore / scoreData.maxScore) * 100).toFixed(1)
            : 0,
          controlScores: scoreData.controlScores.length,
          improvementActions: improvementActions.length,
        });

      } catch (tenantError) {
        console.error(`Error processing tenant ${tenant.id}:`, tenantError);
        errors.push({ 
          tenantId: tenant.id, 
          tenantName: tenant.display_name || tenant.tenant_name,
          error: tenantError instanceof Error ? tenantError.message : 'Unknown error' 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        failed: errors.length,
        scores: results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-secure-scores:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
