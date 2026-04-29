import { useEffect } from 'react';

const BASE_TITLE = 'Aegis';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - M365 Governance Platform`;
    return () => {
      document.title = `${BASE_TITLE} - M365 Governance Platform`;
    };
  }, [title]);
}
