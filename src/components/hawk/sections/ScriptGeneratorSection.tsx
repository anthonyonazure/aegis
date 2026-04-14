import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Terminal, Info, Users, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { hawkCommands } from '@/lib/hawkData';

export const ScriptGeneratorSection = () => {
  const { toast } = useToast();
  const { isConnected, tenantId, tenantName } = useTenant();
  const { users, isLoading: usersLoading } = useTenantUsers();

  const [investigationType, setInvestigationType] = useState<'tenant' | 'user' | 'both'>('tenant');
  const [upn, setUpn] = useState('');
  const [upnSearch, setUpnSearch] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [daysBack, setDaysBack] = useState('90');
  const [outputPath, setOutputPath] = useState('C:\\HawkOutput');
  const [selectedCmds, setSelectedCmds] = useState<Set<string>>(new Set());
  const [includeInstall, setIncludeInstall] = useState(true);

  const filteredCommands = useMemo(() => {
    if (investigationType === 'both') return hawkCommands.filter(c => c.category !== 'setup' && c.category !== 'message');
    return hawkCommands.filter(c => c.category === investigationType);
  }, [investigationType]);

  const filteredUsers = useMemo(() => {
    if (!upnSearch) return users.slice(0, 20);
    const q = upnSearch.toLowerCase();
    return users.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.userPrincipalName.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [users, upnSearch]);

  const toggleCmd = (id: string) => {
    setSelectedCmds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCmds.size === filteredCommands.length) {
      setSelectedCmds(new Set());
    } else {
      setSelectedCmds(new Set(filteredCommands.map(c => c.id)));
    }
  };

  const selectUser = (userPrincipalName: string) => {
    setUpn(userPrincipalName);
    setShowUserPicker(false);
    setUpnSearch('');
  };

  const generatedScript = useMemo(() => {
    const lines: string[] = [
      '# ═══════════════════════════════════════════════════════════════════',
      '# Hawk M365 Forensics Investigation Script',
      `# Generated: ${new Date().toISOString().split('T')[0]}`,
      tenantId ? `# Tenant: ${tenantName || tenantId}` : '',
      '# ═══════════════════════════════════════════════════════════════════',
      '',
    ].filter(Boolean);

    if (includeInstall) {
      lines.push(
        '# ── Prerequisites ────────────────────────────────────────────────',
        'if (-not (Get-Module -ListAvailable -Name Hawk)) {',
        '    Install-Module -Name Hawk -Force -Scope CurrentUser',
        '}',
        'Import-Module Hawk',
        '',
      );
    }

    lines.push(
      '# ── Initialize Investigation ──────────────────────────────────────',
      `$OutputPath = "${outputPath}"`,
      `$DaysBack = ${daysBack}`,
      '',
      `Start-HawkTenantInvestigation -DaysToLookBack $DaysBack`,
      '',
    );

    if (investigationType === 'user' || investigationType === 'both') {
      if (upn) {
        lines.push(
          '# ── User Investigation ───────────────────────────────────────────',
          `$TargetUser = "${upn}"`,
          '',
        );
      }
    }

    const cmdsToRun = selectedCmds.size > 0
      ? hawkCommands.filter(c => selectedCmds.has(c.id))
      : filteredCommands;

    const tenantCmds = cmdsToRun.filter(c => c.category === 'tenant');
    const userCmds = cmdsToRun.filter(c => c.category === 'user');

    if (tenantCmds.length > 0) {
      lines.push('# ── Tenant-Level Commands ─────────────────────────────────────────');
      tenantCmds.forEach(c => {
        lines.push(`Write-Host "Running: ${c.name}..." -ForegroundColor Cyan`);
        lines.push(c.cmdlet);
        lines.push('');
      });
    }

    if (userCmds.length > 0 && (investigationType === 'user' || investigationType === 'both')) {
      lines.push('# ── User-Level Commands ───────────────────────────────────────────');
      if (upn) {
        userCmds.forEach(c => {
          lines.push(`Write-Host "Running: ${c.name}..." -ForegroundColor Cyan`);
          const cmd = c.parameters.find(p => p.name === 'UserPrincipalName')
            ? `${c.cmdlet} -UserPrincipalName $TargetUser`
            : c.cmdlet;
          lines.push(cmd);
          lines.push('');
        });
      } else {
        lines.push('# ⚠ Set $TargetUser above before running user commands');
        lines.push('');
      }
    }

    lines.push(
      '# ── Summary ──────────────────────────────────────────────────────',
      'Write-Host ""',
      'Write-Host "Investigation complete. Review output files for *_Investigate* entries." -ForegroundColor Green',
      `Write-Host "Output directory: $OutputPath" -ForegroundColor Green`,
    );

    return lines.join('\n');
  }, [investigationType, upn, daysBack, outputPath, selectedCmds, includeInstall, filteredCommands, tenantId, tenantName]);

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    toast({ title: 'Script copied', description: 'PowerShell script copied to clipboard.' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Script Generator</h2>
        <p className="text-muted-foreground mt-1">Build a ready-to-run Hawk PowerShell investigation script tailored to your scenario.</p>
      </div>

      {isConnected && (
        <div className="flex items-center gap-2 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-700 dark:text-green-400">
            Connected to <span className="font-medium">{tenantName || tenantId}</span> — user list auto-populated ({users.length} users)
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investigation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Investigation Type</Label>
                <Select value={investigationType} onValueChange={(v: any) => setInvestigationType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Tenant-Wide</SelectItem>
                    <SelectItem value="user">User-Specific</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(investigationType === 'user' || investigationType === 'both') && (
                <div className="space-y-2">
                  <Label>User Principal Name</Label>
                  {isConnected && users.length > 0 ? (
                    <div className="relative">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Select or type a UPN..."
                          value={upn}
                          onChange={e => setUpn(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUserPicker(!showUserPicker)}
                          className="gap-1.5 shrink-0"
                        >
                          {usersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                          Pick User
                        </Button>
                      </div>
                      {showUserPicker && (
                        <Card className="absolute z-50 mt-1 w-full max-h-60 overflow-auto shadow-lg">
                          <CardContent className="p-2 space-y-1">
                            <div className="relative mb-1">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search users..."
                                value={upnSearch}
                                onChange={e => setUpnSearch(e.target.value)}
                                className="pl-8 h-8 text-xs"
                                autoFocus
                              />
                            </div>
                            {filteredUsers.map(u => (
                              <button
                                key={u.id}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs"
                                onClick={() => selectUser(u.userPrincipalName)}
                              >
                                <p className="font-medium">{u.displayName}</p>
                                <p className="text-muted-foreground font-mono">{u.userPrincipalName}</p>
                              </button>
                            ))}
                            {filteredUsers.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">No users found</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Input placeholder="user@contoso.com" value={upn} onChange={e => setUpn(e.target.value)} />
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Days to Look Back</Label>
                <Input type="number" value={daysBack} onChange={e => setDaysBack(e.target.value)} min={1} max={365} />
              </div>

              <div className="space-y-2">
                <Label>Output Path</Label>
                <Input value={outputPath} onChange={e => setOutputPath(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="include-install" checked={includeInstall} onCheckedChange={v => setIncludeInstall(!!v)} />
                <Label htmlFor="include-install" className="text-sm cursor-pointer">Include module install check</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Commands</CardTitle>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedCmds.size === filteredCommands.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto">
              {filteredCommands.map(c => (
                <label key={c.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={selectedCmds.has(c.id)}
                    onCheckedChange={() => toggleCmd(c.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Generated Script */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Generated Script
              </CardTitle>
              <CardDescription>Copy and paste into your PowerShell terminal</CardDescription>
            </div>
            <Button size="sm" onClick={copyScript} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/60 rounded-lg p-4 overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap text-foreground/90">
              {generatedScript}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
