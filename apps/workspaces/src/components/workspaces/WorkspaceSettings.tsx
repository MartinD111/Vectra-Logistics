'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Check, Loader2, Plus, X, Palette } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useCurrentWorkspace,
  useWorkspacePresets,
  useUpdateBranding,
  useApplyPresets,
  useRemovePreset,
} from '@/lib/hooks/useTenantWorkspace';

/**
 * Admin-only Workspace settings: edit header branding (title, logo, colors) and
 * add/remove workspace type(s). Mirrors the constitution — types are tenant
 * data, editable any time.
 */
export default function WorkspaceSettings() {
  const { user } = useAuth();
  const { data: workspace, isLoading } = useCurrentWorkspace();
  const { data: presets } = useWorkspacePresets();
  const updateBranding = useUpdateBranding(workspace?.id ?? '');
  const applyPresets = useApplyPresets(workspace?.id ?? '');
  const removePreset = useRemovePreset(workspace?.id ?? '');

  const [form, setForm] = useState({
    header_title: '',
    logo_url: '',
    primary_color: '',
    accent_color: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (workspace) {
      setForm({
        header_title: workspace.header_title ?? '',
        logo_url: workspace.logo_url ?? '',
        primary_color: workspace.primary_color ?? '',
        accent_color: workspace.accent_color ?? '',
      });
    }
  }, [workspace]);

  if (isLoading) {
    return (
      <div className="saas-card flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading workspace…
      </div>
    );
  }
  if (!workspace) return null;

  const isAdmin = user?.role === 'admin';
  const appliedIds = new Set(workspace.presets.map((p) => p.id));

  async function saveBranding() {
    await updateBranding.mutateAsync({
      header_title: form.header_title || null,
      logo_url: form.logo_url || null,
      primary_color: form.primary_color || null,
      accent_color: form.accent_color || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Branding */}
      <div className="saas-card">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-2 dark:text-white">
          <Palette size={20} className="text-primary-500" /> Workspace branding
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-b pb-4 dark:border-dark-border border-gray-100">
          Customize the header your team sees — title, logo, and colors.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="label-xs">Header title</span>
            <input
              className="saas-input"
              value={form.header_title}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, header_title: e.target.value }))}
              placeholder={workspace.name}
            />
          </label>
          <label className="block">
            <span className="label-xs">Logo URL</span>
            <input
              className="saas-input"
              value={form.logo_url}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://…/logo.png"
            />
          </label>
          <label className="block">
            <span className="label-xs">Primary color</span>
            <input
              className="saas-input"
              value={form.primary_color}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
              placeholder="#16a34a"
            />
          </label>
          <label className="block">
            <span className="label-xs">Accent color</span>
            <input
              className="saas-input"
              value={form.accent_color}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
              placeholder="#22c55e"
            />
          </label>
        </div>

        {isAdmin ? (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={saveBranding}
              disabled={updateBranding.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {updateBranding.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save branding
            </button>
            {saved && (
              <span className="text-sm text-primary-600 dark:text-primary-400 inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        ) : (
          <p className="mt-5 text-xs text-slate-400">Only an admin can change branding.</p>
        )}
      </div>

      {/* Workspace types */}
      <div className="saas-card">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-2 dark:text-white">
          <Briefcase size={20} className="text-primary-500" /> Workspace types
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-b pb-4 dark:border-dark-border border-gray-100">
          Add or remove the types that match how you operate. Each type enables a set of modules.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(presets ?? []).map((preset) => {
            const isOn = appliedIds.has(preset.id);
            const busy = applyPresets.isPending || removePreset.isPending;
            return (
              <div
                key={preset.id}
                className={`flex items-start justify-between gap-3 p-4 rounded-xl border ${
                  isOn
                    ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{preset.name}</p>
                  {preset.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                  )}
                </div>
                {isAdmin &&
                  (isOn ? (
                    <button
                      onClick={() => removePreset.mutate(preset.id)}
                      disabled={busy}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => applyPresets.mutate([preset.id])}
                      disabled={busy}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
