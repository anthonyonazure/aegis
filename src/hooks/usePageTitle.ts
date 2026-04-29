import { useEffect } from 'react';
import { useBranding } from '@/contexts/BrandingContext';

const DEFAULT_TITLE = 'Aegis';

export function usePageTitle(title?: string) {
  const { brandName } = useBranding();
  const baseTitle = brandName || DEFAULT_TITLE;
  useEffect(() => {
    document.title = title ? `${title} | ${baseTitle}` : `${baseTitle} - M365 Governance Platform`;
    return () => {
      document.title = `${baseTitle} - M365 Governance Platform`;
    };
  }, [title, baseTitle]);
}
