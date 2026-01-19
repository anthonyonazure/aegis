import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Plus, Trash2, Mail, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Invitation {
  id: string;
  code: string;
  email: string | null;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export function InviteManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);

  useEffect(() => {
    fetchInvitations();
  }, []);

  async function fetchInvitations() {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function createInvitation() {
    if (!user) return;
    
    setCreating(true);
    try {
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { error } = await supabase
        .from('invitations')
        .insert({
          code,
          email: email.trim() || null,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Invitation Created',
        description: `Code: ${code}`,
      });

      setEmail('');
      fetchInvitations();
    } catch (err) {
      console.error('Error creating invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to create invitation',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  async function deleteInvitation(id: string) {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Invitation Deleted',
      });

      fetchInvitations();
    } catch (err) {
      console.error('Error deleting invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete invitation',
        variant: 'destructive',
      });
    }
  }

  function copyInviteLink(code: string) {
    const link = `${window.location.origin}/login?invite=${code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard',
    });
  }

  function getStatus(invite: Invitation): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
    if (invite.used_by) {
      return { label: 'Used', variant: 'secondary' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      return { label: 'Expired', variant: 'destructive' };
    }
    return { label: 'Active', variant: 'default' };
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Invitation
          </CardTitle>
          <CardDescription>
            Generate an invite code for a new user. Optionally restrict to a specific email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Expires in (days)</Label>
              <Input
                id="expiry"
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={createInvitation} disabled={creating} className="w-full">
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate Code
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            Manage pending and used invitation codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invitations yet. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => {
                  const status = getStatus(invite);
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-mono font-medium">
                        {invite.code}
                      </TableCell>
                      <TableCell>
                        {invite.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {invite.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Any</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label === 'Used' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {status.label === 'Expired' && <XCircle className="h-3 w-3 mr-1" />}
                          {status.label === 'Active' && <Clock className="h-3 w-3 mr-1" />}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invite.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!invite.used_by && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyInviteLink(invite.code)}
                              title="Copy invite link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          {!invite.used_by && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteInvitation(invite.id)}
                              title="Delete invitation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
