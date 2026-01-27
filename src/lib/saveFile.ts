/**
 * Small utility to save blobs reliably.
 * - Uses File System Access API when available to show a native “Save As” dialog.
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
