import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquareText, 
  Plus, 
  Search, 
  Star,
  Trash2,
  Copy,
  Tag,
  Globe,
  Lock,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPromptLibrary, createPrompt, deletePrompt, PromptTemplate } from '@/lib/copilotApi';
import { useToast } from '@/hooks/use-toast';

interface PromptLibraryManagerProps {
  customerId?: string;
}

const PROMPT_CATEGORIES = [
  'general',
  'writing',
  'analysis',
  'coding',
  'meetings',
  'email',
  'presentations',
  'research',
];

const TARGET_APPS = ['Word', 'Excel', 'PowerPoint', 'Outlook', 'Teams', 'OneNote'];

export const PromptLibraryManager = ({ customerId }: PromptLibraryManagerProps) => {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // New prompt form state
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    promptText: '',
    category: 'general',
    tags: [] as string[],
    targetApps: [] as string[],
    isPublic: false,
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadPrompts();
  }, [customerId]);

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const data = await getPromptLibrary(customerId);
      setPrompts(data);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPrompt.name || !newPrompt.promptText) {
      toast({
        title: 'Validation Error',
        description: 'Name and prompt text are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createPrompt(newPrompt, customerId);
      toast({
        title: 'Prompt Created',
        description: 'Your prompt has been added to the library',
      });
      setShowCreateDialog(false);
      setNewPrompt({
        name: '',
        description: '',
        promptText: '',
        category: 'general',
        tags: [],
        targetApps: [],
        isPublic: false,
      });
      loadPrompts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create prompt',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      await deletePrompt(promptId);
      toast({
        title: 'Prompt Deleted',
        description: 'The prompt has been removed from the library',
      });
      loadPrompts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete prompt',
        variant: 'destructive',
      });
    }
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Prompt copied to clipboard',
    });
  };

  const addTag = () => {
    if (tagInput && !newPrompt.tags.includes(tagInput)) {
      setNewPrompt(prev => ({ ...prev, tags: [...prev.tags, tagInput] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNewPrompt(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const toggleTargetApp = (app: string) => {
    setNewPrompt(prev => ({
      ...prev,
      targetApps: prev.targetApps.includes(app)
        ? prev.targetApps.filter(a => a !== app)
        : [...prev.targetApps, app],
    }));
  };

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-primary" />
              Prompt Library
            </CardTitle>
            <CardDescription>
              Organization-approved prompts for Copilot users
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Prompt
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {PROMPT_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompts Grid */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading prompts...</div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquareText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No prompts found</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                Create your first prompt
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPrompts.map((prompt) => (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{prompt.name}</h4>
                      {prompt.isPublic ? (
                        <Globe className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyPrompt(prompt.promptText)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePrompt(prompt.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {prompt.description && (
                    <p className="text-sm text-muted-foreground mb-3">{prompt.description}</p>
                  )}
                  <div className="p-2 rounded bg-background/50 text-sm text-foreground mb-3 line-clamp-2">
                    {prompt.promptText}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className="capitalize">{prompt.category}</Badge>
                    {prompt.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="w-2 h-2 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {prompt.avgRating.toFixed(1)}
                    </span>
                    <span>{prompt.usageCount} uses</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Create Prompt Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Prompt</DialogTitle>
              <DialogDescription>
                Add a reusable prompt to the organization library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="E.g., Meeting Summary"
                  value={newPrompt.name}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Brief description of what this prompt does"
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label>Prompt Text</Label>
                <Textarea
                  placeholder="Enter the prompt text..."
                  value={newPrompt.promptText}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, promptText: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={newPrompt.category}
                    onValueChange={(v) => setNewPrompt(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMPT_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button variant="outline" onClick={addTag}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newPrompt.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Target Apps</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TARGET_APPS.map(app => (
                    <Badge
                      key={app}
                      variant={newPrompt.targetApps.includes(app) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleTargetApp(app)}
                    >
                      {app}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newPrompt.isPublic}
                    onCheckedChange={(checked) => setNewPrompt(prev => ({ ...prev, isPublic: checked }))}
                  />
                  <Label>Make public to all users</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreatePrompt}>Create Prompt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
