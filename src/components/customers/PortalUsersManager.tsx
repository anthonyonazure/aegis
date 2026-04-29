import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Trash2, ToggleLeft, ToggleRight, Users, Copy, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Customer, CustomerUser, CustomerUserRole } from '@/types/tenant';
import {
  getCustomerUsers,
  inviteCustomerUserByEmail,
  setCustomerUserActive,
  removeCustomerUser,
} from '@/lib/customerUsersDatabase';

interface PortalUsersManagerProps {
  customer: Customer;
}

/**
 * Phase 2 #3b — MSP-side portal user management with email invites.
 *
 * Replaces the #3a "paste auth user id" form. The MSP supplies an email +
 * role; the invite-portal-user edge function creates the auth user (if
 * needed), sends a magic link redirected at the customer's portal login,
 * and upserts the customer_users link.
 */
export function PortalUsersManager({ customer }: PortalUsersManagerProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CustomerUserRole>('customer_viewer');
  const [submitting, setSubmitting] = useState(false);

  const portalSlug = customer.customSubdomain;
  const portalUrl = portalSlug ? `${window.location.origin}/portal/${portalSlug}/login` : null;

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await getCustomerUsers(customer.id);
      setUsers(list);
    } catch (e) {
      toast({
        title: 'Failed to load portal users',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast({ title: 'Email required', description: 'Enter an email to invite.', variant: 'destructive' });
      return;
    }
    if (!portalSlug) {
      toast({
        title: 'Set a portal slug first',
        description: 'On the Branding tab, set custom_subdomain so invitees land at the right portal URL.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await inviteCustomerUserByEmail({
        customerId: customer.id,
        email: trimmed,
        role,
        redirectTo: portalUrl ?? undefined,
      });
      toast({
        title: result.inviteEmailSent ? 'Invite sent' : 'Linked, but email not sent',
        description: result.inviteEmailSent
          ? `${trimmed} will get a magic link to ${portalUrl}.`
          : result.message || 'Share the portal URL manually.',
      });
      setEmail('');
      setRole('customer_viewer');
      await refresh();
    } catch (e) {
      toast({
        title: 'Invite failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (u: CustomerUser) => {
    try {
      await setCustomerUserActive(u.id, !u.isActive);
      await refresh();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (u: CustomerUser) => {
    if (!confirm('Revoke portal access for this user? The auth account itself is not deleted.')) return;
    try {
      await removeCustomerUser(u.id);
      await refresh();
      toast({ title: 'Portal access revoked' });
    } catch (e) {
      toast({
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCopyUrl = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    toast({ title: 'Portal URL copied' });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Portal access for {customer.name}
          </CardTitle>
          <CardDescription>
            People you invite here can sign in to a read-only portal showing this customer's secure score, drift, and
            anomaly findings. They cannot see other customers' data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {portalUrl ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border/50">
              <code className="text-xs flex-1 truncate">{portalUrl}</code>
              <Button size="sm" variant="ghost" onClick={handleCopyUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
              <p className="text-sm">
                Set a <strong>custom_subdomain</strong> on the Branding tab to expose a portal URL like{' '}
                <code>/portal/your-slug/login</code>. You'll need this before invites can be sent.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Invite a portal user</CardTitle>
          <CardDescription>
            We'll create the account if needed and email a magic link that lands at the portal sign-in. Roles only
            affect future read/write surfaces; today everything is read-only either way.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr,200px,auto]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="contact@customer.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as CustomerUserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="customer_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleInvite} disabled={submitting || !portalSlug} className="w-full md:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Send invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle>Active portal users</CardTitle>
          <CardDescription>{users.length} grant{users.length === 1 ? '' : 's'} on file.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No portal users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auth user ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.authUserId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role === 'customer_admin' ? 'Admin' : 'Viewer'}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Active</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt ? u.lastLoginAt.toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggle(u)}
                          title={u.isActive ? 'Disable' : 'Enable'}
                        >
                          {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRemove(u)} title="Revoke">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
