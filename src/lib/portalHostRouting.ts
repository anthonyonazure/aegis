/**
 * Phase 2 #3c — host-based portal routing.
 *
 * Detects whether the current browser host should render the customer
 * portal directly (without a `/portal/<slug>` URL prefix). Two paths:
 *
 *   1. Subdomain mode: when VITE_PORTAL_BASE_HOST is set (e.g. "aegis.io"),
 *      requests at `<slug>.aegis.io` (or `<slug>.<base>` for any configured
 *      base) render as the portal for that slug. The base host itself
 *      (and `www.<base>`) renders the MSP app.
 *
 *   2. Custom domain mode: when the host doesn't match the base or any
 *      dev-mode host, treat it as a candidate custom domain and let the
 *      portal app resolve it server-side via get_portal_branding({host}).
 *
 * Returns null when host should render the regular MSP app (default in
 * dev, when there's no env config, or when host matches the base).
 */

export type PortalHostMatch =
  | { kind: 'subdomain'; slug: string; host: string }
  | { kind: 'custom-domain'; host: string };

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function isDevHost(host: string): boolean {
  if (DEV_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  return false;
}

/** Returns the host the app considers its "base" (MSP app), or null. */
export function getPortalBaseHost(): string | null {
  const raw = (import.meta.env.VITE_PORTAL_BASE_HOST as string | undefined)?.trim();
  if (!raw) return null;
  return raw.toLowerCase().replace(/\.+$/, '');
}

/**
 * Resolve the current `window.location.hostname` (or supplied override)
 * against the portal-routing rules. Synchronous; no network access.
 */
export function detectPortalHost(hostname?: string): PortalHostMatch | null {
  const host = (hostname ?? window.location.hostname).toLowerCase().replace(/\.+$/, '');
  if (!host || isDevHost(host)) return null;

  const base = getPortalBaseHost();

  // Subdomain mode (only when a base is configured)
  if (base) {
    // Exact base or www.base → MSP app
    if (host === base || host === `www.${base}`) return null;

    // Match exactly one extra label: <slug>.<base>
    if (host.endsWith(`.${base}`)) {
      const prefix = host.slice(0, -1 - base.length); // strip ".<base>"
      // Only single-label slugs — multi-level subdomains aren't portal hosts.
      if (prefix && !prefix.includes('.')) {
        return { kind: 'subdomain', slug: prefix, host };
      }
      // <something>.<more>.<base> → not a portal host, fall through
      return null;
    }
  }

  // Custom domain mode: anything that isn't a known dev host or the base.
  // Only meaningful when a base is configured (otherwise we'd treat the
  // raw deploy host as a custom domain too).
  if (base) {
    return { kind: 'custom-domain', host };
  }

  return null;
}
