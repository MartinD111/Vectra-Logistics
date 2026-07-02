'use client';

// Standalone Player: the finished mini program colleagues actually use. No builder
// chrome — just the tool. Legacy (v1) programs redirect to their builder.

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Pencil } from 'lucide-react';
import { useProgram } from '@/lib/hooks/useProjects';
import { isMiniProgramConfig, type MiniProgramConfig } from '@/lib/miniProgram/blocks';
import MiniProgramPlayer from '@/components/miniProgram/MiniProgramPlayer';

export default function RunProgramPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const { data: program, isLoading } = useProgram(id);

  if (isLoading) {
    return <div className="flex items-center gap-2 text-gray-400 py-20 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }
  if (!program || !isMiniProgramConfig(program.config)) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-gray-500">
        This program can’t be run here. <Link href={`/programs/${id}`} className="text-primary-600 underline">Open the builder</Link>.
      </div>
    );
  }

  const config = program.config as unknown as MiniProgramConfig;
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 pt-4 flex justify-end">
        <Link href={`/programs/${id}`} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Link>
      </div>
      <MiniProgramPlayer config={config} />
    </div>
  );
}
