'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Folder, FolderTree } from '@/lib/api/folders.api';
import { useCreateFolder, useUpdateFolder } from '@/lib/hooks/useFolders';
import { FolderIcon, IconPicker } from '@/components/icons/IconPicker';

const COLORS = ['#16a34a', '#2563eb', '#9333ea', '#dc2626', '#ea580c', '#0891b2'];

function flattenFolders(tree: FolderTree[], depth = 0): { id: string; name: string; depth: number }[] {
  return tree.flatMap((f) => [
    { id: f.id, name: f.name, depth },
    ...flattenFolders(f.children, depth + 1),
  ]);
}

export function FolderModal({
  folder,
  folderTree,
  defaultParentId = null,
  onClose,
}: {
  folder?: Folder | null;
  folderTree: FolderTree[];
  defaultParentId?: string | null;
  onClose: () => void;
}) {
  const isEdit = !!folder;
  const create = useCreateFolder();
  const update = useUpdateFolder();

  const [name, setName] = useState(folder?.name ?? '');
  const [icon, setIcon] = useState<string | null>(folder?.icon ?? 'Folder');
  const [color, setColor] = useState(folder?.color ?? COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(folder?.parent_id ?? defaultParentId);

  const parentOptions = flattenFolders(folderTree).filter((f) => f.id !== folder?.id);
  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit && folder) {
      await update.mutateAsync({ id: folder.id, data: { name: name.trim(), icon, color } });
    } else {
      await create.mutateAsync({ name: name.trim(), icon, color, parent_id: parentId });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-dark-card shadow-xl border border-gray-100 dark:border-dark-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderIcon name={icon} className="w-4 h-4" style={{ color }} />
            {isEdit ? 'Edit folder' : 'New folder'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <span className="label-xs">Name</span>
            <input
              className="saas-input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client Onboarding"
            />
          </div>

          {!isEdit && (
            <div>
              <span className="label-xs">Parent folder (optional)</span>
              <select
                className="saas-input"
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value || null)}
              >
                <option value="">Top level</option>
                {parentOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {'—'.repeat(f.depth)} {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="label-xs">Icon</span>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div>
            <span className="label-xs">Color</span>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create folder'}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
