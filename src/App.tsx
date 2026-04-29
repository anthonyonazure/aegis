import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TenantProvider } from "@/contexts/TenantContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { PortalHostProvider } from "@/contexts/PortalHostContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { detectPortalHost } from "@/lib/portalHostRouting";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalApp from "./pages/portal/PortalApp";

const queryClient = new QueryClient();

/**
 * Phase 2 #3c — host-aware shell.
 *
 * 1. If the request comes in on a portal host (`acme.aegis.io` or a
 *    verified `portal.acme.com`), render the portal directly. Routes are
 *    bare (`/login` and `/*`) since the host already identifies the
 *    customer. Slug resolution flows through PortalHostProvider.
 *
 * 2. Path-prefixed access (`/portal/:slug/...`) keeps working for ops
 *    fallback even on portal hosts.
 *
 * 3. Everything else gets the MSP app wrapped in TenantProvider +
 *    BrandingProvider.
 */
function AppShell() {
  const location = useLocation();
  const portalMatch = detectPortalHost();

  // Portal host: render bare portal routes regardless of path prefix
  if (portalMatch) {
    return (
      <PortalHostProvider match={portalMatch}>
        <Routes>
          {/* Path-prefixed access still allowed (operator override) */}
          <Route path="/portal/:slug/login" element={<PortalLogin />} />
          <Route path="/portal/:slug/*" element={<PortalApp />} />
          {/* Host-rooted access */}
          <Route path="/login" element={<PortalLogin />} />
          <Route path="/*" element={<PortalApp />} />
        </Routes>
      </PortalHostProvider>
    );
  }

  // MSP host: path-prefixed portal routes still work without provider isolation
  if (location.pathname.startsWith('/portal/')) {
    return (
      <Routes>
        <Route path="/portal/:slug/login" element={<PortalLogin />} />
        <Route path="/portal/:slug/*" element={<PortalApp />} />
      </Routes>
    );
  }

  return (
    <TenantProvider>
      <BrandingProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrandingProvider>
    </TenantProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
