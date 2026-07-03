'use client';

// Company-wide AI provider settings (admin only). Cloud providers (OpenAI /
// Gemini) store an encrypted key server-side — never shown again after save.
// Local providers (Ollama/Gemma etc.) store a non-secret endpoint the browser
// calls directly. Powers the "describe it → generate the program" features in
// Mini Programs and Workflow Automation.

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, KeyRound, Server, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAiConfig, useSaveAiConfig, useAiComplete } from '@/lib/hooks/useAi';
import type { AiProvider } from '@/lib/api/ai.api';

const PROVIDERS: { id: AiProvider; label: string; hint: string; modelPh: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'GPT models via api.openai.com', modelPh: 'gpt-4o' },
  { id: 'gemini', label: 'Google Gemini', hint: 'Gemini via Google AI', modelPh: 'gemini-1.5-pro' },
  { id: 'local', label: 'Local model', hint: 'Ollama / LM Studio / Gemma on your machine', modelPh: 'gemma3' },
];

export default function AiProviderCard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: config, isLoading } = useAiConfig();
  const save = useSaveAiConfig();
  const { complete } = useAiComplete();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:11434');
  const [localModel, setLocalModel] = useState('');
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'err'; msg?: string }>({ state: 'idle' });

  // Hydrate form from saved config once loaded.
  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setModel(config.model ?? '');
    if (config.localEndpoint) setLocalEndpoint(config.localEndpoint);
    setLocalModel(config.localModel ?? '');
  }, [config]);

  if (!isAdmin) return null;

  const isLocal = provider === 'local';
  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

  const onSave = () => {
    save.mutate({
      provider,
      model: model.trim() || undefined,
      apiKey: !isLocal && apiKey.trim() ? apiKey.trim() : undefined,
      localEndpoint: isLocal ? localEndpoint.trim() : undefined,
      localModel: isLocal ? localModel.trim() || undefined : undefined,
    }, { onSuccess: () => setApiKey('') });
  };

  const onTest = async () => {
    setTest({ state: 'running' });
    try {
      const res = await complete({ prompt: 'Reply with exactly: OK', maxTokens: 10 });
      setTest({ state: 'ok', msg: res.text.trim().slice(0, 80) || '(empty response)' });
    } catch (e) {
      setTest({ state: 'err', msg: e instanceof Error ? e.message : 'Request failed' });
    }
  };

  return (
    <div className="saas-card">
      <h3 className="text-lg font-bold flex items-center gap-2 mb-2 dark:text-white">
        <Sparkles size={20} className="text-primary-500" /> AI Assistant
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-b pb-4 dark:border-dark-border border-gray-100">
        Choose the AI provider that powers &ldquo;describe it &rarr; build it&rdquo; in Mini Programs and Workflow Automation.
        Cloud keys are encrypted and stay on the server; local models are called straight from your browser.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Provider choice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROVIDERS.map((p) => (
              <button key={p.id} type="button" onClick={() => { setProvider(p.id); setTest({ state: 'idle' }); }}
                className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  provider === p.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-primary-300'
                }`}>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{p.label}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{p.hint}</span>
              </button>
            ))}
          </div>

          {/* Cloud fields */}
          {!isLocal && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="label-xs">Model</span>
                <input className="saas-input !py-2 text-sm mt-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder={activeProvider.modelPh} />
              </div>
              <div>
                <span className="label-xs flex items-center gap-1"><KeyRound className="w-3 h-3" /> API key</span>
                <input type="password" autoComplete="off" className="saas-input !py-2 text-sm mt-1" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.hasApiKey ? '•••••••• (stored — leave blank to keep)' : 'Paste your API key'} />
              </div>
            </div>
          )}

          {/* Local fields */}
          {isLocal && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="label-xs flex items-center gap-1"><Server className="w-3 h-3" /> Endpoint URL</span>
                <input className="saas-input !py-2 text-sm mt-1 font-mono" value={localEndpoint} onChange={(e) => setLocalEndpoint(e.target.value)} placeholder="http://localhost:11434" />
              </div>
              <div>
                <span className="label-xs">Model name</span>
                <input className="saas-input !py-2 text-sm mt-1" value={localModel} onChange={(e) => setLocalModel(e.target.value)} placeholder={activeProvider.modelPh} />
              </div>
              <p className="md:col-span-2 text-[11px] text-gray-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Your browser calls this endpoint directly — it must be reachable from your machine and allow CORS
                (for Ollama, set <span className="font-mono">OLLAMA_ORIGINS</span>).
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={onSave} disabled={save.isPending}
              className="saas-button bg-primary-600 hover:bg-primary-500 text-white inline-flex items-center gap-2 disabled:opacity-60">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
            </button>
            <button onClick={onTest} disabled={test.state === 'running'}
              className="saas-button bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-2 disabled:opacity-60">
              {test.state === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Test connection
            </button>
            {save.isSuccess && !save.isPending && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>}
            {save.isError && <span className="text-xs text-red-500">{save.error instanceof Error ? save.error.message : 'Save failed'}</span>}
          </div>

          {test.state === 'ok' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Connected — model replied: “{test.msg}”</p>
          )}
          {test.state === 'err' && (
            <p className="text-xs text-red-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {test.msg}</p>
          )}
          <p className="text-[11px] text-gray-400">Tip: click Save before testing — the test uses the last saved configuration.</p>
        </div>
      )}
    </div>
  );
}
