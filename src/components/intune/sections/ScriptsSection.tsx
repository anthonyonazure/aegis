import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneScript } from '../IntuneTypes';
import { format } from 'date-fns';

export const ScriptsSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneScript>({
    resource: 'intune/scripts',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneScript>[] = [
    {
      key: 'displayName',
      label: 'Script name',
      render: (item) => (
        <span className="text-primary font-medium hover:underline cursor-pointer">
          {item.displayName}
        </span>
      ),
    },
    {
      key: 'fileName',
      label: 'File name',
      render: (item) => item.fileName || '—',
    },
    {
      key: 'runAsAccount',
      label: 'Run as',
      render: (item) => (
        <Badge variant="outline" className="capitalize">
          {item.runAsAccount || 'system'}
        </Badge>
      ),
    },
    {
      key: 'createdDateTime',
      label: 'Created',
      render: (item) => item.createdDateTime 
        ? format(new Date(item.createdDateTime), 'MMM d, yyyy') 
        : '—',
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Scripts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          PowerShell and shell scripts deployed to devices
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search scripts..."
        emptyMessage="No scripts found."
      />
    </div>
  );
};
