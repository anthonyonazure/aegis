import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 2 #5 — policy templates marketplace.
 *
 * Browse, publish, install, rate. RLS handles authz:
 *   - browse: any authenticated user, only published rows
 *   - publish: anyone — they end up as publisher_id
 *   - update/delete: only the publisher
 *   - rate: any authenticated user (one rating per user per template)
 *
 * Install is wrapped in a SECURITY DEFINER RPC so the install_count bump
 * and the policy_templates insert happen in one transaction.
 */

export interface MarketplaceTemplate {
  id: string;
  publisherId: string;
  sourceTemplateId: string | null;
  name: string;
  description: string | null;
  category: string;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
  frameworkTags: string[];
  isPublished: boolean;
  installCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  review: string | null;
  createdAt: Date;
}

function mapTemplate(row: Record<string, unknown>): MarketplaceTemplate {
  return {
    id: row.id as string,
    publisherId: row.publisher_id as string,
    sourceTemplateId: (row.source_template_id as string) ?? null,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category: row.category as string,
    policyData: (row.policy_data as Record<string, unknown>) ?? {},
    resourceTypes: (row.resource_types as string[]) ?? [],
    frameworkTags: (row.framework_tags as string[]) ?? [],
    isPublished: row.is_published as boolean,
    installCount: (row.install_count as number) ?? 0,
    ratingAverage: row.rating_average !== null ? Number(row.rating_average) : null,
    ratingCount: (row.rating_count as number) ?? 0,
    version: (row.version as number) ?? 1,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapRating(row: Record<string, unknown>): MarketplaceRating {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    userId: row.user_id as string,
    rating: row.rating as number,
    review: (row.review as string) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function browseMarketplace(options?: {
  category?: string;
  framework?: string;
  search?: string;
  limit?: number;
}): Promise<MarketplaceTemplate[]> {
  let query = supabase
    .from('marketplace_templates')
    .select('*')
    .eq('is_published', true)
    .order('install_count', { ascending: false })
    .limit(options?.limit ?? 100);
  if (options?.category) query = query.eq('category', options.category);
  if (options?.framework) query = query.contains('framework_tags', [options.framework]);
  if (options?.search) {
    const s = `%${options.search}%`;
    query = query.or(`name.ilike.${s},description.ilike.${s}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to browse marketplace: ${error.message}`);
  return (data ?? []).map(mapTemplate);
}

/** All templates published BY the calling user (incl. unpublished). */
export async function getMyPublications(): Promise<MarketplaceTemplate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('marketplace_templates')
    .select('*')
    .eq('publisher_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Failed to load publications: ${error.message}`);
  return (data ?? []).map(mapTemplate);
}

export async function publishTemplate(input: {
  sourceTemplateId?: string;
  name: string;
  description?: string;
  category: string;
  policyData: Record<string, unknown>;
  resourceTypes?: string[];
  frameworkTags?: string[];
}): Promise<MarketplaceTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('marketplace_templates')
    .insert({
      publisher_id: user.id,
      source_template_id: input.sourceTemplateId ?? null,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      policy_data: input.policyData,
      resource_types: input.resourceTypes ?? [],
      framework_tags: input.frameworkTags ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to publish template: ${error.message}`);
  return mapTemplate(data);
}

export async function unpublishTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('marketplace_templates')
    .update({ is_published: false })
    .eq('id', id);
  if (error) throw new Error(`Failed to unpublish: ${error.message}`);
}

export async function deletePublication(id: string): Promise<void> {
  const { error } = await supabase.from('marketplace_templates').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete: ${error.message}`);
}

/** Atomic install — calls the SECURITY DEFINER rpc. Returns new policy_templates.id. */
export async function installTemplate(templateId: string): Promise<string> {
  const { data, error } = await supabase.rpc('install_marketplace_template', { p_template_id: templateId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getRatingsForTemplate(templateId: string): Promise<MarketplaceRating[]> {
  const { data, error } = await supabase
    .from('marketplace_template_ratings')
    .select('*')
    .eq('template_id', templateId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load ratings: ${error.message}`);
  return (data ?? []).map(mapRating);
}

export async function getMyRatingFor(templateId: string): Promise<MarketplaceRating | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('marketplace_template_ratings')
    .select('*')
    .eq('template_id', templateId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load rating: ${error.message}`);
  return data ? mapRating(data) : null;
}

export async function rateTemplate(input: {
  templateId: string;
  rating: number;
  review?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  // Upsert by (template_id, user_id) — uses the unique constraint on the table.
  const { error } = await supabase
    .from('marketplace_template_ratings')
    .upsert(
      {
        template_id: input.templateId,
        user_id: user.id,
        rating: input.rating,
        review: input.review ?? null,
      },
      { onConflict: 'template_id,user_id' }
    );
  if (error) throw new Error(`Failed to rate: ${error.message}`);
}
