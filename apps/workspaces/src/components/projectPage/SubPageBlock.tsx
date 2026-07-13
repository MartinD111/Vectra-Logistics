'use client';

// Sub-page link block (CONT-08): inserting it via the slash menu always
// creates a brand-new, empty child page (reusing projectsApi.createPage +
// parent_page_id nesting, per locked decision D-12 — no "link an existing
// page" picker) and renders a static title+icon row that navigates to the
// created page on click (no live content preview, per D-13).
//
// create() (in lib/projectPage/blocks.ts) stays synchronous and returns a
// placeholder (pageId: null) — the actual page-creation side effect happens
// here, in the editor component, on mount.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects.api';
import type { SubPageBlock } from '@/lib/projectPage/blocks';

function SubPageRow({ projectId, pageId, title }: { projectId: string; pageId: string; title: string }) {
  return (
    <Link
      href={`/projects/${projectId}/pages/${pageId}`}
      target="_blank"
      className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 group"
    >
      <FileText className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
      <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{title}</span>
      <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export function SubPageBlockView({ block, ctx }: { block: SubPageBlock; ctx: { projectId?: string } }) {
  if (!block.pageId || !ctx.projectId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-2">
        <FileText className="w-4 h-4 flex-shrink-0 text-gray-300" />
        <span className="text-sm text-gray-400 italic">Sub-pages aren&apos;t available here</span>
      </div>
    );
  }
  return <SubPageRow projectId={ctx.projectId} pageId={block.pageId} title={block.title} />;
}

export function SubPageBlockEditor({
  block, ctx, onUpdate,
}: {
  block: SubPageBlock;
  ctx: { projectId?: string; pageId?: string };
  onUpdate: (b: SubPageBlock) => void;
}) {
  const creatingRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (block.pageId !== null) return;
    if (!ctx.projectId) return; // no-project canvas — static disabled row is shown instead
    if (creatingRef.current) return;
    creatingRef.current = true;

    projectsApi.createPage(ctx.projectId, { title: 'Untitled', parent_page_id: ctx.pageId ?? null })
      .then((created) => {
        onUpdate({ ...block, pageId: created.id, title: created.title });
      })
      .catch((err) => {
        console.error('Failed to create sub-page:', err);
        setFailed(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.pageId, ctx.projectId]);

  if (!ctx.projectId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-2">
        <FileText className="w-4 h-4 flex-shrink-0 text-gray-300" />
        <span className="text-sm text-gray-400 italic">Sub-pages aren&apos;t available here</span>
      </div>
    );
  }

  if (block.pageId === null) {
    if (failed) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 px-2.5 py-2">
          <FileText className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span className="text-sm text-red-500">Couldn&apos;t create the sub-page. Try removing and re-adding this block.</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-2">
        <Loader2 className="w-4 h-4 flex-shrink-0 text-gray-400 animate-spin" />
        <span className="text-sm text-gray-400">Creating page…</span>
      </div>
    );
  }

  return <SubPageRow projectId={ctx.projectId} pageId={block.pageId} title={block.title} />;
}
