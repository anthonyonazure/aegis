import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  Check, 
  X, 
  Loader2, 
  Eye, 
  EyeOff,
  Sparkles,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  AI_PROVIDERS, 
  PROVIDER_MODELS, 
  saveProviderApiKey, 
  saveProviderSettings,
  getProviderSettings,
  AIProvider
} from '@/lib/aiApi';
import { cn } from '@/lib/utils';

export function AIProviderSettings() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState('lovable');
  const [defaultModel, setDefaultModel] = useState('google/gemini-3-flash-preview');

  useEffect(() => {
    loadProviderSettings();
  }, []);

  const loadProviderSettings = async () => {
    const settings = await getProviderSettings();
    setProviders(settings);
    
    const defaultProv = settings.find(p => p.isDefault);
    if (defaultProv) {
      setDefaultProvider(defaultProv.provider);
      if (defaultProv.modelId) {
        setDefaultModel(defaultProv.modelId);
      }
    }
  };

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const success = await saveProviderApiKey(selectedProvider, apiKey.trim());

    if (success) {
      // Also save provider settings
      await saveProviderSettings({
        provider: selectedProvider,
        displayName: AI_PROVIDERS.find(p => p.id === selectedProvider)?.name || selectedProvider,
        isActive: true,
      });

      toast({
        title: 'API Key Saved',
        description: `Your ${AI_PROVIDERS.find(p => p.id === selectedProvider)?.name} API key has been saved securely`,
      });
      
      setApiKey('');
      setSelectedProvider(null);
      loadProviderSettings();
    } else {
      toast({
        title: 'Failed to Save',
        description: 'Could not save API key. Please try again.',
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  };

  const handleSetDefault = async (providerId: string, modelId?: string) => {
    // Clear existing defaults
    for (const provider of providers) {
      if (provider.isDefault) {
        await saveProviderSettings({
          provider: provider.provider,
          isDefault: false,
        });
      }
    }

    // Set new default
    await saveProviderSettings({
      provider: providerId,
      modelId,
      isDefault: true,
    });

    setDefaultProvider(providerId);
    if (modelId) setDefaultModel(modelId);
    
    toast({
      title: 'Default Provider Updated',
      description: `${AI_PROVIDERS.find(p => p.id === providerId)?.name} is now your default AI provider`,
    });

    loadProviderSettings();
  };

  const providerApiDocs: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    google: 'https://aistudio.google.com/apikey',
    anthropic: 'https://console.anthropic.com/settings/keys',
    azure: 'https://portal.azure.com/#blade/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/OpenAI',
    perplexity: 'https://www.perplexity.ai/settings/api',
    groq: 'https://console.groq.com/keys',
    mistral: 'https://console.mistral.ai/api-keys/',
  };

  const configuredProviders = providers.filter(p => p.isActive);

  return (
    <div className="space-y-6">
      {/* Default Provider */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Default AI Provider
          </CardTitle>
          <CardDescription>
            Choose your preferred AI provider for all features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={defaultProvider} onValueChange={(v) => handleSetDefault(v, PROVIDER_MODELS[v]?.[0]?.id)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Lovable AI (Built-in)
                    </div>
                  </SelectItem>
                  {configuredProviders.map(p => (
                    <SelectItem key={p.provider} value={p.provider}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select value={defaultModel} onValueChange={(v) => handleSetDefault(defaultProvider, v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODELS[defaultProvider] || []).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {defaultProvider === 'lovable' && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Lovable AI is ready to use</p>
                <p className="text-muted-foreground">No configuration needed. Access to Gemini & GPT models included.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Custom Provider */}
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Bring Your Own Key (BYOK)
          </CardTitle>
          <CardDescription>
            Add your own API keys to use different AI providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AI_PROVIDERS.filter(p => p.requiresKey).map((provider) => {
              const isConfigured = configuredProviders.some(cp => cp.provider === provider.id);
              
              return (
                <motion.div
                  key={provider.id}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "p-4 rounded-lg border transition-colors cursor-pointer",
                    isConfigured 
                      ? "border-green-500/50 bg-green-500/10" 
                      : "border-border/50 bg-muted/30 hover:border-primary/50"
                  )}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-foreground">{provider.name}</h4>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                    {isConfigured ? (
                      <Badge className="bg-green-500/20 text-green-400">
                        <Check className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline">Add Key</Badge>
                    )}
                  </div>
                  
                  {providerApiDocs[provider.id] && (
                    <a 
                      href={providerApiDocs[provider.id]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                    >
                      Get API Key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configured Providers */}
      {configuredProviders.length > 0 && (
        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle>Configured Providers</CardTitle>
            <CardDescription>
              Manage your connected AI providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configuredProviders.map((provider) => (
                <div 
                  key={provider.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{provider.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider.modelId || 'Default model'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.isDefault && (
                      <Badge className="bg-primary/20 text-primary">Default</Badge>
                    )}
                    <Switch 
                      checked={provider.isActive} 
                      onCheckedChange={async (checked) => {
                        await saveProviderSettings({
                          provider: provider.provider,
                          isActive: checked,
                        });
                        loadProviderSettings();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add API Key Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {AI_PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key
            </DialogTitle>
            <DialogDescription>
              Your API key will be encrypted and stored securely
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {selectedProvider && providerApiDocs[selectedProvider] && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>
                  Don't have a key?{' '}
                  <a 
                    href={providerApiDocs[selectedProvider]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Get one here
                  </a>
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={isSaving || !apiKey.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Save API Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
