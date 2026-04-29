import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LogOut, LayoutDashboard, GitCompare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { usePortalSlug } from '@/contexts/PortalHostContext';

/**
 * Phase 2 #3a — portal shell. Minimal nav (no MSP-side workflows), branding
 * pulled from the customer record passed in by the route. Read-only by design.
 */

export interface PortalBranding {
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
}

interface PortalLayoutProps {
  customerName: string;
  branding: PortalBranding;
  children: ReactNode;
}

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard },
  { to: 'drift', label: 'Configuration drift', icon: GitCompare },
  { to: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
];

export function PortalLayout({ customerName, branding, children }: PortalLayoutProps) {
  const { slug, source } = usePortalSlug();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Custom-domain mode → /login; URL/subdomain mode → /portal/<slug>/login
  const loginPath = source === 'custom-domain' ? '/login' : `/portal/${slug ?? ''}/login`;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Signed out' });
    navigate(loginPath, { replace: true });
  };

  const brandName = branding.brandName?.trim() || customerName;

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/60 bg-card/40 flex flex-col">
        <div className="p-4 border-b border-border/60 flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${brandName} logo`}
              className="w-9 h-9 rounded-xl object-contain bg-background/40"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{brandName}</h1>
            <p className="text-[11px] text-muted-foreground truncate">Customer portal</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to || 'dashboard'}
              to={item.to}
              end={item.to === ''}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-2">
          {(branding.supportEmail || branding.supportUrl) && (
            <div className="text-[11px] text-muted-foreground px-2">
              Need help?{' '}
              {branding.supportEmail && (
                <a className="underline" href={`mailto:${branding.supportEmail}`}>
                  {branding.supportEmail}
                </a>
              )}
              {branding.supportEmail && branding.supportUrl && ' · '}
              {branding.supportUrl && (
                <a className="underline" target="_blank" rel="noopener noreferrer" href={branding.supportUrl}>
                  Help center
                </a>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
