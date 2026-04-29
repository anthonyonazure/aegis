import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { PortalDashboard } from '@/components/portal/PortalDashboard';
import { PortalDriftView } from '@/components/portal/PortalDriftView';
import { PortalAnomaliesView } from '@/components/portal/PortalAnomaliesView';
import { getPortalBranding, getCurrentPortalUser } from '@/lib/customerUsersDatabase';
import { usePortalSlug } from '@/contexts/PortalHostContext';

interface PortalCustomer {
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

function applyBranding(customer: PortalCustomer | null) {
  const root = document.documentElement;
  if (customer?.primaryColor && HSL.test(customer.primaryColor)) {
    root.style.setProperty('--primary', customer.primaryColor);
    root.style.setProperty('--ring', customer.primaryColor);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
  }
  if (customer?.accentColor && HSL.test(customer.accentColor)) {
    root.style.setProperty('--accent', customer.accentColor);
  } else {
    root.style.removeProperty('--accent');
  }
}

/**
 * Phase 2 #3a + #3c — portal app shell.
 * Resolves the customer by URL slug OR host (subdomain / verified custom
 * domain), verifies the active session is a portal user for that customer,
 * applies branding, and renders the portal views. Anything else routes
 * back to the portal login (host-aware path).
 */
export default function PortalApp() {
  const { slug, source, resolvedFromHost, loading: slugLoading } = usePortalSlug();
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Login URL: custom-domain mode lives at /login; everything else lives
  // at /portal/<slug>/login.
  const loginPath = source === 'custom-domain' ? '/login' : `/portal/${slug ?? ''}/login`;

  useEffect(() => {
    let cancelled = false;
    if (slugLoading) return;
    (async () => {
      try {
        // Custom-domain mode: branding is already in the context — skip
        // the extra round-trip and just authorize.
        if (source === 'custom-domain') {
          if (!resolvedFromHost) {
            setCustomer(null);
            setAuthorized(false);
            return;
          }
          setCustomer(resolvedFromHost);
          applyBranding(resolvedFromHost);
          const portalUser = await getCurrentPortalUser();
          if (cancelled) return;
          setAuthorized(Boolean(portalUser && portalUser.customerId === resolvedFromHost.id));
          return;
        }

        if (!slug) {
          setCustomer(null);
          setAuthorized(false);
          return;
        }

        const c = await getPortalBranding({ slug });
        if (cancelled) return;
        setCustomer(c);
        applyBranding(c);

        if (!c) {
          setAuthorized(false);
          return;
        }
        const portalUser = await getCurrentPortalUser();
        if (cancelled) return;
        setAuthorized(Boolean(portalUser && portalUser.customerId === c.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, source, resolvedFromHost, slugLoading]);

  if (loading || slugLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) return <Navigate to={loginPath} replace />;
  if (!authorized) return <Navigate to={loginPath} replace />;

  return (
    <PortalLayout
      customerName={customer.name}
      branding={{
        brandName: customer.brandName,
        logoUrl: customer.logoUrl,
        primaryColor: customer.primaryColor,
        accentColor: customer.accentColor,
        supportEmail: customer.supportEmail,
        supportUrl: customer.supportUrl,
      }}
    >
      <Routes>
        <Route
          index
          element={
            <PortalDashboard
              customerId={customer.id}
              customerName={customer.brandName || customer.name}
            />
          }
        />
        <Route path="drift" element={<PortalDriftView customerId={customer.id} />} />
        <Route path="anomalies" element={<PortalAnomaliesView customerId={customer.id} />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </PortalLayout>
  );
}
