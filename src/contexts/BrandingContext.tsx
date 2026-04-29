import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { getCustomer } from '@/lib/customerDatabase';
import { Customer } from '@/types/tenant';

/**
 * Per-customer white-label branding (Phase 2 #1).
 *
 * Reads the active customer from TenantContext and overlays its branding
 * onto the document by setting CSS variables on :root. Falls back to the
 * platform defaults (Aegis) when no customer is selected, or when the
 * selected customer has no custom branding.
 */

export interface BrandingState {
  /** Brand display name shown in nav, page titles, emails. */
  brandName: string;
  /** URL of an MSP-supplied logo. Null = render the default Aegis shield. */
  logoUrl: string | null;
  /** HSL string (e.g. "210 100% 55%") for the primary CSS var, or null = default. */
  primaryColor: string | null;
  /** HSL string for the accent CSS var, or null = default. */
  accentColor: string | null;
  /** Support contact for branded emails. */
  supportEmail: string | null;
  supportUrl: string | null;
  /** True when at least one branding field is overriding the default. */
  isCustomBranded: boolean;
}

const DEFAULT_BRAND_NAME = 'Aegis';
const DEFAULT_PRIMARY_HSL = '210 100% 55%';
const DEFAULT_ACCENT_HSL = '190 95% 45%';

const DEFAULT_BRANDING: BrandingState = {
  brandName: DEFAULT_BRAND_NAME,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  supportEmail: null,
  supportUrl: null,
  isCustomBranded: false,
};

const BrandingContext = createContext<BrandingState>(DEFAULT_BRANDING);

/**
 * Validates that a string is a valid CSS HSL triplet like "210 100% 55%".
 * Rejects anything with semicolons, parentheses, or url(...) — so it's safe
 * to inline into a CSS variable without escaping.
 */
function isSafeHsl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^\s*\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%\s*$/.test(value);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { selectedCustomerId } = useTenant();
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Refetch the full customer record (with branding fields) when the active
  // customer changes. The TenantContext's lightweight CustomerInfo doesn't
  // include branding columns.
  useEffect(() => {
    let cancelled = false;
    if (!selectedCustomerId) {
      setCustomer(null);
      return;
    }
    getCustomer(selectedCustomerId)
      .then((c) => {
        if (!cancelled) setCustomer(c);
      })
      .catch(() => {
        if (!cancelled) setCustomer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  const branding: BrandingState = useMemo(() => {
    if (!customer) return DEFAULT_BRANDING;

    const primary = isSafeHsl(customer.primaryColor) ? customer.primaryColor! : null;
    const accent = isSafeHsl(customer.accentColor) ? customer.accentColor! : null;
    const brandName = customer.brandName?.trim() || DEFAULT_BRAND_NAME;

    return {
      brandName,
      logoUrl: customer.logoUrl?.trim() || null,
      primaryColor: primary,
      accentColor: accent,
      supportEmail: customer.supportEmail?.trim() || null,
      supportUrl: customer.supportUrl?.trim() || null,
      isCustomBranded: Boolean(
        primary ||
          accent ||
          customer.logoUrl?.trim() ||
          (customer.brandName?.trim() && customer.brandName.trim() !== DEFAULT_BRAND_NAME)
      ),
    };
  }, [customer]);

  // Apply CSS vars at :root. Cleanup on unmount/customer change so we never
  // leak a previous customer's brand into the default theme.
  useEffect(() => {
    const root = document.documentElement;

    if (branding.primaryColor) {
      root.style.setProperty('--primary', branding.primaryColor);
      root.style.setProperty('--ring', branding.primaryColor);
      root.style.setProperty('--sidebar-primary', branding.primaryColor);
      root.style.setProperty('--sidebar-ring', branding.primaryColor);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-ring');
    }

    if (branding.accentColor) {
      root.style.setProperty('--accent', branding.accentColor);
    } else {
      root.style.removeProperty('--accent');
    }

    if (branding.brandName) {
      // Page-title hook in usePageTitle uses 'Aegis' as default; emit a
      // data attribute so document.title can pick this up if needed.
      root.dataset.brand = branding.brandName;
    }

    return () => {
      // No-op: next effect run will re-set or remove the vars.
    };
  }, [branding.primaryColor, branding.accentColor, branding.brandName]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}
