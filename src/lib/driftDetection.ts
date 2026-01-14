// Drift detection utilities for comparing tenant state vs baseline

export interface DriftResult {
  resourceType: string;
  resourceId: string;
  resourceName: string;
  status: 'unchanged' | 'added' | 'removed' | 'modified';
  changes?: Array<{
    field: string;
    baselineValue: unknown;
    currentValue: unknown;
  }>;
}

// Fields to ignore when comparing resources (metadata, timestamps, etc.)
// Note: We keep 'id' for matching but exclude these volatile metadata fields
const IGNORED_FIELDS = new Set([
  '@odata.context',
  '@odata.type',
  '@odata.id',
  '@odata.count',
  '@odata.nextLink',
  'createdDateTime',
  'modifiedDateTime',
  'lastModifiedDateTime',
  'lastSyncDateTime',
  'lastSuccessfulSyncDateTime',
  'createdBy',
  'lastModifiedBy',
  'version',
  'roleScopeTagIds', // Often changes without meaningful impact
]);

// Fields that indicate volatile state but not configuration drift
const VOLATILE_FIELDS = new Set([
  'lastSignInDateTime',
  'signInSessionsValidFromDateTime',
  'refreshTokensValidFromDateTime',
  'lastPasswordChangeDateTime',
  'onPremisesLastSyncDateTime',
  'deviceLastSeenDateTime',
  'approximateLastSignInDateTime',
]);

function shouldIgnoreField(key: string): boolean {
  if (IGNORED_FIELDS.has(key)) return true;
  if (VOLATILE_FIELDS.has(key)) return true;
  if (key.startsWith('@odata')) return true;
  return false;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    // Sort arrays by their JSON representation for consistent comparison
    return value.map(normalizeValue).sort((a, b) => 
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
  }
  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!shouldIgnoreField(k)) {
        normalized[k] = normalizeValue(v);
      }
    }
    return normalized;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);
  return JSON.stringify(normA) === JSON.stringify(normB);
}

function getChangedFields(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>
): Array<{ field: string; baselineValue: unknown; currentValue: unknown }> {
  const changes: Array<{ field: string; baselineValue: unknown; currentValue: unknown }> = [];
  
  const allKeys = new Set([
    ...Object.keys(baseline).filter(k => !shouldIgnoreField(k)),
    ...Object.keys(current).filter(k => !shouldIgnoreField(k)),
  ]);
  
  for (const key of allKeys) {
    const baselineValue = baseline[key];
    const currentValue = current[key];
    
    if (!deepEqual(baselineValue, currentValue)) {
      changes.push({
        field: key,
        baselineValue,
        currentValue,
      });
    }
  }
  
  return changes;
}

// Extract a unique identifier from resource data
function extractResourceKey(resource: { 
  resourceType: string; 
  resourceId?: string | null; 
  resourceName?: string | null;
  data: Record<string, unknown>;
  category?: string;
}): string {
  // First try explicit resource_id from database
  if (resource.resourceId) {
    return `${resource.resourceType}::${resource.resourceId}`;
  }
  
  // Then try common ID fields in the data
  const data = resource.data;
  
  // Handle array data - get IDs from first few items to create a composite key
  if (Array.isArray(data)) {
    const ids = data.slice(0, 3).map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return obj.id || obj.objectId || obj.policyId || obj.displayName || 'unknown';
      }
      return 'unknown';
    });
    return `${resource.resourceType}::array::${ids.join(',')}::len${data.length}`;
  }
  
  // Standard ID fields
  const idFields = ['id', 'objectId', 'policyId', 'templateId', 'configurationId'];
  for (const field of idFields) {
    if (data[field]) {
      return `${resource.resourceType}::${data[field]}`;
    }
  }
  
  // Fall back to name-based key
  const nameFields = ['displayName', 'name', 'title', 'userPrincipalName'];
  for (const field of nameFields) {
    if (data[field]) {
      return `${resource.resourceType}::name::${data[field]}`;
    }
  }
  
  // Last resort: use resource name from export
  if (resource.resourceName) {
    return `${resource.resourceType}::${resource.resourceName}`;
  }
  
  // Really last resort: hash of data
  return `${resource.resourceType}::hash::${JSON.stringify(data).slice(0, 100)}`;
}

