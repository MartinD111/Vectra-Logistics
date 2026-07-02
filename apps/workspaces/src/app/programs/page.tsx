'use client';

// Mini Programs launcher: every block-based program across the company, plus
// "start from a template". Programs live inside projects but are all listed here
// for quick access.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Blocks, Plus, Loader2, Play, Pencil, Inbox } from 'lucide-react';
import { usePrograms, useCreateProgram } from '@/lib/hooks/useProjects';
import { isMiniProgramConfig } from '@/lib/miniProgram/blocks';
import { STARTERS } from '@/lib/miniProgram/templates';
import { BlockIcon } from '@/components/miniProgram/icon';

export default function MiniProgramsPage() {
  const router = useRouter();
  const { data: programs, isLoading } = usePrograms();
  const createProgram = useCreateProgram();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('extractor');

  const mini = (programs ?? []).filter((p) => isMiniProgramConfig(p.config));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const starter = STARTERS.find((s) => s.id === templateId) ?? STARTERS[0];
    const config = starter.build();
    config.meta.title = name.trim();
    const created = await createProgram.mutateAsync({ name: name.trim(), config: config as unknown as Record<string, unknown> });
    setName(''); setTemplateId('extractor'); setOpen(false);
    router.push(`/programs/${created.id}`);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Blocks className="w-7 h-7 text-primary-500" /> Mini Programs
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Build your own tools from blocks — like a mini-app maker for your data workflows.
            </p>
          </div>
          <button onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> New program
          </button>
        </div>

        {open && (
          <form onSubmit={submit} className="saas-card mb-8 space-y-4">
            <div>
              <span className="label-xs">Program name</span>
              <input className="saas-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. HS Code Extractor" />
            </div>
            <div>
              <span className="label-xs">Start from</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {STARTERS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setTemplateId(s.id)}
                    className={`text-left rounded-xl border p-3 transition flex items-start gap-3 ${templateId === s.id ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-primary-300'}`}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: s.accent }}>
                      <BlockIcon name={s.icon} className="w-4 h-4" />
                    </span>
                    <span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={createProgram.isPending || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
                {createProgram.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create & open builder
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : mini.length === 0 ? (
          <div className="saas-card flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="w-10 h-10 text-gray-300" />
            <p className="font-semibold text-gray-700 dark:text-gray-200">No mini programs yet</p>
            <p className="text-sm text-gray-500 max-w-sm">Create one from a template and assemble it block by block.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mini.map((p) => {
              const meta = (p.config as { meta?: { icon?: string; accent?: string; subtitle?: string } }).meta ?? {};
              return (
                <div key={p.id} className="saas-card flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: meta.accent ?? '#2563eb' }}>
                      <BlockIcon name={meta.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                      {meta.subtitle && <p className="text-xs text-gray-400 truncate">{meta.subtitle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-auto">
                    <Link href={`/programs/${p.id}/run`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
                      <Play className="w-3.5 h-3.5" /> Open
                    </Link>
                    <Link href={`/programs/${p.id}`} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
