import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PortalHostMatch } from '@/lib/portalHostRouting';
import { getPortalBranding, type PortalBrandingLookup } from '@/lib/customerUsersDatabase';

/**
 * Phase 2 #3c — host-aware slug context for the portal.
 *
 * In subdomain mode (`acme.aegis.io`) the slug is the host prefix.
 * In custom-domain mode (`portal.acme.com`) the slug isn't directly
 * encoded — we resolve it via get_portal_branding({host}) and surface
 * the customer it maps to. Until that resolves, downstream components
 * see `slug=null` and should render their loading state.
 */
interface PortalHostContextValue {
  match: PortalHostMatch | null;
  slug: string | null;
  // For custom-domain mode, the resolved customer record (after RPC). null
  // while loading or unresolvable. In subdomain mode this stays null and
  // each consumer fetches its own copy as needed.
  resolvedFromHost: PortalBrandingLookup | null;
  loading: boolean;
}

const PortalHostContext = createContext<PortalHostContextValue>({
  match: null,
  slug: null,
  resolvedFromHost: null,
  loading: false,
});

interface ProviderProps {
  match: PortalHostMatch;
  children: React.ReactNode;
}

export function PortalHostProvider({ match, children }: ProviderProps) {
  const [resolvedFromHost, setResolvedFromHost] = useState<PortalBrandingLookup | null>(null);
  const [loading, setLoading] = useState(match.kind === 'custom-domain');

  useEffect(() => {
    let cancelled = false;
    if (match.kind !== 'custom-domain') return;
    setLoading(true);
    getPortalBranding({ host: match.host })
      .then((res) => {
        if (cancelled) return;
        setResolvedFromHost(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [match]);

  const slug =
    match.kind === 'subdomain'
      ? match.slug
      : resolvedFromHost?.customSubdomain ?? null;

  return (
    <PortalHostContext.Provider value={{ match, slug, resolvedFromHost, loading }}>
      {children}
    </PortalHostContext.Provider>
  );
}

/**
 * Read the active portal slug, regardless of whether it came from the URL
 * (`/portal/:slug`) or the host (`acme.aegis.io`, `portal.acme.com`).
 *
 * URL params take precedence so `/portal/:slug` always works for ops
 * shortcuts even from a portal host.
 */
export function usePortalSlug(): {
  slug: string | null;
  loading: boolean;
  source: 'url' | 'subdomain' | 'custom-domain' | null;
  /** Custom-domain resolution result; only present in custom-domain mode. */
  resolvedFromHost: PortalBrandingLookup | null;
} {
  const params = useParams<{ slug?: string }>();
  const ctx = useContext(PortalHostContext);

  if (params.slug) {
    return { slug: params.slug, loading: false, source: 'url', resolvedFromHost: null };
  }
  if (ctx.match) {
    return {
      slug: ctx.slug,
      loading: ctx.loading,
      source: ctx.match.kind,
      resolvedFromHost: ctx.resolvedFromHost,
    };
  }
  return { slug: null, loading: false, source: null, resolvedFromHost: null };
}
