import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const GRAPH_API_FUNCTION = 'graph-api';
const CONVERT_FUNCTION = 'convert-format';

// Validation schemas for client-side validation
const UUIDSchema = z.string().uuid('Invalid UUID format');
const ClientSecretSchema = z.string().min(1, 'Client secret required').max(1000, 'Client secret too long');
const AccessTokenSchema = z.string().min(1, 'Access token required').max(10000, 'Access token too long');
const ResourceSchema = z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource format');
const FormatSchema = z.enum(['terraform', 'bicep', 'powershell']);
const ResourceTypeSchema = z.string().regex(/^[a-z-]+\/[a-z0-9-]+$/, 'Invalid resource type format');

export interface TestConnectionResult {
  success: boolean;
  tenantName?: string;
  tenantId?: string;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  results?: Array<{
    resource: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  completed?: number;
  total?: number;
  error?: string;
}

export interface ConvertResult {
  success: boolean;
  output?: string;
  format?: string;
  resourceType?: string;
  error?: string;
}

export async function testTenantConnection(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<TestConnectionResult> {
  try {
    // Client-side validation
    const tenantIdResult = UUIDSchema.safeParse(tenantId);
    if (!tenantIdResult.success) {
      return { success: false, error: 'Invalid Tenant ID format. Must be a valid UUID.' };
    }

    const clientIdResult = UUIDSchema.safeParse(clientId);
    if (!clientIdResult.success) {
      return { success: false, error: 'Invalid Client ID format. Must be a valid UUID.' };
    }

    const clientSecretResult = ClientSecretSchema.safeParse(clientSecret);
    if (!clientSecretResult.success) {
      return { success: false, error: clientSecretResult.error.errors[0]?.message || 'Invalid client secret' };
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'test-connection',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      console.error('Connection test error:', error);
      return { success: false, error: 'Connection test failed. Please check your credentials.' };
    }

    return data as TestConnectionResult;
  } catch (err) {
    console.error('Connection test exception:', err);
    return { success: false, error: 'Connection test failed. Please try again.' };
  }
}

export async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    // Client-side validation
    const tenantIdResult = UUIDSchema.safeParse(tenantId);
    if (!tenantIdResult.success) {
      return { error: 'Invalid Tenant ID format. Must be a valid UUID.' };
    }

    const clientIdResult = UUIDSchema.safeParse(clientId);
    if (!clientIdResult.success) {
      return { error: 'Invalid Client ID format. Must be a valid UUID.' };
    }

    const clientSecretResult = ClientSecretSchema.safeParse(clientSecret);
    if (!clientSecretResult.success) {
      return { error: clientSecretResult.error.errors[0]?.message || 'Invalid client secret' };
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'get-token',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      console.error('Token retrieval error:', error);
      return { error: 'Failed to retrieve access token. Please check your credentials.' };
    }

    return data;
  } catch (err) {
    console.error('Token retrieval exception:', err);
    return { error: 'Failed to retrieve access token. Please try again.' };
  }
}

export async function exportResources(
  accessToken: string,
  resources: string[],
  exportJobId: string
): Promise<ExportResult> {
  try {
    // Client-side validation
    const accessTokenResult = AccessTokenSchema.safeParse(accessToken);
    if (!accessTokenResult.success) {
      return { success: false, error: 'Invalid access token.' };
    }

    const exportJobIdResult = UUIDSchema.safeParse(exportJobId);
    if (!exportJobIdResult.success) {
      return { success: false, error: 'Invalid export job ID.' };
    }

    // Validate resources array
    if (!Array.isArray(resources) || resources.length === 0) {
      return { success: false, error: 'At least one resource must be selected.' };
    }

    if (resources.length > 100) {
      return { success: false, error: 'Too many resources selected. Maximum is 100.' };
    }

    for (const resource of resources) {
      const resourceResult = ResourceSchema.safeParse(resource);
      if (!resourceResult.success) {
        return { success: false, error: `Invalid resource format: ${resource}` };
      }
    }

    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'export',
        accessToken,
        resources,
        exportJobId,
      },
    });

    if (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Export failed. Please try again.' };
    }

    return data as ExportResult;
  } catch (err) {
    console.error('Export exception:', err);
    return { success: false, error: 'Export failed. Please try again.' };
  }
}

export async function convertToFormat(
  data: any,
  resourceType: string,
  format: 'terraform' | 'bicep' | 'powershell'
): Promise<ConvertResult> {
  try {
    // Client-side validation
    const resourceTypeResult = ResourceTypeSchema.safeParse(resourceType);
    if (!resourceTypeResult.success) {
      return { success: false, error: 'Invalid resource type format.' };
    }

    const formatResult = FormatSchema.safeParse(format);
    if (!formatResult.success) {
      return { success: false, error: 'Invalid format. Must be terraform, bicep, or powershell.' };
    }

    // Check data size (rough estimate)
    try {
      const dataStr = JSON.stringify(data);
      if (dataStr.length > 5 * 1024 * 1024) {
        return { success: false, error: 'Data payload is too large to process.' };
      }
    } catch {
      return { success: false, error: 'Invalid data format.' };
    }

    const { data: result, error } = await supabase.functions.invoke(CONVERT_FUNCTION, {
      body: {
        data,
        resourceType,
        format,
      },
    });

    if (error) {
      console.error('Conversion error:', error);
      return { success: false, error: 'Conversion failed. Please try again.' };
    }

    return result as ConvertResult;
  } catch (err) {
    console.error('Conversion exception:', err);
    return { success: false, error: 'Conversion failed. Please try again.' };
  }
}
