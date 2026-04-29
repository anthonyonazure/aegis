import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldAlert, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Customer } from '@/types/tenant';
import { getCustomer, updateCustomer } from '@/lib/customerDatabase';
import { verifyCustomDomain } from '@/lib/customerUsersDatabase';

interface CustomDomainSectionProps {
  customer: Customer;
}

const HOSTNAME_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?))+$/;

/**
 * Phase 2 #3c — manage a customer's custom portal domain.
 *
 * Saving a custom_domain clears any prior verification (the backend does this
 * automatically), then the MSP runs Verify to DNS-check the CNAME and flip
 * custom_domain_verified_at. The portal only routes for verified domains.
 */
export function CustomDomainSection({ customer }: CustomDomainSectionProps) {
  const { toast } = useToast();
  const [latest, setLatest] = useState<Customer>(customer);
  const [domain, setDomain] = useState(customer.customDomain ?? '');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{
    expected?: { cname?: string[]; a?: string[] };
    actual?: { cname?: string[] };
  } | null>(null);

  // Refetch in case the parent's customer object is stale
  useEffect(() => {
    let cancelled = false;
    getCustomer(customer.id).then((c) => {
      if (cancelled || !c) return;
      setLatest(c);
      setDomain(c.customDomain ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  const trimmedDomain = domain.trim().toLowerCase();
  const isValidFormat = !trimmedDomain || HOSTNAME_REGEX.test(trimmedDomain);
  const isDirty = trimmedDomain !== (latest.customDomain ?? '');
  const isVerified = !isDirty && Boolean(latest.customDomainVerifiedAt);

  const handleSave = async () => {
    if (!isValidFormat) {
      toast({
        title: 'Invalid hostname',
        description: 'Use a fully-qualified hostname like portal.acme.com — no scheme or path.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCustomer(customer.id, {
        customDomain: trimmedDomain || undefined,
      });
      setLatest(updated);
      setDiagnostic(null);
      toast({
        title: trimmedDomain ? 'Custom domain saved' : 'Custom domain cleared',
        description: trimmedDomain
          ? 'Verification cleared. Add a CNAME record then click Verify.'
          : undefined,
      });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save domain.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!latest.customDomain) return;
    setVerifying(true);
    setDiagnostic(null);
    try {
      const result = await verifyCustomDomain(customer.id);
      if (result.verified) {
        toast({
          title: 'Domain verified',
          description: `Resolved via ${result.via?.toUpperCase()} → ${result.matched}.`,
        });
        const refreshed = await getCustomer(customer.id);
        if (refreshed) setLatest(refreshed);
      } else {
        toast({
          title: 'Not verified yet',
          description: result.error ?? 'DNS does not match the expected target.',
          variant: 'destructive',
        });
        setDiagnostic({ expected: result.expected, actual: result.actual });
      }
    } catch (e) {
      toast({
        title: 'Verify failed',
        description: e instanceof Error ? e.message : 'Verification request failed.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Custom portal domain
        </CardTitle>
        <CardDescription>
          Optional — host this customer's portal at their own subdomain (e.g. <code>portal.acme.com</code>) instead of
          the default <code>{customer.customSubdomain ? `${customer.customSubdomain}.your-aegis-host` : 'platform subdomain'}</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="custom-domain">Hostname</Label>
          <div className="flex gap-2">
            <Input
              id="custom-domain"
              placeholder="portal.acme.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              inputMode="url"
              autoCapitalize="none"
            />
            <Button onClick={handleSave} disabled={saving || !isDirty || !isValidFormat}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
          {!isValidFormat && (
            <p className="text-xs text-destructive">
              Use a hostname like <code>portal.acme.com</code> (no scheme, no path).
            </p>
          )}
        </div>

        {latest.customDomain && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/50 bg-muted/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{latest.customDomain}</p>
              <p className="text-xs text-muted-foreground">
                {isVerified
                  ? `Verified ${latest.customDomainVerifiedAt?.toLocaleString() ?? ''}`
                  : 'Not verified — DNS check pending.'}
              </p>
            </div>
            {isVerified ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                <ShieldAlert className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleVerify}
              disabled={verifying || isDirty || !latest.customDomain}
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </Button>
          </div>
        )}

        {diagnostic && (
          <div className="text-xs space-y-1 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/10">
            <p className="font-medium">Verification diagnostic</p>
            {diagnostic.expected?.cname && diagnostic.expected.cname.length > 0 && (
              <p>
                Expected CNAME → one of:{' '}
                {diagnostic.expected.cname.map((c) => (
                  <code key={c} className="mx-0.5">
                    {c}
                  </code>
                ))}
              </p>
            )}
            {diagnostic.expected?.a && diagnostic.expected.a.length > 0 && (
              <p>
                Or A record → one of:{' '}
                {diagnostic.expected.a.map((c) => (
                  <code key={c} className="mx-0.5">
                    {c}
                  </code>
                ))}
              </p>
            )}
            {diagnostic.actual?.cname && diagnostic.actual.cname.length > 0 && (
              <p>
                Found CNAME:{' '}
                {diagnostic.actual.cname.map((c) => (
                  <code key={c} className="mx-0.5">
                    {c}
                  </code>
                ))}
              </p>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/40">
          <p className="font-medium text-foreground">Setup</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              In your customer's DNS, add a CNAME from <code>{trimmedDomain || 'portal.example.com'}</code> to the
              hostname your operator team gave you for Aegis.
            </li>
            <li>Wait a few minutes for DNS to propagate.</li>
            <li>Click <strong>Verify</strong>. The portal becomes available at the custom domain immediately on success.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
