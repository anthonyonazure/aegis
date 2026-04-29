import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shield, Save, Loader2, RotateCcw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Customer } from '@/types/tenant';
import { getCustomer, updateCustomer } from '@/lib/customerDatabase';

interface BrandingSettingsProps {
  customer: Customer;
}

const HSL_REGEX = /^\s*\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%\s*$/;

interface BrandingForm {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportUrl: string;
}

const EMPTY_FORM: BrandingForm = {
  brandName: '',
  logoUrl: '',
  primaryColor: '',
  accentColor: '',
  supportEmail: '',
  supportUrl: '',
};

function customerToForm(c: Customer): BrandingForm {
  return {
    brandName: c.brandName ?? '',
    logoUrl: c.logoUrl ?? '',
    primaryColor: c.primaryColor ?? '',
    accentColor: c.accentColor ?? '',
    supportEmail: c.supportEmail ?? '',
    supportUrl: c.supportUrl ?? '',
  };
}

export function BrandingSettings({ customer }: BrandingSettingsProps) {
  const { toast } = useToast();
  const [latest, setLatest] = useState<Customer>(customer);
  const [form, setForm] = useState<BrandingForm>(() => customerToForm(customer));
  const [saving, setSaving] = useState(false);

  // Refetch the customer when the detail view first mounts so we render
  // the persisted branding (the parent may have a stale Customer object
  // that pre-dates this migration).
  useEffect(() => {
    let cancelled = false;
    getCustomer(customer.id).then((c) => {
      if (cancelled || !c) return;
      setLatest(c);
      setForm(customerToForm(c));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  const primaryError = useMemo(
    () => (form.primaryColor && !HSL_REGEX.test(form.primaryColor) ? 'Use HSL format like "210 100% 55%"' : null),
    [form.primaryColor]
  );
  const accentError = useMemo(
    () => (form.accentColor && !HSL_REGEX.test(form.accentColor) ? 'Use HSL format like "190 95% 45%"' : null),
    [form.accentColor]
  );

  const dirty = useMemo(() => {
    const baseline = customerToForm(latest);
    return (
      baseline.brandName !== form.brandName ||
      baseline.logoUrl !== form.logoUrl ||
      baseline.primaryColor !== form.primaryColor ||
      baseline.accentColor !== form.accentColor ||
      baseline.supportEmail !== form.supportEmail ||
      baseline.supportUrl !== form.supportUrl
    );
  }, [form, latest]);

  const update = <K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleReset = () => {
    setForm(customerToForm(latest));
  };

  const handleClear = () => {
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (primaryError || accentError) {
      toast({
        title: 'Invalid color',
        description: primaryError ?? accentError ?? 'Check the color format.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCustomer(customer.id, {
        brandName: form.brandName.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        primaryColor: form.primaryColor.trim() || undefined,
        accentColor: form.accentColor.trim() || undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        supportUrl: form.supportUrl.trim() || undefined,
      });
      setLatest(updated);
      setForm(customerToForm(updated));
      toast({
        title: 'Branding saved',
        description: `Updated branding for ${updated.name}.`,
      });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save branding.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Inline preview pulled from form values (not yet saved)
  const previewPrimary = HSL_REGEX.test(form.primaryColor) ? form.primaryColor : '210 100% 55%';
  const previewAccent = HSL_REGEX.test(form.accentColor) ? form.accentColor : '190 95% 45%';

  return (
    <div className="space-y-6">
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Live preview
          </CardTitle>
          <CardDescription>What this customer's instance will look like.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl border border-border/50 p-4 flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, hsl(${previewPrimary} / 0.15) 0%, hsl(${previewAccent} / 0.10) 100%)`,
            }}
          >
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="w-10 h-10 rounded-xl object-contain bg-background/40"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${previewPrimary}) 0%, hsl(${previewAccent}) 100%)`,
                }}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="font-semibold">{form.brandName || 'Aegis'}</p>
              <p className="text-xs text-muted-foreground">M365 Governance Platform</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Brand identity</CardTitle>
          <CardDescription>Used in the sidebar logo, page titles, and outbound emails for this customer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand name</Label>
              <Input
                id="brand-name"
                placeholder="e.g. Northwind MSP"
                value={form.brandName}
                onChange={(e) => update('brandName', e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                placeholder="https://cdn.example.com/logo.svg"
                value={form.logoUrl}
                onChange={(e) => update('logoUrl', e.target.value)}
                inputMode="url"
              />
              <p className="text-[11px] text-muted-foreground">
                Square image (SVG/PNG). Hosted at an https URL the customer's browsers can reach.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Theme colors</CardTitle>
          <CardDescription>
            HSL components only — e.g. <code className="text-foreground">210 100% 55%</code>. Tailwind tokens use them
            directly. Leave blank to inherit the platform default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary color (HSL)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="primary-color"
                  placeholder="210 100% 55%"
                  value={form.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                />
                <span
                  className="w-10 h-10 rounded-md border border-border/60 flex-shrink-0"
                  style={{ background: `hsl(${HSL_REGEX.test(form.primaryColor) ? form.primaryColor : '210 100% 55%'})` }}
                />
              </div>
              {primaryError && <p className="text-xs text-destructive">{primaryError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent color (HSL)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="accent-color"
                  placeholder="190 95% 45%"
                  value={form.accentColor}
                  onChange={(e) => update('accentColor', e.target.value)}
                />
                <span
                  className="w-10 h-10 rounded-md border border-border/60 flex-shrink-0"
                  style={{ background: `hsl(${HSL_REGEX.test(form.accentColor) ? form.accentColor : '190 95% 45%'})` }}
                />
              </div>
              {accentError && <p className="text-xs text-destructive">{accentError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Support contacts</CardTitle>
          <CardDescription>Stamped into branded emails and customer-facing pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                type="email"
                placeholder="support@example.com"
                value={form.supportEmail}
                onChange={(e) => update('supportEmail', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-url">Support URL</Label>
              <Input
                id="support-url"
                placeholder="https://help.example.com"
                value={form.supportUrl}
                onChange={(e) => update('supportUrl', e.target.value)}
                inputMode="url"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!dirty || saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="ghost" onClick={handleClear} disabled={saving}>
            Clear all
          </Button>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving || !!primaryError || !!accentError}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save branding
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
