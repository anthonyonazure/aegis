/**
 * Small utility to save blobs reliably.
 * - Uses File System Access API when available to show a native "Save As" dialog.
 * - Falls back to an anchor download with a delayed revoke to avoid incomplete .crdownload files.
 */

export type SavePickerType = {
  description: string;
  accept: Record<string, string[]>;
};

type ShowSaveFilePicker = (options: {
  suggestedName?: string;
  types?: SavePickerType[];
}) => Promise<FileSystemFileHandle>;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export async function promptSaveFileHandle(options: {
  suggestedName: string;
  types?: SavePickerType[];
}): Promise<FileSystemFileHandle> {
  const fn = (window as any).showSaveFilePicker as ShowSaveFilePicker | undefined;
  if (!fn) {
    throw new Error("File System Access API not supported");
  }
  return fn({ suggestedName: options.suggestedName, types: options.types });
}

export async function writeBlobToHandle(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function downloadBlobFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Delay revoke to avoid interrupting the download in some Chromium builds.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
}

/**
 * Sanitize a filename by removing special characters and limiting length.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return '';
  return name
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
    .trim();
}

/**
 * Build an export filename with customer/tenant names and timestamp.
 * Format: {prefix}_{CustomerName}_{TenantName}_{YYYY-MM-DD}_{HH-mm-ss}.zip
 */
export function buildExportFilename(
  customerName?: string | null,
  tenantName?: string | null,
  prefix = 'm365-export'
): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  const parts: string[] = [prefix];
  
  if (customerName) {
    const sanitized = sanitizeFilename(customerName);
    if (sanitized) parts.push(sanitized);
  }
  
  if (tenantName) {
    const sanitized = sanitizeFilename(tenantName);
    if (sanitized) parts.push(sanitized);
  }
  
  parts.push(`${date}_${time}`);
  
  return `${parts.join('_')}.zip`;
}
