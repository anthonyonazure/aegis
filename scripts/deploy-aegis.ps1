# Aegis one-shot deploy script (PowerShell, Windows-friendly)
#
# Runs every database migration + deploys every edge function in dependency order.
# Idempotent — safe to re-run.
#
# Prerequisites (one-time):
#   1. npm install -g supabase   (or use npx supabase ...)
#   2. supabase login
#   3. supabase link --project-ref <your-project-ref>
#   4. Set the AI gateway secrets in Supabase Dashboard:
#        AI_GATEWAY_API_KEY = your OpenAI / OpenAI-compatible API key
#        AI_GATEWAY_URL     = https://api.openai.com/v1 (or your gateway)
#      Optional for #3c custom domains:
#        CUSTOM_DOMAIN_CNAME_TARGET = your hosting target (e.g. cname.vercel-dns.com)
#        CUSTOM_DOMAIN_A_TARGETS    = optional comma-separated IPv4 fallbacks
#
# Usage:
#   .\scripts\deploy-aegis.ps1
#
# Re-running:
#   The migrations are tracked by Supabase; already-applied ones are skipped.
#   Function deploys overwrite in place — no harm in re-running.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Step {
  param([string]$Label)
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
}

# 1. Push every migration (Supabase tracks which have run; new ones apply, existing ones skip)
Step 'Pushing database migrations'
supabase db push

# 2. Deploy every function. Listing them explicitly so removals stay obvious.
$functions = @(
  # Pre-existing (modified during the rebrand + lovable cleanup)
  'graph-api',
  'create-psa-ticket',
  'send-ai-notification',
  'ai-chat', 'ai-analyze', 'ai-policy-generator', 'ai-anomaly-detection',
  'ai-nl-query', 'ai-remediation', 'ai-license-optimizer', 'ai-drift-explainer',
  'ai-executive-report', 'ai-security-predictor', 'ai-migration-planner',
  'ai-copilot-advisor', 'ai-tenant-analyzer', 'ai-compliance-advisor',
  'ai-cost-predictor', 'ai-security-benchmark', 'ai-change-impact',
  'ai-incident-responder', 'ai-user-risk-profiler', 'ai-config-optimizer',
  'ai-chat-assistant', 'ai-cross-tenant-insights', 'email-security',
  # New (Phase 2 #3a–#3c, #4a–#4c, #6)
  'compute-drift-adhoc',
  'invite-portal-user',
  'verify-custom-domain',
  'collect-compliance-evidence',
  'run-scheduled-compliance',
  'run-plugin'
)

foreach ($fn in $functions) {
  $path = Join-Path 'supabase\functions' $fn
  if (-not (Test-Path $path)) {
    Write-Warning "Skipping $fn (folder not found)"
    continue
  }
  Step "Deploying function: $fn"
  supabase functions deploy $fn
}

# 3. Print remaining manual TODOs
Step 'Done. Remaining manual steps (HANDOFF.md):'
Write-Host @'
  - HANDOFF.md item 2: paste the lovable->gateway rename SQL into Supabase SQL editor
                       (only matters if you have existing rows with provider='lovable')
  - HANDOFF.md item 13: in Auth -> URL Configuration, add /portal/* to Redirect URLs
  - HANDOFF.md item 17: configure wildcard DNS *.<your-base-host> + wildcard SSL,
                       then set VITE_PORTAL_BASE_HOST in your hosting provider env
  - HANDOFF.md item 28: register a pg_cron job that hits run-scheduled-compliance
                       every 15 minutes (SQL example is in HANDOFF.md)
  - All `Smoke-test` items: actually click through the new UI and verify
'@ -ForegroundColor Yellow
