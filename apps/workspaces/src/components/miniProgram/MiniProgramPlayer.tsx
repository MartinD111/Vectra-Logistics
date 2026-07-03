'use client';

// The finished, runnable mini program — no builder chrome. Used both as the
// standalone /run experience and as the builder's live preview.

import { RotateCcw } from 'lucide-react';
import type { MiniProgramConfig } from '@/lib/miniProgram/blocks';
import { RuntimeProvider, useRuntime } from '@/lib/miniProgram/runtime';
import { BlockView } from './BlockView';
import PluginTransformRunner from './PluginTransformRunner';
import { BlockIcon } from './icon';

export default function MiniProgramPlayer({ config, compact = false }: { config: MiniProgramConfig; compact?: boolean }) {
  return (
    <RuntimeProvider config={config}>
      <PluginTransformRunner blocks={config.blocks} />
      <div className={compact ? '' : 'max-w-4xl mx-auto px-4 py-8'}>
        <PlayerHeader config={config} />
        <div className="space-y-4">
          {config.blocks.map((b) => (
            <div key={b.id}><BlockView block={b} /></div>
          ))}
          {config.blocks.length === 0 && (
            <div className="saas-card py-16 text-center text-sm text-gray-400">This program has no blocks yet.</div>
          )}
        </div>
      </div>
    </RuntimeProvider>
  );
}

function PlayerHeader({ config }: { config: MiniProgramConfig }) {
  const rt = useRuntime();
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: config.meta.accent ?? '#2563eb' }}>
          <BlockIcon name={config.meta.icon} className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">{config.meta.title}</h1>
          {config.meta.subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{config.meta.subtitle}</p>}
        </div>
      </div>
      <button onClick={rt.resetAll} title="Reset"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <RotateCcw className="w-3.5 h-3.5" /> Reset
      </button>
    </div>
  );
}
