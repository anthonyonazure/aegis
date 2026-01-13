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
const IGNORED_FIELDS = [
  'id',
  '@odata.context',
  '@odata.type',
  '@odata.id',
  'createdDateTime',
  'modifiedDateTime',
  'lastModifiedDateTime',
  'createdBy',
  'lastModifiedBy',
  'version',
];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object).filter(k => !IGNORED_FIELDS.includes(k));
    const bKeys = Object.keys(b as object).filter(k => !IGNORED_FIELDS.includes(k));
    
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => 
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  
  return false;
}

function getChangedFields(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>
): Array<{ field: string; baselineValue: unknown; currentValue: unknown }> {
  const changes: Array<{ field: string; baselineValue: unknown; currentValue: unknown }> = [];
  
  const allKeys = new Set([
    ...Object.keys(baseline).filter(k => !IGNORED_FIELDS.includes(k)),
    ...Object.keys(current).filter(k => !IGNORED_FIELDS.includes(k)),
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

export function compareResources(
  baselineResources: Array<{ 
    resourceType: string; 
    resourceId?: string; 
    resourceName?: string;
    data: Record<string, unknown> 
  }>,
  currentResources: Array<{ 
    resourceType: string; 
    resourceId?: string; 
    resourceName?: string;
    data: Record<string, unknown> 
  }>
): DriftResult[] {
  const results: DriftResult[] = [];
  
  // Create maps for quick lookup
  const baselineMap = new Map<string, typeof baselineResources[0]>();
  const currentMap = new Map<string, typeof currentResources[0]>();
  
  for (const resource of baselineResources) {
    const key = resource.resourceId || 
                (resource.data.id as string) || 
                `${resource.resourceType}/${resource.resourceName}`;
    baselineMap.set(key, resource);
  }
  
  for (const resource of currentResources) {
    const key = resource.resourceId || 
                (resource.data.id as string) || 
                `${resource.resourceType}/${resource.resourceName}`;
    currentMap.set(key, resource);
  }
  
  // Check for modified and removed resources
  for (const [key, baseline] of baselineMap) {
    const current = currentMap.get(key);
    
    if (!current) {
      // Resource was removed
      results.push({
        resourceType: baseline.resourceType,
        resourceId: key,
        resourceName: baseline.resourceName || (baseline.data.displayName as string) || 'Unknown',
        status: 'removed',
      });
    } else {
      // Check if modified
      const changes = getChangedFields(baseline.data, current.data);
      
      if (changes.length > 0) {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName || (baseline.data.displayName as string) || 'Unknown',
          status: 'modified',
          changes,
        });
      } else {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName || (baseline.data.displayName as string) || 'Unknown',
          status: 'unchanged',
        });
      }
    }
  }
  
  // Check for added resources
  for (const [key, current] of currentMap) {
    if (!baselineMap.has(key)) {
      results.push({
        resourceType: current.resourceType,
        resourceId: key,
        resourceName: current.resourceName || (current.data.displayName as string) || 'Unknown',
        status: 'added',
      });
    }
  }
  
  return results;
}

export function compareExports(
  exportA: Array<{ resource_type: string; resource_id?: string; resource_name?: string; data: unknown }>,
  exportB: Array<{ resource_type: string; resource_id?: string; resource_name?: string; data: unknown }>
): DriftResult[] {
  const resourcesA = exportA.map(r => ({
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    data: r.data as Record<string, unknown>,
  }));
  
  const resourcesB = exportB.map(r => ({
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    data: r.data as Record<string, unknown>,
  }));
  
  return compareResources(resourcesA, resourcesB);
}