// Flatten array data into individual resources for comparison
function flattenResourceData(resource: {
  resourceType: string;
  resourceId?: string | null;
  resourceName?: string | null;
  data: Record<string, unknown>;
  category?: string;
}): Array<{
  resourceType: string;
  resourceId: string;
  resourceName: string;
  data: Record<string, unknown>;
  isArrayItem: boolean;
  arrayIndex?: number;
}> {
  const data = resource.data;
  
  // If data is an array, flatten it into individual items
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      let itemData: Record<string, unknown>;
      if (typeof item === 'object' && item !== null) {
        itemData = item as Record<string, unknown>;
      } else {
        itemData = { value: item };
      }
      
      const itemId = (itemData.id || itemData.objectId || itemData.policyId || `index-${index}`) as string;
      const itemName = (itemData.displayName || itemData.name || itemData.title || `Item ${index + 1}`) as string;
      
      return {
        resourceType: resource.resourceType,
        resourceId: `${resource.resourceType}::${itemId}`,
        resourceName: itemName,
        data: itemData,
        isArrayItem: true,
        arrayIndex: index,
      };
    });
  }
  
  // Handle OData value wrapper
  if (data.value && Array.isArray(data.value)) {
    return (data.value as Array<Record<string, unknown>>).map((item, index) => {
      const itemId = (item.id || item.objectId || item.policyId || `index-${index}`) as string;
      const itemName = (item.displayName || item.name || item.title || `Item ${index + 1}`) as string;
      
      return {
        resourceType: resource.resourceType,
        resourceId: `${resource.resourceType}::${itemId}`,
        resourceName: itemName,
        data: item,
        isArrayItem: true,
        arrayIndex: index,
      };
    });
  }
  
  // Single resource - keep as is
  const resourceId = extractResourceKey(resource);
  const dataRecord = data as Record<string, unknown>;
  const resourceName = (dataRecord.displayName || dataRecord.name || dataRecord.title || resource.resourceName || resource.resourceType) as string;
  
  return [{
    resourceType: resource.resourceType,
    resourceId,
    resourceName,
    data,
    isArrayItem: false,
  }];
}

