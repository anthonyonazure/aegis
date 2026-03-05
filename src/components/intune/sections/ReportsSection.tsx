import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, FileText } from 'lucide-react';

const reportCategories = [
  {
    title: 'Device compliance',
    description: 'View compliance status across all managed devices',
    icon: BarChart3,
  },
  {
    title: 'Device configuration',
    description: 'Profile assignment and conflict reports',
    icon: PieChart,
  },
  {
    title: 'Software updates',
    description: 'Update ring deployment status',
    icon: TrendingUp,
  },
  {
    title: 'App install status',
    description: 'Application deployment success rates',
    icon: FileText,
  },
];

export const ReportsSection = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Intune reporting and analytics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reportCategories.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.title} 
              className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">{report.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select a report category above to view detailed analytics.
            Reports are generated from live tenant data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
