import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Report } from './reportDatabase';

interface ReportData {
  summary?: Record<string, unknown>;
  recommendations?: string[];
  recentActivity?: Record<string, unknown[]>;
  history?: Record<string, unknown>[];
  runs?: Record<string, unknown>[];
  usage?: Record<string, unknown>[];
  criticalFindings?: Record<string, unknown>[];
  highFindings?: Record<string, unknown>[];
  secureScores?: Array<{ tenantName: string; currentScore: number; maxScore: number; percentage: number }>;
  tenants?: Record<string, unknown>[];
  psaTicketDetails?: Record<string, unknown>[];
  generatedAt?: string;
  [key: string]: unknown;
}

export function generateReportPdf(report: Report, customerName?: string): void {
  const doc = new jsPDF();
  const data = report.data as ReportData;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(report.name, 20, 25);
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(report.generated_at), 'MMMM d, yyyy \'at\' HH:mm')}`, 20, 35);
  
  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  if (customerName) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Customer: ${customerName}`, 20, yPos);
    yPos += 10;
  }

  if (report.date_range_start || report.date_range_end) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const start = report.date_range_start ? format(new Date(report.date_range_start), 'MMM d, yyyy') : 'Beginning';
    const end = report.date_range_end ? format(new Date(report.date_range_end), 'MMM d, yyyy') : 'Present';
    doc.text(`Period: ${start} - ${end}`, 20, yPos);
    yPos += 15;
  }

  switch (report.report_type) {
    case 'executive_summary':
      yPos = generateExecutiveSummaryContent(doc, data, yPos);
      break;
    case 'compliance':
      yPos = generateComplianceContent(doc, data, yPos);
      break;
    case 'drift':
      yPos = generateDriftContent(doc, data, yPos);
      break;
    case 'billing':
      yPos = generateBillingContent(doc, data, yPos);
      break;
    case 'security':
      yPos = generateSecurityContent(doc, data, yPos);
      break;
    case 'tenant_summary':
      yPos = generateTenantSummaryContent(doc, data, yPos);
      break;
    case 'psa_tickets':
      yPos = generatePsaTicketsContent(doc, data, yPos);
      break;
    default:
      yPos = generateGenericContent(doc, data, yPos);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}

function addSectionHeader(doc: jsPDF, text: string, yPos: number): number {
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text(text, 20, yPos);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 100, yPos + 2);
  return yPos + 12;
}

