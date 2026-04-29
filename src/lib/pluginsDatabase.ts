import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 2 #6 — plugin SDK helpers.
 *
 * RLS handles authz: my plugins OR public plugins for read; only mine for
 * write. Install + Run delegate to RPC / edge function respectively.
 */

export type PluginCategory = 'analysis' | 'remediation' | 'reporting' | 'compliance' | 'other';

export interface PluginInputField {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'number' | 'tenantId';
  required?: boolean;
  default?: string | number;
  helpText?: string;
}

export interface Plugin {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: PluginCategory | null;
  promptTemplate: string;
  inputSchema: PluginInputField[];
  requiresTenant: boolean;
  defaultModel: string | null;
  defaultTemperature: number | null;
  isPublic: boolean;
  sourcePluginId: string | null;
  installCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginRun {
  id: string;
  userId: string;
  pluginId: string;
  tenantConnectionId: string | null;
  inputs: Record<string, unknown>;
  output: string | null;
  status: 'running' | 'completed' | 'failed';
  error: string | null;
  model: string | null;
  durationMs: number | null;
  ranAt: Date;
}

function mapPlugin(row: Record<string, unknown>): Plugin {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category: (row.category as PluginCategory) ?? null,
    promptTemplate: row.prompt_template as string,
    inputSchema: Array.isArray(row.input_schema) ? (row.input_schema as PluginInputField[]) : [],
    requiresTenant: row.requires_tenant as boolean,
    defaultModel: (row.default_model as string) ?? null,
    defaultTemperature: row.default_temperature !== null ? Number(row.default_temperature) : null,
    isPublic: row.is_public as boolean,
    sourcePluginId: (row.source_plugin_id as string) ?? null,
    installCount: (row.install_count as number) ?? 0,
    version: (row.version as number) ?? 1,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapRun(row: Record<string, unknown>): PluginRun {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    pluginId: row.plugin_id as string,
    tenantConnectionId: (row.tenant_connection_id as string) ?? null,
    inputs: (row.inputs as Record<string, unknown>) ?? {},
    output: (row.output as string) ?? null,
    status: row.status as PluginRun['status'],
    error: (row.error as string) ?? null,
    model: (row.model as string) ?? null,
    durationMs: row.duration_ms !== null ? (row.duration_ms as number) : null,
    ranAt: new Date(row.ran_at as string),
  };
}

export async function getMyPlugins(): Promise<Plugin[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Failed to load plugins: ${error.message}`);
  return (data ?? []).map(mapPlugin);
}

export async function browsePublicPlugins(options?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<Plugin[]> {
  let query = supabase
    .from('plugins')
    .select('*')
    .eq('is_public', true)
    .order('install_count', { ascending: false })
    .limit(options?.limit ?? 100);
  if (options?.category) query = query.eq('category', options.category);
  if (options?.search) {
    const s = `%${options.search}%`;
    query = query.or(`name.ilike.${s},description.ilike.${s}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to browse plugins: ${error.message}`);
  return (data ?? []).map(mapPlugin);
}

export async function createPlugin(input: {
  name: string;
  description?: string;
  category?: PluginCategory;
  promptTemplate: string;
  inputSchema?: PluginInputField[];
  requiresTenant?: boolean;
  defaultModel?: string;
  defaultTemperature?: number;
  isPublic?: boolean;
}): Promise<Plugin> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('plugins')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      prompt_template: input.promptTemplate,
      input_schema: input.inputSchema ?? [],
      requires_tenant: input.requiresTenant ?? false,
      default_model: input.defaultModel ?? null,
      default_temperature: input.defaultTemperature ?? 0.3,
      is_public: input.isPublic ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create plugin: ${error.message}`);
  return mapPlugin(data);
}

export async function updatePlugin(id: string, patch: Partial<{
  name: string;
  description: string | null;
  category: PluginCategory | null;
  promptTemplate: string;
  inputSchema: PluginInputField[];
  requiresTenant: boolean;
  defaultModel: string | null;
  defaultTemperature: number | null;
  isPublic: boolean;
}>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.promptTemplate !== undefined) update.prompt_template = patch.promptTemplate;
  if (patch.inputSchema !== undefined) update.input_schema = patch.inputSchema;
  if (patch.requiresTenant !== undefined) update.requires_tenant = patch.requiresTenant;
  if (patch.defaultModel !== undefined) update.default_model = patch.defaultModel;
  if (patch.defaultTemperature !== undefined) update.default_temperature = patch.defaultTemperature;
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
  const { error } = await supabase.from('plugins').update(update).eq('id', id);
  if (error) throw new Error(`Failed to update plugin: ${error.message}`);
}

export async function deletePlugin(id: string): Promise<void> {
  const { error } = await supabase.from('plugins').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete plugin: ${error.message}`);
}

/** Clones a public plugin into the caller's library (atomic; bumps install_count). */
export async function installPlugin(pluginId: string): Promise<string> {
  const { data, error } = await supabase.rpc('install_plugin', { p_plugin_id: pluginId });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface RunPluginResult {
  success: boolean;
  runId?: string;
  output?: string;
  model?: string;
  durationMs?: number;
  error?: string;
}

export async function runPlugin(input: {
  pluginId: string;
  inputs?: Record<string, unknown>;
  tenantConnectionId?: string;
}): Promise<RunPluginResult> {
  const { data, error } = await supabase.functions.invoke('run-plugin', { body: input });
  if (error) return { success: false, error: error.message };
  return data as RunPluginResult;
}

export async function getRecentRuns(limit = 25): Promise<PluginRun[]> {
  const { data, error } = await supabase
    .from('plugin_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load run history: ${error.message}`);
  return (data ?? []).map(mapRun);
}
