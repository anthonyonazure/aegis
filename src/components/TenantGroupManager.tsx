import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Server,
  Loader2,
  Palette,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { TenantGroup, Customer } from '@/types/tenant';
import {
  createTenantGroup,
  updateTenantGroup,
  deleteTenantGroup,
  getTenantGroupsWithTenantCount,
} from '@/lib/customerDatabase';
import { cn } from '@/lib/utils';

const colorOptions = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

interface TenantGroupWithCount extends TenantGroup {
  tenantCount: number;
}

interface TenantGroupFormData {
  name: string;
  description: string;
  color: string;
}

const emptyFormData: TenantGroupFormData = {
  name: '',
  description: '',
  color: '#6366f1',
};

interface TenantGroupManagerProps {
  customer: Customer;
  onBack?: () => void;
}

export const TenantGroupManager = ({ customer, onBack }: TenantGroupManagerProps) => {
  const [groups, setGroups] = useState<TenantGroupWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TenantGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<TenantGroup | null>(null);
  const [formData, setFormData] = useState<TenantGroupFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadGroups();
  }, [customer.id]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await getTenantGroupsWithTenantCount(customer.id);
      setGroups(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load tenant groups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (group: TenantGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#6366f1',
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (group: TenantGroup) => {
    setDeletingGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Group name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      if (editingGroup) {
        await updateTenantGroup(editingGroup.id, {
          name: formData.name.trim(),
          description: formData.description || undefined,
          color: formData.color,
        });
        toast({ title: 'Success', description: 'Group updated successfully' });
      } else {
        await createTenantGroup({
          customerId: customer.id,
          name: formData.name.trim(),
          description: formData.description || undefined,
          color: formData.color,
        });
        toast({ title: 'Success', description: 'Group created successfully' });
      }

      setDialogOpen(false);
      loadGroups();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save group',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;

    try {
      setSaving(true);
      await deleteTenantGroup(deletingGroup.id);
      toast({ title: 'Success', description: 'Group deleted successfully' });
      setDeleteDialogOpen(false);
      setDeletingGroup(null);
      loadGroups();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete group',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            {onBack && (
              <button onClick={onBack} className="hover:text-foreground transition-colors">
                Customers
              </button>
            )}
            {onBack && <span>/</span>}
            <span className="text-foreground">{customer.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tenant Groups</h1>
          <p className="text-muted-foreground mt-1">
            Organize tenants into groups for better management
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Group
        </Button>
      </div>

      {/* Group List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-12 text-center">
            <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">
              Create groups to organize tenants (e.g., Production, Development, Staging)
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass-panel">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${group.color}20` }}
                        >
                          <FolderTree className="w-5 h-5" style={{ color: group.color }} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{group.name}</h3>
                          {group.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Server className="w-4 h-4" />
                        <span>{group.tenantCount} tenant{group.tenantCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(group)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleOpenDelete(group)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
            <DialogDescription>
              {editingGroup
                ? 'Update the group details below'
                : 'Create a new tenant group for organizing your tenants'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production, Development"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this group..."
                className="bg-secondary/50 min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Color
              </Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      formData.color === color
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGroup ? 'Save Changes' : 'Add Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingGroup?.name}"? Tenants in this group will
              not be deleted, but they will no longer be associated with a group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
