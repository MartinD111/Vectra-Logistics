'use client';

// Generic player renderer for a plugin block. Interprets the manifest's uiSchema
// (a tree of FIXED Vectra primitives — the only rendering vocabulary a plugin
// has) into real, styled React. Plugins never emit HTML/DOM or React, so Vectra
// fully owns rendering, styling and the XSS surface. Button/action logic runs in
// the hardened sandbox. One generic component handles every plugin — no per-
// plugin code in the builder/player.

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { PluginBlockInstance, Row } from '@/lib/miniProgram/blocks';
import { useRuntime } from '@/lib/miniProgram/runtime';
import { getPlugin } from '@/lib/miniProgram/plugins/registry';
import { runInSandbox } from '@/lib/miniProgram/plugins/sandbox';
import type { UiNode } from '@/lib/miniProgram/plugins/manifest';

interface Ctx {
  config: Record<string, unknown>;
  vars: Record<string, unknown>;
  count: number;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Resolve {{config.x}} / {{vars.x}} / {{count}} in plugin UI text. */
function resolve(tpl: string, ctx: Ctx): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    if (path === 'count') return String(ctx.count);
    if (path.startsWith('config.')) return str(ctx.config[path.slice(7)]);
    if (path.startsWith('vars.')) return str(ctx.vars[path.slice(5)]);
    return '';
  });
}

const BADGE_TONE: Record<string, string> = {
  neutral: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

export function DynamicBlockView({ block }: { block: PluginBlockInstance }) {
  const rt = useRuntime();
  const manifest = getPlugin(block.pluginId);
  const dataset: Row[] = rt.result.outputOf[block.id] ?? rt.result.inputTo[block.id] ?? [];
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx: Ctx = useMemo(
    () => ({ config: block.config, vars: rt.state.vars, count: dataset.length }),
    [block.config, rt.state.vars, dataset.length],
  );

  if (!manifest) {
    return (
      <div className="saas-card !p-4 border border-amber-200 dark:border-amber-800/40 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Plugin “{block.pluginId}” is not installed.
      </div>
    );
  }

  async function runAction(actionId: string) {
    if (!manifest) return;
    setBusyAction(actionId); setError(null);
    try {
      const out = await runInSandbox(manifest.logic.source, { rows: dataset, config: block.config, vars: rt.state.vars, actionId });
      if (out.rows) rt.setPluginOutput(block.id, out.rows);
      if (out.vars && Object.keys(out.vars).length > 0) rt.setVars(out.vars);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  }

  function render(node: UiNode, key: number): React.ReactNode {
    switch (node.node) {
      case 'text': {
        const t = resolve(node.text, ctx);
        if (node.variant === 'heading') return <h3 key={key} className="text-base font-bold text-gray-900 dark:text-white">{t}</h3>;
        if (node.variant === 'muted') return <p key={key} className="text-xs text-gray-500 dark:text-gray-400">{t}</p>;
        return <p key={key} className="text-sm text-gray-700 dark:text-gray-200">{t}</p>;
      }
      case 'badge':
        return <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${BADGE_TONE[node.tone ?? 'neutral']}`}>{resolve(node.text, ctx)}</span>;
      case 'button':
        return (
          <button key={key} onClick={() => runAction(node.action)} disabled={busyAction !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
            {busyAction === node.action ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {node.label}
          </button>
        );
      case 'input': {
        const v = rt.state.vars[node.bindVar];
        return (
          <label key={key} className="block">
            {node.label && <span className="label-xs">{node.label}</span>}
            <input className="saas-input !py-2 text-sm mt-1" placeholder={node.placeholder} value={str(v)}
              onChange={(e) => rt.setVar(node.bindVar, e.target.value)} />
          </label>
        );
      }
      case 'progress': {
        const raw = Number(rt.state.vars[node.bindVar]);
        const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        return (
          <div key={key} className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        );
      }
      case 'list': {
        const items = rt.state.vars[node.bindVar];
        const arr = Array.isArray(items) ? items : [];
        return (
          <ul key={key} className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-200 space-y-0.5">
            {arr.map((it, i) => <li key={i}>{str(it)}</li>)}
          </ul>
        );
      }
      case 'table': {
        const cols = node.columns?.length ? node.columns : (dataset[0] ? Object.keys(dataset[0]) : []);
        return (
          <div key={key} className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold text-gray-500">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {dataset.slice(0, 100).map((r, i) => (
                  <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{str(r[c])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'row':
        return <div key={key} className="flex flex-wrap items-center gap-2">{node.children.map((c, i) => render(c, i))}</div>;
      case 'stack':
        return <div key={key} className="space-y-2">{node.children.map((c, i) => render(c, i))}</div>;
      default:
        return null;
    }
  }

  return (
    <div className="saas-card !p-4 space-y-3">
      <div className="space-y-2">{manifest.uiSchema.map((n, i) => render(n, i))}</div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
    </div>
  );
}
