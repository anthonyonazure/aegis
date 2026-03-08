import { supabase } from '@/integrations/supabase/client';
import { withRetry, FetchError } from '@/lib/retry';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  id: string;
  provider: string;
  displayName: string;
  apiEndpoint?: string;
  modelId?: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  featureType: string;
  provider: string;
  modelId?: string;
  tenantConnectionId?: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysisResult {
  id: string;
  analysisType: string;
  result: Record<string, unknown>;
  score?: number;
  recommendations: unknown[];
  createdAt: string;
  expiresAt?: string;
}

// Available AI providers
export const AI_PROVIDERS = [
  { id: 'lovable', name: 'Lovable AI', description: 'Built-in AI (Gemini & GPT)', requiresKey: false },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4, GPT-3.5', requiresKey: true },
  { id: 'google', name: 'Google AI', description: 'Gemini Pro, Gemini Flash', requiresKey: true },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5, Claude 3', requiresKey: true },
  { id: 'azure', name: 'Azure OpenAI', description: 'Azure-hosted GPT models', requiresKey: true },
  { id: 'perplexity', name: 'Perplexity', description: 'AI-powered search', requiresKey: true },
  { id: 'groq', name: 'Groq', description: 'Fast Llama & Mixtral', requiresKey: true },
  { id: 'mistral', name: 'Mistral AI', description: 'Mistral Large, Medium', requiresKey: true },
] as const;

// Available models per provider
export const PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
  lovable: [
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (Best)' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'openai/gpt-5', name: 'GPT-5' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'openai/gpt-5.2', name: 'GPT-5.2 (Latest)' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o1', name: 'o1 (Reasoning)' },
    { id: 'o1-mini', name: 'o1 Mini' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  azure: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4', name: 'GPT-4' },
  ],
  perplexity: [
    { id: 'sonar', name: 'Sonar' },
    { id: 'sonar-pro', name: 'Sonar Pro' },
    { id: 'sonar-reasoning', name: 'Sonar Reasoning' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
  ],
};

