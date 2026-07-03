'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, Loader2, ArrowRight, Layers, FolderPlus } from 'lucide-react';
import { useProjects, useCreateProject, useUpdateProject } from '@/lib/hooks/useProjects';
import { useFolderTree } from '@/lib/hooks/useFolders';
import { FolderModal } from '@/components/folders/FolderModal';
import { FolderIcon } from '@/components/icons/IconPicker';
import type { FolderTree } from '@/lib/api/folders.api';

const COLORS = ['#16a34a', '#2563eb', '#9333ea', '#dc2626', '#ea580c', '#0891b2'];

function flattenFolders(tree: FolderTree[], depth = 0): { id: string; name: string; icon: string | null; depth: number }[] {
  return tree.flatMap((f) => [
    { id: f.id, name: f.name, icon: f.icon, depth },
    ...flattenFolders(f.children, depth + 1),
  ]);
}

function ProjectFolderMenu({ projectId, currentFolderId, folders }: { projectId: string; currentFolderId: string | null; folders: { id: string; name: string; depth: number }[] }) {
  const update = useUpdateProject(projectId);
  return (
    <select
      value={currentFolderId ?? ''}
      onChange={(e) => update.mutate({ folder_id: e.target.value || null })}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-dark-bg px-2 py-1 text-gray-600 dark:text-gray-300"
    >
      <option value="">Unfiled</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>{'—'.repeat(f.depth)} {f.name}</option>
      ))}
    </select>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: folderTree } = useFolderTree();
  const create = useCreateProject();
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const flatFolders = flattenFolders(folderTree ?? []);

  const initialOpen =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('new') === '1';
  const [open, setOpen] = useState(initialOpen);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, color });
    setName(''); setDescription(''); setColor(COLORS[0]); setOpen(false);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <FolderKanban className="w-7 h-7 text-primary-500" /> Projects
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Organize your programs and get automatic statistics per project.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {flatFolders.length > 0 && (
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="saas-input !w-auto"
              >
                <option value="all">All folders</option>
                <option value="unfiled">Unfiled</option>
                {flatFolders.map((f) => (
                  <option key={f.id} value={f.id}>{'—'.repeat(f.depth)} {f.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setFolderModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {folderModalOpen && (
          <FolderModal folderTree={folderTree ?? []} onClose={() => setFolderModalOpen(false)} />
        )}

        {open && (
          <form onSubmit={submit} className="saas-card mb-8 space-y-4">
            <div>
              <span className="label-xs">Project name</span>
              <input className="saas-input" value={name} autoFocus
                onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly customs imports" />
            </div>
            <div>
              <span className="label-xs">Description (optional)</span>
              <input className="saas-input" value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder="What this project is for" />
            </div>
            <div>
              <span className="label-xs">Color</span>
              <div className="flex gap-2 mt-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition ${color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={create.isPending || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
                {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create project
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading projects…
          </div>
        ) : (projects ?? []).length === 0 ? (
          <div className="saas-card flex flex-col items-center gap-3 py-16 text-center">
            <Layers className="w-10 h-10 text-gray-300" />
            <p className="font-semibold text-gray-700 dark:text-gray-200">No projects yet</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Create a project to group related programs and track their activity automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(projects ?? [])
              .filter((p) => {
                if (folderFilter === 'all') return true;
                if (folderFilter === 'unfiled') return !p.folder_id;
                return p.folder_id === folderFilter;
              })
              .map((p) => (
              <div key={p.id} className="group saas-card hover:-translate-y-0.5 hover:shadow-xl transition-all flex flex-col gap-3">
                <Link href={`/projects/${p.id}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color ?? '#94a3b8' }} />
                    <h2 className="font-bold text-gray-900 dark:text-white truncate">{p.name}</h2>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {p.program_count ?? 0} program{(p.program_count ?? 0) === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
                {flatFolders.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-slate-800">
                    <FolderIcon name={p.folder_id ? flatFolders.find((f) => f.id === p.folder_id)?.icon : null} className="w-3.5 h-3.5 shrink-0" />
                    <ProjectFolderMenu projectId={p.id} currentFolderId={p.folder_id} folders={flatFolders} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
