import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  Filter,
  MoreVertical,
  Star,
  Crown,
  Zap,
  Mail,
  User,
  FileText,
  ChevronRight,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Customer, CustomerTier } from '@/types/tenant';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerWithTenantCount,
} from '@/lib/customerDatabase';
import { cn } from '@/lib/utils';

const tierConfig: Record<CustomerTier, { label: string; icon: React.ElementType; color: string }> = {
  starter: { label: 'Starter', icon: Zap, color: 'bg-muted text-muted-foreground' },
  professional: { label: 'Professional', icon: Star, color: 'bg-primary/20 text-primary' },
  enterprise: { label: 'Enterprise', icon: Crown, color: 'bg-warning/20 text-warning' },
};

const industryOptions = [
  'Healthcare',
  'Finance',
  'Education',
  'Technology',
  'Manufacturing',
  'Retail',
  'Legal',
  'Government',
  'Non-Profit',
  'Other',
];

interface CustomerWithCount extends Customer {
  tenantCount: number;
}

interface CustomerFormData {
  name: string;
  industry: string;
  tier: CustomerTier;
  primaryContactName: string;
  primaryContactEmail: string;
  notes: string;
}

const emptyFormData: CustomerFormData = {
  name: '',
  industry: '',
  tier: 'starter',
  primaryContactName: '',
  primaryContactEmail: '',
  notes: '',
};

interface CustomerManagerProps {
  onSelectCustomer?: (customer: Customer) => void;
  selectedCustomerId?: string;
}

export const CustomerManager = ({ onSelectCustomer, selectedCustomerId }: CustomerManagerProps) => {
  const [customers, setCustomers] = useState<CustomerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<CustomerTier | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomerWithTenantCount();
      setCustomers(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load customers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      industry: customer.industry || '',
      tier: customer.tier,
      primaryContactName: customer.primaryContactName || '',
      primaryContactEmail: customer.primaryContactEmail || '',
      notes: customer.notes || '',
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (customer: Customer) => {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Customer name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: formData.name.trim(),
          industry: formData.industry || undefined,
          tier: formData.tier,
          primaryContactName: formData.primaryContactName || undefined,
          primaryContactEmail: formData.primaryContactEmail || undefined,
          notes: formData.notes || undefined,
        });
        toast({ title: 'Success', description: 'Customer updated successfully' });
      } else {
        await createCustomer({
          name: formData.name.trim(),
          industry: formData.industry || undefined,
          tier: formData.tier,
          primaryContactName: formData.primaryContactName || undefined,
          primaryContactEmail: formData.primaryContactEmail || undefined,
          notes: formData.notes || undefined,
        });
        toast({ title: 'Success', description: 'Customer created successfully' });
      }

      setDialogOpen(false);
      loadCustomers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save customer',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;

    try {
      setSaving(true);
      await deleteCustomer(deletingCustomer.id);
      toast({ title: 'Success', description: 'Customer deleted successfully' });
      setDeleteDialogOpen(false);
      setDeletingCustomer(null);
      loadCustomers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete customer',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.primaryContactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.primaryContactEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your MSP customer organizations
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-panel">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50"
              />
            </div>
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as CustomerTier | 'all')}>
              <SelectTrigger className="w-full sm:w-48 bg-secondary/50">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery || tierFilter !== 'all' ? 'No customers found' : 'No customers yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || tierFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Add your first customer to get started'}
            </p>
            {!searchQuery && tierFilter === 'all' && (
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredCustomers.map((customer, index) => {
              const TierIcon = tierConfig[customer.tier].icon;
              const isSelected = selectedCustomerId === customer.id;

              return (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={cn(
                      "glass-panel cursor-pointer transition-all duration-200 hover:border-primary/50",
                      isSelected && "border-primary ring-1 ring-primary"
                    )}
                    onClick={() => onSelectCustomer?.(customer)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{customer.name}</h3>
                            {customer.industry && (
                              <p className="text-xs text-muted-foreground">{customer.industry}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(customer); }}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleOpenDelete(customer); }}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={cn("gap-1", tierConfig[customer.tier].color)}>
                          <TierIcon className="w-3 h-3" />
                          {tierConfig[customer.tier].label}
                        </Badge>
                        {!customer.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{customer.tenantCount} tenant{customer.tenantCount !== 1 ? 's' : ''}</span>
                        </div>
                        {customer.primaryContactEmail && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-32">{customer.primaryContactEmail}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? 'Update the customer details below'
                : 'Enter the details for the new customer'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corporation"
                className="bg-secondary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(v) => setFormData({ ...formData, industry: v })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier">Service Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(v) => setFormData({ ...formData, tier: v as CustomerTier })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Primary Contact Name</Label>
                <Input
                  id="contactName"
                  value={formData.primaryContactName}
                  onChange={(e) => setFormData({ ...formData, primaryContactName: e.target.value })}
                  placeholder="John Smith"
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Primary Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.primaryContactEmail}
                  onChange={(e) => setFormData({ ...formData, primaryContactEmail: e.target.value })}
                  placeholder="john@acme.com"
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this customer..."
                className="bg-secondary/50 min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingCustomer?.name}"? This action cannot be undone.
              All tenant groups under this customer will also be deleted.
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
