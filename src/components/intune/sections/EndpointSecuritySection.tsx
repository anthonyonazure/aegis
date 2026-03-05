import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { format } from 'date-fns';

interface SecurityPolicy {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  templateReference?: { templateId: string; templateDisplayName: string };
  settings?: any[];
  '@odata.type'?: string;
}

export const EndpointSecuritySection = () => {
  const { data, isLoading, fetchData } = useIntuneData<SecurityPolicy>({
    resource: 'defender/antivirus-policies',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<SecurityPolicy>[] = [
    {
      key: 'name',
      label: 'Policy name',
      render: (item) => (
        <span className="text-primary font-medium hover:underline cursor-pointer">
          {item.name || item.displayName || 'Unnamed'}
        </span>
      ),
    },
    {
      key: 'templateReference',
      label: 'Template',
      render: (item) => (
        <Badge variant="outline">
          {item.templateReference?.templateDisplayName || 'Custom'}
        </Badge>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      render: (item) => `${item.settings?.length || 0} settings`,
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
        <h2 className="text-xl font-semibold text-foreground">Endpoint security</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Security policies including antivirus, firewall, and EDR
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchKey="name"
        searchPlaceholder="Search security policies..."
        emptyMessage="No endpoint security policies found."
      />
    </div>
  );
};
