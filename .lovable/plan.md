

# Plan: Feed Real Audit Data to Anomaly Detection

## Problem
The Anomaly Detector sends `data: {}` to the AI, which then fabricates sample anomalies with fake contoso.com accounts. No real tenant data is fetched.

## Solution
Apply the same "live-with-fallback" pattern from the Copilot Advisor: the edge function fetches real sign-in logs, audit logs, and directory role assignments from Microsoft Graph using stored tenant credentials, then sends that real data to the AI for analysis.

## Changes

### 1. Edge Function -- Fetch real Graph data before AI analysis
**File:** `supabase/functions/ai-anomaly-detection/index.ts`

- Accept `tenantConnectionId` (not just `tenantId`)
- Authenticate the caller via Supabase JWT
- Look up stored credentials via `rpc('get_decrypted_credential')`
- Acquire a Graph access token (client credentials flow)
- Fetch real data from Graph endpoints:
  - **Sign-in logs:** `GET /auditLogs/signIns?$top=50&$orderby=createdDateTime desc` (requires `AuditLog.Read.All`)
  - **Directory audit logs:** `GET /auditLogs/directoryAudits?$top=50&$orderby=activityDateTime desc` (config changes, permission grants)
  - **Risky sign-ins (if available):** `GET /identityProtection/riskyUsers?$top=20`
- Map Graph responses into the existing `AnomalyData` shape (signInLogs, configChanges, permissionGrants)
- Remove the "generate sample anomalies" instruction from the AI prompt -- instead say "If no anomalies are found, return an empty anomalies array"
- If Graph calls fail (missing permissions, expired token), fall back to returning an error message telling the user which permissions are needed

### 2. Frontend -- Pass tenant connection ID
**File:** `src/components/ai/AnomalyDetector.tsx`

- Change the function invoke to send `tenantConnectionId` (the selected tenant's connection ID) instead of just `tenantId`
- Show a warning if no tenant is connected or selected
- Display a note about required permissions (`AuditLog.Read.All`) if the scan returns a permissions error

### 3. Remove sample data fallback
The AI prompt will no longer instruct the model to "generate sample anomalies for demonstration." If there's no data, the response will correctly show zero anomalies.

