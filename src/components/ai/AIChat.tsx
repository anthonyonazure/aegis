import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Settings2, 
  Trash2,
  MessageSquare,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { 
  streamAIChat, 
  AIMessage, 
  AI_PROVIDERS, 
  PROVIDER_MODELS,
  createConversation 
} from '@/lib/aiApi';
import { cn } from '@/lib/utils';

interface AIChatProps {
  featureType?: string;
  title?: string;
  placeholder?: string;
  systemContext?: Record<string, unknown>;
  className?: string;
}

export function AIChat({ 
  featureType = 'general-chat',
  title = 'AI Assistant',
  placeholder = 'Ask me anything about your Microsoft 365 tenant...',
  systemContext,
  className 
}: AIChatProps) {
  const { toast } = useToast();
  const { selectedTenantId, tenants } = useTenant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState('gateway');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  const availableModels = PROVIDER_MODELS[provider] || PROVIDER_MODELS.gateway;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update model when provider changes
  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (models && models.length > 0) {
      setModel(models[0].id);
    }
  }, [provider]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Create conversation if needed
    let convId = conversationId;
    if (!convId) {
      const conv = await createConversation({
        title: input.trim().slice(0, 50),
        featureType,
        provider,
        modelId: model,
        tenantConnectionId: selectedTenantId || undefined,
      });
      if (conv) {
        convId = conv.id;
        setConversationId(conv.id);
      }
    }

    let assistantContent = '';

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    // Build tenant context
    const tenantContext = {
      ...systemContext,
      ...(selectedTenant && {
        tenantName: selectedTenant.displayName || selectedTenant.tenantName,
        tenantId: selectedTenant.tenantId,
      }),
    };

    await streamAIChat({
      messages: [...messages, userMessage],
      featureType,
      provider,
      model,
      tenantContext: Object.keys(tenantContext).length > 0 ? tenantContext : undefined,
      conversationId: convId || undefined,
      onDelta: updateAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        toast({
          title: 'AI Error',
          description: err,
          variant: 'destructive',
        });
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{title}</h3>
          {selectedTenant && (
            <Badge variant="outline" className="text-xs">
              {selectedTenant.displayName || selectedTenant.tenantName}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings2 className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI Provider</label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button variant="ghost" size="icon" onClick={clearChat}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Start a conversation with AI
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Using {AI_PROVIDERS.find(p => p.id === provider)?.name}
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 text-foreground'
                )}>
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                    {isLoading && index === messages.length - 1 && message.role === 'assistant' && (
                      <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                    )}
                  </div>
                </div>
                
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={2}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            className="h-auto"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
