import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Download, Upload, Star, Search, Trash2, EyeOff, Store, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  MarketplaceTemplate,
  browseMarketplace,
  deletePublication,
  getMyPublications,
  getMyRatingFor,
  installTemplate,
  publishTemplate,
  rateTemplate,
  unpublishTemplate,
} from '@/lib/marketplaceDatabase';

const FRAMEWORK_TAGS = ['hipaa-security', 'soc2-tsc', 'cmmc-l2'];

/**
 * Phase 2 #5 — public marketplace for policy templates.
 *
 * Browse and install community-published templates; publish your own
 * templates; rate ones you've used.
 */
export function PolicyMarketplaceView() {
  const { toast } = useToast();
  const [browseList, setBrowseList] = useState<MarketplaceTemplate[]>([]);
  const [myList, setMyList] = useState<MarketplaceTemplate[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [framework, setFramework] = useState<string>('');
  const [selected, setSelected] = useState<MarketplaceTemplate | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [myReview, setMyReview] = useState<string>('');

  // Publish form
  const [publishOpen, setPublishOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pPolicyJson, setPPolicyJson] = useState('{}');
  const [pFrameworkTags, setPFrameworkTags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const refreshBrowse = async () => {
    setBrowseLoading(true);
    try {
      setBrowseList(
        await browseMarketplace({
          search: search.trim() || undefined,
          framework: framework || undefined,
          limit: 50,
        })
      );
    } catch (e) {
      toast({
        title: 'Failed to load marketplace',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBrowseLoading(false);
    }
  };

  const refreshMine = async () => {
    try {
      setMyList(await getMyPublications());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void refreshBrowse();
    void refreshMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    void refreshBrowse();
  };

  const openDetail = async (t: MarketplaceTemplate) => {
    setSelected(t);
    try {
      const r = await getMyRatingFor(t.id);
      setMyRating(r?.rating ?? 0);
      setMyReview(r?.review ?? '');
    } catch {
      setMyRating(0);
      setMyReview('');
    }
  };

  const handleInstall = async (t: MarketplaceTemplate) => {
    try {
      await installTemplate(t.id);
      toast({ title: 'Template installed', description: `"${t.name}" added to your Policy Templates.` });
      // Bump local install_count optimistically
      setBrowseList((list) => list.map((x) => (x.id === t.id ? { ...x, installCount: x.installCount + 1 } : x)));
      if (selected?.id === t.id) setSelected({ ...selected, installCount: selected.installCount + 1 });
    } catch (e) {
      toast({
        title: 'Install failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async () => {
    if (!pName.trim() || !pCategory.trim()) {
      toast({ title: 'Name and category required', variant: 'destructive' });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(pPolicyJson);
    } catch {
      toast({ title: 'Policy data must be valid JSON', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      await publishTemplate({
        name: pName.trim(),
        description: pDescription.trim() || undefined,
        category: pCategory.trim(),
        policyData: parsed,
        frameworkTags: pFrameworkTags,
      });
      toast({ title: 'Template published' });
      setPublishOpen(false);
      setPName('');
      setPCategory('');
      setPDescription('');
      setPPolicyJson('{}');
      setPFrameworkTags([]);
      void refreshBrowse();
      void refreshMine();
    } catch (e) {
      toast({
        title: 'Publish failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleRate = async () => {
    if (!selected || myRating === 0) return;
    try {
      await rateTemplate({ templateId: selected.id, rating: myRating, review: myReview });
      toast({ title: 'Rating saved' });
      void refreshBrowse();
    } catch (e) {
      toast({
        title: 'Rate failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleUnpublish = async (t: MarketplaceTemplate) => {
    try {
      await unpublishTemplate(t.id);
      toast({ title: 'Unpublished' });
      void refreshMine();
      void refreshBrowse();
    } catch (e) {
      toast({
        title: 'Unpublish failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (t: MarketplaceTemplate) => {
    if (!confirm(`Permanently delete "${t.name}" from the marketplace?`)) return;
    try {
      await deletePublication(t.id);
      toast({ title: 'Deleted' });
      void refreshMine();
      void refreshBrowse();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const ratingStars = useMemo(() => [1, 2, 3, 4, 5], []);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policy Templates Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Browse policy templates other MSPs have shared. Install with one click; rate ones you've used.
          </p>
        </div>
        <Button onClick={() => setPublishOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Publish
        </Button>
      </header>

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="mine">My publications</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr,200px,auto]">
                <div className="space-y-1">
                  <Label className="sr-only">Search</Label>
                  <Input
                    placeholder="Search by name or description"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="sr-only">Framework tag</Label>
                  <select
                    className="w-full h-10 rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                  >
                    <option value="">All frameworks</option>
                    {FRAMEWORK_TAGS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {browseLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : browseList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No published templates match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {browseList.map((t) => (
                <Card
                  key={t.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openDetail(t)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <Badge variant="outline">{t.category}</Badge>
                    </div>
                    {t.description && (
                      <CardDescription className="line-clamp-2">{t.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          {t.installCount}
                        </span>
                        {t.ratingAverage !== null && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            {t.ratingAverage.toFixed(1)} ({t.ratingCount})
                          </span>
                        )}
                      </div>
                      {t.frameworkTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {t.frameworkTags.slice(0, 2).map((f) => (
                            <Badge key={f} variant="secondary" className="text-[10px]">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          {myList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">You haven't published any templates yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {myList.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{t.name}</p>
                        {!t.isPublished && <Badge variant="outline">Unpublished</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.installCount} install{t.installCount === 1 ? '' : 's'}
                        {t.ratingCount > 0 && ` · ${t.ratingAverage?.toFixed(1)}★ (${t.ratingCount})`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {t.isPublished && (
                        <Button size="sm" variant="ghost" onClick={() => handleUnpublish(t)}>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Unpublish
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.description ?? '(no description)'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{selected.category}</Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Download className="w-3 h-3" />
                    {selected.installCount} installs
                  </span>
                  {selected.ratingAverage !== null && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Star className="w-3 h-3 fill-current" />
                      {selected.ratingAverage.toFixed(1)} ({selected.ratingCount})
                    </span>
                  )}
                </div>
                {selected.frameworkTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {selected.frameworkTags.map((f) => (
                      <Badge key={f} variant="secondary">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}

                <div>
                  <Label className="text-xs">Policy data</Label>
                  <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto max-h-48">
                    {JSON.stringify(selected.policyData, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2 border-t border-border/40 pt-4">
                  <Label>Your rating</Label>
                  <div className="flex gap-1">
                    {ratingStars.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMyRating(s)}
                        className="text-yellow-400 hover:scale-110 transition-transform"
                      >
                        <Star className={`w-5 h-5 ${s <= myRating ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Optional review"
                    value={myReview}
                    onChange={(e) => setMyReview(e.target.value)}
                    rows={2}
                  />
                  <Button size="sm" variant="outline" onClick={handleRate} disabled={myRating === 0}>
                    Save rating
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => handleInstall(selected)}>
                  <Download className="w-4 h-4 mr-2" />
                  Install
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish a policy template</DialogTitle>
            <DialogDescription>
              Anyone signed in can install it. You can unpublish or delete later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="e.g. conditional-access" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={pDescription} onChange={(e) => setPDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Framework tags</Label>
              <div className="flex gap-2 flex-wrap">
                {FRAMEWORK_TAGS.map((f) => {
                  const on = pFrameworkTags.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setPFrameworkTags(on ? pFrameworkTags.filter((x) => x !== f) : [...pFrameworkTags, f])
                      }
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        on ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted/30 border-border/60'
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Policy JSON</Label>
              <Textarea
                value={pPolicyJson}
                onChange={(e) => setPPolicyJson(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
