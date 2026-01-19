import { PublicClientApplication, Configuration, PopupRequest, AccountInfo, AuthenticationResult } from '@azure/msal-browser';

// MSAL configuration for delegated authentication
// Users must provide their own Client ID for multi-tenant app
const createMsalConfig = (clientId: string, tenantId: string = 'common'): Configuration => ({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: 3, // Warning
      piiLoggingEnabled: false,
    },
  },
});

// Scopes for different resource access levels
export const GRAPH_SCOPES = {
  // Read-only scopes for export operations
  readOnly: [
    'User.Read',
    'Directory.Read.All',
    'DeviceManagementConfiguration.Read.All',
    'DeviceManagementApps.Read.All',
    'DeviceManagementManagedDevices.Read.All',
    'DeviceManagementServiceConfig.Read.All',
    'Policy.Read.All',
    'Application.Read.All',
    'Group.Read.All',
    'RoleManagement.Read.Directory',
    'SecurityEvents.Read.All',
    'Sites.Read.All',
    'TeamSettings.Read.All',
  ],
  // Read-write scopes for import/deploy operations
  readWrite: [
    'User.Read',
    'Directory.ReadWrite.All',
    'DeviceManagementConfiguration.ReadWrite.All',
    'DeviceManagementApps.ReadWrite.All',
    'DeviceManagementManagedDevices.ReadWrite.All',
    'DeviceManagementServiceConfig.ReadWrite.All',
    'Policy.ReadWrite.ConditionalAccess',
    'Application.ReadWrite.All',
    'Group.ReadWrite.All',
    'RoleManagement.ReadWrite.Directory',
    'SecurityEvents.ReadWrite.All',
    'Sites.ReadWrite.All',
    'TeamSettings.ReadWrite.All',
  ],
};

export const AZURE_SCOPES = {
  management: ['https://management.azure.com/user_impersonation'],
};

// MSAL instance cache
let msalInstance: PublicClientApplication | null = null;
let currentClientId: string | null = null;
let currentTenantId: string | null = null;

// Get or create MSAL instance
export async function getMsalInstance(clientId: string, tenantId: string = 'common'): Promise<PublicClientApplication> {
  // Return existing instance if config matches
  if (msalInstance && currentClientId === clientId && currentTenantId === tenantId) {
    return msalInstance;
  }

  // Create new instance
  const config = createMsalConfig(clientId, tenantId);
  msalInstance = new PublicClientApplication(config);
  currentClientId = clientId;
  currentTenantId = tenantId;

  // Initialize the instance
  await msalInstance.initialize();

  return msalInstance;
}

// Interactive login with popup
export async function loginWithPopup(
  clientId: string,
  tenantId: string = 'common',
  scopes: string[] = GRAPH_SCOPES.readOnly
): Promise<{ success: boolean; account?: AccountInfo; accessToken?: string; error?: string }> {
  try {
    const instance = await getMsalInstance(clientId, tenantId);

    const loginRequest: PopupRequest = {
      scopes,
      prompt: 'select_account',
    };

    const response: AuthenticationResult = await instance.loginPopup(loginRequest);

    if (response.account) {
      // Set active account
      instance.setActiveAccount(response.account);

      return {
        success: true,
        account: response.account,
        accessToken: response.accessToken,
      };
    }

    return { success: false, error: 'No account returned from login' };
  } catch (error) {
    console.error('MSAL login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    
    // Provide user-friendly error messages
    if (errorMessage.includes('popup_window_error')) {
      return { success: false, error: 'Popup was blocked. Please allow popups for this site.' };
    }
    if (errorMessage.includes('user_cancelled')) {
      return { success: false, error: 'Login was cancelled.' };
    }
    if (errorMessage.includes('interaction_in_progress')) {
      return { success: false, error: 'Another login is in progress. Please wait.' };
    }
    
    return { success: false, error: errorMessage };
  }
}

// Acquire token silently or with popup
export async function acquireToken(
  clientId: string,
  tenantId: string = 'common',
  scopes: string[] = GRAPH_SCOPES.readOnly
): Promise<{ success: boolean; accessToken?: string; expiresOn?: Date; error?: string }> {
  try {
    const instance = await getMsalInstance(clientId, tenantId);
    const account = instance.getActiveAccount();

    if (!account) {
      return { success: false, error: 'No active account. Please sign in first.' };
    }

    // Try silent token acquisition first
    try {
      const response = await instance.acquireTokenSilent({
        scopes,
        account,
      });

      return {
        success: true,
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || undefined,
      };
    } catch (silentError) {
      // Silent acquisition failed, try popup
      console.log('Silent token acquisition failed, trying popup...');
      
      const response = await instance.acquireTokenPopup({
        scopes,
        account,
      });

      return {
        success: true,
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || undefined,
      };
    }
  } catch (error) {
    console.error('Token acquisition error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token acquisition failed',
    };
  }
}

// Logout
export async function logout(clientId: string, tenantId: string = 'common'): Promise<void> {
  try {
    const instance = await getMsalInstance(clientId, tenantId);
    const account = instance.getActiveAccount();

    if (account) {
      await instance.logoutPopup({
        account,
        postLogoutRedirectUri: window.location.origin,
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Get current account
export async function getCurrentAccount(clientId: string, tenantId: string = 'common'): Promise<AccountInfo | null> {
  try {
    const instance = await getMsalInstance(clientId, tenantId);
    return instance.getActiveAccount();
  } catch {
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated(clientId: string, tenantId: string = 'common'): Promise<boolean> {
  const account = await getCurrentAccount(clientId, tenantId);
  return account !== null;
}

// Get tenant info from account
export function getTenantFromAccount(account: AccountInfo): { tenantId: string; tenantName?: string } {
  return {
    tenantId: account.tenantId,
    tenantName: account.username?.split('@')[1],
  };
}

// Acquire Azure Management token
export async function acquireAzureToken(
  clientId: string,
  tenantId: string = 'common'
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  return acquireToken(clientId, tenantId, AZURE_SCOPES.management);
}
