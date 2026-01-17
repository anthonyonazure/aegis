import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  Search,
  Filter,
  MoreVertical,
  FileCheck,
  Rocket,
  Settings,
  Lock,
  Heart,
  Globe,
  Laptop,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  PolicyTemplate,
  BaselineType,
  BASELINE_CONFIG,
  BASELINE_TEMPLATES,
} from '@/types/policy';
import {
  createPolicyTemplate,
  updatePolicyTemplate,
  deletePolicyTemplate,
  getPolicyTemplates,
  getPolicyStats,
} from '@/lib/policyDatabase';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Shield,
  FileCheck,
  Heart,
  Globe,
  Lock,
  Laptop,
  Settings,
};

interface PolicyTemplatesViewProps {
  onNavigateToDeployment?: (templateId: string) => void;
}

export const PolicyTemplatesView = ({ onNavigateToDeployment }: PolicyTemplatesViewProps) => {
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [baselineFilter, setBaselineFilter] = useState<BaselineType | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'custom' | 'builtin'>('custom');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PolicyTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<PolicyTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ totalTemplates: 0, totalDeployments: 0, activeDeployments: 0, successRate: 100 });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'security',
    baselineType: 'custom' as BaselineType,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesData, statsData] = await Promise.all([
        getPolicyTemplates(),
        getPolicyStats(),
      ]);
      setTemplates(templatesData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'security',
      baselineType: 'custom',
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: PolicyTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      baselineType: template.baselineType,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Template name is required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      if (editingTemplate) {
        await updatePolicyTemplate(editingTemplate.id, {
          name: formData.name.trim(),
          description: formData.description || undefined,
          category: formData.category,
          baselineType: formData.baselineType,
        });
        toast({ title: 'Success', description: 'Template updated successfully' });
      } else {
        await createPolicyTemplate({
          name: formData.name.trim(),
          description: formData.description || undefined,
          category: formData.category,
          baselineType: formData.baselineType,
          policyData: {},
          resourceTypes: [],
        });
        toast({ title: 'Success', description: 'Template created successfully' });
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      setSaving(true);
      await deletePolicyTemplate(deletingTemplate.id);
      toast({ title: 'Success', description: 'Template deleted successfully' });
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyBuiltIn = async (builtIn: typeof BASELINE_TEMPLATES[0]) => {
    try {
      setSaving(true);
      await createPolicyTemplate({
        name: `${builtIn.name} (Copy)`,
        description: builtIn.description,
        category: builtIn.category,
        baselineType: builtIn.baselineType,
        policyData: builtIn.policyData,
        resourceTypes: builtIn.resourceTypes,
      });
      toast({ title: 'Success', description: 'Template copied to your library' });
      setActiveTab('custom');
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to copy template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBaseline = baselineFilter === 'all' || t.baselineType === baselineFilter;
    return matchesSearch && matchesBaseline;
  });

  const filteredBuiltIn = BASELINE_TEMPLATES.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBaseline = baselineFilter === 'all' || t.baselineType === baselineFilter;
    return matchesSearch && matchesBaseline;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Policy Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage security baseline templates for multi-tenant deployment
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Templates', value: stats.totalTemplates, icon: Shield },
          { label: 'Deployments', value: stats.totalDeployments, icon: Rocket },
          { label: 'Active', value: stats.activeDeployments, icon: Loader2 },
          { label: 'Success Rate', value: `${stats.successRate}%`, icon: FileCheck },
        ].map((stat) => (
          <Card key={stat.label} className="glass-panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{loading ? '...' : stat.value}</p>
                </div>
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="glass-panel">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50"
              />
            </div>
            <Select value={baselineFilter} onValueChange={(v) => setBaselineFilter(v as BaselineType | 'all')}>
              <SelectTrigger className="w-full sm:w-48 bg-secondary/50">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by baseline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Baselines</SelectItem>
                {Object.entries(BASELINE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'custom' | 'builtin')}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="custom" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="w-4 h-4" />
            My Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="builtin" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="w-4 h-4" />
            Built-in Baselines ({BASELINE_TEMPLATES.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card className="glass-panel">
              <CardContent className="py-12 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No templates yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first policy template or copy from built-in baselines
                </p>
                <div className="flex justify-center gap-2">
                  <Button onClick={handleOpenCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Template
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('builtin')}>
                    Browse Baselines
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredTemplates.map((template, index) => {
                  const config = BASELINE_CONFIG[template.baselineType];
                  const Icon = iconMap[config.icon] || Shield;

                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="glass-panel hover:border-primary/50 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {template.description || 'No description'}
                                </p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onNavigateToDeployment?.(template.id)}>
                                  <Rocket className="w-4 h-4 mr-2" />
                                  Deploy
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => { setDeletingTemplate(template); setDeleteDialogOpen(true); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <Badge className={cn("gap-1", config.color)}>
                              {config.label}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {template.category}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>v{template.version}</span>
                            <span>{template.resourceTypes.length} resource types</span>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3 gap-2"
                            onClick={() => onNavigateToDeployment?.(template.id)}
                          >
                            <Rocket className="w-4 h-4" />
                            Deploy to Tenants
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="builtin" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBuiltIn.map((template, index) => {
              const config = BASELINE_CONFIG[template.baselineType];
              const Icon = iconMap[config.icon] || Shield;

              return (
                <motion.div
                  key={template.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass-panel">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground">{template.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={cn("gap-1", config.color)}>
                          {config.label}
                        </Badge>
                        <Badge variant="secondary">
                          {template.resourceTypes.length} resource types
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => handleCopyBuiltIn(template)}
                          disabled={saving}
                        >
                          <Copy className="w-4 h-4" />
                          Copy to Library
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update the template details' : 'Create a new policy template'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Security Baseline"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template enforces..."
                className="bg-secondary/50 min-h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="configuration">Configuration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Baseline Type</Label>
                <Select
                  value={formData.baselineType}
                  onValueChange={(v) => setFormData({ ...formData, baselineType: v as BaselineType })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BASELINE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This will also delete all associated deployments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
