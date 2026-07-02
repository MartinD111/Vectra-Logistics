'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Loader2, Activity, Zap, Clock, FileCode2, Inbox,
} from 'lucide-react';
import {
  useProject, useProjectStats, usePrograms, useCreateProgram,
} from '@/lib/hooks/useProjects';
import { STARTERS } from '@/lib/miniProgram/templates';

function timeAgo(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();

  const { data: project, isLoading: pLoading } = useProject(id);
  const { data: stats } = useProjectStats(id);
  const { data: programs, isLoading: progLoading } = usePrograms(id);
  const createProgram = useCreateProgram();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('extractor');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const starter = STARTERS.find((s) => s.id === templateId) ?? STARTERS[0];
    const config = starter.build();
    config.meta.title = name.trim();
    const created = await createProgram.mutateAsync({
      name: name.trim(), project_id: id, config: config as unknown as Record<string, unknown>,
    });
    setName(''); setTemplateId('extractor'); setOpen(false);
    router.push(`/programs/${created.id}`);
  }

  if (pLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading project…
      </div>
    );
  }
  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-gray-500">Project not found.</p>
        <Link href="/projects" className="text-primary-600 text-sm underline mt-2 inline-block">← Back to projects</Link>
      </div>
    );
  }

  const kpis = [
    { label: 'Programs', value: stats?.program_count ?? 0, icon: <FileCode2 className="w-4 h-4 text-white" />, accent: 'bg-primary-500' },
    { label: 'Total events', value: stats?.total_events ?? 0, icon: <Activity className="w-4 h-4 text-white" />, accent: 'bg-violet-500' },
    { label: 'Last 7 days', value: stats?.events_last_7d ?? 0, icon: <Zap className="w-4 h-4 text-white" />, accent: 'bg-amber-500' },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Projects
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl flex-shrink-0" style={{ backgroundColor: project.color ?? '#94a3b8' }} />
            <div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">{project.name}</h1>
              {project.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>}
            </div>
          </div>
          <button onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> New Program
          </button>
        </div>

        {/* Automatic statistics (from the event spine) */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {kpis.map((k) => (
            <div key={k.label} className="saas-card !p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{k.label}</span>
                <span className={`inline-flex items-center justify-center h-9 w-9 rounded-xl ${k.accent}`}>{k.icon}</span>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{k.value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-8 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Last activity: {timeAgo(stats?.last_activity_at ?? null)}
          {stats && stats.by_verb.length > 0 && (
            <span className="ml-3">
              {stats.by_verb.slice(0, 4).map((v) => (
                <span key={v.verb} className="inline-block ml-2 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                  {v.verb} · {v.count}
                </span>
              ))}
            </span>
          )}
        </p>

        {open && (
          <form onSubmit={submit} className="saas-card mb-6 space-y-4">
            <div>
              <span className="label-xs">Program name</span>
              <input className="saas-input" value={name} autoFocus
                onChange={(e) => setName(e.target.value)} placeholder="e.g. Clean & remap customs CSV" />
            </div>
            <div>
              <span className="label-xs">Start from</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {STARTERS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setTemplateId(s.id)}
                    className={`text-left rounded-xl border p-3 transition ${templateId === s.id ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-primary-300'}`}>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={createProgram.isPending || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
                {createProgram.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create program
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
            <p className="text-xs text-gray-400">
              The visual block builder opens after creating — assemble any tool from inputs, transforms and outputs.
            </p>
          </form>
        )}

        {/* Programs in this project */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Programs</h2>
        {progLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-10 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : (programs ?? []).length === 0 ? (
          <div className="saas-card flex flex-col items-center gap-2 py-12 text-gray-400">
            <Inbox className="w-8 h-8" />
            <p className="text-sm">No programs in this project yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(programs ?? []).map((pr) => (
              <Link key={pr.id} href={`/programs/${pr.id}`}
                className="saas-card !py-4 flex items-center justify-between hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{pr.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{pr.type} · {pr.status}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  pr.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>{pr.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
