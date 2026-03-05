import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { format } from 'date-fns';

interface UpdateRing {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@odata.type': string;
}

export const UpdateRingsSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<UpdateRing>({
    resource: 'intune/update-rings',
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Filter to only show update ring type configs
  const updateRings = data.filter(
    (d) => d['@odata.type']?.includes('windowsUpdateForBusiness') || 
           d.displayName?.toLowerCase().includes('update')
  );

  const columns: DataTableColumn<UpdateRing>[] = [
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
        <h2 className="text-xl font-semibold text-foreground">Update rings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Windows Update for Business ring configurations
        </p>
      </div>
      <IntuneDataTable
        data={updateRings}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search update rings..."
        emptyMessage="No update rings found."
      />
    </div>
  );
};
