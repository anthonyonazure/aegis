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
    const totalCustomers = summary.totalCustomers as number ?? 0;
    const exportSuccessRate = summary.exportSuccessRate as number ?? 0;
    const avgComplianceScore = summary.avgComplianceScore as number ?? 0;
    const driftDetectedCount = summary.driftDetectedCount as number ?? 0;
    
    // Generate insights based on data
    const insights: string[] = [];
    if (totalCustomers === 0) {
      insights.push('No customer tenants configured yet. Add tenants to start monitoring and exporting configurations.');
    }
    if (exportSuccessRate < 80 && exportSuccessRate > 0) {
      insights.push(`Export success rate is ${exportSuccessRate}%. Check failed exports for permission issues or connectivity problems.`);
    }
    if (avgComplianceScore < 70 && avgComplianceScore > 0) {
      insights.push(`Average compliance score of ${avgComplianceScore}% indicates security gaps. Review compliance checks for specific issues.`);
    } else if (avgComplianceScore >= 90) {
      insights.push(`Excellent compliance score of ${avgComplianceScore}%. Continue monitoring to maintain security posture.`);
    }
    if (driftDetectedCount > 0) {
      insights.push(`Configuration drift detected in ${driftDetectedCount} run(s). Review changes and determine if they're authorized.`);
    }
    
    return (
      <div className="space-y-6">
        {/* Overview explanation */}
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              This executive summary provides a high-level overview of your M365 tenant management activities, 
              including export operations, compliance status, and configuration drift detection across all monitored tenants.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard 
            label="Customer Tenants" 
            value={totalCustomers} 
            icon={<Users className="w-4 h-4" />}
            description="Number of M365 tenants being managed"
          />
          <MetricCard 
            label="Configuration Exports" 
            value={summary.totalExports as number ?? 0} 
            icon={<FileText className="w-4 h-4" />}
            description="Total export operations performed"
          />
          <MetricCard 
            label="Export Success Rate" 
            value={`${exportSuccessRate}%`} 
            icon={<CheckCircle2 className="w-4 h-4" />}
            valueClassName={getScoreColor(exportSuccessRate)}
            description="Percentage of exports completed successfully"
          />
          <MetricCard 
            label="Avg Compliance Score" 
            value={`${avgComplianceScore}%`} 
            icon={<FileCheck className="w-4 h-4" />}
            valueClassName={getScoreColor(avgComplianceScore)}
            description="Average security compliance across tenants"
          />
          <MetricCard 
            label="Drift Scans" 
            value={summary.driftDetectionRuns as number ?? 0} 
            icon={<GitCompare className="w-4 h-4" />}
            description="Number of configuration drift checks"
          />
          <MetricCard 
            label="Drift Issues Found" 
            value={driftDetectedCount} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={driftDetectedCount > 0 ? 'text-yellow-500' : 'text-green-500'}
            description={driftDetectedCount > 0 ? 'Unauthorized changes detected' : 'No unexpected changes'}
          />
        </div>

        {insights.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Key Insights
              </h4>
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Recommended Actions
              </h4>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400 min-w-[24px]">{idx + 1}.</span>
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

  const renderCMMCReport = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    const domains = data.domains as Array<{
      id: string; name: string; practiceCount: number; passed: number; failed: number; partial: number; review: number; score: number;
      practices: Array<{ id: string; name: string; description: string; m365Controls: string[]; status: string }>;
    }> | undefined;
    const gapAnalysis = data.gapAnalysis as Array<{ practiceId: string; name: string; status: string; remediation: string; effort: string }> | undefined;
    const overallScore = summary.overallScore as number ?? 0;
    const assessmentStatus = summary.assessmentStatus as string ?? '';
    const reportSubtype = data.reportSubtype as string ?? 'Full Audit';

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'pass': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Pass</Badge>;
        case 'fail': return <Badge variant="destructive">Fail</Badge>;
        case 'partial': return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Partial</Badge>;
        case 'review': return <Badge variant="outline">Manual Review</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
      }
    };

    return (
      <div className="space-y-6">
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">CMMC Level 1 — {reportSubtype}</h3>
              <Badge className={assessmentStatus.includes('READY') ? 'bg-green-500/10 text-green-600' : assessmentStatus.includes('NEAR') ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600'}>
                {assessmentStatus}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Assessment of all 17 CMMC Level 1 practices across 6 domains, mapped to your Microsoft 365 environment.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Overall Score" value={`${overallScore}%`} icon={<Shield className="w-4 h-4" />} valueClassName={getScoreColor(overallScore)} description="Across all 17 practices" />
          <MetricCard label="Passed" value={summary.passedPractices as number ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} description="Fully met practices" />
          <MetricCard label="Failed" value={summary.failedPractices as number ?? 0} icon={<XCircle className="w-4 h-4" />} description="Practices not met" />
          <MetricCard label="Manual Review" value={summary.reviewRequired as number ?? 0} icon={<AlertTriangle className="w-4 h-4" />} description="Requires manual verification" />
        </div>

        {domains && domains.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Domain Breakdown</h4>
              <div className="space-y-4">
                {domains.map((domain) => (
                  <Card key={domain.id}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{domain.id} — {domain.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${getScoreColor(domain.score)}`}>{domain.score}%</span>
                          <span className="text-xs text-muted-foreground">({domain.passed}/{domain.practiceCount} passed)</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-2">
                        {domain.practices.map((practice) => (
                          <div key={practice.id} className="flex items-start justify-between p-2 rounded border bg-muted/20">
                            <div className="flex-1 mr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">{practice.id}</span>
                                {getStatusBadge(practice.status)}
                              </div>
                              <p className="text-sm font-medium mt-1">{practice.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{practice.description}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {practice.m365Controls.map((ctrl, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{ctrl}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {gapAnalysis && gapAnalysis.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Gap Analysis & Remediation</h4>
              <div className="space-y-2">
                {gapAnalysis.map((gap, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono">{gap.practiceId}</span>
                      <Badge variant={gap.status === 'fail' ? 'destructive' : 'outline'}>{gap.status}</Badge>
                    </div>
                    <p className="text-sm font-medium">{gap.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{gap.remediation}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {(data.recommendations as string[])?.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
              <div className="space-y-2">
                {(data.recommendations as string[]).map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderComplianceReport = () => {
    // Check if this is a CMMC report
    if (data.reportFramework === 'CMMC Level 1') {
      return renderCMMCReport();
    }
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const history = data.history as Record<string, unknown>[] | undefined;
    const averageScore = summary.averageScore as number ?? 0;
    const lowestScore = summary.lowestScore as number ?? 0;
    const trend = summary.trend as string ?? 'stable';
    
    // Generate compliance insights
    const getComplianceInsight = () => {
      if (averageScore >= 90) return 'Your tenants are well-configured and meet most security requirements.';
      if (averageScore >= 70) return 'Most security controls are in place, but some areas need attention.';
      if (averageScore >= 50) return 'Significant security gaps exist. Prioritize addressing failed checks.';
      return 'Critical security issues detected. Immediate action required to protect your environment.';
    };
    
    const getTrendExplanation = () => {
      if (trend === 'improving') return 'Compliance scores are trending upward — your remediation efforts are working.';
      if (trend === 'declining') return 'Compliance scores are declining. Review recent configuration changes.';
      return 'Compliance scores have remained stable over the measured period.';
    };
    
    return (
      <div className="space-y-6">
        {/* Overview explanation */}
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              This report shows how well your M365 configurations align with security best practices and compliance requirements. 
              Higher scores indicate better adherence to security baselines.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard 
            label="Compliance Checks Run" 
            value={summary.totalChecks as number ?? 0} 
            icon={<FileCheck className="w-4 h-4" />}
            description="Number of compliance assessments performed"
          />
          <MetricCard 
            label="Average Score" 
            value={`${averageScore}%`} 
            icon={<BarChart3 className="w-4 h-4" />}
            valueClassName={getScoreColor(averageScore)}
            description={getComplianceInsight()}
          />
          <MetricCard 
            label="Lowest Score" 
            value={`${lowestScore}%`} 
            icon={<TrendingDown className="w-4 h-4" />}
            valueClassName={getScoreColor(lowestScore)}
            description="Tenant with the most security gaps"
          />
          <MetricCard 
            label="Best Score" 
            value={`${summary.highestScore ?? 0}%`} 
            icon={<TrendingUp className="w-4 h-4" />}
            valueClassName={getScoreColor(summary.highestScore as number ?? 0)}
            description="Best performing tenant"
          />
          <div className="col-span-2 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              {getTrendIcon(trend)}
              <span className="text-sm font-medium capitalize">{trend} Trend</span>
            </div>
            <p className="text-xs text-muted-foreground">{getTrendExplanation()}</p>
          </div>
        </div>

        {history && history.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Compliance Check History</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Each row shows a compliance assessment with pass/fail counts against security baselines.
              </p>
              <div className="space-y-2">
                {history.slice(0, 5).map((h, idx) => {
                  const passedCount = Number(h.passed_count ?? 0);
                  const failedCount = Number(h.failed_count ?? 0);
                  const score = Number(h.score ?? 0);
                  return (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {h.checked_at ? format(new Date(h.checked_at as string), 'MMM d, yyyy \'at\' HH:mm') : 'N/A'}
                        </span>
                        <Badge variant="outline" className={getScoreColor(score)}>
                          {score}% compliant
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {passedCount} checks passed
                        </span>
                        <span className="text-red-500 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {failedCount} checks failed
                        </span>
                      </div>
                    </div>
                  );
                })}
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
    const runsWithDrift = summary.runsWithDrift as number ?? 0;
    const driftRate = summary.driftRate as number ?? 0;
    
    return (
      <div className="space-y-6">
        {/* Overview explanation */}
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Configuration drift occurs when tenant settings change from their expected baseline state. 
              This can happen due to manual changes, policy updates, or unauthorized modifications. 
              Regular drift detection helps maintain configuration consistency across tenants.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="Drift Scans Completed" 
            value={summary.totalRuns as number ?? 0} 
            icon={<GitCompare className="w-4 h-4" />}
            description="Number of configuration comparisons performed"
          />
          <MetricCard 
            label="Scans with Changes" 
            value={runsWithDrift} 
            icon={<AlertTriangle className="w-4 h-4" />}
            valueClassName={runsWithDrift > 0 ? 'text-yellow-500' : 'text-green-500'}
            description={runsWithDrift > 0 ? 'Changes detected that need review' : 'No unexpected changes found'}
          />
          <MetricCard 
            label="Drift Rate" 
            value={`${driftRate}%`} 
            icon={<BarChart3 className="w-4 h-4" />}
            description="Percentage of scans detecting changes"
          />
          <MetricCard 
            label="Total Differences" 
            value={summary.totalDifferences as number ?? 0} 
            icon={<FileText className="w-4 h-4" />}
            description="Individual setting changes detected"
          />
        </div>

        {runs && runs.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recent Drift Detection Runs</h4>
              <div className="space-y-2">
                {runs.slice(0, 5).map((r, idx) => {
                  const hasDrift = r.drift_detected as boolean;
                  return (
                    <div key={idx} className={`p-3 rounded-lg border ${hasDrift ? 'border-yellow-500/30 bg-yellow-500/5' : 'bg-muted/20'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {r.started_at ? format(new Date(r.started_at as string), 'MMM d, yyyy \'at\' HH:mm') : 'N/A'}
                        </span>
                        <Badge variant={hasDrift ? 'destructive' : 'outline'} className={!hasDrift ? 'bg-green-500/10 text-green-500 border-green-500/30' : ''}>
                          {hasDrift ? 'Changes Detected' : 'No Changes'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scanned {String(r.total_tenants ?? 0)} tenant(s) • 
                        {hasDrift 
                          ? ' Review changes to determine if they were authorized' 
                          : ' Configuration matches expected baseline'}
                      </p>
                    </div>
                  );
                })}
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
    const totalBillable = Number(summary.totalBillable ?? 0);
    
    return (
      <div className="space-y-6">
        {/* Overview explanation */}
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              This billing report summarizes resource usage across your managed M365 tenants, 
              including user counts, device enrollments, and associated costs. 
              Use this data for customer invoicing and capacity planning.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            label="Resources Managed" 
            value={summary.totalResources as number ?? 0} 
            icon={<HardDrive className="w-4 h-4" />}
            description="Total configuration objects across tenants"
          />
          <MetricCard 
            label="Users" 
            value={summary.totalUsers as number ?? 0} 
            icon={<Users className="w-4 h-4" />}
            description="Licensed users across all tenants"
          />
          <MetricCard 
            label="Devices" 
            value={summary.totalDevices as number ?? 0} 
            icon={<Monitor className="w-4 h-4" />}
            description="Enrolled devices (Intune managed)"
          />
          <MetricCard 
            label="Total Billable" 
            value={`$${totalBillable.toFixed(2)}`} 
            icon={<DollarSign className="w-4 h-4" />}
            valueClassName="text-primary"
            description="Aggregated billing amount"
          />
        </div>

        {usage && usage.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Usage Breakdown by Period</h4>
              <div className="space-y-2">
                {usage.slice(0, 5).map((u, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">
                          {u.period_start ? format(new Date(u.period_start as string), 'MMMM yyyy') : 'N/A'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          • {u.customerName as string ?? 'All Customers'}
                        </span>
                      </div>
                      <span className="font-semibold text-primary">
                        ${Number(u.billable_amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{String(u.total_resources ?? 0)} resources</span>
                      <span>{String(u.total_users ?? 0)} users</span>
                      <span>{String(u.total_devices ?? 0)} devices</span>
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

  const renderTenantSummary = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const tenants = data.tenants as Record<string, unknown>[] | undefined;
    const recommendations = data.recommendations as string[] | undefined;
    
    return (
      <div className="space-y-6">
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Overview of all connected M365 tenants, their health status, connectivity, and security posture.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Total Tenants" value={summary.totalTenants as number ?? summary.tenantCount as number ?? 0} icon={<Monitor className="w-4 h-4" />} description="Managed tenant connections" />
          <MetricCard label="Connected" value={summary.connectedTenants as number ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} valueClassName="text-green-500" description="Actively connected tenants" />
          <MetricCard label="Healthy" value={summary.healthyTenants as number ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} valueClassName="text-green-500" />
          <MetricCard label="Warning" value={summary.warningTenants as number ?? 0} icon={<AlertTriangle className="w-4 h-4" />} valueClassName={(summary.warningTenants as number ?? 0) > 0 ? 'text-yellow-500' : ''} />
          <MetricCard label="Critical" value={summary.criticalTenants as number ?? 0} icon={<XCircle className="w-4 h-4" />} valueClassName={(summary.criticalTenants as number ?? 0) > 0 ? 'text-red-500' : ''} />
          <MetricCard label="Avg Secure Score" value={`${summary.avgSecureScore ?? 0}%`} icon={<Shield className="w-4 h-4" />} valueClassName={getScoreColor(summary.avgSecureScore as number ?? 0)} />
        </div>

        {tenants && tenants.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Tenant Details</h4>
              <div className="space-y-2">
                {tenants.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.displayName as string ?? t.tenantName as string ?? 'Unknown'}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline">{t.status as string ?? 'unknown'}</Badge>
                        <Badge variant="outline" className={
                          (t.healthStatus as string) === 'healthy' ? 'text-green-500 border-green-500/30' :
                          (t.healthStatus as string) === 'warning' ? 'text-yellow-500 border-yellow-500/30' :
                          (t.healthStatus as string) === 'critical' ? 'text-red-500 border-red-500/30' : ''
                        }>{t.healthStatus as string ?? 'unknown'}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Environment: {t.environment as string ?? 'production'}</span>
                      <span>Secure Score: {t.secureScorePercent as number ?? 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
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

  const renderPsaTickets = () => {
    if (!summary) return <p className="text-muted-foreground">No data available</p>;
    
    const tickets = (data.tickets ?? data.psaTicketDetails) as Record<string, unknown>[] | undefined;
    const recommendations = data.recommendations as string[] | undefined;
    
    return (
      <div className="space-y-6">
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Summary of PSA tickets created from drift detection, compliance failures, and other automated events.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Total Tickets" value={summary.totalTickets as number ?? 0} icon={<FileText className="w-4 h-4" />} />
          <MetricCard label="Customers" value={summary.customerCount as number ?? 0} icon={<Users className="w-4 h-4" />} />
          <MetricCard label="Tenants" value={summary.tenantCount as number ?? 0} icon={<Monitor className="w-4 h-4" />} />
        </div>

        {tickets && tickets.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recent Tickets</h4>
              <div className="space-y-2">
                {tickets.slice(0, 10).map((t, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.title as string ?? 'Untitled'}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline">{t.status as string ?? ''}</Badge>
                        <Badge variant={
                          (t.priority as string) === 'critical' ? 'destructive' : 'outline'
                        } className={
                          (t.priority as string) === 'high' ? 'text-orange-500 border-orange-500/30' : ''
                        }>{t.priority as string ?? ''}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Type: {(t.ticketType ?? t.ticket_type) as string ?? ''}</span>
                      {(t.createdAt ?? t.created_at) && (
                        <span>Created: {format(new Date(String(t.createdAt ?? t.created_at)), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
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

  const renderGenericReport = () => {
    const recommendations = data.recommendations as string[] | undefined;
    
    return (
      <div className="space-y-6">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(summary)
              .filter(([, v]) => v !== null && v !== undefined)
              .slice(0, 9)
              .map(([key, value], idx) => (
                <MetricCard 
                  key={idx}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  value={typeof value === 'number' ? value : String(value)}
                  icon={<FileText className="w-4 h-4" />}
                />
              ))}
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
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
      case 'tenant_summary':
        return renderTenantSummary();
      case 'psa_tickets':
        return renderPsaTickets();
      // Categories that produce specific data shapes from edge function
      case 'identity':
      case 'devices':
      case 'exchange':
      case 'sharepoint':
      case 'teams':
      case 'licensing':
      case 'copilot':
        return renderGenericReport();
      default:
        return renderGenericReport();
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
  valueClassName = '',
  description
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  valueClassName?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
