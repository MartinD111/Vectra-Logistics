'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Folder, FolderKanban, Plus } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
  type DragMoveEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  useFullTree, useCreateFolder, useUnarchiveFolder, useReorderTree, useMoveTreeNode,
} from '@/lib/hooks/useFolders';
import { useCreateProject, useUnarchiveProject } from '@/lib/hooks/useProjects';
import { useCurrentWorkspace } from '@/lib/hooks/useTenantWorkspace';
import { useExpandedTreeNodes } from '@/lib/hooks/useExpandedTreeNodes';
import type { TreeNode } from '@/lib/api/folders.api';
import { ApiError } from '@/lib/api/client';
import { pruneTree } from './treeFilters';
import { flattenVisibleTree, computeDropZone } from './treeDragUtils';
import TreeNodeRow from './TreeNodeRow';
import { TreeContextMenu } from './TreeContextMenu';
import { ArchiveConfirmDialog } from './ArchiveConfirmDialog';
import { TreeUndoToast } from './TreeUndoToast';

// Finds a folder node by id anywhere in the pruned tree — used to resolve
// the true sibling children array when reordering, since flattenVisibleTree
// rows only carry a parentKey id, not the actual children array.
function findFolderNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findFolderNode(n.children, id);
    if (found) return found;
  }
  return null;
}

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

  const reorderTree = useReorderTree();
  const moveTreeNode = useMoveTreeNode();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [dropZone, setDropZone] = useState<{ nodeId: string; zone: 'before' | 'after' | 'into' } | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const { setNodeRef: setRootDropRef } = useDroppable({ id: 'root-drop' });

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const enabledModules = new Set(workspace?.enabled_modules ?? []);
  const pruned = tree ? pruneTree(tree, enabledModules) : [];

  const handleDragError = (err: unknown) => {
    if (err instanceof ApiError) {
      setDragError(err.status === 403 ? "You don't have permission to do this." : err.message);
    } else {
      setDragError('Something went wrong moving this item.');
    }
    setTimeout(() => setDragError(null), 4000);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!event.over) {
      setDropZone(null);
      return;
    }
    if (event.over.id === 'root-drop') {
      setDropZone(null);
      return;
    }
    const flat = flattenVisibleTree(pruned, expanded);
    const overRow = flat.find((r) => r.id === event.over!.id);
    if (!overRow) {
      setDropZone(null);
      return;
    }
    const overIsFolder = overRow.node_type === 'folder';
    const pointerY = event.active.rect.current.translated
      ? event.active.rect.current.translated.top + event.active.rect.current.translated.height / 2
      : 0;
    const zone = computeDropZone(pointerY, event.over.rect as DOMRect, overIsFolder);
    setDropZone({ nodeId: String(event.over.id), zone });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDropZone(null);
    if (!event.over || event.active.id === event.over.id) return;

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const flat = flattenVisibleTree(pruned, expanded);
    const activeRow = flat.find((r) => r.id === activeId);
    if (!activeRow) return;
    const activeNodeType = activeRow.node_type;

    if (overId === 'root-drop') {
      if (activeNodeType !== 'project') return;
      try {
        await moveTreeNode.mutateAsync({ node_type: 'project', node_id: activeId, new_parent_id: null });
      } catch (err) {
        handleDragError(err);
      }
      return;
    }

    const overRow = flat.find((r) => r.id === overId);
    if (!overRow) return;
    const overIsFolder = overRow.node_type === 'folder';
    const zone = dropZone?.nodeId === overId
      ? dropZone.zone
      : computeDropZone(
        event.active.rect.current.translated
          ? event.active.rect.current.translated.top + event.active.rect.current.translated.height / 2
          : 0,
        event.over.rect as DOMRect,
        overIsFolder,
      );

    if (zone === 'before' || zone === 'after') {
      if (overRow.node_type !== activeNodeType) return;
      const parentKey = overRow.parentKey;
      const siblings = parentKey === 'root' ? pruned : (findFolderNode(pruned, parentKey)?.children ?? []);
      const siblingIds = siblings
        .filter((n) => n.node_type === activeNodeType)
        .map((n) => n.id);
      const withoutActive = siblingIds.filter((id) => id !== activeId);
      const overIndex = withoutActive.indexOf(overId);
      const insertIndex = zone === 'before' ? overIndex : overIndex + 1;
      const orderedIds = [
        ...withoutActive.slice(0, insertIndex),
        activeId,
        ...withoutActive.slice(insertIndex),
      ];
      try {
        await reorderTree.mutateAsync({
          node_type: activeNodeType,
          parent_id: parentKey === 'root' ? null : parentKey,
          ordered_ids: orderedIds,
        });
      } catch (err) {
        handleDragError(err);
      }
    } else if (zone === 'into') {
      if (overRow.node_type !== 'folder') return;
      try {
        await moveTreeNode.mutateAsync({ node_type: activeNodeType, node_id: activeId, new_parent_id: overId });
      } catch (err) {
        handleDragError(err);
      }
    }
  };

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
        <SortableContext items={flattenVisibleTree(pruned, expanded).map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div ref={setRootDropRef} className="space-y-1">
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
                dropZone={dropZone}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {dragError && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 p-4 rounded-xl text-sm border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 shadow-lg">
          {dragError}
        </div>
      )}
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
