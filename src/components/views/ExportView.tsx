import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileJson, 
  FileCode, 
  Terminal, 
  FolderOpen,
  Download,
  Check,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ExportFormat } from '@/types/tenant';

const exportFormats = [
  {
    id: 'json' as const,
    name: 'JSON',
    description: 'Raw Graph API exports with full data fidelity',
    icon: FileJson,
    color: 'warning',
    features: ['Complete data', 'Easy to parse', 'Backup format'],
  },
  {
    id: 'terraform' as const,
    name: 'Terraform',
    description: 'HCL configuration for infrastructure as code',
    icon: FileCode,
    color: 'purple',
    features: ['IaC ready', 'Version control', 'State management'],
  },
  {
    id: 'bicep' as const,
    name: 'Bicep',
    description: 'Azure-native declarative syntax',
    icon: FileCode,
    color: 'info',
    features: ['Azure native', 'Type safe', 'ARM compatible'],
  },
  {
    id: 'powershell' as const,
    name: 'PowerShell',
    description: 'Executable scripts for automation',
    icon: Terminal,
    color: 'blue',
    features: ['Executable', 'Customizable', 'Legacy support'],
  },
];

interface ExportViewProps {
  selectedResources: string[];
  selectedFormats: ExportFormat['id'][];
  onFormatToggle: (format: ExportFormat['id']) => void;
  onStartExport: () => void;
}

export const ExportView = ({
  selectedResources,
  selectedFormats,
  onFormatToggle,
  onStartExport,
}: ExportViewProps) => {
  const [outputPath, setOutputPath] = useState('./exports');
  const [separateFiles, setSeparateFiles] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const canExport = selectedResources.length > 0 && selectedFormats.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Choose export formats and configure output settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            {selectedResources.length} resources selected
          </Badge>
          <Button 
            onClick={onStartExport} 
            disabled={!canExport}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Start Export
          </Button>
        </div>
      </div>

      {/* Warning if no resources selected */}
      {selectedResources.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20"
        >
          <AlertCircle className="w-5 h-5 text-warning" />
          <div>
            <p className="font-medium text-warning">No resources selected</p>
            <p className="text-sm text-muted-foreground">
              Go to the Resources tab to select items for export
            </p>
          </div>
        </motion.div>
      )}

      {/* Export Formats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportFormats.map((format, index) => {
          const Icon = format.icon;
          const isSelected = selectedFormats.includes(format.id);

          return (
            <motion.div
              key={format.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={cn(
                  "glass-panel cursor-pointer transition-all duration-200 glow-border",
                  isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => onFormatToggle(format.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      isSelected ? "bg-primary/20" : "bg-secondary"
                    )}>
                      <Icon className={cn(
                        "w-6 h-6",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-foreground">{format.name}</h3>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          isSelected 
                            ? "bg-primary border-primary" 
                            : "border-muted-foreground"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {format.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {format.features.map(feature => (
                          <span 
                            key={feature}
                            className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Output Settings */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Output Settings
          </CardTitle>
          <CardDescription>Configure how exported files are organized</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="output-path">Output Directory</Label>
            <Input
              id="output-path"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="./exports"
              className="font-mono bg-secondary/50 border-border"
            />
            <p className="text-xs text-muted-foreground">
              Relative path from your repository root
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="separate-files">Separate Files per Resource</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Create individual files for each resource type
                </p>
              </div>
              <Switch
                id="separate-files"
                checked={separateFiles}
                onCheckedChange={setSeparateFiles}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="include-metadata">Include Metadata</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add export timestamp and source tenant info
                </p>
              </div>
              <Switch
                id="include-metadata"
                checked={includeMetadata}
                onCheckedChange={setIncludeMetadata}
              />
            </div>
          </div>

          {/* Preview Structure */}
          <div className="mt-6">
            <Label className="mb-3 block">Output Structure Preview</Label>
            <div className="bg-secondary/30 rounded-lg p-4 font-mono text-sm">
              <div className="text-muted-foreground">
                <div className="text-foreground">{outputPath}/</div>
                <div className="ml-4">├── json/</div>
                <div className="ml-8">├── intune/</div>
                <div className="ml-8">├── conditional-access/</div>
                <div className="ml-8">└── ...</div>
                <div className="ml-4">├── terraform/</div>
                <div className="ml-8">├── main.tf</div>
                <div className="ml-8">├── variables.tf</div>
                <div className="ml-8">└── modules/</div>
                <div className="ml-4">└── scripts/</div>
                <div className="ml-8">└── deploy.ps1</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
