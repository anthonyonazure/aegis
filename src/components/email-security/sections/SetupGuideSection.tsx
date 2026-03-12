import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle2, Copy, Check, ShieldCheck, Key, UserCog, Loader2, AlertTriangle } from 'lucide-react';
import { useEmailSecurityData } from '@/hooks/useEmailSecurityData';
import { useToast } from '@/hooks/use-toast';

const manifestJson = `{
  "resourceAppId": "00000002-0000-0ff1-ce00-000000000000",
  "resourceAccess": [
    {
      "id": "dc50a0fb-09a3-484d-be87-e023b12c6440",
      "type": "Role"
    }
  ]
}`;

const powershellScript = `# Install Microsoft Graph PowerShell SDK if needed
# Install-Module Microsoft.Graph -Scope CurrentUser

Connect-MgGraph -Scopes "RoleManagement.ReadWrite.Directory"

# Get the Exchange Administrator role
$role = Get-MgRoleManagementDirectoryRoleDefinition \\
  -Filter "displayName eq 'Exchange Administrator'"

# Get your service principal (use your App Registration's Client ID)
$sp = Get-MgServicePrincipal \\
  -Filter "appId eq 'YOUR-CLIENT-ID-HERE'"

# Assign the role
New-MgRoleManagementDirectoryRoleAssignment \\
  -PrincipalId $sp.Id \\
  -RoleDefinitionId $role.Id \\
  -DirectoryScopeId "/"

Write-Host "Exchange Administrator role assigned successfully!"`;

function CopyBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-3">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <pre className="bg-muted/50 border border-border/50 rounded-lg p-4 text-xs overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const SetupGuideSection = () => {
  const { fetchData, isLoading, data, error } = useEmailSecurityData<any>({ action: 'get-overview' });
  const [verified, setVerified] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    setVerified(false);
    await fetchData();
    if (!error) {
      setVerified(true);
      toast({ title: 'Connection verified', description: 'Exchange Online policies loaded successfully.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Exchange Online Setup Guide</h2>
        <p className="text-muted-foreground mt-1">
          Configure your service principal to access Exchange Online Protection policies via the Admin API.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Prerequisites</p>
            <p className="text-muted-foreground mt-1">
              You need <strong>Global Administrator</strong> or <strong>Privileged Role Administrator</strong> access in your Azure / Entra ID tenant to complete these steps.
            </p>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={['step-1', 'step-2', 'step-3']} className="space-y-3">
        {/* Step 1 */}
        <AccordionItem value="step-1" className="border border-border/50 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Key className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Step 1: Add Exchange.ManageAsApp Permission</p>
                <p className="text-xs text-muted-foreground font-normal">Grant API access to Exchange Online</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Option A: Via Azure Portal</p>
              <ol className="list-decimal list-inside space-y-2 pl-2">
                <li>Go to <strong>Azure AD → App Registrations</strong> → select your app</li>
                <li>Click <strong>API Permissions → Add a permission</strong></li>
                <li>Select <strong>"APIs my organization uses"</strong></li>
                <li>Search for <Badge variant="secondary" className="text-xs">Office 365 Exchange Online</Badge></li>
                <li>Choose <strong>Application permissions</strong></li>
                <li>Find and select <Badge variant="secondary" className="text-xs">Exchange.ManageAsApp</Badge></li>
                <li>Click <strong>Add permissions</strong></li>
              </ol>

              <p className="font-medium text-foreground pt-2">Option B: Via App Manifest (if not found in UI)</p>
              <p>
                If you can't find "Office 365 Exchange Online" in the API list, add the permission directly via the app manifest.
                Go to <strong>App Registrations → Manifest</strong> and add this entry to the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">requiredResourceAccess</code> array:
              </p>
              <CopyBlock code={manifestJson} language="json" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 2 */}
        <AccordionItem value="step-2" className="border border-border/50 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Step 2: Grant Admin Consent</p>
                <p className="text-xs text-muted-foreground font-normal">Authorize the permission for your tenant</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal list-inside space-y-2 pl-2">
                <li>Navigate to your app's <strong>API Permissions</strong> page</li>
                <li>Click <strong>"Grant admin consent for [Your Organization]"</strong></li>
                <li>Confirm the consent dialog</li>
                <li>Verify the status column shows <Badge variant="secondary" className="text-xs">✓ Granted</Badge> next to Exchange.ManageAsApp</li>
              </ol>
              <p className="text-xs italic pt-1">
                Note: You must be a Global Administrator to grant tenant-wide admin consent.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3 */}
        <AccordionItem value="step-3" className="border border-border/50 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserCog className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Step 3: Assign Exchange Administrator Role</p>
                <p className="text-xs text-muted-foreground font-normal">Required for Admin API authorization</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-3 text-xs">
                  <strong>Important:</strong> Admin consent alone is not enough. The service principal must also hold the <strong>Exchange Administrator</strong> Azure AD role.
                </CardContent>
              </Card>

              <p className="font-medium text-foreground">Option A: Via Entra ID Portal</p>
              <ol className="list-decimal list-inside space-y-2 pl-2">
                <li>Go to <strong>Entra ID → Roles and administrators</strong></li>
                <li>Search for and click <strong>Exchange Administrator</strong></li>
                <li>Click <strong>+ Add assignments</strong></li>
                <li>
                  In the member picker, switch the filter from "Users" to{' '}
                  <Badge variant="secondary" className="text-xs">Enterprise applications</Badge>{' '}
                  or <Badge variant="secondary" className="text-xs">Service principals</Badge>
                </li>
                <li>Search for your app registration name and select it</li>
                <li>Click <strong>Add</strong></li>
              </ol>

              <p className="font-medium text-foreground pt-2">Option B: Via PowerShell (if the portal filter is missing)</p>
              <p>Some tenants don't show the service principal filter in the portal. Use PowerShell instead:</p>
              <CopyBlock code={powershellScript} language="powershell" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Verify */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className={`h-5 w-5 ${verified && !error ? 'text-green-500' : 'text-muted-foreground'}`} />
            Verify Connection
          </CardTitle>
          <CardDescription>Test that your service principal can access Exchange Online policies.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleVerify} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Verifying...' : 'Test EXO Connection'}
          </Button>
          {verified && !error && (
            <p className="text-sm text-green-600 mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Connection successful — Exchange Online policies loaded.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive mt-3">
              Connection failed: {error}. Please review the steps above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
