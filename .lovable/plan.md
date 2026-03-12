

## Plan: Fix EXO API to use InvokeCommand method

### Problem
The edge function calls `GET https://outlook.office365.com/adminapi/beta/{tenantId}/AntiPhishPolicy` etc., but these resource segments don't exist. The Exchange Admin API requires the **InvokeCommand** POST method to proxy PowerShell cmdlets.

### Root Cause
The EXO Admin REST API exposes only a handful of native REST endpoints (OrganizationConfig, Domains, Mailbox, etc.). EOP/Defender policy cmdlets like `Get-AntiPhishPolicy`, `Get-HostedContentFilterPolicy`, etc. must be called via the InvokeCommand proxy:

```text
POST /adminapi/beta/{tenantId}/InvokeCommand
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
  X-AnchorMailbox: UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@{tenantId}

Body:
{
  "CmdletInput": {
    "CmdletName": "Get-AntiPhishPolicy"
  }
}
```

### Changes

**File: `supabase/functions/email-security/index.ts`**

1. Replace the `exoGet` helper with an `exoInvokeCommand` helper that:
   - Uses POST to `https://outlook.office365.com/adminapi/beta/{tenantId}/InvokeCommand`
   - Sends `Content-Type: application/json` and `X-AnchorMailbox: UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@{tenantId}` headers
   - Sends body: `{ "CmdletInput": { "CmdletName": "Get-AntiPhishPolicy" } }`
   - Parses response `.value` array

2. Update the `exoPolicyActions` mapping to use PowerShell cmdlet names:
   - `fetch-anti-phishing` → `Get-AntiPhishPolicy`
   - `fetch-anti-spam` → `Get-HostedContentFilterPolicy`
   - `fetch-anti-malware` → `Get-MalwareFilterPolicy`
   - `fetch-safe-links` → `Get-SafeLinksPolicy`
   - `fetch-safe-attachments` → `Get-SafeAttachmentPolicy`

3. Update all call sites from `exoGet(token, tenantId, cmdlet)` to `exoInvokeCommand(token, tenantId, cmdlet)`.

4. Keep the existing mappers and fallback logic unchanged.

### Technical Detail
The `X-AnchorMailbox` header is required for application-permission (client credentials) requests. The system mailbox GUID `bb558c35-97f1-4cb9-8ff7-d53741dc928c` is a well-known constant used across all Exchange Online tenants.

