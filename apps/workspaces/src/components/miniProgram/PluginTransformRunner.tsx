'use client';

// Headless driver for plugin TRANSFORM blocks. Renders nothing; runs each
// plugin transform in the hardened sandbox whenever its input dataset or config
// changes, and caches the result into runtime state (which evaluate() reads).
// This is how async, untrusted plugin logic participates in the otherwise
// synchronous top-to-bottom fold. Must be rendered inside a RuntimeProvider.

import { useEffect, useRef } from 'react';
import type { Block } from '@/lib/miniProgram/blocks';
import { useRuntime } from '@/lib/miniProgram/runtime';
import { getPlugin } from '@/lib/miniProgram/plugins/registry';
import { runInSandbox } from '@/lib/miniProgram/plugins/sandbox';

export default function PluginTransformRunner({ blocks }: { blocks: Block[] }) {
  const rt = useRuntime();
  // Last input+config signature we ran per block, to avoid redundant re-runs.
  const sigs = useRef<Record<string, string>>({});
  // Monotonic run token per block, so a stale async result can't overwrite a newer one.
  const tokens = useRef<Record<string, number>>({});

  useEffect(() => {
    for (const b of blocks) {
      if (b.kind !== 'plugin') continue;
      const manifest = getPlugin(b.pluginId);
      if (!manifest || manifest.logic.kind !== 'transform') continue;

      const input = rt.result.inputTo[b.id] ?? [];
      // Signature deliberately excludes `vars` — a transform that writes vars
      // must not retrigger itself into a loop.
      let sig: string;
      try { sig = JSON.stringify([b.config, input]); } catch { sig = String(Math.random()); }
      if (sigs.current[b.id] === sig) continue;
      sigs.current[b.id] = sig;

      const token = (tokens.current[b.id] ?? 0) + 1;
      tokens.current[b.id] = token;

      runInSandbox(manifest.logic.source, { rows: input, config: b.config, vars: rt.state.vars })
        .then((out) => {
          if (tokens.current[b.id] !== token) return; // superseded
          rt.setPluginOutput(b.id, out.rows ?? input);
          if (out.vars && Object.keys(out.vars).length > 0) rt.setVars(out.vars);
        })
        .catch(() => {
          if (tokens.current[b.id] !== token) return;
          // On error, pass the input through so downstream blocks still work.
          rt.setPluginOutput(b.id, input);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, rt.result, rt.state.vars]);

  return null;
}
