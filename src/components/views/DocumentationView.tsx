import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import {
  Book,
  Download,
  FileText,
  FileDown,
  Shield,
  Users,
  Building2,
  Settings,
  Key,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Copy,
  Rocket,
  BarChart3,
  RefreshCw,
  Bell,
  Layers,
  GitBranch,
  Upload,
  FileCheck,
  CreditCard,
  Webhook,
  Calendar,
  Brain,
  Sparkles,
  Bot
} from 'lucide-react';

const DOCUMENTATION_CONTENT = {
  overview: {
    title: 'Overview',
    icon: Book,
    content: `
# M365 Governance Manager

A comprehensive Microsoft 365 governance and management platform designed for Managed Service Providers (MSPs) and IT administrators to manage multiple Microsoft 365 tenants efficiently.

## Key Features

- **Multi-Tenant Management**: Connect and manage multiple M365 tenants from a single dashboard
- **Policy Deployment**: Create and deploy policies across tenants with dry-run support
- **Configuration Export/Import**: Export tenant configurations in multiple formats (JSON, PowerShell, Terraform, Bicep)
- **Drift Detection**: Monitor configuration changes and detect drift from baselines
- **Compliance Monitoring**: Run compliance scans against industry standards (CIS, NIST, ISO 27001)
- **Governance Center**: Centralized view of security scores, identity metrics, and licensing
- **Automated Backups**: Schedule automatic configuration backups with retention policies
- **Webhook Notifications**: Get alerts via webhooks for governance events
- **Customer Management**: Organize tenants by customer with grouping capabilities
- **Audit Logging**: Complete audit trail of all actions performed
- **AI-Powered Intelligence**: Built-in AI analysis for tenant health, compliance, risk scoring, and recommendations
- **BYOK AI Support**: Bring your own API keys for OpenAI, Google, Anthropic, Azure, and more

## Architecture

The platform is built on:
- **Frontend**: React with TypeScript, Tailwind CSS, and shadcn/ui components
- **Backend**: Supabase (PostgreSQL database, Edge Functions, Auth)
- **APIs**: Microsoft Graph API for M365 integration
- **AI Gateway**: Multi-provider AI with automatic fallback and streaming support
`
  },
  setup: {
    title: 'Setup Guide',
    icon: Settings,
    content: `
# Setup Guide

## Prerequisites

Before you begin, ensure you have:

1. A Microsoft 365 tenant with Global Administrator access
2. An Azure Active Directory with permissions to create App Registrations
3. A web browser (Chrome, Firefox, Edge, or Safari recommended)

## Step 1: Create an Azure App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations** → **New registration**
3. Enter a name (e.g., "M365 Governance Manager")
4. Select **Accounts in any organizational directory** for multi-tenant support
5. Click **Register**

### Required API Permissions

Add the following Microsoft Graph API permissions:

**Application Permissions (Admin consent required):**
- \`Directory.Read.All\` - Read directory data
- \`User.Read.All\` - Read all users
- \`Group.Read.All\` - Read all groups
- \`Policy.Read.All\` - Read policies
- \`SecurityEvents.Read.All\` - Read security events
- \`DeviceManagementConfiguration.Read.All\` - Read Intune config
- \`Organization.Read.All\` - Read organization info
- \`AuditLog.Read.All\` - Read audit logs

**For write operations (policy deployment):**
- \`Policy.ReadWrite.ConditionalAccess\` - Manage CA policies
- \`DeviceManagementConfiguration.ReadWrite.All\` - Manage Intune

### Create Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Add a description and set expiration (recommended: 24 months)
3. Copy the secret value immediately (you won't see it again)

## Step 2: Connect Your First Tenant

1. Log in to the M365 Governance Manager
2. Navigate to **Authentication** in the sidebar
3. Click **Add Tenant Connection**
4. Enter:
   - **Tenant ID**: Found in Azure AD Overview
   - **Client ID**: From the App Registration
   - **Client Secret**: The secret you created
   - **Display Name**: Friendly name for the tenant
5. Click **Connect**

The platform will validate the credentials and test the connection.

## Step 3: Create a Customer (Optional)

Organize tenants by customer:

1. Go to **Customers** in the sidebar
2. Click **Add Customer**
3. Fill in customer details:
   - Name
   - Industry (optional)
   - Tier (Standard, Premium, Enterprise)
   - Primary contact information
4. Assign tenants to the customer

## Step 4: Configure Service Principal (For Automation)

For scheduled tasks and automation:

1. Go to **Authentication** → **Service Principals**
2. Click **Add Service Principal Configuration**
3. Enter the credentials for automated access
4. Select connection types (Graph API, Azure Management, etc.)
`
  },
  tenantManagement: {
    title: 'Tenant Management',
    icon: Building2,
    content: `
# Tenant Management

## Connecting Tenants

### Authentication Methods

The platform supports two authentication methods:

1. **Interactive (Delegated)**: User signs in with their credentials
2. **Service Principal (Application)**: App-only authentication with client credentials

### Tenant Connection Status

Tenants can have the following statuses:

| Status | Description |
|--------|-------------|
| \`connected\` | Successfully authenticated and operational |
| \`pending\` | Connection initiated, waiting for validation |
| \`error\` | Authentication failed or permissions missing |
| \`disconnected\` | Manually disconnected by user |

### Health Monitoring

The platform automatically monitors tenant health:

- **Healthy**: All API calls successful
- **Degraded**: Some API calls failing
- **Unhealthy**: Unable to communicate with tenant

## Tenant Groups

Organize tenants into logical groups:

1. Navigate to **Tenant Groups**
2. Create groups within a customer (e.g., "Production", "Development")
3. Assign tenants to groups
4. Target deployments and operations at group level

## Multi-Tenant Operations

### Selecting Tenants

Use the tenant selector in the sidebar to:

- Filter by customer
- Select individual tenants
- Apply operations to all connected tenants

### Bulk Operations

Many operations support multi-tenant execution:

- Policy deployments
- Configuration exports
- Compliance scans
- Drift detection
`
  },
  exportImport: {
    title: 'Export & Import',
    icon: Upload,
    content: `
# Export & Import

## Exporting Configurations

### Supported Export Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| JSON | Raw configuration data | Backup, comparison |
| PowerShell | Executable PS1 scripts | Manual deployment |
| Terraform | HCL configuration files | IaC pipelines |
| Bicep | Azure Bicep templates | ARM deployment |

### Export Process

1. Navigate to **Export**
2. Select the target tenant
3. Choose resource categories:
   - Conditional Access Policies
   - Intune Device Configurations
   - Compliance Policies
   - App Protection Policies
   - Security Configurations
4. Select output formats
5. Click **Start Export**

### Export Results

- Progress is tracked in real-time
- Download individual files or ZIP archive
- View exported resources in the dashboard

## Importing Configurations

### Import Sources

- Previous exports (same or different tenant)
- Uploaded JSON files
- Policy templates

### Import Process

1. Navigate to **Import**
2. Select source (previous export or file upload)
3. Choose destination tenant
4. Preview resources to import
5. Execute import (creates/updates resources)

### Conflict Resolution

When importing existing resources:

- **Skip**: Leave existing resource unchanged
- **Overwrite**: Replace with imported version
- **Merge**: Combine settings (where applicable)

## Scheduled Exports

Automate exports on a schedule:

1. Go to **Scheduled Exports**
2. Create a new schedule
3. Configure:
   - Name and description
   - Target tenant or service principal
   - Resource types to export
   - Output formats
   - Schedule (cron expression)
4. Enable the schedule

Exports run automatically and are stored with retention policies.
`
  },
  policyDeployment: {
    title: 'Policy Deployment',
    icon: Rocket,
    content: `
# Policy Deployment

## Policy Templates

### Creating Templates

1. Navigate to **Policy Templates**
2. Click **Create Template**
3. Configure:
   - Name and description
   - Category (Security, Identity, Compliance, etc.)
   - Baseline type (Custom, CIS, NIST, ISO 27001)
   - Policy data (JSON configuration)
   - Resource types affected

### Template Categories

- **Security**: Conditional Access, MFA policies
- **Identity**: User and group configurations
- **Compliance**: Audit and retention policies
- **Endpoint**: Intune device configurations
- **App Protection**: Mobile app policies

## Deploying Policies

### Deployment Wizard

1. Go to **Policy Deployment**
2. Select a policy template
3. Choose targets:
   - **All Tenants**: Deploy to all connected tenants
   - **Customer**: Deploy to all tenants of a customer
   - **Group**: Deploy to a tenant group
   - **Specific Tenants**: Select individual tenants
4. Configure options:
   - **Dry Run**: Preview changes without applying
   - **Schedule**: Deploy at a specific time
5. Start deployment

### Dry Run Mode

Always recommended before live deployment:

- Simulates the deployment
- Shows what would be created/modified/deleted
- Identifies potential conflicts
- No changes are made to the tenant

### Deployment Status

| Status | Description |
|--------|-------------|
| \`pending\` | Queued for execution |
| \`in_progress\` | Currently deploying |
| \`completed\` | Successfully deployed |
| \`partially_completed\` | Some tenants failed |
| \`failed\` | All tenants failed |
| \`rolled_back\` | Changes reverted |

### Rollback

If a deployment causes issues:

1. Find the deployment in history
2. Click **Rollback**
3. Confirm rollback operation
4. Original configurations are restored

## Scheduled Deployments

Automate recurring deployments:

1. Go to **Scheduled Deployments**
2. Create schedule with:
   - Policy template
   - Target tenants
   - Cron schedule
   - Notification settings
3. Monitor execution history
`
  },
  driftDetection: {
    title: 'Drift Detection',
    icon: GitBranch,
    content: `
# Drift Detection

## What is Configuration Drift?

Configuration drift occurs when the actual state of a tenant differs from the expected baseline. Common causes:

- Manual changes in admin portals
- Changes by other tools or scripts
- Policy conflicts or overwrites
- Automatic updates by Microsoft

## Setting Up Drift Detection

### Creating a Baseline

1. Navigate to **Drift Detection**
2. Select a tenant
3. Click **Create Baseline**
4. Choose an existing export as the baseline
5. Or run a new export to capture current state

### Running Drift Scans

1. Select a tenant with a baseline
2. Click **Run Drift Detection**
3. The scan compares current state to baseline
4. Results show:
   - **Added**: New resources not in baseline
   - **Modified**: Resources with changed properties
   - **Removed**: Resources deleted from tenant
   - **Unchanged**: Resources matching baseline

### Viewing Differences

Click on any drifted resource to see:

- Side-by-side comparison (baseline vs current)
- Highlighted property changes
- Timestamp of last modification
- Severity classification

## Scheduled Drift Detection

Automate drift monitoring:

1. Go to **Scheduled Drift**
2. Create a schedule:
   - Name and description
   - Target tenants
   - Baseline export
   - Resource types to monitor
   - Threshold for alerts (e.g., >5% drift)
   - Notification settings
3. Receive alerts when drift is detected

## Remediation

When drift is detected:

1. **Acknowledge**: Mark as intentional change
2. **Remediate**: Restore to baseline
3. **Update Baseline**: Accept current state as new baseline
4. **Create Ticket**: Open PSA ticket for investigation
`
  },
  complianceMonitoring: {
    title: 'Compliance Monitoring',
    icon: FileCheck,
    content: `
# Compliance Monitoring

## Compliance Baselines

### Supported Standards

| Standard | Description |
|----------|-------------|
| CIS Microsoft 365 | Center for Internet Security benchmarks |
| NIST 800-53 | Federal security controls |
| ISO 27001 | Information security management |
| SOC 2 | Service organization controls |
| HIPAA | Healthcare data protection |
| PCI-DSS | Payment card security |
| Custom | Your own compliance rules |

## Running Compliance Scans

1. Navigate to **Compliance**
2. Select baseline standard
3. Choose target tenant(s)
4. Click **Run Compliance Scan**
5. Review results

### Scan Results

Results are categorized:

- ✅ **Passed**: Control requirement met
- ⚠️ **Warning**: Partial compliance or best practice
- ❌ **Failed**: Control requirement not met
- ⏭️ **Skipped**: Not applicable or cannot check

### Compliance Score

Overall compliance score calculated as:

\`\`\`
Score = (Passed Controls / Total Applicable Controls) × 100
\`\`\`

## Compliance Dashboard

The compliance dashboard shows:

- Aggregate scores across tenants
- Trend over time
- Most common failures
- Remediation recommendations

## Custom Compliance Rules

Create custom rules:

1. Go to **Compliance** → **Custom Rules**
2. Define rule:
   - Name and description
   - Resource type to check
   - Property conditions
   - Expected values
   - Severity level
3. Add to compliance baseline

## Automated Remediation

Some compliance failures can be auto-remediated:

1. View failing control
2. Click **Remediate**
3. Review proposed changes
4. Deploy remediation policy
`
  },
  governanceCenter: {
    title: 'Governance Center',
    icon: Shield,
    content: `
# Governance Center

## Overview

The Governance Center provides a unified view of:

- **Security Posture**: Microsoft Secure Score and trends
- **Identity Health**: User statistics, MFA coverage, risky users
- **License Management**: Utilization, costs, optimization
- **Compliance Status**: Scan results and scores
- **Action Items**: Prioritized remediation tasks

## Security Metrics

### Secure Score

- Pulled from Microsoft Secure Score API
- Displayed as percentage of maximum
- Trend charts show improvement over time
- Drill down to improvement actions

### MFA Coverage

Tracks MFA enrollment across users:

- Total users vs MFA-enabled
- Admin accounts with MFA
- Coverage by user type

### Risky Users & Sign-ins

From Azure AD Identity Protection:

- Users flagged as risky
- Risky sign-in events
- Risk level distribution

## Identity Metrics

- Total users, admins, guests
- Stale accounts (no recent sign-in)
- Privileged role holders
- Group statistics

## License Management

### License Overview

- Total licenses by product
- Assigned vs available
- Utilization percentage
- Monthly cost (configurable pricing)

### Cost Optimization

- Identify unused licenses
- Detect over-provisioned users
- License downgrade recommendations
- Savings potential calculation

### Price Customization

1. Click **Edit Prices** in licensing section
2. Enter your contract prices per SKU
3. Save to update cost calculations

## Multi-Tenant Comparison

Compare metrics across all tenants:

- Heatmap visualization
- Sort by any metric
- Filter by customer
- Identify outliers

## Scheduled Governance Scans

Automate governance data collection:

1. Go to **Governance Center** → **Schedules**
2. Create schedule:
   - Target tenants
   - Metrics to collect
   - Threshold alerts
   - Webhook notifications
3. View historical trends
`
  },
  automation: {
    title: 'Automation',
    icon: Clock,
    content: `
# Automation

## Scheduled Tasks

### Available Automations

| Task Type | Description |
|-----------|-------------|
| Scheduled Exports | Automatic configuration backups |
| Scheduled Deployments | Recurring policy deployments |
| Scheduled Drift Detection | Periodic drift monitoring |
| Scheduled Governance | Regular governance scans |
| Automated Backups | Multi-tenant backup jobs |

### Creating Schedules

All schedules use cron expressions:

\`\`\`
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
\`\`\`

Common examples:
- \`0 2 * * *\` - Daily at 2 AM
- \`0 0 * * 0\` - Weekly on Sunday midnight
- \`0 0 1 * *\` - Monthly on the 1st

## Automated Backups

### Backup Configuration

1. Navigate to **Automated Backups**
2. Create backup job:
   - Name and description
   - Target: All tenants, customer, or group
   - Resource types to backup
   - Output formats
   - Schedule
   - Retention days
   - Auto-cleanup old backups

### Backup Runs

Monitor backup execution:

- Status per tenant
- Resources exported
- File sizes
- Download/restore options

## Azure Automation Integration

Connect to Azure Automation for advanced workflows:

1. Go to **Azure Automation**
2. Add automation account:
   - Subscription ID
   - Resource group
   - Automation account name
   - Runbook name
3. Trigger runbooks from the platform

## Webhook Notifications

### Creating Webhooks

1. Navigate to **Webhooks**
2. Click **Add Webhook**
3. Configure:
   - Name
   - URL (your endpoint)
   - Secret (for signature validation)
   - Events to trigger

### Webhook Events

| Event | Description |
|-------|-------------|
| \`deployment.completed\` | Policy deployment finished |
| \`deployment.failed\` | Policy deployment failed |
| \`drift.detected\` | Configuration drift found |
| \`compliance.failed\` | Compliance check failed |
| \`governance.alert\` | Governance threshold breached |
| \`backup.completed\` | Automated backup finished |

### Payload Format

\`\`\`json
{
  "event": "drift.detected",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "tenant_id": "xxx",
    "tenant_name": "Contoso",
    "drift_count": 5,
    "severity": "high"
  }
}
\`\`\`
`
  },
  reports: {
    title: 'Reports',
    icon: BarChart3,
    content: `
# Reports

## Report Types

### Security Reports

- **Security Posture Summary**: Overall security status
- **Conditional Access Analysis**: CA policy coverage
- **MFA Enrollment**: User MFA status
- **Privileged Users**: Admin role holders
- **Risky Users & Sign-ins**: Identity protection events

### Compliance Reports

- **CIS Benchmark**: Detailed CIS compliance
- **ISO 27001 Audit**: ISO control assessment
- **Custom Baseline**: Your compliance rules

### Identity Reports

- **User Inventory**: All users with attributes
- **Guest Users**: External collaboration audit
- **Stale Accounts**: Inactive user report
- **License Assignment**: Per-user licensing

### Licensing Reports

- **License Inventory**: All licenses by SKU
- **Utilization Report**: Usage analysis
- **Cost Analysis**: Monthly spend breakdown
- **Optimization Recommendations**: Savings opportunities

## Generating Reports

1. Navigate to **Reports**
2. Select report type
3. Choose parameters:
   - Target tenant(s)
   - Date range
   - Filters
4. Generate report
5. View or download

## Report Formats

- **PDF**: Formatted document with charts
- **Excel**: Raw data for analysis
- **CSV**: Simple export
- **JSON**: Machine-readable

## Scheduled Reports

Automate report generation:

1. Create report schedule
2. Configure delivery:
   - Email recipients
   - Webhook notification
   - Storage location
3. Reports generated and delivered automatically

## Report Templates

Save custom report configurations:

1. Configure report parameters
2. Click **Save as Template**
3. Reuse template for future reports
`
  },
  troubleshooting: {
    title: 'Troubleshooting',
    icon: AlertTriangle,
    content: `
# Troubleshooting

## Common Issues

### Connection Failed

**Symptoms**: Unable to connect tenant, "Access denied" errors

**Solutions**:
1. Verify Client ID and Secret are correct
2. Check API permissions are granted with admin consent
3. Ensure app registration is multi-tenant enabled
4. Verify tenant ID format (GUID)

### Insufficient Permissions

**Symptoms**: Some resources not exported, partial data

**Solutions**:
1. Review required permissions in Setup Guide
2. Grant admin consent for all permissions
3. For Intune, ensure Intune licenses are active
4. Check for Conditional Access blocking service principal

### Token Expired

**Symptoms**: Operations fail after working previously

**Solutions**:
1. Client secrets expire - check expiration date
2. Reconnect the tenant with new credentials
3. Consider certificate-based authentication for longer validity

### Slow Performance

**Symptoms**: Exports or scans taking very long

**Solutions**:
1. Large tenants naturally take longer
2. Reduce resource types if not all needed
3. Check Microsoft service health for throttling
4. Run during off-peak hours

### Drift Detection False Positives

**Symptoms**: Changes detected that weren't made

**Solutions**:
1. Some Microsoft properties update automatically
2. Exclude volatile properties from comparison
3. Update baseline if changes are expected
4. Use property-level filtering

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| \`AADSTS7000215\` | Invalid client secret | Regenerate secret in Azure |
| \`AADSTS65001\` | Missing consent | Grant admin consent |
| \`AADSTS700016\` | App not found | Verify app exists in tenant |
| \`403 Forbidden\` | Permission denied | Add required API permissions |
| \`429 Too Many Requests\` | Rate limited | Wait and retry |

## Getting Help

- Check audit logs for detailed error information
- Review Edge Function logs for backend errors
- Enable verbose logging for debugging
- Contact support with error details and timestamps

## Health Check

Run the built-in health check:

1. Go to **Authentication**
2. Click **Run Health Check**
3. Reviews:
   - API connectivity
   - Permission validation
   - Token validity
   - Resource access
`
  },
  security: {
    title: 'Security & Privacy',
    icon: Key,
    content: `
# Security & Privacy

## Data Security

### Credential Storage

- Client secrets are encrypted at rest
- Stored in Supabase Vault (enterprise-grade encryption)
- Never exposed in logs or UI
- Automatic rotation reminders
- AI API keys encrypted with same standards

### Data Encryption

- All data encrypted in transit (TLS 1.3)
- Database encryption at rest
- Encrypted backups

### Access Control

- Row-Level Security (RLS) on all tables
- Users only see their own data
- Multi-tenant isolation

## Authentication

### Platform Authentication

- Email/password with secure hashing
- Session management with JWT tokens
- Automatic session refresh
- Logout from all devices option

### Microsoft Authentication

- OAuth 2.0 client credentials flow
- App-only authentication
- No user credentials stored
- Scoped permissions (least privilege)

## Audit Logging

All actions are logged:

- Who (user ID, email)
- What (action type, resource)
- When (timestamp)
- Where (IP address, user agent)
- Result (success/failure)
- AI analysis requests and results

View audit logs in **Audit** section.

## Privacy Considerations

### Data Collected

- Tenant configurations (policies, settings)
- User metadata (not passwords)
- Group information
- Device configurations (not personal data)
- AI conversation history (optional)

### Data Not Collected

- Email contents
- File contents from OneDrive/SharePoint
- User passwords or authentication tokens
- Personal files or documents

### Data Retention

- Exports retained based on configuration
- Audit logs retained for 90 days (configurable)
- Deleted data purged within 30 days
- AI conversations expire after 30 days

## Compliance

The platform is designed to support:

- GDPR data subject rights
- SOC 2 control requirements
- ISO 27001 security controls
- Customer data isolation

## Security Best Practices

1. **Use least privilege**: Only grant required permissions
2. **Rotate secrets**: Update client secrets before expiration
3. **Monitor access**: Review audit logs regularly
4. **Enable MFA**: For all platform users
5. **Separate accounts**: Use dedicated app registrations
6. **Test in dev**: Use dry-run before production deployment
7. **Secure AI keys**: Use BYOK with secure storage
`
  },
  aiIntelligence: {
    title: 'AI Intelligence',
    icon: Brain,
    content: `
# AI Intelligence

M365 Governance Manager includes powerful AI-powered analysis capabilities to help you understand your tenant health, identify risks, and get actionable recommendations.

## AI Features Overview

### Tenant Health Analysis

AI-powered analysis of your tenant's overall health:

- **Health Score**: Overall score (0-100) based on multiple factors
- **Category Breakdown**: Security, Identity, Compliance, Performance, Cost
- **Issue Detection**: Automatic identification of problems
- **Quick Wins**: Prioritized recommendations for immediate impact

### Compliance Advisor

Get AI-powered compliance guidance:

- Natural language questions about compliance
- Real-time analysis of tenant configuration
- Recommendations based on industry standards
- Remediation suggestions with step-by-step guidance

### Risk Score Analysis

Comprehensive risk assessment:

- **Risk Score**: Overall risk level (0-100)
- **Risk Categories**: Security, Compliance, Operational, Financial
- **Risk Factors**: Specific issues contributing to risk
- **Mitigations**: Recommended actions to reduce risk

### Cross-Tenant Benchmarking

Compare tenants against each other:

- Performance comparison across your tenant portfolio
- Industry benchmark comparisons
- Identify outliers and best practices
- Adoption rate analysis

## Accessing AI Features

### Tenant Analyzer

1. Navigate to **Tenant Health** → **Copilot Agents**
2. Select the **AI Analyzer** tab
3. Choose an analysis type:
   - Tenant Health
   - Compliance
   - Risk Score
   - Cost Forecast
4. Click **Run Analysis**
5. View detailed results with recommendations

### AI Chat

Interactive chat for tenant questions:

1. Open AI Chat from any analysis view
2. Ask questions in natural language:
   - "What are the top security risks in this tenant?"
   - "How can I improve MFA coverage?"
   - "What compliance gaps exist for ISO 27001?"
3. Get contextual answers based on your tenant data

### Compliance Advisor

1. Navigate to **Copilot Agents** → **Compliance** tab
2. Select a compliance framework (CIS, NIST, ISO, etc.)
3. Use the chat to ask compliance questions
4. Get specific recommendations for your tenant

## AI Analysis Types

| Analysis | Purpose | Output |
|----------|---------|--------|
| \`tenant-health\` | Overall health assessment | Score, categories, issues, quick wins |
| \`compliance\` | Compliance gap analysis | Gaps, recommendations, priority actions |
| \`risk-score\` | Risk assessment | Score, factors, mitigations |
| \`cost-forecast\` | License cost analysis | Current spend, projections, savings |
| \`adoption-benchmark\` | Usage comparison | Metrics, benchmarks, recommendations |

## AI Models

The platform supports multiple AI providers:

### Default Provider (Built-in AI)

- Uses the platform-configured AI gateway (any OpenAI-compatible endpoint)
- No per-user configuration needed
- Best for most use cases

### Available Models (built-in gateway)

- \`gpt-4o-mini\` - Fast, balanced (default)
- \`gpt-4o\` - Best for complex reasoning
- \`gpt-4-turbo\` - Long context

You can also bring your own key for OpenAI, Anthropic, Google, Azure OpenAI, Perplexity, Groq, or Mistral via Settings → AI Providers.

## Tips for Best Results

1. **Be Specific**: Ask targeted questions for better answers
2. **Provide Context**: Mention specific tenants or scenarios
3. **Iterate**: Follow up on recommendations for more detail
4. **Compare**: Use benchmarking to identify outliers
5. **Regular Analysis**: Run health checks periodically
`
  },
  byokConfiguration: {
    title: 'BYOK AI Setup',
    icon: Sparkles,
    content: `
# Bring Your Own Key (BYOK) AI Setup

M365 Governance Manager supports using your own AI provider API keys for maximum flexibility and control.

## Supported Providers

| Provider | API Key Required | Models Available |
|----------|------------------|------------------|
| Built-in AI | None (built-in gateway) | Gemini, GPT (default) |
| OpenAI | Yes | GPT-4o, GPT-4o-mini, o1, o1-mini |
| Google AI | Yes | Gemini Pro, Gemini Flash |
| Anthropic | Yes | Claude 3.5 Sonnet, Claude 3.5 Haiku |
| Azure OpenAI | Yes | GPT-4o, GPT-4o-mini (your deployment) |
| Perplexity | Yes | Sonar, Sonar Pro |
| Groq | Yes | Llama 3.3, Mixtral |
| Mistral | Yes | Mistral Large, Mistral Small |

## Configuring API Keys

### Step 1: Navigate to Settings

1. Go to **Settings** in the sidebar
2. Select the **AI Providers** tab

### Step 2: Add API Key

1. Find the provider you want to configure
2. Click **Configure API Key**
3. Enter your API key
4. Click **Save**

### Step 3: Set as Default (Optional)

1. After saving, the provider appears in "Configured Providers"
2. Toggle **Active** to enable the provider
3. To make it default, select it from the "Default Provider" dropdown
4. Choose a default model for the provider

## Getting API Keys

### OpenAI

1. Visit [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys
3. Create a new API key
4. Copy and save securely

### Google AI (Gemini)

1. Visit [aistudio.google.com](https://aistudio.google.com)
2. Go to API Keys section
3. Create an API key
4. Copy and save securely

### Anthropic (Claude)

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys
3. Generate a new key
4. Copy and save securely

### Azure OpenAI

1. Create an Azure OpenAI resource in Azure Portal
2. Deploy a model (GPT-4o recommended)
3. Copy the endpoint and API key
4. Note: Azure requires additional endpoint configuration

### Perplexity

1. Visit [perplexity.ai](https://www.perplexity.ai)
2. Go to Settings → API
3. Generate an API key
4. Copy and save securely

### Groq

1. Visit [console.groq.com](https://console.groq.com)
2. Navigate to API Keys
3. Create a new key
4. Copy and save securely

### Mistral

1. Visit [console.mistral.ai](https://console.mistral.ai)
2. Go to API Keys
3. Generate a new key
4. Copy and save securely

## Provider Selection

### Per-Chat Selection

Each AI chat allows selecting the provider and model:

1. Click the settings icon in the chat header
2. Select provider from dropdown
3. Choose specific model
4. Settings persist for the session

### Automatic Fallback

If a configured provider fails:

1. System automatically falls back to the built-in AI
2. You're notified of the fallback
3. Request is completed seamlessly

## Security Considerations

### API Key Storage

- Keys are encrypted before storage
- Stored in Supabase Vault
- Never exposed in UI after saving
- Never logged or transmitted in plain text

### Best Practices

1. **Use dedicated keys**: Create keys specifically for this application
2. **Monitor usage**: Check provider dashboards for unusual activity
3. **Set limits**: Configure spending limits in provider settings
4. **Rotate regularly**: Update keys periodically
5. **Revoke if compromised**: Immediately revoke and replace if exposed

## Troubleshooting

### Invalid API Key

- Verify key is copied correctly (no extra spaces)
- Check key hasn't expired
- Confirm key has required permissions
- Try regenerating the key

### Rate Limits

- Provider may have usage limits
- Wait and retry, or upgrade your plan
- Consider using a different provider temporarily

### Model Not Available

- Some models require specific access
- Check provider documentation
- Try a different model from the same provider
`
  },
  copilotManagement: {
    title: 'Copilot Management',
    icon: Bot,
    content: `
# Microsoft 365 Copilot Management

M365 Governance Manager includes comprehensive tools for managing Microsoft 365 Copilot across your tenants.

## Copilot Readiness Assessment

Evaluate tenant readiness for Copilot deployment:

### Running an Assessment

1. Navigate to **Tenant Health** → **Copilot Agents**
2. Select a tenant from the dropdown
3. Click **Run Readiness Assessment**
4. Review the results

### Assessment Criteria

| Criterion | Description |
|-----------|-------------|
| Licensing | Copilot licenses available and assigned |
| Permissions | Required API permissions configured |
| Semantic Index | Content indexed for Copilot |
| Data Governance | Sensitivity labels and DLP policies |
| Network | Required endpoints accessible |

### Readiness Score

- **80-100%**: Ready for deployment
- **60-79%**: Minor issues to address
- **40-59%**: Significant preparation needed
- **0-39%**: Major blockers present

## Copilot Usage Analytics

Track Copilot adoption and usage:

### Available Metrics

- **Active Users**: Users actively using Copilot
- **Total Queries**: Number of Copilot interactions
- **Adoption Rate**: Percentage of licensed users active
- **Top Features**: Most used Copilot capabilities

### Usage by Application

- Microsoft Teams
- Word
- Excel
- PowerPoint
- Outlook
- Microsoft 365 Chat

### Time Periods

- Last 7 days
- Last 30 days
- Last 90 days

## Copilot Licensing

Manage Copilot license allocation:

### License Overview

- Total Copilot licenses
- Assigned licenses
- Available licenses
- Utilization rate

### SKU Breakdown

View licenses by type:
- Microsoft 365 Copilot
- Copilot Studio
- Copilot for Sales
- Copilot for Service

### Licensed Users

- User list with Copilot assignment
- Last active date
- Activity status (Active/Inactive)

### Optimization

- Identify inactive users (30+ days)
- Reclaim unused licenses
- Optimize allocation

## AI Governance Policies

Create policies to govern AI usage:

### Policy Types

| Type | Description |
|------|-------------|
| Usage Restrictions | Limit AI feature access |
| Data Access | Control what data AI can access |
| Content Filtering | Filter sensitive content |
| Audit Requirements | Logging and compliance |
| Prompt Guidelines | Approved prompt templates |
| Model Selection | Allowed AI models |

### Enforcement Levels

- **Strict**: Hard enforcement, blocks violations
- **Moderate**: Warns users, allows override
- **Flexible**: Advisory only, no blocking

### Creating a Policy

1. Navigate to **Copilot Agents** → **Governance Policies**
2. Click **Create Policy**
3. Configure:
   - Name and description
   - Policy type
   - Enforcement level
   - Target applications
   - Policy rules
4. Save and enable

## Prompt Library

Manage approved prompts for your organization:

### Creating Prompts

1. Go to **Prompt Library**
2. Click **Add Prompt**
3. Enter:
   - Prompt name
   - Category
   - Prompt text
   - Target applications
   - Tags
4. Set visibility (Public/Private)
5. Save

### Prompt Categories

- Sales
- Marketing
- Support
- Analysis
- Documentation
- Development
- HR
- Finance

### Prompt Sharing

- Public prompts visible to all users
- Private prompts for personal use
- Share across customer tenants

## Best Practices

### Deployment

1. Start with pilot group
2. Train users on effective prompting
3. Monitor usage and feedback
4. Expand gradually

### Governance

1. Establish usage policies early
2. Regular compliance reviews
3. Monitor for sensitive data exposure
4. Educate on responsible AI use

### Optimization

1. Track adoption metrics
2. Identify power users for training
3. Reclaim unused licenses
4. Collect user feedback
`
  }
};

