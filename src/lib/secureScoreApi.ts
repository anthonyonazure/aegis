import { supabase } from '@/integrations/supabase/client';

export interface TenantSecureScore {
  id: string;
  tenantConnectionId: string;
  tenantName: string;
  customerId?: string;
  customerName?: string;
  currentScore: number;
  maxScore: number;
  scorePercentage: number;
  controlScores: ControlScore[];
  improvementActions: ImprovementAction[];
  updatedAt: Date;
}

export interface ControlScore {
  controlCategory: string;
  controlName: string;
  score: number;
  maxScore: number;
  description?: string;
}

export interface ImprovementAction {
  id: string;
  title: string;
  category: string;
  scoreImpact: number;
  implementationStatus: string;
  userImpact: string;
  implementationCost: string;
  threats: string[];
}

export interface ScoreHistory {
  id: string;
  tenantConnectionId: string;
  score: number;
  maxScore: number;
  recordedAt: Date;
}

export interface AggregatedScoreStats {
  averageScore: number;
  averagePercentage: number;
  totalTenants: number;
  tenantsAbove80: number;
  tenantsBetween50And80: number;
  tenantsBelow50: number;
  topImprovementActions: { action: string; count: number; avgImpact: number }[];
  categoryBreakdown: { category: string; avgScore: number; maxScore: number }[];
}

// Fetch all secure scores for the current user
export async function getSecureScores(): Promise<TenantSecureScore[]> {
  const { data: scores, error } = await supabase
    .from('tenant_secure_scores')
    .select(`
      *,
      tenant_connections!inner (
        id,
        tenant_id,
        tenant_name,
        display_name,
        customer_id,
        customers (
          id,
          name
        )
      )
    `)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching secure scores:', error);
    throw new Error('Failed to fetch secure scores');
  }

  return (scores || []).map((score: any) => ({
    id: score.id,
    tenantConnectionId: score.tenant_connection_id,
    tenantName: score.tenant_connections?.display_name || 
                score.tenant_connections?.tenant_name || 
                score.tenant_connections?.tenant_id || 'Unknown',
    customerId: score.tenant_connections?.customer_id,
    customerName: score.tenant_connections?.customers?.name,
    currentScore: parseFloat(score.current_score) || 0,
    maxScore: parseFloat(score.max_score) || 0,
    scorePercentage: parseFloat(score.score_percentage) || 0,
    controlScores: score.control_scores || [],
    improvementActions: score.improvement_actions || [],
    updatedAt: new Date(score.updated_at),
  }));
}

// Get score history for trend analysis
export async function getScoreHistory(
  tenantConnectionId?: string,
  days: number = 30
): Promise<ScoreHistory[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('secure_score_history')
    .select('*')
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (tenantConnectionId) {
    query = query.eq('tenant_connection_id', tenantConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching score history:', error);
    throw new Error('Failed to fetch score history');
  }

  return (data || []).map((h: any) => ({
    id: h.id,
    tenantConnectionId: h.tenant_connection_id,
    score: parseFloat(h.score) || 0,
    maxScore: parseFloat(h.max_score) || 0,
    recordedAt: new Date(h.recorded_at),
  }));
}

// Refresh scores from Microsoft Graph API
export async function refreshSecureScores(
  tenantConnectionIds?: string[]
): Promise<{ processed: number; failed: number; errors?: any[] }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  // Supabase function calls can occasionally hang due to network/runtime hiccups.
  // We add a client-side timeout so the UI never spins forever.
  const invokePromise = supabase.functions.invoke('fetch-secure-scores', {
    body: {
      tenantConnectionIds,
      refreshAll: !tenantConnectionIds || tenantConnectionIds.length === 0,
    },
  });

  const timeoutMs = 20000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Refresh request timed out. It may still be running; try again in a moment.'));
    }, timeoutMs);
  });

  const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

  if (error) {
    console.error('Error refreshing secure scores:', error);
    throw new Error('Failed to refresh secure scores');
  }

  return {
    processed: data?.processed || 0,
    failed: data?.failed || 0,
    errors: data?.errors,
  };
}

// Calculate aggregated statistics
export function calculateAggregatedStats(scores: TenantSecureScore[]): AggregatedScoreStats {
  if (scores.length === 0) {
    return {
      averageScore: 0,
      averagePercentage: 0,
      totalTenants: 0,
      tenantsAbove80: 0,
      tenantsBetween50And80: 0,
      tenantsBelow50: 0,
      topImprovementActions: [],
      categoryBreakdown: [],
    };
  }

  const totalScore = scores.reduce((sum, s) => sum + s.currentScore, 0);
  const totalPercentage = scores.reduce((sum, s) => sum + s.scorePercentage, 0);

  // Count by percentage thresholds
  const tenantsAbove80 = scores.filter(s => s.scorePercentage >= 80).length;
  const tenantsBetween50And80 = scores.filter(s => s.scorePercentage >= 50 && s.scorePercentage < 80).length;
  const tenantsBelow50 = scores.filter(s => s.scorePercentage < 50).length;

  // Aggregate improvement actions
  const actionCounts = new Map<string, { count: number; totalImpact: number }>();
  scores.forEach(s => {
    s.improvementActions.forEach(action => {
      const existing = actionCounts.get(action.title) || { count: 0, totalImpact: 0 };
      actionCounts.set(action.title, {
        count: existing.count + 1,
        totalImpact: existing.totalImpact + action.scoreImpact,
      });
    });
  });

  const topImprovementActions = Array.from(actionCounts.entries())
    .map(([action, data]) => ({
      action,
      count: data.count,
      avgImpact: data.totalImpact / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category breakdown
  const categoryScores = new Map<string, { total: number; max: number; count: number }>();
  scores.forEach(s => {
    s.controlScores.forEach(cs => {
      const existing = categoryScores.get(cs.controlCategory) || { total: 0, max: 0, count: 0 };
      categoryScores.set(cs.controlCategory, {
        total: existing.total + cs.score,
        max: existing.max + cs.maxScore,
        count: existing.count + 1,
      });
    });
  });

  const categoryBreakdown = Array.from(categoryScores.entries())
    .map(([category, data]) => ({
      category,
      avgScore: data.total / data.count,
      maxScore: data.max / data.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return {
    averageScore: totalScore / scores.length,
    averagePercentage: totalPercentage / scores.length,
    totalTenants: scores.length,
    tenantsAbove80,
    tenantsBetween50And80,
    tenantsBelow50,
    topImprovementActions,
    categoryBreakdown,
  };
}

// Delete a secure score record
export async function deleteSecureScore(id: string): Promise<void> {
  const { error } = await supabase
    .from('tenant_secure_scores')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting secure score:', error);
    throw new Error('Failed to delete secure score');
  }
}