function addKeyValuePair(doc: jsPDF, key: string, value: string | number, xPos: number, yPos: number): void {
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(key, xPos, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(String(value), xPos, yPos + 6);
}

function addRecommendations(doc: jsPDF, recommendations: string[] | undefined, yPos: number): number {
  if (!recommendations || recommendations.length === 0) return yPos;
  yPos = addSectionHeader(doc, 'Recommendations', yPos);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  recommendations.forEach((rec: string) => {
    if (yPos > 270) { doc.addPage(); yPos = 20; }
    doc.text(`• ${rec}`, 25, yPos);
    yPos += 7;
  });
  return yPos;
}

function addMetricsGrid(doc: jsPDF, metrics: Array<{ label: string; value: string | number }>, yPos: number, colsPerRow = 3): number {
  let xPos = 20;
  const colWidth = Math.floor(160 / colsPerRow);
  metrics.forEach((metric, idx) => {
    if (idx > 0 && idx % colsPerRow === 0) {
      yPos += 20;
      xPos = 20;
    }
    addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
    xPos += colWidth;
  });
  return yPos + 30;
}

function generateExecutiveSummaryContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, number> | undefined;
  
  yPos = addSectionHeader(doc, 'Executive Summary', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Customers', value: summary.totalCustomers ?? 0 },
      { label: 'Total Tenants', value: summary.totalTenants ?? summary.tenantCount ?? 0 },
      { label: 'Export Success Rate', value: `${summary.exportSuccessRate ?? 0}%` },
      { label: 'Avg Compliance Score', value: `${summary.avgComplianceScore ?? 0}%` },
      { label: 'Drift Scans', value: summary.driftDetectionRuns ?? 0 },
      { label: 'Drift Detected', value: summary.driftDetectedCount ?? 0 },
    ], yPos);
  }

  // Secure scores table
  const secureScores = data.secureScores as Array<{ tenantName: string; percentage: number }> | undefined;
  if (secureScores && secureScores.length > 0) {
    yPos = addSectionHeader(doc, 'Secure Scores by Tenant', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Tenant', 'Score %']],
      body: secureScores.map(s => [s.tenantName, `${s.percentage}%`]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateComplianceContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Compliance Overview', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Checks', value: Number(summary.totalChecks ?? 0) },
      { label: 'Average Score', value: `${summary.averageScore ?? 0}%` },
      { label: 'Passed', value: Number(summary.passedChecks ?? 0) },
      { label: 'Failed', value: Number(summary.failedChecks ?? 0) },
      { label: 'Lowest Score', value: `${summary.lowestScore ?? 0}%` },
      { label: 'Highest Score', value: `${summary.highestScore ?? 0}%` },
    ], yPos);
  }

  const history = data.history as Record<string, unknown>[] | undefined;
  if (history && history.length > 0) {
    yPos = addSectionHeader(doc, 'Compliance History', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Baseline', 'Score', 'Passed', 'Failed', 'Warnings']],
      body: history.slice(0, 20).map((h) => [
        h.checked_at ? format(new Date(h.checked_at as string), 'MMM d, yyyy') : 'N/A',
        String(h.baseline_name ?? ''),
        `${Number(h.score ?? 0)}%`,
        String(h.passed_count ?? 0),
        String(h.failed_count ?? 0),
        String(h.warning_count ?? 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateDriftContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Drift Detection Overview', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Scans', value: Number(summary.totalRuns ?? summary.totalScans ?? 0) },
      { label: 'Scans with Drift', value: Number(summary.runsWithDrift ?? summary.driftDetected ?? 0) },
      { label: 'Drift Rate', value: `${summary.driftRate ?? 0}%` },
      { label: 'Total Changes', value: Number(summary.totalDifferences ?? summary.totalChanges ?? 0) },
    ], yPos, 2);
  }

  const runs = data.runs as Record<string, unknown>[] | undefined;
  if (runs && runs.length > 0) {
    yPos = addSectionHeader(doc, 'Recent Drift Runs', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Status', 'Drift', 'Added', 'Modified', 'Removed']],
      body: runs.slice(0, 15).map((r) => [
        r.started_at ? format(new Date(r.started_at as string), 'MMM d, yyyy') : 'N/A',
        String(r.status ?? 'N/A'),
        r.drift_detected ? 'Yes' : 'No',
        String(r.added ?? 0),
        String(r.modified ?? 0),
        String(r.removed ?? 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateBillingContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Billing Summary', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Billable', value: typeof summary.totalSpend === 'string' ? summary.totalSpend : `$${Number(summary.totalBillable ?? 0).toFixed(2)}` },
      { label: 'Total Users', value: Number(summary.totalUsers ?? 0) },
      { label: 'Total Devices', value: Number(summary.totalDevices ?? 0) },
      { label: 'Total Resources', value: Number(summary.totalResources ?? 0) },
    ], yPos, 2);
  }

  const usage = data.usage as Record<string, unknown>[] | undefined;
  if (usage && usage.length > 0) {
    yPos = addSectionHeader(doc, 'Usage Details', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Period', 'Customer', 'Resources', 'Users', 'Devices', 'Amount']],
      body: usage.slice(0, 20).map((u) => [
        u.period_start ? format(new Date(u.period_start as string), 'MMM yyyy') : 'N/A',
        String(u.customerName ?? 'All'),
        String(Number(u.total_resources ?? 0)),
        String(Number(u.total_users ?? 0)),
        String(Number(u.total_devices ?? 0)),
        `$${Number(u.billable_amount ?? 0).toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateSecurityContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Security Posture', yPos);
  
  if (summary) {
    const score = Number(summary.overallScore ?? summary.overallSecurityScore ?? 0);
    doc.setFontSize(14);
    doc.setTextColor(score >= 80 ? 22 : score >= 60 ? 217 : 239, score >= 80 ? 163 : score >= 60 ? 119 : 68, score >= 80 ? 74 : score >= 60 ? 6 : 68);
    doc.text(`Overall Score: ${score}%`, 20, yPos);
    yPos += 15;
    doc.setTextColor(0, 0, 0);
    
    yPos = addMetricsGrid(doc, [
      { label: 'Critical Issues', value: Number(summary.criticalIssues ?? 0) },
      { label: 'High Issues', value: Number(summary.highIssues ?? 0) },
      { label: 'MFA Coverage', value: `${summary.mfaCoverage ?? 0}%` },
      { label: 'CA Policies', value: Number(summary.conditionalAccessPolicies ?? 0) },
    ], yPos, 2);
  }

  // Secure scores table
  const secureScores = data.secureScores as Array<{ tenantName: string; currentScore: number; maxScore: number; percentage: number }> | undefined;
  if (secureScores && secureScores.length > 0) {
    yPos = addSectionHeader(doc, 'Secure Scores by Tenant', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Tenant', 'Score', 'Max', 'Percentage']],
      body: secureScores.map(s => [s.tenantName, String(s.currentScore), String(s.maxScore), `${s.percentage}%`]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Findings
  const criticalFindings = data.criticalFindings as Record<string, unknown>[] | undefined;
  if (criticalFindings && criticalFindings.length > 0) {
    yPos = addSectionHeader(doc, 'Critical Findings', yPos);
    doc.setFontSize(10);
    criticalFindings.forEach((finding) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(239, 68, 68);
      doc.text(`• ${finding.ruleName ?? finding.name ?? 'Unknown issue'}`, 25, yPos);
      if (finding.message) {
        doc.setTextColor(100, 100, 100);
        doc.text(`  ${finding.message}`, 30, yPos + 5);
        yPos += 5;
      }
      yPos += 7;
    });
    yPos += 5;
  }

  const highFindings = data.highFindings as Record<string, unknown>[] | undefined;
  if (highFindings && highFindings.length > 0) {
    yPos = addSectionHeader(doc, 'High Priority Findings', yPos);
    doc.setFontSize(10);
    highFindings.forEach((finding) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(249, 115, 22);
      doc.text(`• ${String(finding.ruleName ?? finding.name ?? 'Unknown issue')}`, 25, yPos);
      if (finding.message) {
        doc.setTextColor(100, 100, 100);
        doc.text(`  ${finding.message}`, 30, yPos + 5);
        yPos += 5;
      }
      yPos += 7;
    });
    yPos += 5;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateTenantSummaryContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Tenant Summary', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Tenants', value: Number(summary.totalTenants ?? summary.tenantCount ?? 0) },
      { label: 'Connected', value: Number(summary.connectedTenants ?? 0) },
      { label: 'Healthy', value: Number(summary.healthyTenants ?? 0) },
      { label: 'Warning', value: Number(summary.warningTenants ?? 0) },
      { label: 'Critical', value: Number(summary.criticalTenants ?? 0) },
      { label: 'Avg Secure Score', value: `${summary.avgSecureScore ?? 0}%` },
    ], yPos);
  }

  const tenants = data.tenants as Record<string, unknown>[] | undefined;
  if (tenants && tenants.length > 0) {
    yPos = addSectionHeader(doc, 'Tenant Details', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Tenant', 'Status', 'Health', 'Environment', 'Secure Score']],
      body: tenants.map(t => [
        String(t.displayName ?? t.tenantName ?? 'Unknown'),
        String(t.status ?? 'unknown'),
        String(t.healthStatus ?? 'unknown'),
        String(t.environment ?? 'production'),
        `${t.secureScorePercent ?? 0}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generatePsaTicketsContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'PSA Tickets Summary', yPos);
  
  if (summary) {
    yPos = addMetricsGrid(doc, [
      { label: 'Total Tickets', value: Number(summary.totalTickets ?? 0) },
      { label: 'Customers', value: Number(summary.customerCount ?? 0) },
      { label: 'Tenants', value: Number(summary.tenantCount ?? 0) },
    ], yPos);
  }

  // Ticket details from enriched data
  const tickets = (data.tickets ?? data.psaTicketDetails) as Record<string, unknown>[] | undefined;
  if (tickets && tickets.length > 0) {
    yPos = addSectionHeader(doc, 'Ticket Details', yPos);
    autoTable(doc, {
      startY: yPos,
      head: [['Title', 'Status', 'Priority', 'Type', 'Created']],
      body: tickets.slice(0, 30).map(t => [
        String(t.title ?? ''),
        String(t.status ?? ''),
        String(t.priority ?? ''),
        String(t.ticketType ?? t.ticket_type ?? ''),
        t.createdAt || t.created_at ? format(new Date(String(t.createdAt ?? t.created_at)), 'MMM d, yyyy') : 'N/A',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}

function generateGenericContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Report Summary', yPos);
  
  if (summary) {
    const entries = Object.entries(summary).filter(([, v]) => v !== null && v !== undefined);
    const metrics = entries.map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      value: typeof value === 'number' ? value : String(value),
    }));
    yPos = addMetricsGrid(doc, metrics.slice(0, 12), yPos);
  }

  yPos = addRecommendations(doc, data.recommendations, yPos);
  return yPos;
}
