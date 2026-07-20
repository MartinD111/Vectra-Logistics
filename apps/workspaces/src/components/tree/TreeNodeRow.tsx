'use client';

import Link from 'next/link';
import { ChevronRight, Folder, FolderKanban, Zap, Boxes, FileText } from 'lucide-react';
import type { TreeNode } from '@/lib/api/folders.api';
import { treeNodeUrl } from './treeNodeUrl';

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
}

export default function TreeNodeRow({ node, depth, expanded, onToggle, isActive }: TreeNodeRowProps) {
  const href = treeNodeUrl(node);
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const Icon = ICON_BY_TYPE[node.node_type];

  const active = !!href && isActive(href);
  const rowCls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
  }`;

  const content = (
    <>
      <Icon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
      {node.name}
    </>
  );

  return (
    <div>
      <div className={rowCls} style={{ paddingLeft: 12 + depth * 16 }}>
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
        {href ? (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
