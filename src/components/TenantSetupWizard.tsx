import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Server,
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { storeEncryptedCredential } from '@/lib/database';
import { cn } from '@/lib/utils';

interface TenantSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onComplete: () => void;
}

type WizardStep = 'intro' | 'tenant-info' | 'credentials' | 'test' | 'complete';

interface ValidationState {
  tenantId: { valid: boolean; message: string };
  displayName: { valid: boolean; message: string };
  clientId: { valid: boolean; message: string };
  clientSecret: { valid: boolean; message: string };
}

const STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: 'intro', title: 'Getting Started', description: 'What you\'ll need' },
  { id: 'tenant-info', title: 'Tenant Details', description: 'Basic information' },
  { id: 'credentials', title: 'App Registration', description: 'Authentication setup' },
  { id: 'test', title: 'Test Connection', description: 'Verify everything works' },
  { id: 'complete', title: 'Complete', description: 'Ready to use' },
];

export function TenantSetupWizard({
  open,
  onOpenChange,
  customerId,
  customerName,
  onComplete,
}: TenantSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; tenantName?: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();

  // Form state
  const [tenantId, setTenantId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Validation state
  const [validation, setValidation] = useState<ValidationState>({
    tenantId: { valid: true, message: '' },
    displayName: { valid: true, message: '' },
    clientId: { valid: true, message: '' },
    clientSecret: { valid: true, message: '' },
  });

  // Reset wizard when opened
  useEffect(() => {
    if (open) {
      setCurrentStep('intro');
      setTenantId('');
      setDisplayName('');
      setEnvironment('production');
      setClientId('');
      setClientSecret('');
      setTestResult(null);
      setShowSecret(false);
      setValidation({
        tenantId: { valid: true, message: '' },
        displayName: { valid: true, message: '' },
        clientId: { valid: true, message: '' },
        clientSecret: { valid: true, message: '' },
      });
    }
  }, [open]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Validation functions
  const validateTenantId = (value: string): { valid: boolean; message: string } => {
    if (!value.trim()) {
      return { valid: false, message: 'Tenant ID is required' };
    }
    // GUID format check
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Domain format check
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.onmicrosoft\.com$/i;
    
    if (!guidRegex.test(value.trim()) && !domainRegex.test(value.trim())) {
      return { 
        valid: false, 
        message: 'Enter a valid Tenant ID (GUID) or domain (e.g., contoso.onmicrosoft.com)' 
      };
    }
    return { valid: true, message: '' };
  };

  const validateClientId = (value: string): { valid: boolean; message: string } => {
    if (!value.trim()) {
      return { valid: false, message: 'Client ID (Application ID) is required' };
    }
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(value.trim())) {
      return { valid: false, message: 'Client ID must be a valid GUID' };
    }
    return { valid: true, message: '' };
  };

  const validateClientSecret = (value: string): { valid: boolean; message: string } => {
    if (!value.trim()) {
      return { valid: false, message: 'Client Secret is required' };
    }
    if (value.length < 10) {
      return { valid: false, message: 'Client Secret seems too short' };
    }
    return { valid: true, message: '' };
  };

  const handleTenantIdChange = (value: string) => {
    setTenantId(value);
    if (value) {
      setValidation(prev => ({ ...prev, tenantId: validateTenantId(value) }));
    } else {
      setValidation(prev => ({ ...prev, tenantId: { valid: true, message: '' } }));
    }
  };

  const handleClientIdChange = (value: string) => {
    setClientId(value);
    if (value) {
      setValidation(prev => ({ ...prev, clientId: validateClientId(value) }));
    } else {
      setValidation(prev => ({ ...prev, clientId: { valid: true, message: '' } }));
    }
  };

  const handleClientSecretChange = (value: string) => {
    setClientSecret(value);
    if (value) {
      setValidation(prev => ({ ...prev, clientSecret: validateClientSecret(value) }));
    } else {
      setValidation(prev => ({ ...prev, clientSecret: { valid: true, message: '' } }));
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'intro':
        return true;
      case 'tenant-info':
        return !!tenantId.trim() && validateTenantId(tenantId).valid;
      case 'credentials':
        return (
          !!clientId.trim() && 
          !!clientSecret.trim() && 
          validateClientId(clientId).valid && 
          validateClientSecret(clientSecret).valid
        );
      case 'test':
        return testResult?.success === true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    const stepOrder: WizardStep[] = ['intro', 'tenant-info', 'credentials', 'test', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: WizardStep[] = ['intro', 'tenant-info', 'credentials', 'test', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('graph-api', {
        body: {
          action: 'test-connection',
          tenantId: tenantId.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Connection test failed');
      }

      if (response.data?.success) {
        setTestResult({
          success: true,
          message: 'Successfully connected to Microsoft Graph API',
          tenantName: response.data.tenantName,
        });
      } else {
        setTestResult({
          success: false,
          message: response.data?.error || 'Authentication failed. Check your credentials.',
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create tenant connection
      const { data: newTenant, error } = await supabase
        .from('tenant_connections')
        .insert({
          user_id: user.id,
          tenant_id: tenantId.trim(),
          display_name: displayName.trim() || testResult?.tenantName || tenantId.trim(),
          tenant_name: displayName.trim() || testResult?.tenantName || tenantId.trim(),
          environment,
          customer_id: customerId,
          auth_method: 'app',
          status: 'disconnected',
          client_id: clientId.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Store encrypted credentials
      await storeEncryptedCredential(
        newTenant.id,
        clientId.trim(),
        clientSecret.trim()
      );

      // Update status to connected
      await supabase
        .from('tenant_connections')
        .update({ status: 'connected' })
        .eq('id', newTenant.id);

      toast({
        title: 'Tenant Created Successfully',
        description: `${displayName || testResult?.tenantName || tenantId} has been connected.`,
      });

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tenant',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to Tenant Setup</h3>
              <p className="text-muted-foreground">
                Connect your Microsoft 365 tenant to {customerName} in just a few steps.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                What You'll Need
              </h4>
              <div className="grid gap-3">
                {[
                  { icon: Building2, title: 'Tenant ID', desc: 'Your Microsoft 365 tenant identifier (GUID or domain)' },
                  { icon: Key, title: 'App Registration', desc: 'Client ID and Secret from Azure Portal' },
                  { icon: Shield, title: 'API Permissions', desc: 'Graph API permissions with admin consent' },
                ].map((item, idx) => (
                  <Card key={idx} className="bg-secondary/30 border-border/50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle>Need help creating an App Registration?</AlertTitle>
              <AlertDescription className="mt-2">
                <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                  <a
                    href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Microsoft's guide <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        );

      case 'tenant-info':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenantId" className="flex items-center gap-2">
                  Tenant ID <span className="text-destructive">*</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Find this in Azure Portal → Entra ID → Overview, or use your .onmicrosoft.com domain</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    id="tenantId"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={tenantId}
                    onChange={(e) => handleTenantIdChange(e.target.value)}
                    className={cn(
                      !validation.tenantId.valid && tenantId && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {tenantId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {validation.tenantId.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {!validation.tenantId.valid && tenantId && (
                  <p className="text-sm text-destructive">{validation.tenantId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center gap-2">
                  Display Name
                  <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                </Label>
                <Input
                  id="displayName"
                  placeholder="e.g., Production Tenant"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this tenant. Will be auto-detected if left blank.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Building2 className="w-4 h-4 text-blue-500" />
              <AlertTitle className="text-blue-500">Where to find your Tenant ID</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                  <li>Go to <span className="font-medium">Azure Portal</span></li>
                  <li>Navigate to <span className="font-medium">Microsoft Entra ID</span></li>
                  <li>Click <span className="font-medium">Overview</span></li>
                  <li>Copy the <span className="font-medium">Tenant ID</span> value</li>
                </ol>
              </AlertDescription>
            </Alert>
          </motion.div>
        );

      case 'credentials':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId" className="flex items-center gap-2">
                  Client ID (Application ID) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="clientId"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={clientId}
                    onChange={(e) => handleClientIdChange(e.target.value)}
                    className={cn(
                      !validation.clientId.valid && clientId && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {clientId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {validation.clientId.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {!validation.clientId.valid && clientId && (
                  <p className="text-sm text-destructive">{validation.clientId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret" className="flex items-center gap-2">
                  Client Secret <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="clientSecret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter client secret value"
                    value={clientSecret}
                    onChange={(e) => handleClientSecretChange(e.target.value)}
                    className={cn(
                      'pr-20',
                      !validation.clientSecret.valid && clientSecret && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    {clientSecret && validation.clientSecret.valid && (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    )}
                  </div>
                </div>
                {!validation.clientSecret.valid && clientSecret && (
                  <p className="text-sm text-destructive">{validation.clientSecret.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Use the secret <span className="font-medium">Value</span>, not the Secret ID
                </p>
              </div>
            </div>

            <Alert className="bg-purple-500/10 border-purple-500/20">
              <Key className="w-4 h-4 text-purple-500" />
              <AlertTitle className="text-purple-500">Creating an App Registration</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                  <li>Go to <span className="font-medium">Azure Portal → App Registrations</span></li>
                  <li>Click <span className="font-medium">New registration</span></li>
                  <li>Enter a name and register</li>
                  <li>Copy the <span className="font-medium">Application (client) ID</span></li>
                  <li>Go to <span className="font-medium">Certificates & secrets</span></li>
                  <li>Create a new client secret and copy the <span className="font-medium">Value</span></li>
                </ol>
                <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
                  <a
                    href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open App Registrations <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        );

      case 'test':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center py-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors",
                testResult?.success 
                  ? "bg-success/10" 
                  : testResult 
                    ? "bg-destructive/10" 
                    : "bg-secondary"
              )}>
                {isTesting ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : testResult?.success ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : testResult ? (
                  <XCircle className="w-8 h-8 text-destructive" />
                ) : (
                  <Shield className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {isTesting 
                  ? 'Testing Connection...' 
                  : testResult?.success 
                    ? 'Connection Successful!' 
                    : testResult 
                      ? 'Connection Failed' 
                      : 'Ready to Test'}
              </h3>
              <p className="text-muted-foreground">
                {isTesting 
                  ? 'Verifying credentials with Microsoft Graph API'
                  : testResult?.success 
                    ? testResult.tenantName 
                      ? `Connected to ${testResult.tenantName}` 
                      : testResult.message
                    : testResult 
                      ? testResult.message 
                      : 'Click the button below to verify your credentials'}
              </p>
            </div>

            {!testResult && !isTesting && (
              <Button 
                onClick={handleTestConnection} 
                className="w-full"
                size="lg"
              >
                <Shield className="w-4 h-4 mr-2" />
                Test Connection
              </Button>
            )}

            {testResult && !testResult.success && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Connection Failed</AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('credentials')}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Edit Credentials
                  </Button>
                  <Button 
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    Retry Test
                  </Button>
                </div>
              </div>
            )}

            {testResult?.success && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tenant</span>
                    <span className="font-medium">{testResult.tenantName || tenantId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className="bg-success/20 text-success border-success/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Authenticated
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center py-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-10 h-10 text-success" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">All Set!</h3>
              <p className="text-muted-foreground">
                Your tenant is ready to use. Click "Complete Setup" to finish.
              </p>
            </div>

            <Card className="bg-secondary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="font-medium">{customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tenant</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{displayName || testResult?.tenantName || tenantId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(tenantId, 'Tenant ID')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Environment</span>
                  <Badge variant="secondary">{environment}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connection</span>
                  <Badge className="bg-success/20 text-success border-success/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>What's next?</p>
              <p className="mt-1">
                Select this tenant and start exporting your M365 configurations.
              </p>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Add Tenant to {customerName}
          </DialogTitle>
          <DialogDescription>
            {STEPS[currentStepIndex]?.title} • Step {currentStepIndex + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex-shrink-0 space-y-2">
          <Progress value={progressPercent} className="h-1" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, idx) => (
              <span
                key={step.id}
                className={cn(
                  'transition-colors',
                  idx <= currentStepIndex && 'text-primary font-medium'
                )}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        <div className="flex-shrink-0 flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? () => onOpenChange(false) : handleBack}
            disabled={isSubmitting}
          >
            {currentStepIndex === 0 ? 'Cancel' : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </>
            )}
          </Button>

          {currentStep === 'complete' ? (
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Complete Setup
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed() || isTesting}>
              {currentStep === 'test' && !testResult?.success ? (
                'Skip for now'
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
