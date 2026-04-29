import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TenantProvider } from "@/contexts/TenantContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
 * Phase 2 #3b — split provider tree.
 *
 * MSP routes are wrapped in TenantProvider + BrandingProvider, which load
 * MSP-only data (tenant_connections, customers list, the active customer's
 * branding). Portal routes (/portal/*) skip those providers entirely — the
 * portal manages its own customer scoping via the URL slug + customer_users
 * RLS, and applies branding inline. This stops MSP-side state from
 * flickering or leaking into a portal session.
 */
function AppShell() {
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith('/portal/');

  if (isPortalRoute) {
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
