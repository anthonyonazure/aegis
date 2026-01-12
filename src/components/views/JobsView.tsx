import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Download,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ExportJob } from '@/types/tenant';

// Mock data for demonstration
const mockJobs: ExportJob[] = [
  {
    id: '1',
    name: 'Full Tenant Export',
    status: 'completed',
    progress: 100,
    categories: ['intune', 'conditional-access', 'entra-id'],
    formats: ['json', 'terraform'],
    createdAt: new Date(Date.now() - 86400000),
    completedAt: new Date(Date.now() - 82800000),
    outputPath: './exports/2024-01-15',
  },
  {
    id: '2',
    name: 'Intune Policies Only',
    status: 'running',
    progress: 67,
    categories: ['intune'],
    formats: ['json', 'powershell'],
    createdAt: new Date(Date.now() - 300000),
  },
  {
    id: '3',
    name: 'Security Baseline Export',
    status: 'failed',
    progress: 45,
    categories: ['defender', 'conditional-access'],
    formats: ['json'],
    createdAt: new Date(Date.now() - 172800000),
    error: 'Insufficient permissions for Defender policies',
  },
];

const getStatusIcon = (status: ExportJob['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-destructive" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: ExportJob['status']) => {
  const variants: Record<ExportJob['status'], { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-success/20 text-success' },
    running: { label: 'Running', className: 'bg-primary/20 text-primary' },
    failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", variants[status].className)}>
      {variants[status].label}
    </span>
  );
};

export const JobsView = () => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Jobs</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your export history
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Exports', value: '12', icon: Download },
          { label: 'Successful', value: '10', icon: CheckCircle2, color: 'text-success' },
          { label: 'Failed', value: '2', icon: XCircle, color: 'text-destructive' },
          { label: 'In Progress', value: '1', icon: Loader2, color: 'text-primary' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <Icon className={cn("w-5 h-5", stat.color || 'text-muted-foreground')} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Jobs List */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg">Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {mockJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {getStatusIcon(job.status)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-foreground">{job.name}</h3>
                      {getStatusBadge(job.status)}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span>Started: {formatDate(job.createdAt)}</span>
                      {job.completedAt && (
                        <span>• Completed: {formatDate(job.completedAt)}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {job.categories.map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                      <span className="text-muted-foreground">→</span>
                      {job.formats.map(format => (
                        <span 
                          key={format}
                          className={`export-format-badge export-format-${format}`}
                        >
                          {format.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    {job.status === 'running' && (
                      <div className="space-y-1">
                        <Progress value={job.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{job.progress}% complete</p>
                      </div>
                    )}

                    {job.error && (
                      <p className="text-sm text-destructive mt-2">{job.error}</p>
                    )}

                    {job.outputPath && (
                      <code className="text-xs text-muted-foreground font-mono">
                        {job.outputPath}
                      </code>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && (
                      <>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
