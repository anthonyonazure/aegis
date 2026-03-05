import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { IntuneSidebar } from '@/components/intune/IntuneSidebar';
import { IntuneSectionId } from '@/components/intune/IntuneTypes';
import { OverviewSection } from '@/components/intune/sections/OverviewSection';
import { DevicesSection } from '@/components/intune/sections/DevicesSection';
import { AppsSection } from '@/components/intune/sections/AppsSection';
import { AppConfigSection } from '@/components/intune/sections/AppConfigSection';
import { CompliancePoliciesSection } from '@/components/intune/sections/CompliancePoliciesSection';
import { ConfigurationSection } from '@/components/intune/sections/ConfigurationSection';
import { ScriptsSection } from '@/components/intune/sections/ScriptsSection';
import { EnrollmentSection } from '@/components/intune/sections/EnrollmentSection';
import { AutopilotSection } from '@/components/intune/sections/AutopilotSection';
import { EndpointSecuritySection } from '@/components/intune/sections/EndpointSecuritySection';
import { UpdateRingsSection } from '@/components/intune/sections/UpdateRingsSection';
import { ReportsSection } from '@/components/intune/sections/ReportsSection';
import { Monitor } from 'lucide-react';

// Breadcrumb mapping
const breadcrumbMap: Record<IntuneSectionId, string[]> = {
  overview: ['Intune'],
  'all-devices': ['Devices', 'All devices'],
  windows: ['Devices', 'Windows'],
  macos: ['Devices', 'macOS'],
  ios: ['Devices', 'iOS/iPadOS'],
  android: ['Devices', 'Android'],
  'all-apps': ['Apps', 'All apps'],
  'app-configs': ['Apps', 'App configuration'],
  enrollment: ['Device onboarding', 'Enrollment'],
  autopilot: ['Device onboarding', 'Windows Autopilot'],
  configuration: ['Manage devices', 'Configuration'],
  compliance: ['Manage devices', 'Compliance'],
  scripts: ['Manage devices', 'Scripts'],
  'update-rings': ['Manage updates', 'Update rings'],
  'endpoint-security': ['Endpoint security', 'Security policies'],
  reports: ['Reports'],
};

export const IntuneView = () => {
  const [activeSection, setActiveSection] = useState<IntuneSectionId>('overview');

  const breadcrumbs = breadcrumbMap[activeSection] || ['Intune'];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />;
      case 'all-devices':
        return <DevicesSection />;
      case 'windows':
        return <DevicesSection platformFilter="Windows" />;
      case 'macos':
        return <DevicesSection platformFilter="macOS" />;
      case 'ios':
        return <DevicesSection platformFilter="iOS" />;
      case 'android':
        return <DevicesSection platformFilter="Android" />;
      case 'all-apps':
        return <AppsSection />;
      case 'app-configs':
        return <AppConfigSection />;
      case 'enrollment':
        return <EnrollmentSection />;
      case 'autopilot':
        return <AutopilotSection />;
      case 'configuration':
        return <ConfigurationSection />;
      case 'compliance':
        return <CompliancePoliciesSection />;
      case 'scripts':
        return <ScriptsSection />;
      case 'update-rings':
        return <UpdateRingsSection />;
      case 'endpoint-security':
        return <EndpointSecuritySection />;
      case 'reports':
        return <ReportsSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2 text-sm">
        <Monitor className="w-4 h-4 text-primary" />
        <span className="text-muted-foreground">Home</span>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-2">
            <span className="text-muted-foreground">›</span>
            <span className={idx === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Main layout with internal sidebar */}
      <Card className="border-border/50 overflow-hidden">
        <div className="flex min-h-[calc(100vh-200px)]">
          <IntuneSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <div className="flex-1 p-6 overflow-auto">
            {renderSection()}
          </div>
        </div>
      </Card>
    </div>
  );
};
