import { ALL_RESOURCE_CATEGORIES } from '@/types/tenant';

function getSubcategory(categoryId: string, subId: string) {
  const category = ALL_RESOURCE_CATEGORIES.find((c) => c.id === categoryId);
  return category?.subcategories.find((s) => s.id === subId);
}

export function isSupportedResourceId(resourceId: string): boolean {
  const [categoryId, subId] = resourceId.split('/');
  if (!categoryId || !subId) return false;

  const sub = getSubcategory(categoryId, subId);
  if (!sub) return false;

  // Explicit supported flag takes priority
  if (sub.supported === false) return false;
  if (sub.supported === true) return true;

  // Default rule: Graph-backed, Azure ARM-backed, or EXO-backed resources are supported
  return !!sub.graphEndpoint || !!sub.azureResourceType || !!sub.exoEndpoint;
}

export function filterSupportedResourceIds(resourceIds: string[]) {
  const supported: string[] = [];
  const unsupported: string[] = [];

  for (const id of resourceIds) {
    if (isSupportedResourceId(id)) supported.push(id);
    else unsupported.push(id);
  }

  return {
    supported: [...new Set(supported)],
    unsupported: [...new Set(unsupported)],
  };
}
