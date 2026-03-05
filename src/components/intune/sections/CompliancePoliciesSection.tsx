import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useIntuneData } from '@/hooks/useIntuneData';
import { IntuneDataTable, DataTableColumn } from '../IntuneDataTable';
import { IntuneCompliancePolicy } from '../IntuneTypes';
import { format } from 'date-fns';

const platformBadge = (odataType: string) => {
  const type = odataType?.split('.').pop() || '';
  if (type.includes('Windows') || type.includes('windows')) 
    return <Badge variant="outline">Windows</Badge>;
  if (type.includes('iOS') || type.includes('ios')) 
    return <Badge variant="outline">iOS/iPadOS</Badge>;
  if (type.includes('Android') || type.includes('android')) 
    return <Badge variant="outline">Android</Badge>;
  if (type.includes('MacOS') || type.includes('macOS') || type.includes('mac')) 
    return <Badge variant="outline">macOS</Badge>;
  return <Badge variant="outline">All platforms</Badge>;
};

export const CompliancePoliciesSection = () => {
  const { data, isLoading, fetchData } = useIntuneData<IntuneCompliancePolicy>({
    resource: 'intune/compliance-policies',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const columns: DataTableColumn<IntuneCompliancePolicy>[] = [
    {
      key: 'displayName',
      label: 'Policy name',
      render: (item) => (
        <span className="text-primary font-medium hover:underline cursor-pointer">
          {item.displayName}
        </span>
      ),
    },
    {
      key: '@odata.type',
      label: 'Platform',
      render: (item) => platformBadge(item['@odata.type']),
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
        <h2 className="text-xl font-semibold text-foreground">Compliance policies</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Device compliance policies assigned through Intune
        </p>
      </div>
      <IntuneDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchData}
        searchPlaceholder="Search compliance policies..."
        emptyMessage="No compliance policies found."
      />
    </div>
  );
};
