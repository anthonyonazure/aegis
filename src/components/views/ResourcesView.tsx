import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Search,
  Filter,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RESOURCE_CATEGORIES, ResourceCategory } from '@/types/tenant';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Pre-defined templates for quick resource selection
const RESOURCE_TEMPLATES = [
  {
    id: 'all-intune',
    name: 'All Intune Policies',
    description: 'Device configs, compliance, apps',
    categoryIds: ['intune'],
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
  },
  {
    id: 'identity-access',
    name: 'Identity & Access',
    description: 'Users, groups, CA policies, roles',
    categoryIds: ['entra-id', 'conditional-access'],
  },
  {
    id: 'device-management',
    name: 'Device Management',
    description: 'All device-related configurations',
    categoryIds: ['intune', 'autopilot'],
  },
  {
    id: 'apps-only',
    name: 'Applications Only',
    description: 'App configs and assignments',
    categoryIds: ['intune'],
    subcategoryFilter: (catId: string, subId: string) => 
      subId.includes('app') || subId.includes('script'),
  },
];

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
  const [filterFormats, setFilterFormats] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Check if resource is supported (has graphEndpoint OR explicit supported: true)
  const isResourceSupported = (categoryId: string, subId: string) => {
    const category = RESOURCE_CATEGORIES.find(c => c.id === categoryId);
    const sub = category?.subcategories.find(s => s.id === subId);
    if (!sub) return false;
    // Explicit supported flag takes priority, otherwise check for graphEndpoint
    if (sub.supported === false) return false;
    if (sub.supported === true) return true;
    return !!sub.graphEndpoint;
  };

  const getSupportedSubcategories = (category: ResourceCategory) => {
    return category.subcategories.filter(sub => {
      if (sub.supported === false) return false;
      if (sub.supported === true) return true;
      return !!sub.graphEndpoint;
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

  const filteredCategories = RESOURCE_CATEGORIES.map(category => {
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

  const totalResources = RESOURCE_CATEGORIES.reduce((acc, cat) => 
    acc + cat.subcategories.filter(sub => sub.supported !== false && (sub.supported === true || sub.graphEndpoint)).length, 0
  );
  const selectedCount = selectedResources.length;
  const allSelected = selectedCount === totalResources && totalResources > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalResources;
  
  const activeFilterCount = (filterStatus !== 'all' ? 1 : 0) + (filterFormats.length > 0 ? 1 : 0);

  const handleApplyTemplate = (templateId: string) => {
    const template = RESOURCE_TEMPLATES.find(t => t.id === templateId);
    if (!template || !onSetResources) return;
    
    const resources: string[] = [];
    
    RESOURCE_CATEGORIES.forEach(category => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resource Browser</h1>
          <p className="text-muted-foreground mt-1">
            Select the resources you want to export from your M365 tenant
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            {selectedCount} / {totalResources} selected
          </Badge>
          {selectedCount > 0 && onNavigateToExport && (
            <Button onClick={onNavigateToExport} className="gap-2">
              Next: Export
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        {onSelectAllResources && (
          <Button 
            variant={allSelected ? "default" : "outline"} 
            className="gap-2"
            onClick={onSelectAllResources}
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center",
              allSelected 
                ? "bg-primary-foreground border-primary-foreground" 
                : someSelected 
                  ? "border-primary bg-primary/20" 
                  : "border-current"
            )}>
              {allSelected && <Check className="w-3 h-3 text-primary" />}
              {someSelected && !allSelected && <div className="w-2 h-2 bg-primary rounded-sm" />}
            </div>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        )}
        {/* Filters Popover */}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto py-1 px-2 text-xs">
                    Clear all
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Support Status</Label>
                <RadioGroup value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="status-all" />
                    <Label htmlFor="status-all" className="text-sm font-normal">All resources</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="supported" id="status-supported" />
                    <Label htmlFor="status-supported" className="text-sm font-normal">Supported only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coming-soon" id="status-coming" />
                    <Label htmlFor="status-coming" className="text-sm font-normal">Coming Soon</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Export Formats</Label>
                <div className="space-y-2">
                  {['json', 'terraform', 'bicep', 'powershell'].map(format => (
                    <div key={format} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`format-${format}`}
                        checked={filterFormats.includes(format)}
                        onCheckedChange={() => toggleFormatFilter(format)}
                      />
                      <Label htmlFor={`format-${format}`} className="text-sm font-normal">
                        {format.toUpperCase()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Templates Popover */}
        <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Layers className="w-4 h-4" />
              Templates
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Quick Select Templates</h4>
              <p className="text-xs text-muted-foreground">
                Apply a pre-defined selection of resources
              </p>
              <div className="space-y-2">
                {RESOURCE_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary/50 hover:border-primary/50 transition-colors"
                  >
                    <div className="font-medium text-sm text-foreground">{template.name}</div>
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Resource Tree */}
      <Card className="glass-panel">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filteredCategories.map((category, categoryIndex) => {
              const Icon = getIcon(category.icon);
              const isExpanded = expandedCategories.includes(category.id);
              const isSelected = isCategorySelected(category);
              const isPartial = isCategoryPartiallySelected(category);

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: categoryIndex * 0.05 }}
                >
                  {/* Category Header */}
                  <div 
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer transition-colors",
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
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        isSelected 
                          ? "bg-primary border-primary" 
                          : isPartial 
                            ? "border-primary bg-primary/20" 
                            : "border-muted-foreground"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        {isPartial && !isSelected && <div className="w-2 h-2 bg-primary rounded-sm" />}
                      </div>
                    </button>
                    
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{category.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {category.subcategories.length}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {category.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {category.exportFormats.filter(f => f.supported).map(format => (
                        <span 
                          key={format.id}
                          className={`export-format-badge export-format-${format.id}`}
                        >
                          {format.id.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </div>

                  {/* Subcategories */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-secondary/10"
                      >
                        <div className="py-2">
                          {category.subcategories.map((sub) => {
                            const resourceId = `${category.id}/${sub.id}`;
                            const isSubSelected = selectedResources.includes(resourceId);
                            const isSupported = isResourceSupported(category.id, sub.id);

                            return (
                              <div
                                key={sub.id}
                                className={cn(
                                  "flex items-center gap-3 px-6 py-2 pl-14 transition-colors",
                                  isSupported ? "cursor-pointer hover:bg-secondary/30" : "cursor-not-allowed opacity-60",
                                  isSubSelected && isSupported && "bg-primary/5"
                                )}
                                onClick={() => isSupported && onResourceSelect(resourceId)}
                              >
                                <Checkbox 
                                  checked={isSubSelected}
                                  disabled={!isSupported}
                                  className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <span className={cn("text-sm", isSupported ? "text-foreground" : "text-muted-foreground")}>
                                  {sub.name}
                                </span>
                                {isSupported && sub.graphEndpoint && (
                                  <code className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded">
                                    Graph API
                                  </code>
                                )}
                                {!isSupported && (
                                  <Badge variant="outline" className="text-xs text-warning border-warning/50 bg-warning/10">
                                    Coming Soon
                                  </Badge>
                                )}
                                {!isSupported && sub.comingSoonReason && (
                                  <span className="text-xs text-muted-foreground">
                                    ({sub.comingSoonReason})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
