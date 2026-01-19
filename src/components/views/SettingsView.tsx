import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AzureAutomationManager } from '@/components/AzureAutomationManager';
import { ServicePrincipalManager } from '@/components/ServicePrincipalManager';
import { AIProviderSettings } from '@/components/ai/AIProviderSettings';
import { InviteManager } from '@/components/InviteManager';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Settings, Server, Key, Sparkles, Users, Loader2 } from 'lucide-react';

export function SettingsView() {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure Azure Automation, service principals, and AI providers</p>
        </div>
      </div>

      <Tabs defaultValue="ai-providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai-providers" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Providers
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Server className="h-4 w-4" />
            Azure Automation
          </TabsTrigger>
          <TabsTrigger value="service-principals" className="gap-2">
            <Key className="h-4 w-4" />
            Service Principals
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="user-management" className="gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="ai-providers" className="space-y-4">
          <AIProviderSettings />
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <AzureAutomationManager />
        </TabsContent>

        <TabsContent value="service-principals" className="space-y-4">
          <ServicePrincipalManager />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="user-management" className="space-y-4">
            <InviteManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
