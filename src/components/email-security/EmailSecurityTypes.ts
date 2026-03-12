export type EmailSecuritySectionId =
  | 'overview'
  | 'anti-phishing'
  | 'anti-spam'
  | 'anti-malware'
  | 'safe-links'
  | 'safe-attachments'
  | 'domain-auth'
  | 'recommendations';

export interface EopPolicy {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  isEnabled?: boolean;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  priority?: number;
  settings?: Record<string, any>;
  '@odata.type'?: string;
}

export interface AntiPhishingPolicy extends EopPolicy {
  impersonationProtectionEnabled?: boolean;
  mailboxIntelligenceEnabled?: boolean;
  spoofIntelligenceEnabled?: boolean;
  targetedUserProtection?: string[];
  targetedDomainProtection?: string[];
}

export interface AntiSpamPolicy extends EopPolicy {
  spamAction?: string;
  highConfidenceSpamAction?: string;
  bulkSpamAction?: string;
  bulkThreshold?: number;
  allowedSenders?: string[];
  blockedSenders?: string[];
  direction?: 'inbound' | 'outbound';
}

export interface AntiMalwarePolicy extends EopPolicy {
  enableFileFilter?: boolean;
  fileFilterTypes?: string[];
  zapEnabled?: boolean;
  adminNotificationsEnabled?: boolean;
  action?: string;
}

export interface SafeLinksPolicy extends EopPolicy {
  isEnabled?: boolean;
  scanUrls?: boolean;
  deliverMessageAfterScan?: boolean;
  trackUserClicks?: boolean;
  allowClickThrough?: boolean;
  doNotRewriteUrls?: string[];
}

export interface SafeAttachmentsPolicy extends EopPolicy {
  action?: 'block' | 'replace' | 'dynamicDelivery' | 'monitor';
  redirect?: boolean;
  redirectAddress?: string;
  actionOnError?: boolean;
}

export interface DomainAuthRecord {
  domain: string;
  isVerified: boolean;
  spf: {
    status: 'pass' | 'fail' | 'missing' | 'unknown';
    record?: string;
  };
  dkim: {
    status: 'pass' | 'fail' | 'missing' | 'unknown';
    selectors?: string[];
  };
  dmarc: {
    status: 'pass' | 'fail' | 'missing' | 'unknown';
    record?: string;
    policy?: 'none' | 'quarantine' | 'reject';
  };
}

export interface EmailSecurityOverview {
  totalPolicies: number;
  antiPhishingCount: number;
  antiSpamCount: number;
  antiMalwareCount: number;
  safeLinksCount: number;
  safeAttachmentsCount: number;
  domainCount: number;
  domainsWithFullAuth: number;
  protectionScore: number;
}
