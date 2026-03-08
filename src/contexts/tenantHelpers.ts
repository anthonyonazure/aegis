import type { LastSelection } from './tenantTypes';

const LAST_SELECTION_KEY = 'msp_last_tenant_selection';

export function saveLastSelection(selection: LastSelection) {
  try {
    localStorage.setItem(LAST_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    console.warn('Failed to save tenant selection to localStorage');
  }
}

export function loadLastSelection(): LastSelection | null {
  try {
    const saved = localStorage.getItem(LAST_SELECTION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    console.warn('Failed to load tenant selection from localStorage');
  }
  return null;
}

// Refresh token 5 minutes before expiry
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
