import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneAutopilotProfile } from '../IntuneTypes';
import { format } from 'date-fns';

export const AutopilotSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneAutopilotProfile>({
    resource: 'intune/autopilot',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneAutopilotProfile>[] = [
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
      key: 'description',
      label: 'Description',
      render: (item) => (
        <span className="text-muted-foreground truncate max-w-xs block">
          {item.description || '—'}
        </span>
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
        <h2 className="text-xl font-semibold text-foreground">Windows Autopilot</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Autopilot deployment profiles for device provisioning
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search Autopilot profiles..."
        emptyMessage="No Autopilot profiles found."
      />
    </div>
  );
};
