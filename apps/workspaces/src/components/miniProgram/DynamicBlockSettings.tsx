'use client';

// Generic builder settings form for a plugin block. Interprets the manifest's
// settingsSchema (FieldSpec[]) into inputs bound to block.config. A plugin author
// (human or AI) declares fields — never writes a React settings panel. One
// component handles every plugin.

import type { PluginBlockInstance } from '@/lib/miniProgram/blocks';
import { getPlugin } from '@/lib/miniProgram/plugins/registry';

export function DynamicBlockSettings({
  block, columns, patch,
}: {
  block: PluginBlockInstance;
  columns: string[];
  patch: (config: Record<string, unknown>) => void;
}) {
  const manifest = getPlugin(block.pluginId);
  if (!manifest) {
    return <p className="text-xs text-amber-600">Plugin “{block.pluginId}” is not installed.</p>;
  }

  const set = (key: string, value: unknown) => patch({ ...block.config, [key]: value });

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">{manifest.description}</p>
      {manifest.settingsSchema.map((f) => {
        const val = block.config[f.key] ?? f.default ?? '';
        switch (f.type) {
          case 'boolean':
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={!!block.config[f.key]} onChange={(e) => set(f.key, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600" /> {f.label}
              </label>
            );
          case 'select':
            return (
              <div key={f.key}>
                <span className="label-xs">{f.label}</span>
                <select className="saas-input !py-2 text-sm mt-1" value={String(val)} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
          case 'column':
            return (
              <div key={f.key}>
                <span className="label-xs">{f.label}</span>
                <select className="saas-input !py-2 text-sm mt-1" value={String(val)} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">{columns.length ? 'Choose column…' : 'Drop a sample file in the preview'}</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            );
          case 'number':
            return (
              <div key={f.key}>
                <span className="label-xs">{f.label}</span>
                <input type="number" className="saas-input !py-2 text-sm mt-1" value={String(val)} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            );
          case 'textarea':
          case 'code':
            return (
              <div key={f.key}>
                <span className="label-xs">{f.label}</span>
                <textarea rows={f.type === 'code' ? 6 : 3} className="saas-input text-xs font-mono mt-1" value={String(val)} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)} />
              </div>
            );
          default: // 'text'
            return (
              <div key={f.key}>
                <span className="label-xs">{f.label}</span>
                <input className="saas-input !py-2 text-sm mt-1" value={String(val)} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)} />
              </div>
            );
        }
      })}
    </div>
  );
}
