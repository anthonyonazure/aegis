import { supabase } from '@/integrations/supabase/client';

export type PSAProvider = 'halopsa' | 'autotask' | 'connectwise';

export interface PSAIntegration {
  id: string;
  user_id: string;
  name: string;
  provider: PSAProvider;
  api_url: string;
  is_active: boolean;
  default_ticket_type: string | null;
  default_priority: string | null;
  auto_create_tickets: boolean;
  ticket_on_drift: boolean;
  ticket_on_compliance_fail: boolean;
  created_at: string;
  updated_at: string;
}

export interface PSATicket {
  id: string;
  user_id: string;
  psa_integration_id: string;
  customer_id: string | null;
  external_ticket_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ticket_type: string;
  source_type: 'drift' | 'compliance' | 'manual' | 'scheduled_drift';
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export const PSA_PROVIDERS = [
  { id: 'halopsa' as const, name: 'HaloPSA', logo: '🟦' },
  { id: 'autotask' as const, name: 'Autotask (Datto)', logo: '🟩' },
  { id: 'connectwise' as const, name: 'ConnectWise Manage', logo: '🟧' },
] as const;

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;

// PSA Integration CRUD
export async function getPSAIntegrations(): Promise<PSAIntegration[]> {
  const { data, error } = await supabase
    .from('psa_integrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as PSAIntegration[];
}

export async function getPSAIntegration(id: string): Promise<PSAIntegration | null> {
  const { data, error } = await supabase
    .from('psa_integrations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as PSAIntegration;
}

export async function createPSAIntegration(integration: Omit<PSAIntegration, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<PSAIntegration> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('psa_integrations')
    .insert({
      ...integration,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PSAIntegration;
}

export async function updatePSAIntegration(id: string, updates: Partial<Omit<PSAIntegration, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<PSAIntegration> {
  const { data, error } = await supabase
    .from('psa_integrations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PSAIntegration;
}

export async function deletePSAIntegration(id: string): Promise<void> {
  const { error } = await supabase
    .from('psa_integrations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// PSA Tickets CRUD
export async function getPSATickets(filters?: { 
  integrationId?: string; 
  customerId?: string; 
  sourceType?: string;
  status?: string;
}): Promise<PSATicket[]> {
  let query = supabase
    .from('psa_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.integrationId) {
    query = query.eq('psa_integration_id', filters.integrationId);
  }
  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as PSATicket[];
}

export async function createPSATicket(ticket: Omit<PSATicket, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<PSATicket> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('psa_tickets')
    .insert({
      ...ticket,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PSATicket;
}

export async function updatePSATicket(id: string, updates: Partial<Omit<PSATicket, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<PSATicket> {
  const { data, error } = await supabase
    .from('psa_tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PSATicket;
}

export async function deletePSATicket(id: string): Promise<void> {
  const { error } = await supabase
    .from('psa_tickets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get active integrations that should receive tickets
export async function getActiveTicketingIntegrations(): Promise<PSAIntegration[]> {
  const { data, error } = await supabase
    .from('psa_integrations')
    .select('*')
    .eq('is_active', true)
    .eq('auto_create_tickets', true);

  if (error) throw error;
  return (data || []) as unknown as PSAIntegration[];
}
