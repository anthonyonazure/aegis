import { useState, useCallback } from 'react';
import { ALL_RESOURCE_CATEGORIES, ExportFormat } from '@/types/tenant';

export function useResourceSelection() {
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat['id'][]>(['json']);

  const handleResourceSelect = useCallback((resourceId: string) => {
    setSelectedResources(prev =>
      prev.includes(resourceId)
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  }, []);

  const handleSelectAll = useCallback((categoryId: string) => {
    const category = ALL_RESOURCE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    const supportedResources = category.subcategories
      .filter(sub => {
        if (sub.supported === false) return false;
        if (sub.supported === true) return true;
        return !!sub.graphEndpoint || !!sub.azureResourceType;
      })
      .map(sub => `${categoryId}/${sub.id}`);

    if (supportedResources.length === 0) return;

    const allSelected = supportedResources.every(r => selectedResources.includes(r));
    if (allSelected) {
      setSelectedResources(prev => prev.filter(r => !supportedResources.includes(r)));
    } else {
      setSelectedResources(prev => [...new Set([...prev, ...supportedResources])]);
    }
  }, [selectedResources]);

  const handleSelectAllResources = useCallback(() => {
    const allSupportedResources = ALL_RESOURCE_CATEGORIES.flatMap(category =>
      category.subcategories
        .filter(sub => {
          if (sub.supported === false) return false;
          if (sub.supported === true) return true;
          return !!sub.graphEndpoint || !!sub.azureResourceType;
        })
        .map(sub => `${category.id}/${sub.id}`)
    );

    const allSelected = allSupportedResources.every(r => selectedResources.includes(r));
    if (allSelected) {
      setSelectedResources([]);
    } else {
      setSelectedResources(allSupportedResources);
    }
  }, [selectedResources]);

  const handleFormatToggle = useCallback((format: ExportFormat['id']) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  }, []);

  return {
    selectedResources,
    setSelectedResources,
    selectedFormats,
    handleResourceSelect,
    handleSelectAll,
    handleSelectAllResources,
    handleFormatToggle,
  };
}
