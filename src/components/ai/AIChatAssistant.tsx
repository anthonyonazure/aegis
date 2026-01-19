import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Bot,
  User,
  Sparkles,
  Lightbulb,
  Shield,
  Settings,
  FileText,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SuggestedPrompt {
  icon: React.ElementType;
  label: string;
  prompt: string;
}

const suggestedPrompts: SuggestedPrompt[] = [
  { icon: Shield, label: 'Security Review', prompt: 'Review my tenant security posture and identify critical gaps' },
  { icon: Settings, label: 'Policy Help', prompt: 'Help me create a conditional access policy for MFA enforcement' },
  { icon: FileText, label: 'Compliance', prompt: 'What compliance frameworks should I implement for healthcare?' },
  { icon: HelpCircle, label: 'Best Practices', prompt: 'What are the best practices for M365 guest access management?' },
];

export const AIChatAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    const assistantId = (Date.now() + 1).toString();

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-assistant`;
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Add empty assistant message
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: assistantContent }
                  : m
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    streamChat(input.trim());
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (isLoading) return;
    streamChat(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[700px]">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Bot className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <span className="flex items-center gap-2">
                AI Assistant
                <Badge variant="outline" className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-500 border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Powered by AI
                </Badge>
              </span>
              <p className="text-sm font-normal text-muted-foreground">
                Ask me anything about M365 configuration, security, and compliance
              </p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="p-4 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 mb-4">
                  <MessageSquare className="h-8 w-8 text-violet-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">How can I help you today?</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  I'm your M365 management assistant. Ask me about security policies, 
                  compliance requirements, configuration best practices, and more.
                </p>
                
                {/* Suggested Prompts */}
                <div className="grid gap-2 w-full max-w-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Try one of these prompts:
                  </p>
                  {suggestedPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => handleSuggestedPrompt(prompt.prompt)}
                    >
                      <prompt.icon className="h-4 w-4 mr-3 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm">{prompt.prompt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 h-fit">
                        <Bot className="h-4 w-4 text-violet-500" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.content === '' && isLoading && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="p-2 rounded-lg bg-primary h-fit">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about M365 configuration, security, compliance..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
