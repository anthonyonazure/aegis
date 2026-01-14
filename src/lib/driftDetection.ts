// Drift detection utilities for comparing tenant state vs baseline

export type ResourceProvider = 'graph' | 'azure' | 'all';

export interface DriftResult {
  resourceType: string;
  resourceId: string;
  resourceName: string;
  status: 'unchanged' | 'added' | 'removed' | 'modified';
  provider?: ResourceProvider;
  subscriptionId?: string;
  azureResourceType?: string;
  changes?: Array<{
    field: string;
    baselineValue: unknown;
    currentValue: unknown;
  }>;
}

// Fields to ignore when comparing Microsoft Graph resources (metadata, timestamps, etc.)
const GRAPH_IGNORED_FIELDS = new Set([
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
  'roleScopeTagIds',
]);

// Fields to ignore when comparing Azure ARM resources
const AZURE_IGNORED_FIELDS = new Set([
  'etag',
  'systemData',
  'provisioningState',
  'resourceGuid',
  'uniqueId',
  'createdTime',
  'changedTime',
  'lastModifiedTime',
  'createdBy',
  'createdByType',
  'lastModifiedBy',
  'lastModifiedByType',
  'state', // Runtime state, not configuration
  'status', // Runtime status
  'instanceView', // VM runtime state
  'powerState', // VM power state
  'statuses', // Array of runtime statuses
  'vmId', // Generated VM identifier
  'diskSizeBytes', // Can vary slightly
  'timeCreated',
  'privateIpAddressVersion',
  'primary', // Network interface primary status
]);

// Azure properties that represent runtime metrics, not config
const AZURE_VOLATILE_FIELDS = new Set([
  'numberOfCores',
  'osDiskSizeInMB',
  'resourceDiskSizeInMB',
  'memoryInMB',
  'maxDataDiskCount',
  'diskIOPSReadWrite',
  'diskMBpsReadWrite',
  'diskState',
  'timeCreated',
  'freeOfferExpirationTime',
  'currentThroughput',
  'usageState',
  'availabilityState',
  'hostNames',
  'enabledHostNames',
  'outboundIpAddresses',
  'possibleOutboundIpAddresses',
  'privateIPAddress',
  'publicIPAddress',
  'ipAddress',
  'lastOperationResult',
  'maxCpuUsedCores',
  'maxMemoryUsedMB',
]);

// Fields that indicate volatile state but not configuration drift (Graph)
const GRAPH_VOLATILE_FIELDS = new Set([
  'lastSignInDateTime',
  'signInSessionsValidFromDateTime',
  'refreshTokensValidFromDateTime',
  'lastPasswordChangeDateTime',
  'onPremisesLastSyncDateTime',
  'deviceLastSeenDateTime',
  'approximateLastSignInDateTime',
]);

// Detect if a resource is from Azure ARM based on its type/data
function isAzureResource(resourceType: string, data: Record<string, unknown>): boolean {
  // Azure resources typically have these patterns
  if (resourceType.startsWith('azure-') || resourceType.startsWith('Microsoft.')) return true;
  if (data.type && typeof data.type === 'string' && data.type.includes('Microsoft.')) return true;
  if (data.subscriptionId || data.resourceGroup) return true;
  return false;
}

function shouldIgnoreField(key: string, isAzure: boolean = false): boolean {
  if (isAzure) {
    if (AZURE_IGNORED_FIELDS.has(key)) return true;
    if (AZURE_VOLATILE_FIELDS.has(key)) return true;
    // Azure-specific patterns
    if (key.startsWith('x-ms-')) return true;
    if (key.endsWith('State') && key !== 'desiredState') return true;
  } else {
    if (GRAPH_IGNORED_FIELDS.has(key)) return true;
    if (GRAPH_VOLATILE_FIELDS.has(key)) return true;
    if (key.startsWith('@odata')) return true;
  }
  return false;
}

function normalizeValue(value: unknown, isAzure: boolean = false): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    // Sort arrays by their JSON representation for consistent comparison
    return value.map(v => normalizeValue(v, isAzure)).sort((a, b) => 
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
  }
  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!shouldIgnoreField(k, isAzure)) {
        normalized[k] = normalizeValue(v, isAzure);
      }
    }
    return normalized;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown, isAzure: boolean = false): boolean {
  const normA = normalizeValue(a, isAzure);
  const normB = normalizeValue(b, isAzure);
  return JSON.stringify(normA) === JSON.stringify(normB);
}

