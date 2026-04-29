#!/usr/bin/env bash
# Aegis one-shot deploy script (bash, macOS / Git Bash / WSL friendly).
#
# Runs every database migration + deploys every edge function in dependency
# order. Idempotent — safe to re-run.
#
# Prerequisites (one-time):
#   1. brew install supabase/tap/supabase   (or npm i -g supabase)
#   2. supabase login
#   3. supabase link --project-ref rcvtxvpyqmfuunnpsqny
#   4. Set AI_GATEWAY_API_KEY + AI_GATEWAY_URL in the Supabase Dashboard.
#      Optional for #3c custom domains: CUSTOM_DOMAIN_CNAME_TARGET / CUSTOM_DOMAIN_A_TARGETS.
#
# Usage:  ./scripts/deploy-aegis.sh

set -euo pipefail
cd "$(dirname "$0")/.."

step() {
  printf "\n\033[36m=== %s ===\033[0m\n" "$1"
}

# 1. Migrations
step "Pushing database migrations"
supabase db push

# 2. Functions
FUNCTIONS=(
  graph-api
  create-psa-ticket
  send-ai-notification
  ai-chat ai-analyze ai-policy-generator ai-anomaly-detection
  ai-nl-query ai-remediation ai-license-optimizer ai-drift-explainer
  ai-executive-report ai-security-predictor ai-migration-planner
  ai-copilot-advisor ai-tenant-analyzer ai-compliance-advisor
  ai-cost-predictor ai-security-benchmark ai-change-impact
  ai-incident-responder ai-user-risk-profiler ai-config-optimizer
  ai-chat-assistant ai-cross-tenant-insights email-security
  compute-drift-adhoc
  invite-portal-user
  verify-custom-domain
  collect-compliance-evidence
  run-scheduled-compliance
  run-plugin
)

for fn in "${FUNCTIONS[@]}"; do
  if [[ ! -d "supabase/functions/$fn" ]]; then
    echo "Skipping $fn (folder not found)" >&2
    continue
  fi
  step "Deploying function: $fn"
  supabase functions deploy "$fn"
done

step "Done. Remaining manual steps (HANDOFF.md):"
cat <<'EOF'
  - HANDOFF.md item 2: paste the lovable->gateway rename SQL into Supabase SQL editor
                       (only matters if you have existing rows with provider='lovable')
  - HANDOFF.md item 13: in Auth -> URL Configuration, add /portal/* to Redirect URLs
  - HANDOFF.md item 17: configure wildcard DNS *.<your-base-host> + wildcard SSL,
                       then set VITE_PORTAL_BASE_HOST in your hosting provider env
  - HANDOFF.md item 28: register a pg_cron job that hits run-scheduled-compliance
                       every 15 minutes (SQL example is in HANDOFF.md)
  - All "Smoke-test" items: actually click through the new UI and verify
EOF
