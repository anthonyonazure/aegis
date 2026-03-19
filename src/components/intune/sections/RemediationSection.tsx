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
  Search, Copy, ExternalLink, Play, Shield, Trash2, Wrench,
  Network, Monitor, Settings2, RefreshCw, HardDrive, ShieldCheck,
  Eye, FileCode, LayoutGrid, List, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import {
  remediationScripts,
  remediationCategories,
  RemediationScript,
  RemediationCategory,
} from '@/lib/remediationScriptsCatalog';

const categoryIcons: Record<RemediationCategory, React.ElementType> = {
  Security: Shield,
  Cleanup: Trash2,
  Maintenance: Wrench,
  Network: Network,
  'Office & Apps': Monitor,
  'Detection & Monitoring': Eye,
  Configuration: Settings2,
  'Windows Updates': RefreshCw,
  'Data & Backup': HardDrive,
  Defender: ShieldCheck,
};

const categoryColors: Record<RemediationCategory, string> = {
  Security: 'destructive',
  Cleanup: 'warning',
  Maintenance: 'info',
  Network: 'default',
  'Office & Apps': 'secondary',
  'Detection & Monitoring': 'info',
  Configuration: 'secondary',
  'Windows Updates': 'default',
  'Data & Backup': 'success',
  Defender: 'destructive',
};

export const RemediationSection = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<RemediationCategory | 'All'>('All');
  const [selectedScript, setSelectedScript] = useState<RemediationScript | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deploying, setDeploying] = useState(false);
  const { isConnected, getValidToken } = useTenant();

  const deployToTenant = async (script: RemediationScript) => {
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
            displayName: script.name,
            description: script.description,
            publisher: 'Community - JayRHa',
            runAs: script.runAs,
            runAs32Bit: script.runAs32Bit || false,
            detectionScriptContent: script.detectionScript,
            remediationScriptContent: script.remediationScript,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`"${script.name}" deployed successfully! Script ID: ${data.scriptId}`);
      setSelectedScript(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deploy script to tenant.');
    } finally {
      setDeploying(false);
    }
  };

  const filtered = remediationScripts.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = remediationCategories.reduce(
    (acc, cat) => {
      acc[cat] = remediationScripts.filter((s) => s.category === cat).length;
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
        <h2 className="text-xl font-semibold text-foreground">Remediation Scripts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Community remediation scripts from{' '}
          <a
            href="https://github.com/JayRHa/EndpointAnalyticsRemediationScripts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            JayRHa/EndpointAnalyticsRemediationScripts
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search scripts..."
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
            All ({remediationScripts.length})
          </Badge>
          {remediationCategories.map((cat) => {
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
        {filtered.length} script{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Scripts Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((script) => {
            const Icon = categoryIcons[script.category];
            return (
              <Card
                key={script.id}
                className="cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => setSelectedScript(script)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-tight">
                      {script.name}
                    </CardTitle>
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={categoryColors[script.category] as any} className="text-[10px] px-1.5 py-0">
                      {script.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {script.runAs}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {script.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((script) => {
            const Icon = categoryIcons[script.category];
            return (
              <div
                key={script.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedScript(script)}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{script.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{script.description}</p>
                </div>
                <Badge variant={categoryColors[script.category] as any} className="text-[10px] flex-shrink-0">
                  {script.category}
                </Badge>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {script.runAs}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileCode className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No scripts match your search.</p>
        </div>
      )}

      {/* Script Detail Dialog */}
      <Dialog open={!!selectedScript} onOpenChange={() => setSelectedScript(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          {selectedScript && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle>{selectedScript.name}</DialogTitle>
                  <Badge variant={categoryColors[selectedScript.category] as any}>
                    {selectedScript.category}
                  </Badge>
                  <Badge variant="outline">Run as: {selectedScript.runAs}</Badge>
                  {selectedScript.runAs32Bit && (
                    <Badge variant="outline">32-bit</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedScript.description}
                </p>
              </DialogHeader>

              <Tabs defaultValue="detection" className="flex-1 min-h-0">
                <TabsList className="w-full">
                  <TabsTrigger value="detection" className="flex-1">
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Detection Script
                  </TabsTrigger>
                  <TabsTrigger value="remediation" className="flex-1">
                    <Wrench className="w-3.5 h-3.5 mr-1.5" />
                    Remediation Script
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="detection" className="mt-3 flex-1 min-h-0">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 h-7"
                      onClick={() => copyToClipboard(selectedScript.detectionScript, 'Detection script')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <ScrollArea className="h-[350px]">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {selectedScript.detectionScript}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="remediation" className="mt-3 flex-1 min-h-0">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 h-7"
                      onClick={() => copyToClipboard(selectedScript.remediationScript, 'Remediation script')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <ScrollArea className="h-[350px]">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {selectedScript.remediationScript}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-3 border-t">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={selectedScript.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    View on GitHub
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.info('Deploy to tenant requires an active tenant connection with DeviceManagementConfiguration.ReadWrite.All permission.');
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
