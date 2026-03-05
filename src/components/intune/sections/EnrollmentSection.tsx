import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneEnrollmentConfig } from '../IntuneTypes';
import { format } from 'date-fns';

export const EnrollmentSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneEnrollmentConfig>({
    resource: 'intune/enrollment-restrictions',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneEnrollmentConfig>[] = [
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
      key: 'priority',
      label: 'Priority',
      render: (item) => item.priority ?? '—',
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
        <h2 className="text-xl font-semibold text-foreground">Enrollment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Device enrollment configurations and restrictions
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search enrollment configs..."
        emptyMessage="No enrollment configurations found."
      />
    </div>
  );
};
