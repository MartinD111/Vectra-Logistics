'use client';

// The mini-program builder: left = meta + ordered block list + palette + settings
// for the selected block; right = live, interactive preview. Everything shares one
// RuntimeProvider, so dropping a sample file into the preview populates the column
// pickers in the settings panels.

import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Settings2, Eye } from 'lucide-react';
import {
  BLOCK_REGISTRY, blockDef, type Block, type BlockGroup, type MiniProgramConfig,
} from '@/lib/miniProgram/blocks';
import { RuntimeProvider } from '@/lib/miniProgram/runtime';
import { BlockView } from './BlockView';
import { BlockSettings } from './BlockSettings';
import { BlockIcon } from './icon';

const GROUP_LABEL: Record<BlockGroup, string> = { input: 'Inputs', process: 'Process', output: 'Outputs', layout: 'Layout' };

export default function MiniProgramBuilder({ config, onChange }: { config: MiniProgramConfig; onChange: (c: MiniProgramConfig) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(config.blocks[0]?.id ?? null);
  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (blocks: Block[]) => onChange({ ...config, blocks });
  const addBlock = (b: Block) => { setBlocks([...config.blocks, b]); setSelectedId(b.id); };
  const updateBlock = (b: Block) => setBlocks(config.blocks.map((x) => (x.id === b.id ? b : x)));
  const removeBlock = (id: string) => { setBlocks(config.blocks.filter((b) => b.id !== id)); if (selectedId === id) setSelectedId(null); };
  const move = (id: string, d: -1 | 1) => {
    const i = config.blocks.findIndex((b) => b.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= config.blocks.length) return;
    const n = [...config.blocks]; [n[i], n[j]] = [n[j], n[i]]; setBlocks(n);
  };

  return (
    <RuntimeProvider config={config}>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: builder controls */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="saas-card !p-4 space-y-2">
            <input className="saas-input !py-2 text-sm font-semibold" value={config.meta.title}
              onChange={(e) => onChange({ ...config, meta: { ...config.meta, title: e.target.value } })} placeholder="Program title" />
            <input className="saas-input !py-2 text-sm" value={config.meta.subtitle ?? ''}
              onChange={(e) => onChange({ ...config, meta: { ...config.meta, subtitle: e.target.value } })} placeholder="Subtitle (optional)" />
          </div>

          {/* Block list */}
          <div className="saas-card !p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1 mb-2">Blocks</h3>
            <div className="space-y-1">
              {config.blocks.map((b) => {
                const def = blockDef(b.kind);
                const active = b.id === selectedId;
                return (
                  <div key={b.id} onClick={() => setSelectedId(b.id)}
                    className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer ${active ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                    <BlockIcon name={def?.icon} className={`w-4 h-4 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{def?.title ?? b.kind}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
              {config.blocks.length === 0 && <p className="text-xs text-gray-400 px-1 py-2">No blocks yet. Add one below.</p>}
            </div>

            {/* Palette */}
            <details className="mt-2">
              <summary className="text-sm font-semibold text-primary-600 cursor-pointer list-none flex items-center gap-1 px-1"><Plus className="w-4 h-4" /> Add block</summary>
              <div className="mt-2 space-y-2">
                {(['input', 'process', 'output', 'layout'] as BlockGroup[]).map((g) => (
                  <div key={g}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">{GROUP_LABEL[g]}</p>
                    <div className="grid gap-1 mt-1">
                      {BLOCK_REGISTRY.filter((d) => d.group === g).map((d) => (
                        <button key={d.kind} onClick={() => addBlock(d.create())} title={d.description}
                          className="flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                          <BlockIcon name={d.icon} className="w-3.5 h-3.5 text-gray-400" /> {d.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Settings for selected block */}
          {selected && (
            <div className="saas-card !p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary-500" /> {blockDef(selected.kind)?.title} settings
              </h3>
              <BlockSettings block={selected} onChange={updateBlock} />
            </div>
          )}
        </div>

        {/* Right: live preview */}
        <div className="saas-card !p-6 self-start">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4"><Eye className="w-3.5 h-3.5" /> Live preview — fully interactive</div>
          <div className="space-y-4">
            {config.blocks.map((b) => <div key={b.id}><BlockView block={b} /></div>)}
            {config.blocks.length === 0 && <div className="py-16 text-center text-sm text-gray-400">Add blocks to see your program here.</div>}
          </div>
        </div>
      </div>
    </RuntimeProvider>
  );
}
