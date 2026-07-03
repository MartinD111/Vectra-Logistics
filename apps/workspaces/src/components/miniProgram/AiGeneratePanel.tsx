'use client';

// "Describe it → build it" for mini programs. Sends the user's description plus
// the block-vocabulary system prompt to the company's configured AI provider
// (via useAiComplete — cloud proxy or local direct), validates the response into
// a real MiniProgramConfig, and hands it to the builder as an editable DRAFT.
// Nothing is auto-saved; the user reviews and edits before saving.

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, X, AlertTriangle, Wand2, Settings, ChevronDown } from 'lucide-react';
import { useAiComplete } from '@/lib/hooks/useAi';
import { blockDef, type MiniProgramConfig } from '@/lib/miniProgram/blocks';
import { buildSystemPrompt, parseGeneratedConfig } from '@/lib/miniProgram/generator';

const EXAMPLES = [
  'Upload two Excel files, match rows on VIN, and show which VINs are missing.',
  'Paste a list of invoices, extract the number after "INV-", and export as Excel.',
  'Upload a CSV, group rows by wagon and sum the weight per wagon.',
];

type Result = { config: MiniProgramConfig; warnings: string[] } | null;

export default function AiGeneratePanel({
  onApply,
}: {
  onApply: (config: MiniProgramConfig, mode: 'replace' | 'append') => void;
}) {
  const { complete, config: aiConfig } = useAiComplete();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const configured = !!aiConfig && (aiConfig.hasApiKey || aiConfig.provider === 'local');

  function reset() {
    setPrompt(''); setError(null); setRaw(null); setShowRaw(false); setResult(null); setBusy(false);
  }
  function close() { setOpen(false); reset(); }

  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true); setError(null); setRaw(null); setResult(null);
    try {
      const res = await complete({ system: buildSystemPrompt(), prompt: prompt.trim(), json: true, maxTokens: 4096 });
      setRaw(res.text);
      const parsed = parseGeneratedConfig(res.text);
      if (!parsed.ok || !parsed.config) {
        setError(parsed.error ?? 'Could not build a program from the response.');
      } else {
        setResult({ config: parsed.config, warnings: parsed.warnings });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  function apply(mode: 'replace' | 'append') {
    if (!result) return;
    onApply(result.config, mode);
    close();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-primary-600 hover:from-violet-500 hover:to-primary-500 text-white text-sm font-semibold shadow-sm">
        <Sparkles className="w-4 h-4" /> Generate with AI
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
          <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                <Sparkles className="w-5 h-5 text-violet-500" /> Generate program with AI
              </h3>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {!configured ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 p-4 text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold flex items-center gap-2 mb-1"><Settings className="w-4 h-4" /> No AI provider configured</p>
                  <p>An admin needs to set an AI provider (OpenAI, Gemini, or a local model) before you can generate programs.{' '}
                    <Link href="/settings" className="underline font-semibold">Open Settings</Link>.</p>
                </div>
              ) : !result ? (
                <>
                  <div>
                    <span className="label-xs">Describe the tool you want</span>
                    <textarea rows={5} className="saas-input text-sm mt-1" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Upload an Excel file, keep only the VIN and weight columns, group by wagon and sum the weight, then add an Export button." />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} onClick={() => setPrompt(ex)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-dark-border text-gray-500 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400">
                        {ex.length > 48 ? ex.slice(0, 46) + '…' : ex}
                      </button>
                    ))}
                  </div>
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 p-3 text-sm text-red-700 dark:text-red-300">
                      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4" /> {error}</p>
                      {raw && (
                        <button onClick={() => setShowRaw((s) => !s)} className="mt-2 text-xs underline inline-flex items-center gap-1">
                          <ChevronDown className={`w-3 h-3 transition-transform ${showRaw ? 'rotate-180' : ''}`} /> {showRaw ? 'Hide' : 'Show'} model output
                        </button>
                      )}
                      {showRaw && raw && <pre className="mt-2 text-[10px] bg-white/60 dark:bg-black/30 rounded-lg p-2 overflow-x-auto max-h-40">{raw}</pre>}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">Provider: {aiConfig?.provider}{aiConfig?.model ? ` · ${aiConfig.model}` : ''}</span>
                    <button onClick={generate} disabled={busy || !prompt.trim()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generate
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{result.config.meta.title}</p>
                    {result.config.meta.subtitle && <p className="text-xs text-gray-500 mb-3">{result.config.meta.subtitle}</p>}
                    <div className="rounded-xl border border-gray-200 dark:border-dark-border divide-y divide-gray-100 dark:divide-dark-border">
                      {result.config.blocks.map((b, i) => (
                        <div key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <span className="w-5 text-[11px] text-gray-400 text-right">{i + 1}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{blockDef(b.kind)?.title ?? b.kind}</span>
                          <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-auto">{blockDef(b.kind)?.group}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {result.warnings.length > 0 && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                      {result.warnings.map((w, i) => <p key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {w}</p>)}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400">This is a draft — review and edit the blocks before saving. Nothing is saved automatically.</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button onClick={() => setResult(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium">← Back</button>
                    <div className="flex gap-2">
                      <button onClick={() => apply('append')} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Append to program</button>
                      <button onClick={() => apply('replace')} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold">Replace program</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
