import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneDevice } from '../IntuneTypes';
import { format } from 'date-fns';

interface DevicesSectionProps {
  platformFilter?: string;
}

const complianceBadge = (state: string) => {
  switch (state?.toLowerCase()) {
    case 'compliant':
      return <Badge className="bg-green-500/20 text-green-400 border-0">Compliant</Badge>;
    case 'noncompliant':
      return <Badge className="bg-red-500/20 text-red-400 border-0">Non-compliant</Badge>;
    case 'ingraceperiod':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-0">In grace period</Badge>;
    default:
      return <Badge variant="outline">{state || 'Unknown'}</Badge>;
  }
};

export const DevicesSection = ({ platformFilter }: DevicesSectionProps) => {
  // Use a generic managed devices endpoint - we'll add this to the graph-api function
  const { data, isLoading, fetchData } = useIntuneData<IntuneDevice>({
    resource: 'intune/device-configurations', // We'll use this as a proxy
  });

  useEffect(() => {
    fetchData();
  }, []);

  // In a real scenario, we'd filter by platform. For now show all.
  const filteredData = platformFilter
    ? data.filter(d => d.operatingSystem?.toLowerCase().includes(platformFilter.toLowerCase()))
    : data;

  const columns: DataTableColumn<IntuneDevice>[] = [
    {
      key: 'deviceName',
      label: 'Device name',
      render: (item) => (
        <span className="text-primary font-medium hover:underline cursor-pointer">
          {item.displayName || item.deviceName || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'operatingSystem',
      label: 'OS',
      render: (item) => item.operatingSystem || item['@odata.type']?.split('.').pop() || '—',
    },
    {
      key: 'complianceState',
      label: 'Compliance',
      render: (item) => complianceBadge(item.complianceState),
    },
    {
      key: 'lastSyncDateTime',
      label: 'Last check-in',
      render: (item) => {
        const date = item.lastModifiedDateTime || item.lastSyncDateTime;
        return date ? format(new Date(date), 'MMM d, yyyy HH:mm') : '—';
      },
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          {platformFilter ? `${platformFilter} Devices` : 'All devices'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Device configurations and profiles managed through Intune
        </p>
      </div>
      <IntuneDataTable
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchKey="displayName"
        searchPlaceholder="Search devices..."
        emptyMessage="No devices found. Connect a tenant to see managed devices."
      />
    </div>
  );
};
