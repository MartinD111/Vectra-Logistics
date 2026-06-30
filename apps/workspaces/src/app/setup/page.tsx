'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container, Truck, Car, Leaf, Plane, Boxes, Check, Loader2, ArrowRight,
} from 'lucide-react';
import { useCurrentWorkspace, useWorkspacePresets, useApplyPresets } from '@/lib/hooks/useTenantWorkspace';

// Generic icon resolver — presets carry an icon key (data), the app maps it to
// a component. Unknown keys fall back to a neutral icon. No vertical is
// special-cased in logic; this is presentation only.
const ICONS: Record<string, typeof Boxes> = {
  container: Container,
  truck: Truck,
  car: Car,
  leaf: Leaf,
  plane: Plane,
};
function iconFor(key: string | null) {
  return (key && ICONS[key]) || Boxes;
}

export default function SetupPage() {
  const router = useRouter();
  const { data: workspace, isLoading: wsLoading } = useCurrentWorkspace();
  const { data: presets, isLoading: presetsLoading } = useWorkspacePresets();
  const apply = useApplyPresets(workspace?.id ?? '');

  // Pre-select any types already applied to the workspace.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  if (!seeded && workspace) {
    setSelected(new Set(workspace.presets.map((p) => p.id)));
    setSeeded(true);
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function finish() {
    if (workspace && selected.size > 0) {
      await apply.mutateAsync(Array.from(selected));
    }
    router.push('/dashboard');
  }

  const loading = wsLoading || presetsLoading;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
            Workspace setup
          </p>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Choose your workspace type
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Pick one or more types that match how your company operates. Each one turns on a
            tailored set of modules. You can change this anytime in Settings.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-20 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading types…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(presets ?? []).map((preset) => {
                const Icon = iconFor(preset.icon);
                const isOn = selected.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => toggle(preset.id)}
                    className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                      isOn
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-primary-300 bg-white dark:bg-dark-card'
                    }`}
                  >
                    {isOn && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white">{preset.name}</p>
                    {preset.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {preset.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {preset.enabled_modules.slice(0, 4).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selected.size === 0
                  ? 'Select at least one to enable its modules.'
                  : `${selected.size} type${selected.size > 1 ? 's' : ''} selected`}
              </p>
              <button
                onClick={finish}
                disabled={apply.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {apply.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {selected.size === 0 ? 'Skip for now' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
