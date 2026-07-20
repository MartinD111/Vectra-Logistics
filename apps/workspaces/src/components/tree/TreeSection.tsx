'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Folder, FolderKanban, Plus } from 'lucide-react';
import { useFullTree, useCreateFolder, useUnarchiveFolder } from '@/lib/hooks/useFolders';
import { useCreateProject, useUnarchiveProject } from '@/lib/hooks/useProjects';
import { useCurrentWorkspace } from '@/lib/hooks/useTenantWorkspace';
import { useExpandedTreeNodes } from '@/lib/hooks/useExpandedTreeNodes';
import type { TreeNode } from '@/lib/api/folders.api';
import { pruneTree } from './treeFilters';
import TreeNodeRow from './TreeNodeRow';
import { TreeContextMenu } from './TreeContextMenu';
import { ArchiveConfirmDialog } from './ArchiveConfirmDialog';
import { TreeUndoToast } from './TreeUndoToast';

export default function TreeSection() {
  const { data: tree, isLoading, isError } = useFullTree();
  const { data: workspace } = useCurrentWorkspace();
  const { expanded, toggle } = useExpandedTreeNodes();
  const pathname = usePathname();

  const create = useCreateFolder();
  const createProject = useCreateProject();

  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [rootMenuOpen, setRootMenuOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<TreeNode | null>(null);
  const [undoTarget, setUndoTarget] = useState<TreeNode | null>(null);

  const unarchiveFolder = useUnarchiveFolder();
  const unarchiveProject = useUnarchiveProject();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const enabledModules = new Set(workspace?.enabled_modules ?? []);
  const pruned = tree ? pruneTree(tree, enabledModules) : [];

  const handleCreateFolder = (parentId: string | null) => {
    create.mutate(
      { name: 'New Folder', parent_id: parentId },
      {
        onSuccess: (created) => {
          setNewlyCreatedId(created.id);
          if (parentId && !expanded.has(parentId)) toggle(parentId);
        },
      },
    );
  };

  const handleCreateProject = (parentId: string | null) => {
    createProject.mutate(
      { name: 'New Project', folder_id: parentId },
      {
        onSuccess: (created) => {
          setNewlyCreatedId(created.id);
          if (parentId && !expanded.has(parentId)) toggle(parentId);
        },
      },
    );
  };

  const handleUndo = () => {
    if (!undoTarget) return;
    if (undoTarget.node_type === 'folder') {
      unarchiveFolder.mutate(undoTarget.id);
    } else if (undoTarget.node_type === 'project') {
      unarchiveProject.mutate(undoTarget.id);
    }
    setUndoTarget(null);
  };

  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border">
        <p className="px-3 text-sm text-gray-400 dark:text-gray-500">Couldn&apos;t load workspace folders.</p>
      </div>
    );
  }

  if (pruned.length === 0) {
    return null;
  }

  return (
    <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border">
      <div className="flex items-center justify-between px-3 mb-1">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Workspace
        </p>
        <div className="relative">
          <button
            type="button"
            aria-label="Create at root"
            onClick={() => setRootMenuOpen((o) => !o)}
            className="w-3.5 h-3.5 text-gray-400 hover:text-primary-600"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {rootMenuOpen && (
            <TreeContextMenu
              anchor={{ type: 'button' }}
              actions={[
                { id: 'new-folder', label: 'New Folder', icon: Folder, onSelect: () => handleCreateFolder(null) },
                { id: 'new-project', label: 'New Project', icon: FolderKanban, onSelect: () => handleCreateProject(null) },
              ]}
              onClose={() => setRootMenuOpen(false)}
            />
          )}
        </div>
      </div>
      <div className="space-y-1">
        {pruned.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            isActive={isActive}
            onCreateFolder={handleCreateFolder}
            onCreateProject={handleCreateProject}
            onArchive={setArchiveTarget}
            autoFocusRenameId={newlyCreatedId}
            onRenameHandled={() => setNewlyCreatedId(null)}
          />
        ))}
      </div>
      {archiveTarget && (
        <ArchiveConfirmDialog
          node={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchived={(node, totalDescendants) => {
            if (totalDescendants === 0) setUndoTarget(node);
          }}
        />
      )}
      {undoTarget && (
        <TreeUndoToast
          nodeName={undoTarget.name}
          onUndo={handleUndo}
          onDismiss={() => setUndoTarget(null)}
        />
      )}
    </div>
  );
}
