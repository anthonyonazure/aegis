import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  HardDrive,
  Monitor,
  DollarSign,
  Shield,
  GitCompare,
  FileCheck,
  BarChart3,
  Loader2
} from 'lucide-react';
import { Report } from '@/lib/reportDatabase';
import { generateReportPdf } from '@/lib/reportPdfGenerator';
import { format } from 'date-fns';

interface ReportViewerDialogProps {
  report: Report | null;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportViewerDialog({ report, customerName, open, onOpenChange }: ReportViewerDialogProps) {
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const data = report.data as Record<string, unknown>;
  const summary = data.summary as Record<string, unknown> | undefined;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      generateReportPdf(report, customerName);
    } finally {
      setTimeout(() => setDownloading(false), 500);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const renderExecutiveSummary = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const recommendations = data.recommendations as string[] | undefined;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard 
            label="Total Customers" 
            value={summary.totalCustomers as number ?? 0} 
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard 
            label="Total Exports" 
            value={summary.totalExports as number ?? 0} 
            icon={<FileText className="w-4 h-4" />}
          />
          <MetricCard 
            label="Export Success Rate" 
            value={`${summary.exportSuccessRate ?? 0}%`} 
            icon={<CheckCircle2 className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.exportSuccessRate as number ?? 0)}
          />
          <MetricCard 
            label="Avg Compliance Score" 
            value={`${summary.avgComplianceScore ?? 0}%`} 
            icon={<FileCheck className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.avgComplianceScore as number ?? 0)}
          />
          <MetricCard 
            label="Drift Detection Runs" 
            value={summary.driftDetectionRuns as number ?? 0} 
            icon={<GitCompare className="w-4 h-4" />}
          />
          <MetricCard 
            label="Drift Detected" 
            value={summary.driftDetectedCount as number ?? 0} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={(summary.driftDetectedCount as number ?? 0) > 0 ? 'text-yellow-500' : ''}
          />
        </div>

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderComplianceReport = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const history = data.history as Record<string, unknown>[] | undefined;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard 
            label="Total Checks" 
            value={summary.totalChecks as number ?? 0} 
            icon={<FileCheck className="w-4 h-4" />}
          />
          <MetricCard 
            label="Average Score" 
            value={`${summary.averageScore ?? 0}%`} 
            icon={<BarChart3 className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.averageScore as number ?? 0)}
          />
          <MetricCard 
            label="Lowest Score" 
            value={`${summary.lowestScore ?? 0}%`} 
            icon={<TrendingDown className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.lowestScore as number ?? 0)}
          />
          <MetricCard 
            label="Highest Score" 
            value={`${summary.highestScore ?? 0}%`} 
            icon={<TrendingUp className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.highestScore as number ?? 0)}
          />
          <div className="col-span-2 flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <span className="text-sm text-muted-foreground">Trend:</span>
            {getTrendIcon(summary.trend as string)}
            <span className="text-sm font-medium capitalize">{summary.trend as string ?? 'Stable'}</span>
          </div>
        </div>

        {history && history.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recent Compliance Checks</h4>
              <div className="space-y-2">
                {history.slice(0, 5).map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/20">
                    <span className="text-sm">
                      {h.checked_at ? format(new Date(h.checked_at as string), 'MMM d, yyyy HH:mm') : 'N/A'}
                    </span>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={getScoreColor(Number(h.score ?? 0))}>
                        {String(h.score ?? 0)}%
                      </Badge>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-500">{String(h.passed_count ?? 0)} passed</span>
                        <span className="text-red-500">{String(h.failed_count ?? 0)} failed</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDriftReport = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const runs = data.runs as Record<string, unknown>[] | undefined;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="Total Runs" 
            value={summary.totalRuns as number ?? 0} 
            icon={<GitCompare className="w-4 h-4" />}
          />
          <MetricCard 
            label="Runs with Drift" 
            value={summary.runsWithDrift as number ?? 0} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={(summary.runsWithDrift as number ?? 0) > 0 ? 'text-yellow-500' : ''}
          />
          <MetricCard 
            label="Drift Rate" 
            value={`${summary.driftRate ?? 0}%`} 
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <MetricCard 
            label="Total Differences" 
            value={summary.totalDifferences as number ?? 0} 
            icon={<FileText className="w-4 h-4" />}
          />
        </div>

        {runs && runs.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recent Drift Runs</h4>
              <div className="space-y-2">
                {runs.slice(0, 5).map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/20">
                    <span className="text-sm">
                      {r.started_at ? format(new Date(r.started_at as string), 'MMM d, yyyy HH:mm') : 'N/A'}
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.drift_detected ? 'destructive' : 'outline'}>
                        {r.drift_detected ? 'Drift Detected' : 'No Drift'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {String(r.total_tenants ?? 0)} tenants
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderBillingReport = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const usage = data.usage as Record<string, unknown>[] | undefined;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="Total Resources" 
            value={summary.totalResources as number ?? 0} 
            icon={<HardDrive className="w-4 h-4" />}
          />
          <MetricCard 
            label="Total Users" 
            value={summary.totalUsers as number ?? 0} 
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard 
            label="Total Devices" 
            value={summary.totalDevices as number ?? 0} 
            icon={<Monitor className="w-4 h-4" />}
          />
          <MetricCard 
            label="Total Billable" 
            value={`$${Number(summary.totalBillable ?? 0).toFixed(2)}`} 
            icon={<DollarSign className="w-4 h-4" />}
            valueClassName="text-primary"
          />
        </div>

        {usage && usage.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Usage by Period</h4>
              <div className="space-y-2">
                {usage.slice(0, 5).map((u, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/20">
                    <div>
                      <span className="text-sm font-medium">
                        {u.period_start ? format(new Date(u.period_start as string), 'MMM yyyy') : 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({u.customerName as string ?? 'All'})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{String(u.total_resources ?? 0)} resources</span>
                      <span className="font-semibold">
                        ${Number(u.billable_amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSecurityReport = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const criticalFindings = data.criticalFindings as Record<string, unknown>[] | undefined;
    const highFindings = data.highFindings as Record<string, unknown>[] | undefined;
    const recommendations = data.recommendations as string[] | undefined;
    const score = Number(summary.overallScore ?? 0);
    
    const renderFinding = (finding: Record<string, unknown>, severity: 'critical' | 'high') => {
      const ruleName = (finding.ruleName ?? finding.name ?? 'Unknown issue') as string;
      const resourceName = (finding.resourceName ?? finding.resource ?? 'Unknown resource') as string;
      const message = (finding.message ?? '') as string;
      const resourceType = (finding.resourceType ?? '') as string;
      
      const borderClass = severity === 'critical' 
        ? 'border-red-500/50 bg-red-500/10' 
        : 'border-orange-500/50 bg-orange-500/10';
      
      return (
        <div className={`p-4 rounded-lg border ${borderClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h5 className="font-semibold text-sm">{ruleName}</h5>
              {resourceType && (
                <p className="text-xs text-muted-foreground mt-0.5">{resourceType}</p>
              )}
            </div>
            <Badge variant={severity === 'critical' ? 'destructive' : 'outline'} className={severity === 'high' ? 'border-orange-500 text-orange-500' : ''}>
              {severity}
            </Badge>
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground min-w-[80px]">Affected:</span>
              <span className="text-sm">{resourceName}</span>
            </div>
            
            {message && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-muted-foreground min-w-[80px]">Issue:</span>
                <span className="text-sm">{message}</span>
              </div>
            )}
            
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground min-w-[80px]">Fix:</span>
              <span className="text-sm">{getRemediationSteps(ruleName, resourceType)}</span>
            </div>
          </div>
        </div>
      );
    };
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <Shield className={`w-10 h-10 ${getScoreColor(score)}`} />
          <div>
            <p className="text-sm text-muted-foreground">Overall Security Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            label="Critical" 
            value={summary.criticalIssues as number ?? 0} 
            icon={<XCircle className="w-4 h-4" />}
            valueClassName={(summary.criticalIssues as number ?? 0) > 0 ? 'text-red-500' : ''}
          />
          <MetricCard 
            label="High" 
            value={summary.highIssues as number ?? 0} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={(summary.highIssues as number ?? 0) > 0 ? 'text-orange-500' : ''}
          />
          <MetricCard 
            label="Medium" 
            value={summary.mediumIssues as number ?? 0} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={(summary.mediumIssues as number ?? 0) > 0 ? 'text-yellow-500' : ''}
          />
          <MetricCard 
            label="Total Issues" 
            value={summary.totalIssues as number ?? 0} 
            icon={<FileText className="w-4 h-4" />}
          />
        </div>

        {criticalFindings && criticalFindings.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-4 text-red-500 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Critical Findings — Immediate Action Required
              </h4>
              <div className="space-y-3">
                {criticalFindings.map((f, idx) => (
                  <div key={idx}>{renderFinding(f, 'critical')}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {highFindings && highFindings.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-4 text-orange-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> High Priority Findings
              </h4>
              <div className="space-y-3">
                {highFindings.map((f, idx) => (
                  <div key={idx}>{renderFinding(f, 'high')}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Next Steps</h4>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  };

  // Helper function to provide actionable remediation guidance
  const getRemediationSteps = (ruleName: string, resourceType: string): string => {
    const lowerRule = ruleName.toLowerCase();
    const lowerType = resourceType.toLowerCase();
    
    // Access controls / authentication
    if (lowerRule.includes('access control') || lowerRule.includes('164.312(a)(1)')) {
      return 'Configure Conditional Access policies in Entra ID to require MFA and restrict access by location/device. Navigate to Entra ID → Security → Conditional Access → Create new policy.';
    }
    if (lowerRule.includes('automatic logoff') || lowerRule.includes('164.312(a)(2)(iii)')) {
      return 'Set session timeout policies: Entra ID → Enterprise Applications → [App] → Properties → Session Management. Also configure SharePoint/Teams idle session timeout in admin centers.';
    }
    if (lowerRule.includes('mfa') || lowerRule.includes('multi-factor')) {
      return 'Enable MFA for all users: Entra ID → Security → MFA → Getting Started. Create a Conditional Access policy requiring MFA for all cloud apps.';
    }
    if (lowerRule.includes('legacy auth') || lowerRule.includes('basic auth')) {
      return 'Block legacy authentication: Create a Conditional Access policy with Client apps = "Other clients" and Access = "Block". Test in Report-only mode first.';
    }
    
    // Conditional Access
    if (lowerType.includes('conditionalaccess') || lowerRule.includes('conditional access')) {
      return 'Review and update Conditional Access policies in Entra ID → Security → Conditional Access. Ensure policies cover all users and critical applications.';
    }
    
    // Device management
    if (lowerRule.includes('encryption') || lowerRule.includes('audit control')) {
      return 'Enable BitLocker via Intune: Devices → Configuration profiles → Create → Endpoint protection. Ensure encryption is required for compliance.';
    }
    if (lowerType.includes('device') || lowerRule.includes('device')) {
      return 'Configure device compliance policies in Intune → Devices → Compliance policies. Require encryption, PIN, and OS updates.';
    }
    
    // Data protection
    if (lowerRule.includes('transmission') || lowerRule.includes('integrity')) {
      return 'Enforce TLS 1.2+ for all services. Review Exchange connectors and SharePoint settings to ensure encryption in transit.';
    }
    
    // SharePoint/Teams
    if (lowerType.includes('sharepoint')) {
      return 'Review sharing settings in SharePoint Admin Center → Policies → Sharing. Restrict external sharing and enable sensitivity labels.';
    }
    if (lowerType.includes('teams')) {
      return 'Configure Teams policies in Teams Admin Center → Messaging/Meeting policies. Review guest access and external communication settings.';
    }
    
    // Exchange
    if (lowerType.includes('exchange') || lowerType.includes('mail')) {
      return 'Review mail flow rules in Exchange Admin Center → Mail flow → Rules. Enable transport encryption and configure anti-phishing policies.';
    }
    
    // Default
    return 'Review this configuration in the Microsoft 365 admin center or Entra ID portal. Consider enabling additional security controls and monitoring.';
  };

  const renderContent = () => {
    switch (report.report_type) {
      case 'executive_summary':
        return renderExecutiveSummary();
      case 'compliance':
        return renderComplianceReport();
      case 'drift':
        return renderDriftReport();
      case 'billing':
        return renderBillingReport();
      case 'security':
        return renderSecurityReport();
      default:
        return <p className="text-muted-foreground">Unknown report type</p>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{report.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generated: {format(new Date(report.generated_at), 'MMMM d, yyyy \'at\' HH:mm')}
                {customerName && ` • ${customerName}`}
              </p>
            </div>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon,
  valueClassName = ''
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
