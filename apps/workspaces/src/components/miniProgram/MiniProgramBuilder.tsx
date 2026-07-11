'use client';

// The mini-program builder: left = meta + ordered block list + palette + settings
// for the selected block; right = live, interactive preview. Everything shares one
// RuntimeProvider, so dropping a sample file into the preview populates the column
// pickers in the settings panels.

import { useState } from 'react';
import { GripVertical, Trash2, Plus, Settings2, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import {
  blockDef, getDataSource, uid, type Block, type BlockGroup, type MiniProgramConfig,
} from '@/lib/miniProgram/blocks';
import { RuntimeProvider } from '@/lib/miniProgram/runtime';
import { usePlugins, getPlugin } from '@/lib/miniProgram/plugins/registry';
import { miniProgramBlockRegistry } from '@/lib/miniProgram/registry';
import { buildPaletteItems } from '@/lib/workspaceEngine';
import type { PluginBlockManifest } from '@/lib/miniProgram/plugins/manifest';
import { BlockView } from './BlockView';
import { BlockSettings } from './BlockSettings';
import PluginTransformRunner from './PluginTransformRunner';
import { BlockIcon } from './icon';

/** Title + icon for any block, resolving plugin instances via the registry. */
function blockMeta(b: Block): { title: string; icon?: string } {
  if (b.kind === 'plugin') {
    const m = getPlugin(b.pluginId);
    return { title: m?.title ?? 'Plugin', icon: m?.icon };
  }
  const def = blockDef(b.kind);
  return { title: def?.title ?? b.kind, icon: def?.icon };
}

/** Build a fresh plugin block instance from a manifest, seeding config defaults. */
function createPluginBlock(m: PluginBlockManifest): Block {
  const config: Record<string, unknown> = {};
  for (const f of m.settingsSchema) if (f.default !== undefined) config[f.key] = f.default;
  return { id: uid(), kind: 'plugin', pluginId: m.id, version: m.version, config };
}

const GROUP_LABEL: Record<BlockGroup, string> = { input: 'Inputs', process: 'Process', output: 'Outputs', layout: 'Layout' };

export default function MiniProgramBuilder({ config, onChange }: { config: MiniProgramConfig; onChange: (c: MiniProgramConfig) => void }) {
  const plugins = usePlugins();
  const paletteItems = buildPaletteItems(miniProgramBlockRegistry);
  const [selectedId, setSelectedId] = useState<string | null>(config.blocks[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pvDragId, setPvDragId] = useState<string | null>(null);
  const [pvDragOverId, setPvDragOverId] = useState<string | null>(null);
  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (blocks: Block[]) => onChange({ ...config, blocks });
  const addBlock = (b: Block) => { setBlocks([...config.blocks, b]); setSelectedId(b.id); };
  const updateBlock = (b: Block) => setBlocks(config.blocks.map((x) => (x.id === b.id ? b : x)));
  const removeBlock = (id: string) => {
    // Drop the block, then clear any dangling `dataSource` refs left pointing at it.
    const remaining = config.blocks.filter((b) => b.id !== id);
    setBlocks(remaining.map((b) => (getDataSource(b)?.blockId === id ? ({ ...b, dataSource: undefined } as Block) : b)));
    if (selectedId === id) setSelectedId(null);
  };
  const move = (id: string, d: -1 | 1) => {
    const i = config.blocks.findIndex((b) => b.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= config.blocks.length) return;
    const n = [...config.blocks]; [n[i], n[j]] = [n[j], n[i]]; setBlocks(n);
  };
  const reorderByDrag = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...config.blocks];
    const fi = arr.findIndex((b) => b.id === fromId);
    const ti = arr.findIndex((b) => b.id === toId);
    if (fi < 0 || ti < 0) return;
    const [item] = arr.splice(fi, 1);
    arr.splice(ti, 0, item);
    setBlocks(arr);
  };

  return (
    <RuntimeProvider config={config}>
      <PluginTransformRunner blocks={config.blocks} />
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
            <div className="space-y-0.5">
              {config.blocks.map((b) => {
                const meta = blockMeta(b);
                const active = b.id === selectedId;
                const isDragging = dragId === b.id;
                const isOver = dragOverId === b.id && !isDragging;
                return (
                  <div key={b.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(b.id); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(b.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => { e.preventDefault(); if (dragId) reorderByDrag(dragId, b.id); setDragId(null); setDragOverId(null); }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onClick={() => setSelectedId(b.id)}
                    className={[
                      'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all select-none',
                      isOver ? 'ring-2 ring-primary-400 ring-inset bg-primary-50/50 dark:bg-primary-900/10' : '',
                      isDragging ? 'opacity-40' : '',
                      active ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-100 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab flex-shrink-0" />
                    <BlockIcon name={meta.icon} className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{meta.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}
                      className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                      {paletteItems.filter((d) => d.group === g).map((d) => (
                        <button key={d.key} onClick={() => addBlock(d.create())} title={d.description}
                          className="flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                          <BlockIcon name={d.icon} className="w-3.5 h-3.5 text-gray-400" /> {d.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {plugins.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Plugins</p>
                    <div className="grid gap-1 mt-1">
                      {plugins.map((p) => (
                        <button key={p.id} onClick={() => addBlock(createPluginBlock(p))} title={p.description}
                          className="flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                          <BlockIcon name={p.icon} className="w-3.5 h-3.5 text-violet-400" /> {p.title}
                          <span className="ml-auto text-[9px] uppercase tracking-wide text-violet-400">plugin</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* Settings for selected block */}
          {selected && (
            <div className="saas-card !p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary-500" /> {blockMeta(selected).title} settings
              </h3>
              <BlockSettings block={selected} allBlocks={config.blocks} onChange={updateBlock} />
            </div>
          )}
        </div>

        {/* Right: live preview */}
        <div className="saas-card !p-6 self-start">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4"><Eye className="w-3.5 h-3.5" /> Live preview — fully interactive</div>
          <div className="space-y-4">
            {config.blocks.map((b, i) => (
              <div key={b.id}
                className={[
                  'relative group/preview transition-opacity',
                  pvDragOverId === b.id && pvDragId !== b.id ? 'outline outline-2 outline-primary-400 outline-offset-2 rounded-xl' : '',
                  pvDragId === b.id ? 'opacity-40' : '',
                ].join(' ')}
                onDragOver={(e) => { e.preventDefault(); setPvDragOverId(b.id); }}
                onDragLeave={() => setPvDragOverId(null)}
                onDrop={(e) => { e.preventDefault(); if (pvDragId) reorderByDrag(pvDragId, b.id); setPvDragId(null); setPvDragOverId(null); }}
                onDragEnd={() => { setPvDragId(null); setPvDragOverId(null); }}
              >
                <BlockView block={b} />
                {/* Hover toolbar — drag, reorder & remove without leaving the preview */}
                <div className="absolute top-1 right-1 z-10 hidden group-hover/preview:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-0.5">
                  <div
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setPvDragId(b.id); }}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-grab"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 mx-0.5" />
                  <button onClick={() => move(b.id, -1)} disabled={i === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(b.id, 1)} disabled={i === config.blocks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 mx-0.5" />
                  <button onClick={() => removeBlock(b.id)}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {config.blocks.length === 0 && <div className="py-16 text-center text-sm text-gray-400">Add blocks to see your program here.</div>}
          </div>
        </div>
      </div>
    </RuntimeProvider>
  );
}
