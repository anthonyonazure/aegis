import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Monitor, Smartphone, Shield, AlertTriangle, 
  CheckCircle2, XCircle, Loader2, RefreshCw 
} from 'lucide-react';
import { useIntuneData } from '@/hooks/useIntuneData';
import { cn } from '@/lib/utils';

export const OverviewSection = () => {
  const configs = useIntuneData({ resource: 'intune/device-configurations' });
  const compliance = useIntuneData({ resource: 'intune/compliance-policies' });
  const scripts = useIntuneData({ resource: 'intune/scripts' });
  const apps = useIntuneData({ resource: 'intune/win32-apps' });

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      Promise.all([
        configs.fetchData(),
        compliance.fetchData(),
        scripts.fetchData(),
        apps.fetchData(),
      ]);
      setLoaded(true);
    }
  }, [loaded]);

  const isLoading = configs.isLoading || compliance.isLoading || scripts.isLoading || apps.isLoading;

  const stats = [
    {
      label: 'Configuration Profiles',
      value: configs.data.length,
      icon: Monitor,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Compliance Policies',
      value: compliance.data.length,
      icon: Shield,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Scripts',
      value: scripts.data.length,
      icon: Smartphone,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Apps',
      value: apps.data.length,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Intune Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Microsoft Intune device management summary
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoaded(false);
          }}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-lg", stat.bg)}>
                    <Icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLoading && configs.data.length === 0 && compliance.data.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Intune data available</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect a Microsoft 365 tenant with Intune licenses to view device management data.
              Navigate to Authentication to set up a tenant connection.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
