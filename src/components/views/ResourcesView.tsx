import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Search,
  Filter,
  Layers,
  ArrowRight,
  X,
  Plus,
  Trash2,
  Save,
  Cloud,
  Server
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RESOURCE_CATEGORIES, AZURE_RESOURCE_CATEGORIES, ALL_RESOURCE_CATEGORIES, ResourceCategory } from '@/types/tenant';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Pre-defined templates for quick resource selection
const RESOURCE_TEMPLATES = [
  {
    id: 'all-intune',
    name: 'All Intune Policies',
    description: 'Device configs, compliance, apps',
    categoryIds: ['intune'],
    isBuiltIn: true,
    provider: 'graph' as const,
  },
  {
    id: 'security-baseline',
    name: 'Security Baseline',
    description: 'CA policies, compliance, security configs',
    categoryIds: ['conditional-access', 'intune'],
    subcategoryFilter: (catId: string, subId: string) => 
      catId === 'conditional-access' || 
      subId.includes('compliance') || 
      subId.includes('security'),
    isBuiltIn: true,
    provider: 'graph' as const,
  },
  {
    id: 'identity-access',
    name: 'Identity & Access',
    description: 'Users, groups, CA policies, roles',
    categoryIds: ['entra-id', 'conditional-access'],
    isBuiltIn: true,
    provider: 'graph' as const,
  },
  {
    id: 'device-management',
    name: 'Device Management',
    description: 'All device-related configurations',
    categoryIds: ['intune', 'autopilot'],
    isBuiltIn: true,
    provider: 'graph' as const,
  },
  {
    id: 'apps-only',
    name: 'Applications Only',
    description: 'App configs and assignments',
    categoryIds: ['intune'],
    subcategoryFilter: (catId: string, subId: string) => 
      subId.includes('app') || subId.includes('script'),
    isBuiltIn: true,
    provider: 'graph' as const,
  },
  // Azure Templates
  {
    id: 'azure-infrastructure',
    name: 'Azure Infrastructure',
    description: 'VMs, networks, storage, compute',
    categoryIds: ['azure-compute', 'azure-networking', 'azure-storage'],
    isBuiltIn: true,
    provider: 'azure' as const,
  },
  {
    id: 'azure-security',
    name: 'Azure Security',
    description: 'Key Vaults, identities, policies, RBAC',
    categoryIds: ['azure-identity'],
    isBuiltIn: true,
    provider: 'azure' as const,
  },
  {
    id: 'azure-paas',
    name: 'Azure PaaS',
    description: 'App Services, databases, containers',
    categoryIds: ['azure-paas'],
    isBuiltIn: true,
    provider: 'azure' as const,
  },
  {
    id: 'azure-all',
    name: 'All Azure Resources',
    description: 'Complete Azure infrastructure export',
    categoryIds: ['azure-compute', 'azure-networking', 'azure-storage', 'azure-identity', 'azure-paas', 'azure-monitoring'],
    isBuiltIn: true,
    provider: 'azure' as const,
  },
];

interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  resource_ids: string[];
}

interface ResourcesViewProps {
  selectedResources: string[];
  onResourceSelect: (resourceId: string) => void;
  onSelectAll: (categoryId: string) => void;
  onSelectAllResources?: () => void;
  onNavigateToExport?: () => void;
  onSetResources?: (resources: string[]) => void;
}

