'use client';

// Renders a project's pages as a Notion-style nested tree (top-level pages,
// each with their own sub-pages via parent_page_id). Reused by the project's
// Pages tab and can be dropped into a page detail view to show its children.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Star, Trash2, Plus, Loader2 } from 'lucide-react';
import type { ProjectPage } from '@/lib/api/projects.api';

export function PageTree({
  pages, projectId, parentId = null, depth = 0, onDelete, onAddSubPage, addingUnder,
}: {
  pages: ProjectPage[];
  projectId: string;
  parentId?: string | null;
  depth?: number;
  onDelete: (pageId: string) => void;
  onAddSubPage: (parentId: string) => void;
  addingUnder?: string | null;
}) {
  const children = pages.filter((p) => (p.parent_page_id ?? null) === parentId);
  if (children.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-gray-100 dark:border-slate-800 pl-3 space-y-1 mt-1' : 'space-y-1'}>
      {children.map((p) => (
        <PageRow key={p.id} page={p} pages={pages} projectId={projectId} depth={depth}
          onDelete={onDelete} onAddSubPage={onAddSubPage} addingUnder={addingUnder} />
      ))}
    </div>
  );
}

function PageRow({
  page, pages, projectId, depth, onDelete, onAddSubPage, addingUnder,
}: {
  page: ProjectPage; pages: ProjectPage[]; projectId: string; depth: number;
  onDelete: (pageId: string) => void; onAddSubPage: (parentId: string) => void; addingUnder?: string | null;
}) {
  const hasChildren = pages.some((p) => p.parent_page_id === page.id);
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div className="saas-card !py-2.5 !px-3 flex items-center justify-between gap-2 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button onClick={() => setExpanded((v) => !v)} className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <Link href={`/projects/${projectId}/pages/${page.id}`} className="min-w-0 flex items-center gap-2 flex-1">
            {page.is_default && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
            <span className="font-semibold text-gray-900 dark:text-white truncate text-sm">{page.title}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAddSubPage(page.id)} disabled={addingUnder === page.id}
            title="Add sub-page" className="p-1.5 text-gray-300 hover:text-primary-600">
            {addingUnder === page.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(page.id)} title="Delete page" className="p-1.5 text-gray-300 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <PageTree pages={pages} projectId={projectId} parentId={page.id} depth={depth + 1}
          onDelete={onDelete} onAddSubPage={onAddSubPage} addingUnder={addingUnder} />
      )}
    </div>
  );
}
