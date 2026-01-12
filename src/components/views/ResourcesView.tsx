import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Search,
  Filter,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RESOURCE_CATEGORIES, ResourceCategory } from '@/types/tenant';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface ResourcesViewProps {
  selectedResources: string[];
  onResourceSelect: (resourceId: string) => void;
  onSelectAll: (categoryId: string) => void;
}

export const ResourcesView = ({ 
  selectedResources, 
  onResourceSelect, 
  onSelectAll 
}: ResourcesViewProps) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['intune']);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const isCategorySelected = (category: ResourceCategory) => {
    return category.subcategories.every(sub => 
      selectedResources.includes(`${category.id}/${sub.id}`)
    );
  };

  const isCategoryPartiallySelected = (category: ResourceCategory) => {
    const selectedCount = category.subcategories.filter(sub => 
      selectedResources.includes(`${category.id}/${sub.id}`)
    ).length;
    return selectedCount > 0 && selectedCount < category.subcategories.length;
  };

  const filteredCategories = RESOURCE_CATEGORIES.filter(category => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      category.name.toLowerCase().includes(query) ||
      category.subcategories.some(sub => sub.name.toLowerCase().includes(query))
    );
  });

  const totalResources = RESOURCE_CATEGORIES.reduce((acc, cat) => acc + cat.subcategories.length, 0);
  const selectedCount = selectedResources.length;

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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {selectedCount} / {totalResources} selected
          </Badge>
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
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
        <Button variant="outline" className="gap-2">
          <Layers className="w-4 h-4" />
          Templates
        </Button>
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

                            return (
                              <div
                                key={sub.id}
                                className={cn(
                                  "flex items-center gap-3 px-6 py-2 pl-14 cursor-pointer transition-colors",
                                  "hover:bg-secondary/30",
                                  isSubSelected && "bg-primary/5"
                                )}
                                onClick={() => onResourceSelect(resourceId)}
                              >
                                <Checkbox 
                                  checked={isSubSelected}
                                  className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <span className="text-sm text-foreground">{sub.name}</span>
                                {sub.graphEndpoint && (
                                  <code className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded">
                                    Graph API
                                  </code>
                                )}
                                {sub.powershellModule && (
                                  <code className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded">
                                    {sub.powershellModule}
                                  </code>
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
