import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, FolderOpen } from 'lucide-react';
import { hawkOutputFiles } from '@/lib/hawkData';

export const OutputGuideSection = () => {
  const tenantFiles = hawkOutputFiles.filter(f => f.category === 'Tenant');
  const userFiles = hawkOutputFiles.filter(f => f.category === 'User');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Output Guide</h2>
        <p className="text-muted-foreground mt-1">
          Understand the files Hawk generates and what to look for during your investigation.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Look for <code className="bg-muted px-1.5 py-0.5 rounded text-xs">_Investigate</code> files first</p>
            <p className="text-sm text-muted-foreground mt-1">
              Hawk flags suspicious findings by creating files with "_Investigate" in the name. Start your review with these files — they contain items that need immediate attention.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Output Directory Structure</CardTitle>
          <CardDescription>Hawk organizes output into a folder hierarchy</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-sm font-mono bg-muted/60 rounded-lg p-4 text-foreground/90">{`HawkOutput/
├── Tenant/
│   ├── Admin_Audit.csv
│   ├── Consent_Grants.csv
│   ├── Tenant_InboxRules.csv
│   ├── Tenant_InboxRules_Investigate.csv  ← Review this!
│   ├── Tenant_MailForwarding.csv
│   └── Transport_Rules.csv
├── user@contoso.com/
│   ├── User_SignIn_Log.csv
│   ├── User_SignIn_Log_Investigate.csv    ← Review this!
│   ├── User_InboxRules.csv
│   ├── User_MailboxAudit.csv
│   └── User_MailForwarding.csv
└── _Investigate/
    └── (aggregated suspicious findings)`}</pre>
        </CardContent>
      </Card>

      {[
        { title: 'Tenant-Level Output Files', files: tenantFiles },
        { title: 'User-Level Output Files', files: userFiles },
      ].map(group => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.files.map(f => (
                <div key={f.filename} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-medium">{f.filename}</code>
                      {f.investigateFlag && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Investigate
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
