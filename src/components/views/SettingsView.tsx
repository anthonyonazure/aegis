import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AzureAutomationManager } from '@/components/AzureAutomationManager';
import { ServicePrincipalManager } from '@/components/ServicePrincipalManager';
import { Settings, Server, Key } from 'lucide-react';

export function SettingsView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure Azure Automation and service principals</p>
        </div>
      </div>

      <Tabs defaultValue="automation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="automation" className="gap-2">
            <Server className="h-4 w-4" />
            Azure Automation
          </TabsTrigger>
          <TabsTrigger value="service-principals" className="gap-2">
            <Key className="h-4 w-4" />
            Service Principals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automation" className="space-y-4">
          <AzureAutomationManager />
        </TabsContent>

        <TabsContent value="service-principals" className="space-y-4">
          <ServicePrincipalManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
