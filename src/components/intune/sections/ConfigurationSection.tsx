import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneDeviceConfig } from '../IntuneTypes';
import { format } from 'date-fns';

export const ConfigurationSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneDeviceConfig>({
    resource: 'intune/device-configurations',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneDeviceConfig>[] = [
    {
      key: 'displayName',
      label: 'Profile name',
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
      key: 'description',
      label: 'Description',
      render: (item) => (
        <span className="text-muted-foreground truncate max-w-xs block">
          {item.description || '—'}
        </span>
      ),
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
        <h2 className="text-xl font-semibold text-foreground">Configuration profiles</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Device configuration profiles managed through Intune
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search configuration profiles..."
        emptyMessage="No configuration profiles found."
      />
    </div>
  );
};
