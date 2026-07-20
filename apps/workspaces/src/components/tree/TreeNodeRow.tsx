'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Folder, FolderKanban, Zap, Boxes, FileText, MoreVertical, Pencil, Archive,
} from 'lucide-react';
import type { TreeNode } from '@/lib/api/folders.api';
import { useUpdateFolder } from '@/lib/hooks/useFolders';
import { useUpdateProject } from '@/lib/hooks/useProjects';
import { treeNodeUrl } from './treeNodeUrl';
import { TreeContextMenu, type TreeContextMenuAction } from './TreeContextMenu';

const ICON_BY_TYPE: Record<TreeNode['node_type'], typeof Folder> = {
  folder: Folder,
  project: FolderKanban,
  program: Zap,
  data_collection: Boxes,
  project_page: FileText,
};

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  isActive: (href: string) => boolean;
  onCreateFolder: (parentId: string) => void;
  onCreateProject: (parentId: string) => void;
  onArchive: (node: TreeNode) => void;
  autoFocusRenameId: string | null;
  onRenameHandled: () => void;
}

export default function TreeNodeRow({
  node, depth, expanded, onToggle, isActive,
  onCreateFolder, onCreateProject, onArchive, autoFocusRenameId, onRenameHandled,
}: TreeNodeRowProps) {
  const href = treeNodeUrl(node);
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const Icon = ICON_BY_TYPE[node.node_type];

  const [menuOpen, setMenuOpen] = useState(false);
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.name);

  const updateFolder = useUpdateFolder();
  const updateProject = useUpdateProject(node.id);

  useEffect(() => {
    if (autoFocusRenameId === node.id) {
      setDraft(node.name);
      setRenaming(true);
      onRenameHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusRenameId, node.id]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === node.name) {
      setDraft(node.name);
      setRenaming(false);
      return;
    }
    if (node.node_type === 'folder') {
      updateFolder.mutate({ id: node.id, data: { name: trimmed } });
    } else if (node.node_type === 'project') {
      updateProject.mutate({ name: trimmed });
    }
    setRenaming(false);
  };

  const isMenuable = node.node_type === 'folder' || node.node_type === 'project';

  const actions: TreeContextMenuAction[] = isMenuable
    ? node.node_type === 'folder'
      ? [
        { id: 'new-folder', label: 'New Folder', icon: Folder, onSelect: () => onCreateFolder(node.id) },
        { id: 'new-project', label: 'New Project', icon: FolderKanban, onSelect: () => onCreateProject(node.id) },
        { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
        { id: 'archive', label: 'Archive', icon: Archive, destructive: true, onSelect: () => onArchive(node) },
      ]
      : [
        { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
        { id: 'archive', label: 'Archive', icon: Archive, destructive: true, onSelect: () => onArchive(node) },
      ]
    : [];

  const active = !!href && isActive(href);
  const rowCls = `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
  }`;

  const content = renaming ? (
    <input
      autoFocus
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        if (e.key === 'Escape') { setDraft(node.name); setRenaming(false); }
      }}
      className="text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm flex-1 min-w-0"
    />
  ) : (
    <>
      <Icon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
      {node.name}
    </>
  );

  return (
    <div>
      <div
        className={rowCls}
        style={{ paddingLeft: 12 + depth * 16 }}
        onContextMenu={
          isMenuable
            ? (e) => {
              e.preventDefault();
              setContextPoint({ x: e.clientX, y: e.clientY });
            }
            : undefined
        }
      >
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggle(node.id);
            }}
            className={`transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {renaming ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">{content}</div>
        ) : href ? (
          <Link href={href} className="flex items-center gap-3 flex-1 min-w-0">
            {content}
          </Link>
        ) : (
          <span
            onClick={() => onToggle(node.id)}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          >
            {content}
          </span>
        )}
        {isMenuable && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              aria-label="Row actions"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen((o) => !o);
              }}
              className="opacity-0 group-hover:opacity-100 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <TreeContextMenu
                anchor={{ type: 'button' }}
                actions={actions}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
        {contextPoint && (
          <TreeContextMenu
            anchor={{ type: 'point', x: contextPoint.x, y: contextPoint.y }}
            actions={actions}
            onClose={() => setContextPoint(null)}
          />
        )}
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              isActive={isActive}
              onCreateFolder={onCreateFolder}
              onCreateProject={onCreateProject}
              onArchive={onArchive}
              autoFocusRenameId={autoFocusRenameId}
              onRenameHandled={onRenameHandled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
