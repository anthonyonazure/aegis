import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPortalBranding, getCurrentPortalUser } from '@/lib/customerUsersDatabase';
import { usePortalSlug } from '@/contexts/PortalHostContext';

interface PortalCustomerSummary {
  id: string;
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
}

const HSL = /^\s*\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%\s*$/;

/**
 * Portal-specific login. Differences from the MSP login:
 *  - Branded with the customer's logo/colors based on URL slug
 *  - On success, verifies the auth user has a customer_users row matching
 *    the current slug. Mismatches are signed out + rejected.
 */
export default function PortalLogin() {
  const { slug, source, resolvedFromHost, loading: slugLoading } = usePortalSlug();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<PortalCustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Subdomain/URL: navigate to /portal/<slug>; custom-domain: navigate to /
  // (the host already identifies the customer).
  const portalRoot = source === 'custom-domain' ? '/' : `/portal/${slug ?? ''}`;

  // Resolve customer + apply branding pre-login
  useEffect(() => {
    let cancelled = false;
    if (slugLoading) return;
    // Custom-domain mode: branding already came back via PortalHostContext.
    if (source === 'custom-domain') {
      setCustomer(resolvedFromHost);
      if (resolvedFromHost) {
        if (resolvedFromHost.primaryColor && HSL.test(resolvedFromHost.primaryColor)) {
          document.documentElement.style.setProperty('--primary', resolvedFromHost.primaryColor);
          document.documentElement.style.setProperty('--ring', resolvedFromHost.primaryColor);
        }
        if (resolvedFromHost.accentColor && HSL.test(resolvedFromHost.accentColor)) {
          document.documentElement.style.setProperty('--accent', resolvedFromHost.accentColor);
        }
      }
      setLoading(false);
      return;
    }
    if (!slug) {
      setLoading(false);
      return;
    }
    getPortalBranding({ slug })
      .then((c) => {
        if (cancelled) return;
        setCustomer(c);
        if (c) {
          if (c.primaryColor && HSL.test(c.primaryColor)) {
            document.documentElement.style.setProperty('--primary', c.primaryColor);
            document.documentElement.style.setProperty('--ring', c.primaryColor);
          }
          if (c.accentColor && HSL.test(c.accentColor)) {
            document.documentElement.style.setProperty('--accent', c.accentColor);
          }
        }
      })
      .catch((e) => {
        console.error('Portal customer lookup failed:', e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, source, resolvedFromHost, slugLoading]);

  // If already signed in as a portal user for this customer, redirect into the portal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const portalUser = await getCurrentPortalUser();
      if (cancelled || !portalUser || !customer) return;
      if (portalUser.customerId === customer.id) {
        navigate(portalRoot, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, navigate, portalRoot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError(signInErr.message);
        return;
      }

      // Verify portal-user membership matches the resolved customer
      const portalUser = await getCurrentPortalUser();
      if (!portalUser || portalUser.customerId !== customer.id) {
        await supabase.auth.signOut();
        setError("That account doesn't have access to this portal.");
        return;
      }

      // Update last_login_at fire-and-forget
      void supabase
        .from('customer_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', portalUser.id);

      toast({ title: 'Signed in', description: `Welcome to ${customer.brandName || customer.name}.` });
      navigate(portalRoot, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Portal not found</CardTitle>
            <CardDescription>
              No customer portal exists at <code className="font-mono">/portal/{slug}</code>. Check the URL with the
              MSP that invited you.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const brandName = customer.brandName || customer.name;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            {customer.logoUrl ? (
              <img
                src={customer.logoUrl}
                alt={`${brandName} logo`}
                className="w-12 h-12 rounded-xl object-contain bg-card"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
            )}
          </div>
          <CardTitle>{brandName}</CardTitle>
          <CardDescription>Sign in to your security posture portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign in
            </Button>
          </form>
          {customer.supportEmail && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Trouble signing in? Contact{' '}
              <a className="underline" href={`mailto:${customer.supportEmail}`}>
                {customer.supportEmail}
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
