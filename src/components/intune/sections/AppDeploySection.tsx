import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Copy, ExternalLink, Play, Globe, Briefcase, MessageSquare,
  Code2, ShieldCheck, Wrench, FileCode, LayoutGrid, List, Package,
  Download, Upload, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import {
  appDeployTemplates,
  appDeployCategories,
  AppDeployTemplate,
  AppDeployCategory,
} from '@/lib/appDeployTemplates';

const categoryIcons: Record<AppDeployCategory, React.ElementType> = {
  Browsers: Globe,
  Productivity: Briefcase,
  Communication: MessageSquare,
  Development: Code2,
  Security: ShieldCheck,
  Utilities: Wrench,
  Custom: FileCode,
};

const categoryColors: Record<AppDeployCategory, string> = {
  Browsers: 'default',
  Productivity: 'secondary',
  Communication: 'info',
  Development: 'warning',
  Security: 'destructive',
  Utilities: 'default',
  Custom: 'secondary',
};

export const AppDeploySection = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<AppDeployCategory | 'All'>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<AppDeployTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deploying, setDeploying] = useState(false);
  const { isConnected, getValidToken } = useTenant();

  const deployToTenant = async (template: AppDeployTemplate) => {
    if (!isConnected) {
      toast.error('No tenant connected. Please connect a tenant first.');
      return;
    }
    const token = await getValidToken();
    if (!token) {
      toast.error('Session expired. Please reconnect to the tenant.');
      return;
    }
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'deploy-health-script',
          accessToken: token,
          scriptPayload: {
            displayName: `PSADT - ${template.name}`,
            description: template.description,
            publisher: template.publisher,
            runAs: 'System',
            runAs32Bit: false,
            detectionScriptContent: template.detectionScript,
            remediationScriptContent: template.installScript,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`"${template.name}" deployed successfully! Script ID: ${data.scriptId}`);
      setSelectedTemplate(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deploy template to tenant.');
    } finally {
      setDeploying(false);
    }
  };

  const filtered = appDeployTemplates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.publisher.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = appDeployCategories.reduce(
    (acc, cat) => {
      acc[cat] = appDeployTemplates.filter((t) => t.category === cat).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">AppDeploy — PSAppDeployToolkit Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enterprise application deployment templates powered by{' '}
          <a
            href="https://psappdeploytoolkit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            PSAppDeployToolkit
            <ExternalLink className="w-3 h-3" />
          </a>
          {' '}— the industry-standard PowerShell framework for SCCM/Intune app deployments.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeCategory === 'All' ? 'default' : 'outline'}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setActiveCategory('All')}
          >
            All ({appDeployTemplates.length})
          </Badge>
          {appDeployCategories.map((cat) => {
            const Icon = categoryIcons[cat];
            return (
              <Badge
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                onClick={() => setActiveCategory(cat)}
              >
                <Icon className="w-3 h-3" />
                {cat} ({categoryCounts[cat]})
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Templates Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const Icon = categoryIcons[template.category];
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-tight">
                      {template.name}
                    </CardTitle>
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={categoryColors[template.category] as any} className="text-[10px] px-1.5 py-0">
                      {template.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {template.publisher}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((template) => {
            const Icon = categoryIcons[template.category];
            return (
              <div
                key={template.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedTemplate(template)}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                </div>
                <Badge variant={categoryColors[template.category] as any} className="text-[10px] flex-shrink-0">
                  {template.category}
                </Badge>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {template.publisher}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No templates match your search.</p>
        </div>
      )}

      {/* Template Detail Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <Badge variant={categoryColors[selectedTemplate.category] as any}>
                    {selectedTemplate.category}
                  </Badge>
                  <Badge variant="outline">{selectedTemplate.publisher}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedTemplate.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requirements: {selectedTemplate.requirements}
                </p>
              </DialogHeader>

              <Tabs defaultValue="install" className="flex-1 min-h-0">
                <TabsList className="w-full">
                  <TabsTrigger value="install" className="flex-1">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Install Script
                  </TabsTrigger>
                  <TabsTrigger value="uninstall" className="flex-1">
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Uninstall Script
                  </TabsTrigger>
                  <TabsTrigger value="detection" className="flex-1">
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Detection Rule
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="install" className="mt-3 flex-1 min-h-0">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 h-7"
                      onClick={() => copyToClipboard(selectedTemplate.installScript, 'Install script')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <ScrollArea className="h-[350px]">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {selectedTemplate.installScript}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="uninstall" className="mt-3 flex-1 min-h-0">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 h-7"
                      onClick={() => copyToClipboard(selectedTemplate.uninstallScript, 'Uninstall script')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <ScrollArea className="h-[350px]">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {selectedTemplate.uninstallScript}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="detection" className="mt-3 flex-1 min-h-0">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 h-7"
                      onClick={() => copyToClipboard(selectedTemplate.detectionScript, 'Detection script')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <ScrollArea className="h-[350px]">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {selectedTemplate.detectionScript}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-3 border-t">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={selectedTemplate.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    PSADT Docs
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.info('Deploy to tenant requires an active tenant connection with DeviceManagementApps.ReadWrite.All permission.');
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Deploy to Tenant
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
