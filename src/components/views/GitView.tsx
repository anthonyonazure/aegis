import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  GitBranch, 
  Github, 
  Cloud,
  GitCommit,
  Settings,
  Play,
  FileCode,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CICD_TEMPLATES } from '@/types/tenant';

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

export const GitView = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [autoCommit, setAutoCommit] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

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
          git diff --quiet && git diff --staged --quiet || git commit -m "chore: update M365 export"
          git push`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Git & CI/CD</h1>
        <p className="text-muted-foreground mt-1">
          Configure version control and automated pipeline workflows
        </p>
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
                defaultValue="chore: update M365 export - {{date}}"
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

            <Button className="w-full" disabled={!selectedTemplate}>
              <FileCode className="w-4 h-4 mr-2" />
              Generate Pipeline Config
            </Button>
          </CardContent>
        </Card>
      </div>

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
                <Button variant="outline" size="sm">
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
    </div>
  );
};
