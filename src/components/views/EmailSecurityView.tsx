import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { EmailSecuritySidebar } from '@/components/email-security/EmailSecuritySidebar';
import { EmailSecuritySectionId } from '@/components/email-security/EmailSecurityTypes';
import { OverviewSection } from '@/components/email-security/sections/OverviewSection';
import { AntiPhishingSection } from '@/components/email-security/sections/AntiPhishingSection';
import { AntiSpamSection } from '@/components/email-security/sections/AntiSpamSection';
import { AntiMalwareSection } from '@/components/email-security/sections/AntiMalwareSection';
import { SafeLinksSection } from '@/components/email-security/sections/SafeLinksSection';
import { SafeAttachmentsSection } from '@/components/email-security/sections/SafeAttachmentsSection';
import { DomainAuthSection } from '@/components/email-security/sections/DomainAuthSection';
import { RecommendationsSection } from '@/components/email-security/sections/RecommendationsSection';
import { Mail } from 'lucide-react';

const breadcrumbMap: Record<EmailSecuritySectionId, string[]> = {
  overview: ['Email Security'],
  'anti-phishing': ['Protection Policies', 'Anti-Phishing'],
  'anti-spam': ['Protection Policies', 'Anti-Spam'],
  'anti-malware': ['Protection Policies', 'Anti-Malware'],
  'safe-links': ['Advanced Protection', 'Safe Links'],
  'safe-attachments': ['Advanced Protection', 'Safe Attachments'],
  'domain-auth': ['Domain Security', 'SPF / DKIM / DMARC'],
  recommendations: ['AI Analysis', 'Recommendations'],
};

export const EmailSecurityView = () => {
  const [activeSection, setActiveSection] = useState<EmailSecuritySectionId>('overview');

  const breadcrumbs = breadcrumbMap[activeSection] || ['Email Security'];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <OverviewSection />;
      case 'anti-phishing': return <AntiPhishingSection />;
      case 'anti-spam': return <AntiSpamSection />;
      case 'anti-malware': return <AntiMalwareSection />;
      case 'safe-links': return <SafeLinksSection />;
      case 'safe-attachments': return <SafeAttachmentsSection />;
      case 'domain-auth': return <DomainAuthSection />;
      case 'recommendations': return <RecommendationsSection />;
      default: return <OverviewSection />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Mail className="w-4 h-4 text-primary" />
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

      <Card className="border-border/50 overflow-hidden">
        <div className="flex min-h-[calc(100vh-200px)]">
          <EmailSecuritySidebar
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
