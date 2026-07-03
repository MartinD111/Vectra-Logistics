'use client';

// Plugin registry — the set of plugin block kinds available to the builder.
// Seeded with built-in examples; AI-authored (Phase J) and marketplace-installed
// (Phase K) plugins register here too. A manifest is validated before it is
// accepted, so a malformed plugin can never reach the renderers or the sandbox.
//
// For now this is an in-memory, process-wide store. Company-scoped persistence
// (load a company's installed plugins on boot; install/uninstall) is Phase K —
// this module is the single seam that change will plug into.

import { useSyncExternalStore } from 'react';
import type { PluginBlockManifest } from './manifest';
import { validateManifest } from './manifest';
import { EXAMPLE_PLUGINS } from './examples';

class PluginRegistry {
  private plugins = new Map<string, PluginBlockManifest>();
  private listeners = new Set<() => void>();
  private snapshot: PluginBlockManifest[] = [];

  constructor(seed: PluginBlockManifest[] = []) {
    seed.forEach((m) => this.registerUnsafe(m));
    this.recompute();
  }

  /** Register a manifest after structural validation. Returns validation errors (empty = success). */
  register(manifest: PluginBlockManifest): string[] {
    const v = validateManifest(manifest);
    if (!v.ok) return v.errors;
    this.registerUnsafe(manifest);
    this.recompute();
    this.emit();
    return [];
  }

  private registerUnsafe(m: PluginBlockManifest) {
    this.plugins.set(m.id, m);
  }

  unregister(id: string) {
    if (this.plugins.delete(id)) { this.recompute(); this.emit(); }
  }

  get(id: string): PluginBlockManifest | undefined {
    return this.plugins.get(id);
  }

  list(): PluginBlockManifest[] {
    return this.snapshot;
  }

  // ── external-store plumbing (so React palettes update on install) ──────────
  private recompute() { this.snapshot = Array.from(this.plugins.values()); }
  private emit() { this.listeners.forEach((l) => l()); }
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  getSnapshot = (): PluginBlockManifest[] => this.snapshot;
}

export const pluginRegistry = new PluginRegistry(EXAMPLE_PLUGINS);

/** React hook: the current list of installed plugin manifests (re-renders on change). */
export function usePlugins(): PluginBlockManifest[] {
  return useSyncExternalStore(pluginRegistry.subscribe, pluginRegistry.getSnapshot, pluginRegistry.getSnapshot);
}

/** Resolve a single manifest by id (non-reactive). */
export function getPlugin(id: string): PluginBlockManifest | undefined {
  return pluginRegistry.get(id);
}
