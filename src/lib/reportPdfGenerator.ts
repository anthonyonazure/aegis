import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Report, ReportType } from './reportDatabase';

interface ReportData {
  summary?: Record<string, unknown>;
  recommendations?: string[];
  recentActivity?: Record<string, unknown[]>;
  history?: Record<string, unknown>[];
  runs?: Record<string, unknown>[];
  usage?: Record<string, unknown>[];
  criticalFindings?: Record<string, unknown>[];
  highFindings?: Record<string, unknown>[];
  generatedAt?: string;
  [key: string]: unknown;
}

export function generateReportPdf(report: Report, customerName?: string): void {
  const doc = new jsPDF();
  const data = report.data as ReportData;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(31, 41, 55); // bg-gray-800
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(report.name, 20, 25);
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(report.generated_at), 'MMMM d, yyyy \'at\' HH:mm')}`, 20, 35);
  
  // Reset colors
  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  // Customer info if available
  if (customerName) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Customer: ${customerName}`, 20, yPos);
    yPos += 10;
  }

  // Date range if available
  if (report.date_range_start || report.date_range_end) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const start = report.date_range_start ? format(new Date(report.date_range_start), 'MMM d, yyyy') : 'Beginning';
    const end = report.date_range_end ? format(new Date(report.date_range_end), 'MMM d, yyyy') : 'Present';
    doc.text(`Period: ${start} - ${end}`, 20, yPos);
    yPos += 15;
  }

  // Generate content based on report type
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
    default:
      doc.text('Report data not available', 20, yPos);
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

  // Download
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

function generateExecutiveSummaryContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, number> | undefined;
  
  // Summary Section
  yPos = addSectionHeader(doc, 'Executive Summary', yPos);
  
  if (summary) {
    const metrics = [
      { label: 'Total Customers', value: summary.totalCustomers ?? 0 },
      { label: 'Total Exports', value: summary.totalExports ?? 0 },
      { label: 'Export Success Rate', value: `${summary.exportSuccessRate ?? 0}%` },
      { label: 'Avg Compliance Score', value: `${summary.avgComplianceScore ?? 0}%` },
      { label: 'Drift Runs', value: summary.driftDetectionRuns ?? 0 },
      { label: 'Drift Detected', value: summary.driftDetectedCount ?? 0 },
    ];
    
    let xPos = 20;
    metrics.forEach((metric, idx) => {
      if (idx > 0 && idx % 3 === 0) {
        yPos += 20;
        xPos = 20;
      }
      addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
      xPos += 60;
    });
    yPos += 30;
  }

  // Recommendations
  const recommendations = data.recommendations as string[] | undefined;
  if (recommendations && recommendations.length > 0) {
    yPos = addSectionHeader(doc, 'Recommendations', yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    recommendations.forEach((rec: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`• ${rec}`, 25, yPos);
      yPos += 7;
    });
  }

  return yPos;
}

function generateComplianceContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Compliance Overview', yPos);
  
  if (summary) {
    const metrics = [
      { label: 'Total Checks', value: Number(summary.totalChecks ?? 0) },
      { label: 'Average Score', value: `${summary.averageScore ?? 0}%` },
      { label: 'Lowest Score', value: `${summary.lowestScore ?? 0}%` },
      { label: 'Highest Score', value: `${summary.highestScore ?? 0}%` },
      { label: 'Trend', value: String(summary.trend ?? 'N/A').charAt(0).toUpperCase() + String(summary.trend ?? 'N/A').slice(1) },
    ];
    
    let xPos = 20;
    metrics.forEach((metric, idx) => {
      if (idx > 0 && idx % 3 === 0) {
        yPos += 20;
        xPos = 20;
      }
      addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
      xPos += 55;
    });
    yPos += 30;
  }

  // History table
  const history = data.history as Record<string, unknown>[] | undefined;
  if (history && history.length > 0) {
    yPos = addSectionHeader(doc, 'Compliance History', yPos);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Score', 'Passed', 'Failed', 'Warnings']],
      body: history.slice(0, 20).map((h: Record<string, unknown>) => [
        h.checked_at ? format(new Date(h.checked_at as string), 'MMM d, yyyy') : 'N/A',
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

  return yPos;
}

function generateDriftContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Drift Detection Overview', yPos);
  
  if (summary) {
    const metrics = [
      { label: 'Total Runs', value: Number(summary.totalRuns ?? 0) },
      { label: 'Runs with Drift', value: Number(summary.runsWithDrift ?? 0) },
      { label: 'Drift Rate', value: `${summary.driftRate ?? 0}%` },
      { label: 'Total Differences', value: Number(summary.totalDifferences ?? 0) },
    ];
    
    let xPos = 20;
    metrics.forEach((metric, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        yPos += 20;
        xPos = 20;
      }
      addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
      xPos += 80;
    });
    yPos += 30;
  }

  // Runs table
  const runs = data.runs as Record<string, unknown>[] | undefined;
  if (runs && runs.length > 0) {
    yPos = addSectionHeader(doc, 'Recent Drift Runs', yPos);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Status', 'Tenants', 'Drift Detected', 'Differences']],
      body: runs.slice(0, 15).map((r: Record<string, unknown>) => [
        r.started_at ? format(new Date(r.started_at as string), 'MMM d, yyyy') : 'N/A',
        String(r.status ?? 'N/A'),
        String(r.total_tenants ?? 0),
        r.drift_detected ? 'Yes' : 'No',
        String(r.total_differences ?? 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  return yPos;
}

function generateBillingContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Billing Summary', yPos);
  
  if (summary) {
    const metrics = [
      { label: 'Total Resources', value: Number(summary.totalResources ?? 0) },
      { label: 'Total Users', value: Number(summary.totalUsers ?? 0) },
      { label: 'Total Devices', value: Number(summary.totalDevices ?? 0) },
      { label: 'Total Billable', value: `$${Number(summary.totalBillable ?? 0).toFixed(2)}` },
    ];
    
    let xPos = 20;
    metrics.forEach((metric, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        yPos += 20;
        xPos = 20;
      }
      addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
      xPos += 80;
    });
    yPos += 30;
  }

  // Usage table
  const usage = data.usage as Record<string, unknown>[] | undefined;
  if (usage && usage.length > 0) {
    yPos = addSectionHeader(doc, 'Usage Details', yPos);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Period', 'Customer', 'Resources', 'Users', 'Devices', 'Amount']],
      body: usage.slice(0, 20).map((u: Record<string, unknown>) => [
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

  return yPos;
}

function generateSecurityContent(doc: jsPDF, data: ReportData, yPos: number): number {
  const summary = data.summary as Record<string, unknown> | undefined;
  
  yPos = addSectionHeader(doc, 'Security Posture', yPos);
  
  if (summary) {
    // Score indicator
    const score = Number(summary.overallScore ?? 0);
    doc.setFontSize(14);
    doc.setTextColor(score >= 80 ? 22 : score >= 60 ? 217 : 239, score >= 80 ? 163 : score >= 60 ? 119 : 68, score >= 80 ? 74 : score >= 60 ? 6 : 68);
    doc.text(`Overall Score: ${score}%`, 20, yPos);
    yPos += 15;
    
    doc.setTextColor(0, 0, 0);
    
    const metrics = [
      { label: 'Critical Issues', value: Number(summary.criticalIssues ?? 0) },
      { label: 'High Issues', value: Number(summary.highIssues ?? 0) },
      { label: 'Medium Issues', value: Number(summary.mediumIssues ?? 0) },
      { label: 'Total Issues', value: Number(summary.totalIssues ?? 0) },
    ];
    
    let xPos = 20;
    metrics.forEach((metric, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        yPos += 20;
        xPos = 20;
      }
      addKeyValuePair(doc, metric.label, metric.value, xPos, yPos);
      xPos += 80;
    });
    yPos += 30;
  }

  // Critical findings
  const criticalFindings = data.criticalFindings as Record<string, unknown>[] | undefined;
  if (criticalFindings && criticalFindings.length > 0) {
    yPos = addSectionHeader(doc, 'Critical Findings', yPos);
    
    doc.setFontSize(10);
    criticalFindings.forEach((finding: Record<string, unknown>) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setTextColor(239, 68, 68);
      doc.text(`• ${finding.ruleName ?? finding.name ?? 'Unknown issue'}`, 25, yPos);
      yPos += 7;
    });
    yPos += 5;
  }

  // High findings
  const highFindings = data.highFindings as Record<string, unknown>[] | undefined;
  if (highFindings && highFindings.length > 0) {
    yPos = addSectionHeader(doc, 'High Priority Findings', yPos);
    
    doc.setFontSize(10);
    highFindings.forEach((finding: Record<string, unknown>) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setTextColor(249, 115, 22);
      doc.text(`• ${String(finding.ruleName ?? finding.name ?? 'Unknown issue')}`, 25, yPos);
      yPos += 7;
    });
    yPos += 5;
  }

  // Recommendations
  const recommendations = data.recommendations as string[] | undefined;
  if (recommendations && recommendations.length > 0) {
    yPos = addSectionHeader(doc, 'Recommendations', yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    recommendations.forEach((rec: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`• ${rec}`, 25, yPos);
      yPos += 7;
    });
  }

  return yPos;
}
