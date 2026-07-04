'use client';

// A project page: always-live Notion-style canvas (no edit/view toggle) with a
// cover/icon/title header. Block edits autosave (debounced, flushed on
// unmount); header metadata saves immediately via partial PATCH.

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, Plus } from 'lucide-react';
import {
  useProjectPage, useUpdateProjectPage, useProjectPages, useCreateProjectPage, useDeleteProjectPage,
} from '@/lib/hooks/useProjectPages';
import { isPageConfig, emptyPageConfig, parseHeaderSettings, type PageConfig } from '@/lib/projectPage/blocks';
import LivePageCanvas from '@/components/projectPage/LivePageCanvas';
import { PageHeader } from '@/components/projectPage/PageHeader';
import { PageTree } from '@/components/projectPage/PageTree';

export default function ProjectPagePage() {
  const params = useParams<{ id: string; pageId: string }>();
  const projectId = params?.id as string;
  const pageId = params?.pageId as string;
  const router = useRouter();

  const { data: page, isLoading } = useProjectPage(pageId);
  const update = useUpdateProjectPage(pageId, projectId);
  const { data: allPages } = useProjectPages(projectId);
  const createSubPage = useCreateProjectPage(projectId);
  const deletePage = useDeleteProjectPage(projectId);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);

  const parent = page?.parent_page_id ? (allPages ?? []).find((p) => p.id === page.parent_page_id) : null;

  async function addSubPageUnder(parentPageId: string) {
    setAddingUnder(parentPageId);
    try {
      const created = await createSubPage.mutateAsync({ title: 'Untitled', parent_page_id: parentPageId });
      router.push(`/projects/${projectId}/pages/${created.id}`);
    } finally {
      setAddingUnder(null);
    }
  }

  const [config, setConfig] = useState<PageConfig>(emptyPageConfig());
  const [seeded, setSeeded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs mirror state so the unmount flush sees the latest values.
  const dirtyRef = useRef(false);
  const configRef = useRef(config);
  const updateRef = useRef(update);
  const seededConfigRef = useRef<PageConfig | null>(null);
  configRef.current = config;
  updateRef.current = update;

  if (!seeded && page) {
    const initial = isPageConfig(page.config) ? page.config : emptyPageConfig();
    seededConfigRef.current = initial;
    setConfig(initial);
    setSeeded(true);
  }

  useEffect(() => {
    // Skip the effect run caused by seeding itself — only user edits save.
    if (!seeded || config === seededConfigRef.current) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirtyRef.current = false;
      update.mutate({ config: config as unknown as Record<string, unknown> }, {
        onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); },
      });
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, seeded]);

  // Flush a pending save when leaving the page — with always-live editing
  // there is no "exit edit mode" moment to rely on.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        updateRef.current.mutate({ config: configRef.current as unknown as Record<string, unknown> });
      }
    };
  }, []);

  if (isLoading) {
    return <div className="flex items-center gap-2 text-gray-400 py-20 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading page…</div>;
  }
  if (!page) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-gray-500">Page not found.</p>
        <Link href={`/projects/${projectId}`} className="text-primary-600 text-sm underline mt-2 inline-block">← Back to project</Link>
      </div>
    );
  }

  const fullWidth = parseHeaderSettings(page.header_settings).full_width;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className={`${fullWidth ? 'max-w-none' : 'max-w-6xl'} mx-auto px-4 lg:px-8 py-8`}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
              <ArrowLeft className="w-4 h-4" /> Project
            </Link>
            {parent && (
              <>
                <span className="text-gray-300">/</span>
                <Link href={`/projects/${projectId}/pages/${parent.id}`} className="hover:text-gray-700 dark:hover:text-gray-200">
                  {parent.title}
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-primary-600 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
            {update.isPending && !saved && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <button onClick={() => addSubPageUnder(pageId)} disabled={addingUnder === pageId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-60">
              {addingUnder === pageId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Sub-page
            </button>
          </div>
        </div>

        <PageHeader page={page} onUpdate={(data) => update.mutate(data)} />

        {/* pl-10 leaves room for the per-block hover gutter (drag handle + insert). */}
        <div className="pl-10">
          <LivePageCanvas config={config} projectId={projectId} onChange={setConfig} />
        </div>

        {(allPages ?? []).some((p) => p.parent_page_id === pageId) && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Sub-pages</h2>
            <PageTree pages={allPages ?? []} projectId={projectId} parentId={pageId}
              onDelete={(id) => deletePage.mutate(id)} onAddSubPage={addSubPageUnder} addingUnder={addingUnder} />
          </div>
        )}
      </div>
    </div>
  );
}
