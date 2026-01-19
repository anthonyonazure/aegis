import { useState } from 'react';
import { AIScheduleManager } from '@/components/ai/AIScheduleManager';
import { AITrendViewer } from '@/components/ai/AITrendViewer';
import { NotificationChannelManager } from '@/components/ai/NotificationChannelManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, TrendingUp, Bell } from 'lucide-react';

export function AISchedulesView() {
  const [activeTab, setActiveTab] = useState('schedules');
  const [selectedServiceForTrends, setSelectedServiceForTrends] = useState<string | undefined>();

  const handleViewTrends = (serviceType: string) => {
    setSelectedServiceForTrends(serviceType);
    setActiveTab('trends');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Schedules & Trends</h1>
          <p className="text-muted-foreground">Schedule automated AI analysis and track performance over time</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedules" className="gap-2">
            <Clock className="h-4 w-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <AIScheduleManager onViewTrends={handleViewTrends} />
        </TabsContent>

        <TabsContent value="trends">
          <AITrendViewer 
            initialService={selectedServiceForTrends} 
            onBack={() => setActiveTab('schedules')} 
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationChannelManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
