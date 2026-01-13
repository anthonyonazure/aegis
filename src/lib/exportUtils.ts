import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { convertToFormat } from './graphApi';

interface ExportedResource {
  id: string;
  category: string;
  resource_type: string;
  resource_name: string | null;
  data: unknown;
  terraform_config: string | null;
  bicep_config: string | null;
  powershell_script: string | null;
}

interface ExportJob {
  id: string;
  name: string;
  formats: string[];
  categories: string[];
  created_at: string;
}

export async function downloadExportAsZip(jobId: string): Promise<void> {
  // Fetch job details
  const { data: job, error: jobError } = await supabase
    .from('export_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error('Failed to fetch export job');
  }

  // Fetch exported resources
  const { data: resources, error: resourcesError } = await supabase
    .from('exported_resources')
    .select('*')
    .eq('export_job_id', jobId);

  if (resourcesError || !resources) {
    throw new Error('Failed to fetch exported resources');
  }

  if (resources.length === 0) {
    throw new Error('No resources found for this export');
  }

  const zip = new JSZip();
  const formats = job.formats || ['json'];
  const exportDate = new Date(job.created_at).toISOString().split('T')[0];

  // Add a readme file
  const readme = `# M365 Tenant Export
Export Name: ${job.name}
Export Date: ${job.created_at}
Categories: ${job.categories?.join(', ') || 'All'}
Formats: ${formats.join(', ')}
Total Resources: ${resources.length}

## Directory Structure
- json/ - Raw JSON exports from Graph API
- terraform/ - Terraform HCL configurations
- bicep/ - Azure Bicep templates
- powershell/ - PowerShell scripts for deployment
`;
  zip.file('README.md', readme);

  // Group resources by category
  const resourcesByCategory: Record<string, ExportedResource[]> = {};
  for (const resource of resources as ExportedResource[]) {
    if (!resourcesByCategory[resource.category]) {
      resourcesByCategory[resource.category] = [];
    }
    resourcesByCategory[resource.category].push(resource);
  }

  // Process each format
  for (const format of formats) {
    const formatFolder = zip.folder(format);
    if (!formatFolder) continue;

    for (const [category, categoryResources] of Object.entries(resourcesByCategory)) {
      const categoryFolder = formatFolder.folder(category);
      if (!categoryFolder) continue;

      for (const resource of categoryResources) {
        const resourceType = resource.resource_type;
        const resourceName = resource.resource_name || resourceType;
        const safeFileName = resourceName.replace(/[^a-z0-9-_]/gi, '_');

        if (format === 'json') {
          // Always include JSON
          const jsonContent = JSON.stringify(resource.data, null, 2);
          categoryFolder.file(`${safeFileName}.json`, jsonContent);
        } else if (format === 'terraform') {
          // Check if we have cached terraform, otherwise generate
          let terraformContent = resource.terraform_config;
          if (!terraformContent) {
            try {
              const result = await convertToFormat(resource.data, `${category}/${resourceType}`, 'terraform');
              if (result.success && result.output) {
                terraformContent = result.output;
              }
            } catch (e) {
              console.error('Failed to generate terraform:', e);
            }
          }
          if (terraformContent) {
            categoryFolder.file(`${safeFileName}.tf`, terraformContent);
          }
        } else if (format === 'bicep') {
          let bicepContent = resource.bicep_config;
          if (!bicepContent) {
            try {
              const result = await convertToFormat(resource.data, `${category}/${resourceType}`, 'bicep');
              if (result.success && result.output) {
                bicepContent = result.output;
              }
            } catch (e) {
              console.error('Failed to generate bicep:', e);
            }
          }
          if (bicepContent) {
            categoryFolder.file(`${safeFileName}.bicep`, bicepContent);
          }
        } else if (format === 'powershell') {
          let psContent = resource.powershell_script;
          if (!psContent) {
            try {
              const result = await convertToFormat(resource.data, `${category}/${resourceType}`, 'powershell');
              if (result.success && result.output) {
                psContent = result.output;
              }
            } catch (e) {
              console.error('Failed to generate powershell:', e);
            }
          }
          if (psContent) {
            categoryFolder.file(`${safeFileName}.ps1`, psContent);
          }
        }
      }
    }
  }

  // Generate the ZIP file
  const content = await zip.generateAsync({ type: 'blob' });
  const fileName = `m365-export-${exportDate}.zip`;
  saveAs(content, fileName);
}

export async function getExportResourceCount(jobId: string): Promise<number> {
  const { count, error } = await supabase
    .from('exported_resources')
    .select('*', { count: 'exact', head: true })
    .eq('export_job_id', jobId);

  if (error) {
    console.error('Error counting resources:', error);
    return 0;
  }

  return count || 0;
}
