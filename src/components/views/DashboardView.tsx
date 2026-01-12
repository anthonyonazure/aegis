import { motion } from 'framer-motion';
import { 
  Server, 
  FileJson, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RESOURCE_CATEGORIES } from '@/types/tenant';
import { getIcon } from '@/lib/icons';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  isConnected?: boolean;
}

export const DashboardView = ({ onNavigate, isConnected = false }: DashboardViewProps) => {
  const stats = [
    { label: 'Resource Categories', value: '8', icon: Server, trend: '+2 new' },
    { label: 'Export Formats', value: '4', icon: FileJson, trend: 'JSON, TF, Bicep, PS1' },
    { label: 'Last Export', value: 'Never', icon: Clock, trend: 'No exports yet' },
    { 
      label: 'Connection', 
      value: isConnected ? 'Online' : 'Offline', 
      icon: isConnected ? CheckCircle2 : AlertCircle, 
      trend: isConnected ? 'Ready to export' : 'Setup required' 
    },
  ];

  const recentActivity = [
    { id: 1, action: 'System initialized', time: 'Just now', status: 'success' },
    { id: 2, action: isConnected ? 'Tenant connected' : 'Ready for tenant connection', time: '1m ago', status: 'info' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Microsoft 365 Tenant Export & Backup Tool
          </p>
        </div>
        <Button onClick={() => onNavigate('auth')} className="gap-2">
          <Zap className="w-4 h-4" />
          {isConnected ? 'Manage Connection' : 'Connect Tenant'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass-panel glow-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource Categories */}
        <div className="lg:col-span-2">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Resource Categories</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('resources')}>
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RESOURCE_CATEGORIES.slice(0, 6).map((category, index) => {
                  const Icon = getIcon(category.icon);
                  return (
                    <motion.div
                      key={category.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => onNavigate('resources')}
                    >
                      <div className="p-2 rounded-md bg-primary/10">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {category.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {category.subcategories.length} resources
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {category.exportFormats.filter(f => f.supported).slice(0, 2).map(format => (
                          <span 
                            key={format.id}
                            className={`export-format-badge export-format-${format.id}`}
                          >
                            {format.id.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Start */}
        <div className="space-y-4">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isConnected ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
                  }`}>
                    {isConnected ? '✓' : '1'}
                  </div>
                  <span className={isConnected ? 'text-success' : 'text-muted-foreground'}>
                    Connect to your M365 tenant
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                    2
                  </div>
                  <span className="text-muted-foreground">Select resources to export</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                    3
                  </div>
                  <span className="text-muted-foreground">Choose export formats</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                    4
                  </div>
                  <span className="text-muted-foreground">Configure Git & CI/CD</span>
                </div>
              </div>
              <Button className="w-full mt-4" onClick={() => onNavigate(isConnected ? 'resources' : 'auth')}>
                {isConnected ? 'Select Resources' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 ${activity.status === 'success' ? 'text-success' : 'text-info'}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
