import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  GitBranch, 
  Github, 
  Cloud,
  Settings,
  Play,
  FileCode,
  Check,
  Upload,
  Loader2,
  FolderGit2,
  HelpCircle,
  ChevronDown,
  BookOpen,
  Key,
  Workflow,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { saveGitConfig, getGitConfig, getExportJobs } from '@/lib/database';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const cicdTemplates = [
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    icon: Github,
    description: 'Automated workflows for GitHub repositories',
    filename: '.github/workflows/m365-export.yml',
  },
  {
    id: 'azure-pipelines',
    name: 'Azure Pipelines',
    icon: Cloud,
    description: 'CI/CD pipelines for Azure DevOps',
    filename: 'azure-pipelines.yml',
  },
  {
    id: 'gitlab-ci',
    name: 'GitLab CI/CD',
    icon: GitBranch,
    description: 'Integrated CI/CD for GitLab repositories',
    filename: '.gitlab-ci.yml',
  },
];

interface ExportJobRecord {
  id: string;
  name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export const GitView = () => {
  const [provider, setProvider] = useState<'github' | 'azure-devops' | 'gitlab'>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [autoCommit, setAutoCommit] = useState(true);
  const [commitMessage, setCommitMessage] = useState('chore: update PolicyForge export - {{date}}');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedJobs, setCompletedJobs] = useState<ExportJobRecord[]>([]);
  const [selectedExportJob, setSelectedExportJob] = useState<string>('');
  
  const { connectionId } = useTenant();
  const { toast } = useToast();

  // Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getGitConfig(connectionId || undefined);
        if (config) {
          setProvider(config.provider as 'github' | 'azure-devops' | 'gitlab');
          setRepoUrl(config.repo_url || '');
          setBranch(config.branch || 'main');
          setAutoCommit(config.auto_commit ?? true);
          setCommitMessage(config.commit_message_template || 'chore: update M365 export - {{date}}');
          setSelectedTemplate(config.cicd_template || null);
        }
      } catch (error) {
        console.error('Failed to load git config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [connectionId]);

  // Load completed export jobs
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const jobs = await getExportJobs();
        const completed = (jobs as ExportJobRecord[]).filter(j => j.status === 'completed');
        setCompletedJobs(completed);
        if (completed.length > 0 && !selectedExportJob) {
          setSelectedExportJob(completed[0].id);
        }
      } catch (error) {
        console.error('Failed to load jobs:', error);
      }
    };
    loadJobs();
  }, [selectedExportJob]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveGitConfig({
        enabled: true,
        provider,
        repoUrl,
        branch,
        autoCommit,
        commitMessage,
        cicdTemplate: selectedTemplate as 'github-actions' | 'azure-pipelines' | 'gitlab-ci' | undefined,
        tenantConnectionId: connectionId || undefined,
      });
      toast({
        title: 'Settings Saved',
        description: 'Git configuration has been saved',
      });
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save Git configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [provider, repoUrl, branch, autoCommit, commitMessage, selectedTemplate, connectionId, toast]);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(githubActionsTemplate);
    toast({
      title: 'Copied!',
      description: 'Pipeline template copied to clipboard',
    });
  };

  const githubActionsTemplate = `name: M365 Tenant Export

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup PowerShell
        uses: azure/powershell@v1
        with:
          azPSVersion: latest
          
      - name: Install Microsoft Graph Module
        shell: pwsh
        run: |
          Install-Module Microsoft.Graph -Force -Scope CurrentUser
          Install-Module Microsoft.Graph.Intune -Force -Scope CurrentUser
          
      - name: Export M365 Configuration
        shell: pwsh
        env:
          AZURE_TENANT_ID: \${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_ID: \${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: \${{ secrets.AZURE_CLIENT_SECRET }}
        run: |
          ./scripts/export-tenant.ps1
          
      - name: Commit Changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add -A
          git diff --quiet && git diff --staged --quiet || git commit -m "chore: update PolicyForge export"
          git push`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Git & CI/CD</h1>
          <p className="text-muted-foreground mt-1">
            Configure version control and automated pipeline workflows
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Git Configuration */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              Repository Settings
            </CardTitle>
            <CardDescription>
              Configure your Git repository for storing exports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="provider">Git Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="azure-devops">Azure DevOps</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/m365-backup"
                className="font-mono bg-secondary/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="font-mono bg-secondary/50 border-border"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-commit">Auto-commit on Export</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically commit and push after each export
                </p>
              </div>
              <Switch
                id="auto-commit"
                checked={autoCommit}
                onCheckedChange={setAutoCommit}
              />
            </div>

            <div className="space-y-2">
              <Label>Commit Message Template</Label>
              <Input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="font-mono bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {'{{date}}'}, {'{{tenant}}'}, {'{{resources}}'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CI/CD Templates */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Pipeline Templates
            </CardTitle>
            <CardDescription>
              Generate CI/CD configurations for automated exports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cicdTemplates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;

              return (
                <div
                  key={template.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all",
                    "border border-border hover:border-primary/50",
                    isSelected && "bg-primary/5 border-primary"
                  )}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary/20" : "bg-secondary"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{template.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <code className="text-xs text-muted-foreground font-mono">
                      {template.filename}
                    </code>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>
              );
            })}

            <Button className="w-full" disabled={!selectedTemplate} onClick={handleCopyTemplate}>
              <FileCode className="w-4 h-4 mr-2" />
              Copy Pipeline Config
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Push Export to Git */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-primary" />
            Push Export to Repository
          </CardTitle>
          <CardDescription>
            Select a completed export to push to your Git repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {completedJobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No completed exports available. Run an export first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Export</Label>
                <Select value={selectedExportJob} onValueChange={setSelectedExportJob}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an export..." />
                  </SelectTrigger>
                  <SelectContent>
                    {completedJobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name} - {new Date(job.created_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Ready to push</p>
                  <p className="text-sm text-muted-foreground">
                    Export files will be committed to {branch} branch
                  </p>
                </div>
                <Button disabled={!repoUrl || !selectedExportJob}>
                  <Upload className="w-4 h-4 mr-2" />
                  Push to Git
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Note: Git push requires repository access. Configure a personal access token in your CI/CD pipeline for automated pushes.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Preview */}
      {selectedTemplate === 'github-actions' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">GitHub Actions Workflow</CardTitle>
                  <code className="text-xs bg-secondary px-2 py-1 rounded font-mono text-muted-foreground">
                    .github/workflows/m365-export.yml
                  </code>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
                  Copy to Clipboard
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto text-sm font-mono text-muted-foreground">
                {githubActionsTemplate}
              </pre>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Environment Variables */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Required Secrets / Environment Variables
          </CardTitle>
          <CardDescription>
            Configure these in your CI/CD platform's secret management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'].map((secret) => (
              <div 
                key={secret}
                className="p-3 rounded-lg bg-secondary/30 flex items-center gap-3"
              >
                <code className="text-sm font-mono text-primary">{secret}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            How to Use Git & CI/CD
          </CardTitle>
          <CardDescription>
            Step-by-step guide to configure version control and automated exports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="getting-started">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Getting Started</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  The Git & CI/CD integration allows you to store your M365 tenant configuration exports
                  in a Git repository and automate regular backups using CI/CD pipelines.
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Version history of all configuration changes</li>
                    <li>Easy comparison between export snapshots</li>
                    <li>Automated daily/weekly backups</li>
                    <li>Disaster recovery capability</li>
                    <li>Configuration drift detection</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="repository-setup">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <span>Setting Up Your Repository</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <ol className="list-decimal list-inside space-y-3 ml-2">
                  <li>
                    <span className="font-medium text-foreground">Create a new repository</span> in your Git provider
                    (GitHub, Azure DevOps, or GitLab)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Select your provider</span> from the dropdown
                    in Repository Settings
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Enter the repository URL</span> (e.g.,
                    <code className="mx-1 px-1 py-0.5 bg-secondary rounded text-xs">https://github.com/org/m365-backup</code>)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Specify your branch</span> (default: main)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Enable Auto-commit</span> to automatically push
                    exports after completion
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cicd-setup">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-primary" />
                  <span>Configuring CI/CD Pipelines</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  CI/CD pipelines automate the export process on a schedule. Here's how to set them up:
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-foreground mb-2">For GitHub Actions:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                      <li>Select "GitHub Actions" from Pipeline Templates</li>
                      <li>Click "Copy Pipeline Config"</li>
                      <li>Create <code className="px-1 py-0.5 bg-secondary rounded text-xs">.github/workflows/m365-export.yml</code> in your repo</li>
                      <li>Paste the template content</li>
                      <li>Configure secrets in your repository settings</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-2">For Azure Pipelines:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                      <li>Select "Azure Pipelines" from Pipeline Templates</li>
                      <li>Create <code className="px-1 py-0.5 bg-secondary rounded text-xs">azure-pipelines.yml</code> in your repo</li>
                      <li>Add variables in Azure DevOps Pipeline settings</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-2">For GitLab CI/CD:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                      <li>Select "GitLab CI/CD" from Pipeline Templates</li>
                      <li>Create <code className="px-1 py-0.5 bg-secondary rounded text-xs">.gitlab-ci.yml</code> in your repo</li>
                      <li>Add CI/CD variables in GitLab project settings</li>
                    </ol>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="secrets-setup">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  <span>Configuring Secrets</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Your CI/CD pipeline needs Azure AD credentials to authenticate with Microsoft Graph API.
                  These must be stored as secrets in your CI/CD platform:
                </p>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <code className="text-primary font-mono text-sm">AZURE_TENANT_ID</code>
                    <p className="text-sm mt-1">Your Azure AD tenant ID (GUID format)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <code className="text-primary font-mono text-sm">AZURE_CLIENT_ID</code>
                    <p className="text-sm mt-1">Application (client) ID from your App Registration</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <code className="text-primary font-mono text-sm">AZURE_CLIENT_SECRET</code>
                    <p className="text-sm mt-1">Client secret from your App Registration</p>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="font-medium text-foreground">Where to add secrets:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li><strong>GitHub:</strong> Settings → Secrets and variables → Actions</li>
                  <li><strong>Azure DevOps:</strong> Pipelines → Library → Variable groups</li>
                  <li><strong>GitLab:</strong> Settings → CI/CD → Variables</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="troubleshooting">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span>Troubleshooting</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-foreground">Pipeline fails with authentication error</p>
                    <p className="text-sm ml-2">
                      Verify your Azure AD credentials are correct and the App Registration has the required
                      Microsoft Graph permissions (e.g., DeviceManagementConfiguration.Read.All)
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Push to repository fails</p>
                    <p className="text-sm ml-2">
                      Ensure the pipeline has write access to the repository. For GitHub, use a
                      Personal Access Token with repo scope.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Export produces empty results</p>
                    <p className="text-sm ml-2">
                      Check that your App Registration has admin consent for all required permissions
                      in Azure AD.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Scheduled pipeline doesn't run</p>
                    <p className="text-sm ml-2">
                      Verify the cron expression is correct. Note that GitHub Actions schedules
                      are in UTC timezone.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
