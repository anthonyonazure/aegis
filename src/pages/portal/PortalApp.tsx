import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { PortalDashboard } from '@/components/portal/PortalDashboard';
import { PortalDriftView } from '@/components/portal/PortalDriftView';
import { PortalAnomaliesView } from '@/components/portal/PortalAnomaliesView';
import { getCustomerBySlug, getCurrentPortalUser } from '@/lib/customerUsersDatabase';

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
 * Phase 2 #3a — portal app shell.
 * Resolves the customer by URL slug, verifies the active session is a portal
 * user for that customer, applies branding, and renders the portal views.
 * Anything else (no session / wrong customer / unknown slug) routes back to
 * the portal login.
 */
export default function PortalApp() {
  const { slug } = useParams<{ slug: string }>();
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const c = await getCustomerBySlug(slug);
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
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return <Navigate to={`/portal/${slug}/login`} replace />;
  }

  if (!authorized) {
    return <Navigate to={`/portal/${slug}/login`} replace />;
  }

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
        <Route index element={<PortalDashboard customerId={customer.id} customerName={customer.brandName || customer.name} />} />
        <Route path="drift" element={<PortalDriftView customerId={customer.id} />} />
        <Route path="anomalies" element={<PortalAnomaliesView customerId={customer.id} />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </PortalLayout>
  );
}
