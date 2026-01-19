import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_TO_FUNCTION: Record<string, string> = {
  'security_predictor': 'ai-security-predictor',
  'security_benchmark': 'ai-security-benchmark',
  'user_risk_profiler': 'ai-user-risk-profiler',
  'anomaly_detection': 'ai-anomaly-detection',
  'compliance_advisor': 'ai-compliance-advisor',
  'config_optimizer': 'ai-config-optimizer',
  'license_optimizer': 'ai-license-optimizer',
  'drift_explainer': 'ai-drift-explainer',
  'tenant_analyzer': 'ai-tenant-analyzer',
  'copilot_advisor': 'ai-copilot-advisor',
};

const SERVICE_LABELS: Record<string, string> = {
  'security_predictor': 'Security Predictor',
  'security_benchmark': 'Security Benchmark',
  'user_risk_profiler': 'User Risk Profiler',
  'anomaly_detection': 'Anomaly Detection',
  'compliance_advisor': 'Compliance Advisor',
  'config_optimizer': 'Config Optimizer',
  'license_optimizer': 'License Optimizer',
  'drift_explainer': 'Drift Explainer',
  'tenant_analyzer': 'Tenant Analyzer',
  'copilot_advisor': 'Copilot Readiness Advisor',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();
    
    // Find jobs that are due to run
    const { data: dueJobs, error: fetchError } = await supabase
      .from('ai_scheduled_jobs')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now);

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
    }

    console.log(`Found ${dueJobs?.length || 0} jobs due to run`);

    const results = [];

    for (const job of dueJobs || []) {
      try {
        console.log(`Running job: ${job.name} (${job.service_type})`);

        const functionName = SERVICE_TO_FUNCTION[job.service_type];
        if (!functionName) {
          console.warn(`Unknown service type: ${job.service_type}`);
          continue;
        }

        // Call the AI analysis function
        const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId: job.tenant_connection_id,
            scheduled: true,
          }),
        });

        let analysisResult: any = {};
        let score: number | null = null;
        let recommendations: string[] = [];
        let summary = '';

        if (analysisResponse.ok) {
          analysisResult = await analysisResponse.json();
          score = analysisResult.score ?? analysisResult.overallScore ?? null;
          recommendations = analysisResult.recommendations || [];
          summary = analysisResult.summary || analysisResult.analysis || `${SERVICE_LABELS[job.service_type]} analysis completed`;
        } else {
          console.error(`Analysis failed for ${job.service_type}: ${analysisResponse.status}`);
          summary = `Analysis encountered an error`;
        }

        // Store the result
        const { error: insertError } = await supabase
          .from('ai_analysis_results')
          .insert({
            user_id: job.user_id,
            scheduled_job_id: job.id,
            tenant_connection_id: job.tenant_connection_id,
            analysis_type: job.service_type,
            score,
            result: analysisResult,
            recommendations,
          });

        if (insertError) {
          console.error(`Failed to store result: ${insertError.message}`);
        }

        // Update job's last_run_at and recalculate next_run_at
        const { error: updateError } = await supabase
          .from('ai_scheduled_jobs')
          .update({ last_run_at: now })
          .eq('id', job.id);

        if (updateError) {
          console.error(`Failed to update job: ${updateError.message}`);
        }

        // Send notifications if configured
        if (job.notification_channel_ids && job.notification_channel_ids.length > 0) {
          const { data: channels } = await supabase
            .from('notification_channels')
            .select('*')
            .in('id', job.notification_channel_ids)
            .eq('is_active', true);

          for (const channel of channels || []) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-ai-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  channel_type: channel.channel_type,
                  config: channel.config,
                  subject: `${SERVICE_LABELS[job.service_type]} Report`,
                  message: summary,
                  score,
                  recommendations: recommendations.slice(0, 5),
                }),
              });
              console.log(`Sent notification to ${channel.name}`);
            } catch (notifError) {
              console.error(`Notification failed for ${channel.name}:`, notifError);
            }
          }
        }

        results.push({ jobId: job.id, status: 'success', score });

      } catch (jobError) {
        console.error(`Job ${job.id} failed:`, jobError);
        results.push({ jobId: job.id, status: 'error', error: String(jobError) });
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Scheduled AI analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