export function compareResources(
  baselineResources: Array<{ 
    resourceType: string; 
    resourceId?: string | null; 
    resourceName?: string | null;
    data: Record<string, unknown>;
    category?: string;
  }>,
  currentResources: Array<{ 
    resourceType: string; 
    resourceId?: string | null; 
    resourceName?: string | null;
    data: Record<string, unknown>;
    category?: string;
  }>
): DriftResult[] {
  const results: DriftResult[] = [];
  
  // Flatten all resources (handle arrays)
  const flatBaseline = baselineResources.flatMap(flattenResourceData);
  const flatCurrent = currentResources.flatMap(flattenResourceData);
  
  console.log(`[DriftDetection] Comparing ${flatBaseline.length} baseline items vs ${flatCurrent.length} current items`);
  
  // Create maps for quick lookup - use composite keys for better matching
  const baselineById = new Map<string, typeof flatBaseline[0]>();
  const currentById = new Map<string, typeof flatCurrent[0]>();
  
  // Also create maps by type+name for fallback matching
  const baselineByTypeName = new Map<string, typeof flatBaseline[0]>();
  const currentByTypeName = new Map<string, typeof flatCurrent[0]>();
  
  // And by just the inner ID (without resource type prefix) for cross-matching
  const baselineByInnerId = new Map<string, typeof flatBaseline[0]>();
  const currentByInnerId = new Map<string, typeof flatCurrent[0]>();
  
  for (const resource of flatBaseline) {
    baselineById.set(resource.resourceId, resource);
    const typeNameKey = `${resource.resourceType}::${resource.resourceName}`;
    baselineByTypeName.set(typeNameKey, resource);
    
    // Extract inner ID for fallback matching
    const innerIdMatch = resource.resourceId.match(/::([^:]+)$/);
    if (innerIdMatch) {
      baselineByInnerId.set(innerIdMatch[1], resource);
    }
  }
  
  for (const resource of flatCurrent) {
    currentById.set(resource.resourceId, resource);
    const typeNameKey = `${resource.resourceType}::${resource.resourceName}`;
    currentByTypeName.set(typeNameKey, resource);
    
    // Extract inner ID for fallback matching
    const innerIdMatch = resource.resourceId.match(/::([^:]+)$/);
    if (innerIdMatch) {
      currentByInnerId.set(innerIdMatch[1], resource);
    }
  }
  
  const matchedCurrentIds = new Set<string>();
  const matchedBaselineIds = new Set<string>();
  
  // Check for modified and removed resources from baseline
  for (const [key, baseline] of baselineById) {
    if (matchedBaselineIds.has(key)) continue;
    
    // Try to find matching current resource using multiple strategies
    let current: typeof flatCurrent[0] | undefined;
    let matchMethod = '';
    
    // Strategy 1: Exact ID match
    current = currentById.get(key);
    if (current) matchMethod = 'exact-id';
    
    // Strategy 2: Type + Name match
    if (!current) {
      const typeNameKey = `${baseline.resourceType}::${baseline.resourceName}`;
      current = currentByTypeName.get(typeNameKey);
      if (current) matchMethod = 'type-name';
    }
    
    // Strategy 3: Inner ID match (for cases where resource type differs slightly)
    if (!current) {
      const innerIdMatch = key.match(/::([^:]+)$/);
      if (innerIdMatch && innerIdMatch[1] !== 'unknown' && !innerIdMatch[1].startsWith('index-')) {
        current = currentByInnerId.get(innerIdMatch[1]);
        if (current) matchMethod = 'inner-id';
      }
    }
    
    if (!current || matchedCurrentIds.has(current.resourceId)) {
      // Resource was removed
      results.push({
        resourceType: baseline.resourceType,
        resourceId: key,
        resourceName: baseline.resourceName,
        status: 'removed',
      });
      console.log(`[DriftDetection] REMOVED: ${baseline.resourceName} (${baseline.resourceType})`);
    } else {
      matchedCurrentIds.add(current.resourceId);
      matchedBaselineIds.add(key);
      
      // Check if modified
      const changes = getChangedFields(baseline.data, current.data);
      
      if (changes.length > 0) {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName,
          status: 'modified',
          changes,
        });
        console.log(`[DriftDetection] MODIFIED (${matchMethod}): ${baseline.resourceName} - ${changes.length} changes: ${changes.map(c => c.field).join(', ')}`);
      } else {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName,
          status: 'unchanged',
        });
      }
    }
  }
  
  // Check for added resources (in current but not in baseline)
  for (const [key, current] of currentById) {
    if (matchedCurrentIds.has(key)) continue;
    
    // Double-check this wasn't matched by name
    const typeNameKey = `${current.resourceType}::${current.resourceName}`;
    if (baselineByTypeName.has(typeNameKey)) {
      const baseline = baselineByTypeName.get(typeNameKey)!;
      if (!matchedBaselineIds.has(baseline.resourceId)) {
        // This is actually a match we missed - compare them
        matchedBaselineIds.add(baseline.resourceId);
        matchedCurrentIds.add(key);
        
        const changes = getChangedFields(baseline.data, current.data);
        if (changes.length > 0) {
          results.push({
            resourceType: current.resourceType,
            resourceId: key,
            resourceName: current.resourceName,
            status: 'modified',
            changes,
          });
          console.log(`[DriftDetection] MODIFIED (late-match): ${current.resourceName} - ${changes.length} changes`);
        } else {
          results.push({
            resourceType: current.resourceType,
            resourceId: key,
            resourceName: current.resourceName,
            status: 'unchanged',
          });
        }
        continue;
      }
    }
    
    results.push({
      resourceType: current.resourceType,
      resourceId: key,
      resourceName: current.resourceName,
      status: 'added',
    });
    console.log(`[DriftDetection] ADDED: ${current.resourceName} (${current.resourceType})`);
  }
  
  // Sort results: modified/added/removed first, then unchanged
  results.sort((a, b) => {
    const priority = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    return (priority[a.status] || 4) - (priority[b.status] || 4);
  });
  
  const summary = {
    total: results.length,
    modified: results.filter(r => r.status === 'modified').length,
    added: results.filter(r => r.status === 'added').length,
    removed: results.filter(r => r.status === 'removed').length,
    unchanged: results.filter(r => r.status === 'unchanged').length,
  };
  console.log(`[DriftDetection] Summary:`, summary);
  
  return results;
}

export function compareExports(
  exportA: Array<{ resource_type: string; resource_id?: string | null; resource_name?: string | null; category: string; data: unknown }>,
  exportB: Array<{ resource_type: string; resource_id?: string | null; resource_name?: string | null; category: string; data: unknown }>
): DriftResult[] {
  const resourcesA = exportA.map(r => ({
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    category: r.category,
    data: r.data as Record<string, unknown>,
  }));
  
  const resourcesB = exportB.map(r => ({
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    category: r.category,
    data: r.data as Record<string, unknown>,
  }));
  
  return compareResources(resourcesA, resourcesB);
}

// Helper to get a summary of changes
export function getDriftSummary(results: DriftResult[]): {
  total: number;
  unchanged: number;
  added: number;
  removed: number;
  modified: number;
  hasDrift: boolean;
} {
  const unchanged = results.filter(r => r.status === 'unchanged').length;
  const added = results.filter(r => r.status === 'added').length;
  const removed = results.filter(r => r.status === 'removed').length;
  const modified = results.filter(r => r.status === 'modified').length;
  
  return {
    total: results.length,
    unchanged,
    added,
    removed,
    modified,
    hasDrift: added > 0 || removed > 0 || modified > 0,
  };
}
