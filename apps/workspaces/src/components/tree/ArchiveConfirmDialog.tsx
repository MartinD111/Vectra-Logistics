'use client';

import { Loader2, X } from 'lucide-react';
import type { TreeNode } from '@/lib/api/folders.api';
import { useArchiveFolder } from '@/lib/hooks/useFolders';
import { useArchiveProject } from '@/lib/hooks/useProjects';
import { countDescendants } from './treeArchiveCount';

const TYPE_LABELS: Record<string, string> = {
  folder: 'folders',
  project: 'projects',
  program: 'programs',
  data_collection: 'collections',
  project_page: 'pages',
};

export function ArchiveConfirmDialog({
  node,
  onClose,
  onArchived,
}: {
  node: TreeNode;
  onClose: () => void;
  onArchived: (node: TreeNode, totalDescendants: number) => void;
}) {
  const archiveFolder = useArchiveFolder();
  const archiveProject = useArchiveProject();
  const isPending = archiveFolder.isPending || archiveProject.isPending;

  const counts = countDescendants(node);
  const total = counts.folder + counts.project + counts.program + counts.data_collection + counts.project_page;

  const nodeKind = node.node_type === 'folder' ? 'folder' : 'project';

  const bodyCopy =
    total === 0
      ? `This ${nodeKind} has no contents and will be archived.`
      : `This will also archive ${(Object.keys(TYPE_LABELS) as Array<keyof typeof counts>)
          .filter((type) => counts[type] > 0)
          .map((type) => `${counts[type]} ${TYPE_LABELS[type]}`)
          .join(', ')}.`;

  async function handleArchive() {
    if (node.node_type === 'folder') {
      await archiveFolder.mutateAsync(node.id);
    } else {
      await archiveProject.mutateAsync(node.id);
    }
    onClose();
    onArchived(node, total);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-dark-card shadow-xl border border-gray-100 dark:border-dark-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 dark:text-white">Archive {node.name}?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{bodyCopy}</p>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleArchive}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Archive
          </button>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
