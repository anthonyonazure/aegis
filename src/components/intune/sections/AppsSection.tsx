import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneApp } from '../IntuneTypes';
import { format } from 'date-fns';

const appTypeBadge = (odataType: string) => {
  const type = odataType?.split('.').pop() || 'unknown';
  const typeMap: Record<string, { label: string; className: string }> = {
    win32LobApp: { label: 'Win32', className: 'bg-blue-500/20 text-blue-400' },
    microsoftStoreForBusinessApp: { label: 'Store', className: 'bg-purple-500/20 text-purple-400' },
    iosVppApp: { label: 'iOS VPP', className: 'bg-orange-500/20 text-orange-400' },
    androidManagedStoreApp: { label: 'Android', className: 'bg-green-500/20 text-green-400' },
    webApp: { label: 'Web', className: 'bg-cyan-500/20 text-cyan-400' },
    windowsMicrosoftEdgeApp: { label: 'Edge', className: 'bg-teal-500/20 text-teal-400' },
    officeSuiteApp: { label: 'Office', className: 'bg-red-500/20 text-red-400' },
  };
  const info = typeMap[type] || { label: type, className: 'bg-muted text-muted-foreground' };
  return <Badge className={`${info.className} border-0`}>{info.label}</Badge>;
};

export const AppsSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneApp>({
    resource: 'intune/win32-apps',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneApp>[] = [
    {
      key: 'displayName',
      label: 'Name',
      render: (item) => (
        <span className="text-primary font-medium hover:underline cursor-pointer">
          {item.displayName}
        </span>
      ),
    },
    {
      key: 'publisher',
      label: 'Publisher',
    },
    {
      key: '@odata.type',
      label: 'Type',
      render: (item) => appTypeBadge(item['@odata.type']),
    },
    {
      key: 'createdDateTime',
      label: 'Created',
      render: (item) => item.createdDateTime ? format(new Date(item.createdDateTime), 'MMM d, yyyy') : '—',
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">All apps</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Applications deployed through Intune
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search apps..."
        emptyMessage="No apps found. Connect a tenant to see managed apps."
      />
    </div>
  );
};
