import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { format } from 'date-fns';

interface AppConfig {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
  targetedMobileApps?: string[];
}

export const AppConfigSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<AppConfig>({
    resource: 'intune/app-configurations',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<AppConfig>[] = [
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
      key: '@odata.type',
      label: 'Type',
      render: (item) => {
        const type = item['@odata.type']?.split('.').pop() || 'Unknown';
        return <Badge variant="outline">{type}</Badge>;
      },
    },
    {
      key: 'lastModifiedDateTime',
      label: 'Last modified',
      render: (item) => item.lastModifiedDateTime
        ? format(new Date(item.lastModifiedDateTime), 'MMM d, yyyy')
        : '—',
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">App configuration policies</h2>
        <p className="text-sm text-muted-foreground mt-1">
          App configuration policies for managed applications
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search app configs..."
        emptyMessage="No app configuration policies found."
      />
    </div>
  );
};