// Stream chat with AI
export async function streamAIChat(options: {
  messages: AIMessage[];
  featureType?: string;
  provider?: string;
  model?: string;
  tenantContext?: Record<string, unknown>;
  conversationId?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const { messages, featureType, provider, model, tenantContext, conversationId, onDelta, onDone, onError } = options;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      onError('Not authenticated');
      return;
    }

    const response = await withRetry(
      async () => {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages,
            featureType: featureType || 'general-chat',
            provider: provider || 'lovable',
            model,
            stream: true,
            tenantContext,
            conversationId,
          }),
        });
        if (!res.ok && [429, 500, 502, 503, 504].includes(res.status)) {
          throw new FetchError(`AI API error: ${res.status}`, res.status);
        }
        return res;
      },
      { maxRetries: 2, baseDelay: 1000 }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      onError(errorData.error || `Error: ${response.status}`);
      return;
    }

    if (!response.body) {
      onError('No response body');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Incomplete JSON, put it back
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (error) {
    console.error('AI chat error:', error);
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run AI analysis
export async function runAIAnalysis(options: {
  analysisType: 'tenant-health' | 'compliance' | 'risk-score' | 'cost-forecast' | 'adoption-benchmark';
  tenantConnectionId?: string;
  customerId?: string;
  data?: Record<string, unknown>;
  provider?: string;
  model?: string;
}): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  try {
    const result = await withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke('ai-analyze', {
          body: options,
        });
        if (error) throw error;
        return data;
      },
      { maxRetries: 2, baseDelay: 1500 }
    );

    return { success: true, result: result?.result };
  } catch (err) {
    console.error('Analysis exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Conversation management
export async function createConversation(options: {
  title?: string;
  featureType: string;
  provider?: string;
  modelId?: string;
  tenantConnectionId?: string;
  customerId?: string;
}): Promise<AIConversation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: user.id,
      title: options.title || 'New Conversation',
      feature_type: options.featureType,
      provider: options.provider || 'lovable',
      model_id: options.modelId,
      tenant_connection_id: options.tenantConnectionId,
      customer_id: options.customerId,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create conversation:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    featureType: data.feature_type,
    provider: data.provider,
    modelId: data.model_id,
    tenantConnectionId: data.tenant_connection_id,
    customerId: data.customer_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getConversations(featureType?: string): Promise<AIConversation[]> {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (featureType) {
    query = query.eq('feature_type', featureType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get conversations:', error);
    return [];
  }

  return data.map(c => ({
    id: c.id,
    title: c.title,
    featureType: c.feature_type,
    provider: c.provider,
    modelId: c.model_id,
    tenantConnectionId: c.tenant_connection_id,
    customerId: c.customer_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function getConversationMessages(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get messages:', error);
    return [];
  }

  return data.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId);

  return !error;
}

// Provider settings
export async function saveProviderApiKey(provider: string, apiKey: string): Promise<boolean> {
  const { error } = await supabase.rpc('store_ai_api_key', {
    p_provider: provider,
    p_api_key: apiKey,
  });

  if (error) {
    console.error('Failed to save API key:', error);
    return false;
  }

  return true;
}

export async function getProviderSettings(): Promise<AIProvider[]> {
  const { data, error } = await supabase
    .from('ai_provider_settings')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get provider settings:', error);
    return [];
  }

  return data.map(p => ({
    id: p.id,
    provider: p.provider,
    displayName: p.display_name,
    apiEndpoint: p.api_endpoint,
    modelId: p.model_id,
    isActive: p.is_active,
    isDefault: p.is_default,
  }));
}

export async function saveProviderSettings(settings: Partial<AIProvider> & { provider: string }): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('ai_provider_settings')
    .upsert({
      user_id: user.id,
      provider: settings.provider,
      display_name: settings.displayName || settings.provider,
      api_endpoint: settings.apiEndpoint,
      model_id: settings.modelId,
      is_active: settings.isActive ?? true,
      is_default: settings.isDefault ?? false,
    }, {
      onConflict: 'user_id,provider',
    });

  return !error;
}

// Get recent analysis results
export async function getRecentAnalyses(options?: {
  tenantConnectionId?: string;
  analysisType?: string;
}): Promise<AIAnalysisResult[]> {
  let query = supabase
    .from('ai_analysis_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (options?.tenantConnectionId) {
    query = query.eq('tenant_connection_id', options.tenantConnectionId);
  }
  if (options?.analysisType) {
    query = query.eq('analysis_type', options.analysisType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get analyses:', error);
    return [];
  }

  return data.map(a => ({
    id: a.id,
    analysisType: a.analysis_type,
    result: a.result as Record<string, unknown>,
    score: a.score ? Number(a.score) : undefined,
    recommendations: a.recommendations as unknown[],
    createdAt: a.created_at,
    expiresAt: a.expires_at,
  }));
}

// Get the most recent analysis result for a specific type
export async function getLastAnalysis(analysisType: string, tenantConnectionId?: string): Promise<AIAnalysisResult | null> {
  let query = supabase
    .from('ai_analysis_results')
    .select('*')
    .eq('analysis_type', analysisType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    analysisType: data.analysis_type,
    result: data.result as Record<string, unknown>,
    score: data.score ? Number(data.score) : undefined,
    recommendations: data.recommendations as unknown[],
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

// Save an analysis result
export async function saveAnalysisResult(options: {
  analysisType: string;
  result: Record<string, unknown>;
  score?: number;
  recommendations?: unknown[];
  tenantConnectionId?: string;
  customerId?: string;
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('ai_analysis_results')
    .insert({
      user_id: user.id,
      analysis_type: options.analysisType,
      result: options.result as unknown as import('@/integrations/supabase/types').Json,
      score: options.score,
      recommendations: options.recommendations as unknown as import('@/integrations/supabase/types').Json,
      tenant_connection_id: options.tenantConnectionId,
      customer_id: options.customerId,
    });

  return !error;
}