export function DocumentationView() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('overview');
  const [copying, setCopying] = useState(false);

  const sections = Object.entries(DOCUMENTATION_CONTENT);
  const currentContent = DOCUMENTATION_CONTENT[activeSection as keyof typeof DOCUMENTATION_CONTENT];

  const generateFullMarkdown = (): string => {
    let markdown = `# M365 Governance Manager Documentation\n\n`;
    markdown += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
    markdown += `---\n\n`;
    markdown += `## Table of Contents\n\n`;
    
    sections.forEach(([key, section], index) => {
      markdown += `${index + 1}. [${section.title}](#${key})\n`;
    });
    
    markdown += `\n---\n\n`;
    
    sections.forEach(([key, section]) => {
      markdown += `<a id="${key}"></a>\n\n`;
      markdown += section.content.trim();
      markdown += `\n\n---\n\n`;
    });
    
    return markdown;
  };

  const handleExportMarkdown = () => {
    const markdown = generateFullMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'm365-governance-manager-documentation.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Documentation Exported',
      description: 'Markdown file downloaded successfully.',
    });
  };

  const handleExportPDF = () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    const addText = (text: string, fontSize: number, isBold: boolean = false, color: number[] = [0, 0, 0]) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setTextColor(color[0], color[1], color[2]);
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      lines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += fontSize * 0.4;
      });
      
      yPos += 2;
    };

    const addSection = (title: string, content: string) => {
      // Section title
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = margin;
      }
      addText(title, 16, true, [59, 130, 246]); // Blue color for titles
      yPos += 4;
      
      // Process content
      const lines = content.trim().split('\n');
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
          yPos += 2;
          return;
        }
        
        // Headers
        if (trimmedLine.startsWith('# ')) {
          addText(trimmedLine.substring(2), 14, true);
        } else if (trimmedLine.startsWith('## ')) {
          yPos += 2;
          addText(trimmedLine.substring(3), 12, true, [75, 85, 99]);
        } else if (trimmedLine.startsWith('### ')) {
          yPos += 1;
          addText(trimmedLine.substring(4), 11, true, [107, 114, 128]);
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
          // Bullet points
          addText('• ' + trimmedLine.substring(2), 10);
        } else if (/^\d+\./.test(trimmedLine)) {
          // Numbered lists
          addText(trimmedLine, 10);
        } else if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
          // Table rows - simplified
          addText(trimmedLine.replace(/\|/g, '  '), 9);
        } else if (trimmedLine.startsWith('```')) {
          // Skip code block markers
        } else if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
          // Inline code
          pdf.setFont('courier', 'normal');
          addText(trimmedLine.replace(/`/g, ''), 9, false, [220, 38, 38]);
          pdf.setFont('helvetica', 'normal');
        } else {
          // Regular text
          addText(trimmedLine, 10);
        }
      });
      
      yPos += 8;
    };

    // Title page
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(59, 130, 246);
    pdf.text('M365 Governance Manager', pageWidth / 2, 60, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128);
    pdf.text('Documentation', pageWidth / 2, 75, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 90, { align: 'center' });
    
    // Table of Contents
    pdf.addPage();
    yPos = margin;
    addText('Table of Contents', 16, true, [59, 130, 246]);
    yPos += 6;
    
    sections.forEach(([_, section], index) => {
      addText(`${index + 1}. ${section.title}`, 11);
    });
    
    // Content pages
    sections.forEach(([_, section]) => {
      pdf.addPage();
      yPos = margin;
      addSection(section.title, section.content);
    });

    pdf.save('m365-governance-manager-documentation.pdf');
    
    toast({
      title: 'Documentation Exported',
      description: 'PDF file downloaded successfully.',
    });
  };

  const handleCopyMarkdown = async () => {
    setCopying(true);
    const markdown = currentContent.content.trim();
    await navigator.clipboard.writeText(markdown);
    toast({
      title: 'Copied to Clipboard',
      description: 'Markdown content copied successfully.',
    });
    setTimeout(() => setCopying(false), 1000);
  };

  const renderContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let key = 0;

    const processLine = (line: string): JSX.Element | null => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const code = codeContent.join('\n');
          codeContent = [];
          return (
            <pre key={key++} className="bg-muted p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
              <code>{code}</code>
            </pre>
          );
        } else {
          inCodeBlock = true;
          return null;
        }
      }
      
      if (inCodeBlock) {
        codeContent.push(line);
        return null;
      }
      
      if (!trimmed) return <div key={key++} className="h-2" />;
      
      // Headers
      if (trimmed.startsWith('# ')) {
        return <h1 key={key++} className="text-2xl font-bold mt-6 mb-4">{trimmed.substring(2)}</h1>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={key++} className="text-xl font-semibold mt-6 mb-3 text-primary">{trimmed.substring(3)}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={key++} className="text-lg font-medium mt-4 mb-2">{trimmed.substring(4)}</h3>;
      }
      
      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={key++} className="ml-4 flex items-start gap-2 my-1">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
            <span>{processInlineFormatting(trimmed.substring(2))}</span>
          </li>
        );
      }
      if (/^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s*(.*)$/);
        if (match) {
          return (
            <li key={key++} className="ml-4 flex items-start gap-2 my-1">
              <span className="font-medium text-primary">{match[1]}.</span>
              <span>{processInlineFormatting(match[2])}</span>
            </li>
          );
        }
      }
      
      // Tables
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.split('|').filter(c => c.trim());
        const isHeader = lines[lines.indexOf(line) + 1]?.includes('---');
        
        if (cells.every(c => c.includes('---'))) return null;
        
        return (
          <tr key={key++} className={isHeader ? 'bg-muted font-medium' : ''}>
            {cells.map((cell, i) => (
              <td key={i} className="border px-3 py-2 text-sm">{cell.trim()}</td>
            ))}
          </tr>
        );
      }
      
      // Regular paragraph
      return <p key={key++} className="my-2">{processInlineFormatting(trimmed)}</p>;
    };

    const processInlineFormatting = (text: string): React.ReactNode => {
      // Process inline code
      const parts = text.split(/(`[^`]+`)/);
      return parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">{part.slice(1, -1)}</code>;
        }
        // Process bold
        const boldParts = part.split(/(\*\*[^*]+\*\*)/);
        return boldParts.map((bp, j) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
          }
          return bp;
        });
      });
    };

    let inTable = false;
    let tableRows: JSX.Element[] = [];

    lines.forEach((line, index) => {
      const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
      
      if (isTableRow && !inTable) {
        inTable = true;
        tableRows = [];
      }
      
      if (inTable && !isTableRow) {
        elements.push(
          <table key={key++} className="w-full border-collapse my-4">
            <tbody>{tableRows}</tbody>
          </table>
        );
        inTable = false;
        tableRows = [];
      }
      
      const element = processLine(line);
      if (element) {
        if (inTable) {
          tableRows.push(element);
        } else {
          elements.push(element);
        }
      }
    });

    if (inTable && tableRows.length > 0) {
      elements.push(
        <table key={key++} className="w-full border-collapse my-4">
          <tbody>{tableRows}</tbody>
        </table>
      );
    }

    return elements;
  };

  const Icon = currentContent.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Book className="w-6 h-6 text-primary" />
            Documentation
          </h2>
          <p className="text-muted-foreground">
            Setup guide and usage documentation for M365 Governance Manager
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCopyMarkdown} disabled={copying}>
            <Copy className="w-4 h-4 mr-2" />
            {copying ? 'Copied!' : 'Copy Section'}
          </Button>
          <Button variant="outline" onClick={handleExportMarkdown}>
            <FileText className="w-4 h-4 mr-2" />
            Export Markdown
          </Button>
          <Button onClick={handleExportPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contents</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
                {sections.map(([key, section]) => {
                  const SectionIcon = section.icon;
                  return (
                    <Button
                      key={key}
                      variant={activeSection === key ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left"
                      onClick={() => setActiveSection(key)}
                    >
                      <SectionIcon className="w-4 h-4 mr-2" />
                      {section.title}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content Area */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>{currentContent.title}</CardTitle>
                <CardDescription>
                  Documentation section {sections.findIndex(([k]) => k === activeSection) + 1} of {sections.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-sm max-w-none"
              >
                {renderContent(currentContent.content)}
              </motion.div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('setup')}>
              <Settings className="w-5 h-5" />
              <span>Setup Guide</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('troubleshooting')}>
              <AlertTriangle className="w-5 h-5" />
              <span>Troubleshooting</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('security')}>
              <Key className="w-5 h-5" />
              <span>Security</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('aiIntelligence')}>
              <Brain className="w-5 h-5" />
              <span>AI Intelligence</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('byokConfiguration')}>
              <Sparkles className="w-5 h-5" />
              <span>BYOK Setup</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveSection('copilotManagement')}>
              <Bot className="w-5 h-5" />
              <span>Copilot</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
