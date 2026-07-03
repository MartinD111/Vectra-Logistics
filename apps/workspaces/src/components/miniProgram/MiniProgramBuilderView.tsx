'use client';

// Page-level wrapper around MiniProgramBuilder: owns the editable config, save, and
// the link to the standalone Player. Rendered by /programs/[id] when the program's
// config is a v2 (mini program) config.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { useUpdateProgram } from '@/lib/hooks/useProjects';
import type { Program } from '@/lib/api/projects.api';
import { isMiniProgramConfig, emptyMiniProgram, type MiniProgramConfig } from '@/lib/miniProgram/blocks';
import MiniProgramBuilder from './MiniProgramBuilder';
import AiGeneratePanel from './AiGeneratePanel';

export default function MiniProgramBuilderView({ program }: { program: Program }) {
  const update = useUpdateProgram(program.id);
  const [config, setConfig] = useState<MiniProgramConfig>(() =>
    isMiniProgramConfig(program.config) ? (program.config as unknown as MiniProgramConfig) : emptyMiniProgram(program.name),
  );
  const [saved, setSaved] = useState(false);

  async function save() {
    await update.mutateAsync({ config: config as unknown as Record<string, unknown>, status: 'published', name: config.meta.title });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Apply an AI-generated program as an editable draft (not saved until the user hits Save).
  function applyGenerated(generated: MiniProgramConfig, mode: 'replace' | 'append') {
    setConfig((prev) =>
      mode === 'replace'
        ? generated
        : {
            ...prev,
            meta: prev.blocks.length === 0 ? generated.meta : prev.meta,
            blocks: [...prev.blocks, ...generated.blocks],
          },
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            {program.project_id && (
              <Link href={`/projects/${program.project_id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
                <ArrowLeft className="w-4 h-4" /> Project
              </Link>
            )}
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">{config.meta.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Mini program builder</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-primary-600 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
            <AiGeneratePanel onApply={applyGenerated} />
            <Link href={`/programs/${program.id}/run`} target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold hover:bg-gray-50">
              <Play className="w-4 h-4" /> Open
            </Link>
            <button onClick={save} disabled={update.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>

        <MiniProgramBuilder config={config} onChange={setConfig} />
      </div>
    </div>
  );
}