export const ResourcesView = ({ 
  selectedResources, 
  onResourceSelect, 
  onSelectAll,
  onSelectAllResources,
  onNavigateToExport,
  onSetResources
}: ResourcesViewProps) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['intune']);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'supported' | 'coming-soon'>('all');
  const [filterProvider, setFilterProvider] = useState<'all' | 'graph' | 'azure'>('all');
  const [filterFormats, setFilterFormats] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  
  // Custom templates state
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  const { toast } = useToast();

  // Load custom templates on mount
  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('resource_templates')
        .select('id, name, description, resource_ids')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCustomTemplates(data || []);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || selectedResources.length === 0) return;
    
    setSavingTemplate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('resource_templates')
        .insert({
          user_id: user.id,
          name: newTemplateName.trim(),
          description: newTemplateDescription.trim() || null,
          resource_ids: selectedResources,
        });
      
      if (error) throw error;
      
      toast({
        title: 'Template Saved',
        description: `"${newTemplateName}" has been saved with ${selectedResources.length} resources`,
      });
      
      setNewTemplateName('');
      setNewTemplateDescription('');
      setSaveDialogOpen(false);
      loadCustomTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteCustomTemplate = async (templateId: string, templateName: string) => {
    try {
      const { error } = await supabase
        .from('resource_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      toast({
        title: 'Template Deleted',
        description: `"${templateName}" has been deleted`,
      });
      
      loadCustomTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleApplyCustomTemplate = (template: CustomTemplate) => {
    if (onSetResources) {
      onSetResources(template.resource_ids);
      setTemplatesOpen(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Check if resource is supported (has graphEndpoint, azureResourceType, OR explicit supported: true)
  const isResourceSupported = (categoryId: string, subId: string) => {
    const category = ALL_RESOURCE_CATEGORIES.find(c => c.id === categoryId);
    const sub = category?.subcategories.find(s => s.id === subId);
    if (!sub) return false;
    // Explicit supported flag takes priority, otherwise check for graphEndpoint or azureResourceType
    if (sub.supported === false) return false;
    if (sub.supported === true) return true;
    return !!sub.graphEndpoint || !!sub.azureResourceType;
  };

  const getSupportedSubcategories = (category: ResourceCategory) => {
    return category.subcategories.filter(sub => {
      if (sub.supported === false) return false;
      if (sub.supported === true) return true;
      return !!sub.graphEndpoint || !!sub.azureResourceType;
    });
  };

  const isCategorySelected = (category: ResourceCategory) => {
    const supported = getSupportedSubcategories(category);
    if (supported.length === 0) return false;
    return supported.every(sub => 
      selectedResources.includes(`${category.id}/${sub.id}`)
    );
  };

  const isCategoryPartiallySelected = (category: ResourceCategory) => {
    const supported = getSupportedSubcategories(category);
    const selectedCount = supported.filter(sub => 
      selectedResources.includes(`${category.id}/${sub.id}`)
    ).length;
    return selectedCount > 0 && selectedCount < supported.length;
  };

  // Apply filters to categories and subcategories
  const filterSubcategory = (category: ResourceCategory, sub: typeof category.subcategories[0]) => {
    const isSupported = isResourceSupported(category.id, sub.id);
    
    // Filter by support status
    if (filterStatus === 'supported' && !isSupported) return false;
    if (filterStatus === 'coming-soon' && isSupported) return false;
    
    // Filter by export format
    if (filterFormats.length > 0) {
      const categoryFormats = category.exportFormats.filter(f => f.supported).map(f => f.id);
      if (!filterFormats.some(f => categoryFormats.includes(f as typeof categoryFormats[number]))) return false;
    }
    
    return true;
  };

  const filteredCategories = ALL_RESOURCE_CATEGORIES.map(category => {
    // Filter by provider
    if (filterProvider !== 'all') {
      const categoryProvider = category.provider || 'graph';
      if (categoryProvider !== filterProvider) return { ...category, subcategories: [] };
    }
    
    // Filter subcategories based on search and filters
    const filteredSubs = category.subcategories.filter(sub => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          category.name.toLowerCase().includes(query) ||
          sub.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Apply other filters
      return filterSubcategory(category, sub);
    });
    
    return { ...category, subcategories: filteredSubs };
  }).filter(category => category.subcategories.length > 0);

  const totalResources = ALL_RESOURCE_CATEGORIES.reduce((acc, cat) => 
    acc + cat.subcategories.filter(sub => sub.supported !== false && (sub.supported === true || sub.graphEndpoint || sub.azureResourceType)).length, 0
  );
  const selectedCount = selectedResources.length;
  const allSelected = selectedCount === totalResources && totalResources > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalResources;
  
  const activeFilterCount = (filterStatus !== 'all' ? 1 : 0) + (filterFormats.length > 0 ? 1 : 0) + (filterProvider !== 'all' ? 1 : 0);

  const handleApplyTemplate = (templateId: string) => {
    const template = RESOURCE_TEMPLATES.find(t => t.id === templateId);
    if (!template || !onSetResources) return;
    
    const resources: string[] = [];
    
    ALL_RESOURCE_CATEGORIES.forEach(category => {
      if (!template.categoryIds.includes(category.id)) return;
      
      category.subcategories.forEach(sub => {
        const isSupported = isResourceSupported(category.id, sub.id);
        if (!isSupported) return;
        
        // If template has a subcategory filter, apply it
        if (template.subcategoryFilter && !template.subcategoryFilter(category.id, sub.id)) {
          return;
        }
        
        resources.push(`${category.id}/${sub.id}`);
      });
    });
    
    onSetResources(resources);
    setTemplatesOpen(false);
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterProvider('all');
    setFilterFormats([]);
  };

  const toggleFormatFilter = (format: string) => {
    setFilterFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Resources</h1>
          <Badge variant="outline" className="text-xs">
            {selectedCount}/{totalResources}
          </Badge>
        </div>
        {selectedCount > 0 && onNavigateToExport && (
          <Button onClick={onNavigateToExport} size="sm" className="gap-2">
            Export
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Unified Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Provider Toggle - Compact */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {[
            { id: 'all', label: 'All', icon: Layers },
            { id: 'graph', label: 'M365', icon: Cloud },
            { id: 'azure', label: 'Azure', icon: Server },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                  filterProvider === option.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card hover:bg-secondary/50 text-muted-foreground"
                )}
                onClick={() => setFilterProvider(option.id as typeof filterProvider)}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Select All */}
          {onSelectAllResources && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={onSelectAllResources}
            >
              <div className={cn(
                "w-3.5 h-3.5 rounded border flex items-center justify-center",
                allSelected 
                  ? "bg-primary border-primary" 
                  : someSelected 
                    ? "border-primary bg-primary/20" 
                    : "border-muted-foreground"
              )}>
                {allSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                {someSelected && !allSelected && <div className="w-1.5 h-1.5 bg-primary rounded-sm" />}
              </div>
              {allSelected ? 'Clear' : 'All'}
            </Button>
          )}

          {/* Filters Popover */}
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                {activeFilterCount > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <RadioGroup value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'supported', label: 'Supported' },
                      { value: 'coming-soon', label: 'Coming Soon' },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`status-${opt.value}`} />
                        <Label htmlFor={`status-${opt.value}`} className="text-sm font-normal">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Formats</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {['json', 'terraform', 'bicep', 'powershell'].map(format => (
                      <button
                        key={format}
                        onClick={() => toggleFormatFilter(format)}
                        className={cn(
                          "text-xs px-2 py-1 rounded border transition-colors",
                          filterFormats.includes(format)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Templates Popover */}
          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
                <Layers className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {/* Save current selection */}
                {selectedResources.length > 0 && onSetResources && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full gap-2 text-xs" 
                    onClick={() => {
                      setTemplatesOpen(false);
                      setSaveDialogOpen(true);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Selection ({selectedResources.length})
                  </Button>
                )}

                {/* Custom Templates */}
                {customTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground font-medium">My Templates</span>
                    {customTemplates.map(template => (
                      <div
                        key={template.id}
                        className="flex items-center gap-2 p-2 rounded border border-border hover:bg-secondary/50 transition-colors group"
                      >
                        <button
                          onClick={() => handleApplyCustomTemplate(template)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.resource_ids.length} resources</div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomTemplate(template.id, template.name);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Built-in Templates */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Quick Select</span>
                  {RESOURCE_TEMPLATES.filter(t => 
                    filterProvider === 'all' || t.provider === filterProvider
                  ).map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleApplyTemplate(template.id)}
                      className="w-full text-left p-2 rounded border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save your current selection of {selectedResources.length} resources as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., My Security Baseline"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description (optional)</Label>
              <Input
                id="template-description"
                placeholder="e.g., All security-related policies"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate} 
              disabled={!newTemplateName.trim() || savingTemplate}
            >
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Tree */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {filteredCategories.map((category, categoryIndex) => {
              const Icon = getIcon(category.icon);
              const isExpanded = expandedCategories.includes(category.id);
              const isSelected = isCategorySelected(category);
              const isPartial = isCategoryPartiallySelected(category);
              const supportedFormats = category.exportFormats.filter(f => f.supported);

              return (
                <div key={category.id}>
                  {/* Category Header - Compact */}
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors",
                      "hover:bg-secondary/30",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAll(category.id);
                      }}
                      className="flex-shrink-0"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                        isSelected 
                          ? "bg-primary border-primary" 
                          : isPartial 
                            ? "border-primary bg-primary/20" 
                            : "border-muted-foreground/50"
                      )}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        {isPartial && !isSelected && <div className="w-1.5 h-1.5 bg-primary rounded-sm" />}
                      </div>
                    </button>
                    
                    <div className="p-1.5 rounded bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{category.name}</span>
                      <span className="text-xs text-muted-foreground">({category.subcategories.length})</span>
                    </div>

                    {/* Format badges - only show first 2 on desktop */}
                    <div className="hidden sm:flex items-center gap-1">
                      {supportedFormats.slice(0, 2).map(format => (
                        <span 
                          key={format.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                        >
                          {format.id.toUpperCase()}
                        </span>
                      ))}
                      {supportedFormats.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{supportedFormats.length - 2}</span>
                      )}
                    </div>

                    <ChevronRight className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                  </div>

                  {/* Subcategories - Compact */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden bg-secondary/5"
                      >
                        <div className="py-1 px-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5">
                            {category.subcategories.map((sub) => {
                              const resourceId = `${category.id}/${sub.id}`;
                              const isSubSelected = selectedResources.includes(resourceId);
                              const isSupported = isResourceSupported(category.id, sub.id);

                              return (
                                <div
                                  key={sub.id}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded transition-colors",
                                    isSupported ? "cursor-pointer hover:bg-secondary/50" : "cursor-not-allowed opacity-50",
                                    isSubSelected && isSupported && "bg-primary/10"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSupported) {
                                      onResourceSelect(resourceId);
                                    }
                                  }}
                                >
                                  <Checkbox 
                                    checked={isSubSelected}
                                    disabled={!isSupported}
                                    onCheckedChange={() => {
                                      if (isSupported) {
                                        onResourceSelect(resourceId);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <span className={cn(
                                    "text-xs truncate flex-1",
                                    isSupported ? "text-foreground" : "text-muted-foreground"
                                  )}>
                                    {sub.name}
                                  </span>
                                  {!isSupported && (
                                    <span className="text-[10px] text-warning">Soon</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