function getChangedFields(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  isAzure: boolean = false
): Array<{ field: string; baselineValue: unknown; currentValue: unknown }> {
  const changes: Array<{ field: string; baselineValue: unknown; currentValue: unknown }> = [];
  
  const allKeys = new Set([
    ...Object.keys(baseline).filter(k => !shouldIgnoreField(k, isAzure)),
    ...Object.keys(current).filter(k => !shouldIgnoreField(k, isAzure)),
  ]);
  
  for (const key of allKeys) {
    const baselineValue = baseline[key];
    const currentValue = current[key];
    
    if (!deepEqual(baselineValue, currentValue, isAzure)) {
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
  const isAzure = isAzureResource(resource.resourceType, data);
  
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
  
  // Azure-specific ID extraction
  if (isAzure) {
    // Azure resources use ARM resource ID format: /subscriptions/.../resourceGroups/.../providers/...
    if (data.id && typeof data.id === 'string' && data.id.startsWith('/subscriptions/')) {
      return `azure::${data.id}`;
    }
    // Try resourceId field
    if (data.resourceId && typeof data.resourceId === 'string') {
      return `azure::${data.resourceId}`;
    }
  }
  
  // Standard ID fields (Graph API resources)
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
  isAzure: boolean;
  subscriptionId?: string;
  azureResourceType?: string;
}> {
  const data = resource.data;
  const isAzure = isAzureResource(resource.resourceType, data);
  
  // Extract Azure-specific metadata
  let subscriptionId: string | undefined;
  let azureResourceType: string | undefined;
  
  if (isAzure && !Array.isArray(data)) {
    // Extract subscription ID from ARM resource ID
    const armId = (data.id || data.resourceId) as string | undefined;
    if (armId && typeof armId === 'string') {
      const subMatch = armId.match(/\/subscriptions\/([^/]+)/);
      if (subMatch) subscriptionId = subMatch[1];
    }
    azureResourceType = data.type as string | undefined;
  }
  
  // If data is an array, flatten it into individual items
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      let itemData: Record<string, unknown>;
      if (typeof item === 'object' && item !== null) {
        itemData = item as Record<string, unknown>;
      } else {
        itemData = { value: item };
      }
      
      const itemIsAzure = isAzureResource(resource.resourceType, itemData);
      const itemId = (itemData.id || itemData.objectId || itemData.policyId || `index-${index}`) as string;
      const itemName = (itemData.displayName || itemData.name || itemData.title || `Item ${index + 1}`) as string;
      
      return {
        resourceType: resource.resourceType,
        resourceId: `${resource.resourceType}::${itemId}`,
        resourceName: itemName,
        data: itemData,
        isArrayItem: true,
        arrayIndex: index,
        isAzure: itemIsAzure,
        subscriptionId,
        azureResourceType: itemData.type as string | undefined,
      };
    });
  }
  
  // Handle OData value wrapper
  if (data.value && Array.isArray(data.value)) {
    return (data.value as Array<Record<string, unknown>>).map((item, index) => {
      const itemIsAzure = isAzureResource(resource.resourceType, item);
      const itemId = (item.id || item.objectId || item.policyId || `index-${index}`) as string;
      const itemName = (item.displayName || item.name || item.title || `Item ${index + 1}`) as string;
      
      return {
        resourceType: resource.resourceType,
        resourceId: `${resource.resourceType}::${itemId}`,
        resourceName: itemName,
        data: item,
        isArrayItem: true,
        arrayIndex: index,
        isAzure: itemIsAzure,
        subscriptionId,
        azureResourceType: item.type as string | undefined,
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
    isAzure,
    subscriptionId,
    azureResourceType,
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
  type FlatItem = (typeof flatBaseline)[number];
  type MultiMap = Map<string, FlatItem[]>;

  const addToMultiMap = (map: MultiMap, key: string, value: FlatItem) => {
    const existing = map.get(key);
    if (existing) existing.push(value);
    else map.set(key, [value]);
  };

  const getFirstUnmatched = (list: FlatItem[] | undefined, matched: Set<string>) =>
    list?.find(item => !matched.has(item.resourceId));

  const baselineById = new Map<string, FlatItem>();
  const currentById = new Map<string, FlatItem>();

  // NOTE: These are multi-maps because some resources can share the same name
  // (e.g., "Email" or "Device restrictions" baselines), and IDs may vary between exports.
  const baselineByTypeName: MultiMap = new Map();
  const currentByTypeName: MultiMap = new Map();

  const baselineByInnerId: MultiMap = new Map();
  const currentByInnerId: MultiMap = new Map();

  const baselineByName: MultiMap = new Map();
  const currentByName: MultiMap = new Map();

  const baselineByDataId: MultiMap = new Map();
  const currentByDataId: MultiMap = new Map();

  for (const resource of flatBaseline) {
    baselineById.set(resource.resourceId, resource);

    const typeNameKey = `${resource.resourceType}::${resource.resourceName}`;
    addToMultiMap(baselineByTypeName, typeNameKey, resource);

    // Name-only matching (case-insensitive, trimmed)
    const nameKey = resource.resourceName.toLowerCase().trim();
    addToMultiMap(baselineByName, nameKey, resource);

    // Extract inner ID for fallback matching
    const innerIdMatch = resource.resourceId.match(/::([^:]+)$/);
    if (innerIdMatch) {
      addToMultiMap(baselineByInnerId, innerIdMatch[1], resource);
    }

    // Extract actual ID from data
    const dataId = resource.data.id || resource.data.objectId || resource.data.policyId;
    if (dataId && typeof dataId === 'string') {
      addToMultiMap(baselineByDataId, dataId, resource);
    }
  }

  for (const resource of flatCurrent) {
    currentById.set(resource.resourceId, resource);

    const typeNameKey = `${resource.resourceType}::${resource.resourceName}`;
    addToMultiMap(currentByTypeName, typeNameKey, resource);

    // Name-only matching (case-insensitive, trimmed)
    const nameKey = resource.resourceName.toLowerCase().trim();
    addToMultiMap(currentByName, nameKey, resource);

    // Extract inner ID for fallback matching
    const innerIdMatch = resource.resourceId.match(/::([^:]+)$/);
    if (innerIdMatch) {
      addToMultiMap(currentByInnerId, innerIdMatch[1], resource);
    }

    // Extract actual ID from data
    const dataId = resource.data.id || resource.data.objectId || resource.data.policyId;
    if (dataId && typeof dataId === 'string') {
      addToMultiMap(currentByDataId, dataId, resource);
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
    if (current && !matchedCurrentIds.has(current.resourceId)) matchMethod = 'exact-id';
    else current = undefined;
    
    // Strategy 2: Type + Name match
    if (!current) {
      const typeNameKey = `${baseline.resourceType}::${baseline.resourceName}`;
      current = getFirstUnmatched(currentByTypeName.get(typeNameKey), matchedCurrentIds);
      if (current) matchMethod = 'type-name';
    }

    // Strategy 3: Inner ID match (for cases where resource type differs slightly)
    if (!current) {
      const innerIdMatch = key.match(/::([^:]+)$/);
      if (innerIdMatch && innerIdMatch[1] !== 'unknown' && !innerIdMatch[1].startsWith('index-')) {
        current = getFirstUnmatched(currentByInnerId.get(innerIdMatch[1]), matchedCurrentIds);
        if (current) matchMethod = 'inner-id';
      }
    }

    // Strategy 4: Match by actual data ID field
    if (!current) {
      const dataId = baseline.data.id || baseline.data.objectId || baseline.data.policyId;
      if (dataId && typeof dataId === 'string') {
        current = getFirstUnmatched(currentByDataId.get(dataId), matchedCurrentIds);
        if (current) matchMethod = 'data-id';
      }
    }

    // Strategy 5: Name-only match (case-insensitive) - last resort
    if (!current) {
      const nameKey = baseline.resourceName.toLowerCase().trim();
      current = getFirstUnmatched(currentByName.get(nameKey), matchedCurrentIds);
      if (current) matchMethod = 'name-only';
    }
    
    if (!current) {
      // Resource was removed - log why matching failed for debugging
      console.log(`[DriftDetection] REMOVED: ${baseline.resourceName} (${baseline.resourceType}) - no match found. Baseline ID: ${key}`);
      results.push({
        resourceType: baseline.resourceType,
        resourceId: key,
        resourceName: baseline.resourceName,
        status: 'removed',
        provider: baseline.isAzure ? 'azure' : 'graph',
        subscriptionId: baseline.subscriptionId,
        azureResourceType: baseline.azureResourceType,
      });
    } else {
      matchedCurrentIds.add(current.resourceId);
      matchedBaselineIds.add(key);
      
      // Check if modified - use Azure-aware comparison
      const changes = getChangedFields(baseline.data, current.data, baseline.isAzure);
      
      if (changes.length > 0) {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName,
          status: 'modified',
          changes,
          provider: baseline.isAzure ? 'azure' : 'graph',
          subscriptionId: baseline.subscriptionId,
          azureResourceType: baseline.azureResourceType,
        });
        console.log(`[DriftDetection] MODIFIED (${matchMethod}): ${baseline.resourceName} - ${changes.length} changes: ${changes.map(c => c.field).join(', ')}`);
      } else {
        results.push({
          resourceType: baseline.resourceType,
          resourceId: key,
          resourceName: baseline.resourceName,
          status: 'unchanged',
          provider: baseline.isAzure ? 'azure' : 'graph',
          subscriptionId: baseline.subscriptionId,
          azureResourceType: baseline.azureResourceType,
        });
      }
    }
  }
  
  // Check for added resources (in current but not in baseline)
  for (const [key, current] of currentById) {
    if (matchedCurrentIds.has(key)) continue;
    
    // Try multiple fallback strategies before declaring as added
    let baseline: typeof flatBaseline[0] | undefined;
    let matchMethod = '';
    
    // Fallback 1: Type + Name
    const typeNameKey = `${current.resourceType}::${current.resourceName}`;
    baseline = getFirstUnmatched(baselineByTypeName.get(typeNameKey), matchedBaselineIds);
    if (baseline) {
      matchMethod = 'type-name';
    }

    // Fallback 2: Name only
    if (!baseline) {
      const nameKey = current.resourceName.toLowerCase().trim();
      baseline = getFirstUnmatched(baselineByName.get(nameKey), matchedBaselineIds);
      if (baseline) {
        matchMethod = 'name-only';
      }
    }

    // Fallback 3: Data ID
    if (!baseline) {
      const dataId = current.data.id || current.data.objectId || current.data.policyId;
      if (dataId && typeof dataId === 'string') {
        baseline = getFirstUnmatched(baselineByDataId.get(dataId), matchedBaselineIds);
        if (baseline) {
          matchMethod = 'data-id';
        }
      }
    }
    
    if (baseline) {
      // This is actually a match we missed - compare them
      matchedBaselineIds.add(baseline.resourceId);
      matchedCurrentIds.add(key);
      
      const changes = getChangedFields(baseline.data, current.data, current.isAzure);
      if (changes.length > 0) {
        results.push({
          resourceType: current.resourceType,
          resourceId: key,
          resourceName: current.resourceName,
          status: 'modified',
          changes,
          provider: current.isAzure ? 'azure' : 'graph',
          subscriptionId: current.subscriptionId,
          azureResourceType: current.azureResourceType,
        });
        console.log(`[DriftDetection] MODIFIED (late-match ${matchMethod}): ${current.resourceName} - ${changes.length} changes`);
      } else {
        results.push({
          resourceType: current.resourceType,
          resourceId: key,
          resourceName: current.resourceName,
          status: 'unchanged',
          provider: current.isAzure ? 'azure' : 'graph',
          subscriptionId: current.subscriptionId,
          azureResourceType: current.azureResourceType,
        });
      }
    } else {
      // Truly a new resource
      results.push({
        resourceType: current.resourceType,
        resourceId: key,
        resourceName: current.resourceName,
        status: 'added',
        provider: current.isAzure ? 'azure' : 'graph',
        subscriptionId: current.subscriptionId,
        azureResourceType: current.azureResourceType,
      });
      console.log(`[DriftDetection] ADDED: ${current.resourceName} (${current.resourceType})`);
    }
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
  azureCount: number;
  graphCount: number;
} {
  const unchanged = results.filter(r => r.status === 'unchanged').length;
  const added = results.filter(r => r.status === 'added').length;
  const removed = results.filter(r => r.status === 'removed').length;
  const modified = results.filter(r => r.status === 'modified').length;
  const azureCount = results.filter(r => r.provider === 'azure').length;
  const graphCount = results.filter(r => r.provider === 'graph').length;
  
  return {
    total: results.length,
    unchanged,
    added,
    removed,
    modified,
    hasDrift: added > 0 || removed > 0 || modified > 0,
    azureCount,
    graphCount,
  };
}

// Filter results by provider
export function filterResultsByProvider(
  results: DriftResult[], 
  provider: ResourceProvider
): DriftResult[] {
  if (provider === 'all') return results;
  return results.filter(r => r.provider === provider);
}

// Get Azure-specific drift summary
export function getAzureDriftSummary(results: DriftResult[]): {
  bySubscription: Map<string, { added: number; removed: number; modified: number; unchanged: number }>;
  byResourceType: Map<string, { added: number; removed: number; modified: number; unchanged: number }>;
} {
  const azureResults = results.filter(r => r.provider === 'azure');
  
  const bySubscription = new Map<string, { added: number; removed: number; modified: number; unchanged: number }>();
  const byResourceType = new Map<string, { added: number; removed: number; modified: number; unchanged: number }>();
  
  for (const result of azureResults) {
    const subId = result.subscriptionId || 'unknown';
    const resourceType = result.azureResourceType || result.resourceType;
    
    // Update subscription summary
    if (!bySubscription.has(subId)) {
      bySubscription.set(subId, { added: 0, removed: 0, modified: 0, unchanged: 0 });
    }
    const subSummary = bySubscription.get(subId)!;
    subSummary[result.status]++;
    
    // Update resource type summary
    if (!byResourceType.has(resourceType)) {
      byResourceType.set(resourceType, { added: 0, removed: 0, modified: 0, unchanged: 0 });
    }
    const typeSummary = byResourceType.get(resourceType)!;
    typeSummary[result.status]++;
  }
  
  return { bySubscription, byResourceType };
}
