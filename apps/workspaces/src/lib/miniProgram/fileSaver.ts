// Saving files to the user's computer. Two paths:
//   1. Plain browser download (works everywhere) — the classic anchor-click.
//   2. "Save to folder" via the File System Access API (Chromium) — the user picks
//      a directory once, then files write straight into it (and chosen subfolders).
// Everything degrades gracefully: if the FS Access API is missing or the user
// cancels, we fall back to a download so nothing is ever lost.

// Minimal typings for the File System Access API (not in TS DOM lib yet).
interface FsWritable { write: (data: BlobPart) => Promise<void>; close: () => Promise<void>; }
interface FsFileHandle { createWritable: () => Promise<FsWritable>; }
interface FsDirHandle {
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<FsDirHandle>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FsFileHandle>;
}
type WindowFS = Window & {
  showDirectoryPicker?: () => Promise<FsDirHandle>;
  showSaveFilePicker?: (opts?: unknown) => Promise<FsFileHandle>;
};

export function supportsFolderSave(): boolean {
  return typeof window !== 'undefined' && typeof (window as WindowFS).showDirectoryPicker === 'function';
}

/** Classic download — always available. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** A folder the caller picked once and can reuse for many writes. */
export interface FolderTarget {
  handle: FsDirHandle;
  name: string;
}

/** Prompt for a folder. Returns null if unsupported or cancelled. */
export async function pickFolder(): Promise<FolderTarget | null> {
  if (!supportsFolderSave()) return null;
  try {
    const handle = await (window as WindowFS).showDirectoryPicker!();
    return { handle, name: (handle as unknown as { name?: string }).name ?? 'folder' };
  } catch {
    return null; // user cancelled
  }
}

async function resolveSubdir(root: FsDirHandle, subpath?: string): Promise<FsDirHandle> {
  if (!subpath) return root;
  let dir = root;
  for (const part of subpath.split('/').map((p) => p.trim()).filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir;
}

/**
 * Write a blob. If a folder target is given, write into it (optionally under
 * `subpath`, creating subfolders); otherwise fall back to a download.
 */
export async function saveBlob(
  blob: Blob,
  fileName: string,
  folder?: FolderTarget | null,
  subpath?: string,
): Promise<void> {
  if (folder) {
    try {
      const dir = await resolveSubdir(folder.handle, subpath);
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // fall through to download on any FS error
    }
  }
  downloadBlob(blob, fileName);
}
