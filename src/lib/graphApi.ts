import { supabase } from '@/integrations/supabase/client';

const GRAPH_API_FUNCTION = 'graph-api';
const CONVERT_FUNCTION = 'convert-format';

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
      return { success: false, error: error.message };
    }

    return data as TestConnectionResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to test connection';
    return { success: false, error: errorMessage };
  }
}

export async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'get-token',
        tenantId,
        clientId,
        clientSecret,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to get token';
    return { error: errorMessage };
  }
}

export async function exportResources(
  accessToken: string,
  resources: string[],
  exportJobId: string
): Promise<ExportResult> {
  try {
    const { data, error } = await supabase.functions.invoke(GRAPH_API_FUNCTION, {
      body: {
        action: 'export',
        accessToken,
        resources,
        exportJobId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data as ExportResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Export failed';
    return { success: false, error: errorMessage };
  }
}

export async function convertToFormat(
  data: any,
  resourceType: string,
  format: 'terraform' | 'bicep' | 'powershell'
): Promise<ConvertResult> {
  try {
    const { data: result, error } = await supabase.functions.invoke(CONVERT_FUNCTION, {
      body: {
        data,
        resourceType,
        format,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return result as ConvertResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Conversion failed';
    return { success: false, error: errorMessage };
  }
}
