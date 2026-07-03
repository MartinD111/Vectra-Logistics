// Plugin logic sandbox. Untrusted plugin code (marketplace / AI-authored) runs
// in a hardened Web Worker with NO DOM, NO network, NO storage, and a hard
// wall-clock timeout. This is a different trust boundary from the built-in
// `code` block (which is the program author's own trusted code on the main
// thread) — plugin code may come from a third party, so it must not be able to
// exfiltrate data, reach the network, spawn escape workers, or hang the tab.

import type { Row } from '../blocks';

export interface SandboxInput {
  rows: Row[];
  config: Record<string, unknown>;
  vars: Record<string, unknown>;
  actionId?: string;
}

export interface SandboxOutput {
  rows?: Row[];
  vars?: Record<string, unknown>;
}

// The worker body as a PLAIN-JS string. Kept dependency-free and self-contained
// so it can be shipped as a Blob and audited/tested as the exact artifact.
// Hardening strips every capability that could touch the network, storage, DOM,
// or spawn a fresh (un-hardened) global.
export const SANDBOX_WORKER_SOURCE = `
'use strict';
(function () {
  // Capabilities that must not be reachable from plugin code. In a Worker these
  // live as accessor properties on the WorkerGlobalScope PROTOTYPE chain, so a
  // plain 'self.x = undefined' or 'delete self.x' silently no-ops. We instead
  // redefine each name to undefined on whichever object actually owns it, and
  // shadow it with an own non-writable property on self — neutralising direct
  // calls AND Function-constructor / scope-chain escapes, since bare names
  // resolve against this same global.
  var DENY = [
    'fetch','XMLHttpRequest','WebSocket','EventSource','importScripts',
    'Worker','SharedWorker','BroadcastChannel','RTCPeerConnection','MessageChannel',
    'indexedDB','caches','navigator','Notification','sessionStorage','localStorage',
    'openDatabase','FileReader','FileReaderSync','createImageBitmap','Request','Response'
  ];
  function nuke(name) {
    // Redefine on every object in the prototype chain that owns the name.
    var t = self;
    while (t) {
      try {
        var d = Object.getOwnPropertyDescriptor(t, name);
        if (d && d.configurable) {
          Object.defineProperty(t, name, { value: undefined, writable: false, configurable: true });
        }
      } catch (e) {}
      t = Object.getPrototypeOf(t);
    }
    // Own-property shadow on self as a final guarantee.
    try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: true }); } catch (e) {}
    try { self[name] = undefined; } catch (e) {}
  }
  DENY.forEach(nuke);

  function normalize(out, inputRows) {
    if (out == null) return { rows: inputRows };
    if (Array.isArray(out)) return { rows: out };
    if (typeof out === 'object') {
      var res = {};
      if (Array.isArray(out.rows)) res.rows = out.rows;
      if (out.vars && typeof out.vars === 'object') res.vars = out.vars;
      return res;
    }
    return { rows: inputRows };
  }

  self.onmessage = function (ev) {
    var msg = ev.data || {};
    var id = msg.id;
    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function('rows', 'config', 'vars', 'actionId', '"use strict";\\n' + String(msg.source));
      var raw = fn(msg.rows || [], msg.config || {}, msg.vars || {}, msg.actionId);
      Promise.resolve(raw).then(function (val) {
        var result = normalize(val, msg.rows || []);
        // Structured-clone-safe round-trip; also strips functions/DOM refs.
        self.postMessage({ id: id, ok: true, result: JSON.parse(JSON.stringify(result)) });
      }).catch(function (err) {
        self.postMessage({ id: id, ok: false, error: String(err && err.message ? err.message : err) });
      });
    } catch (err) {
      self.postMessage({ id: id, ok: false, error: String(err && err.message ? err.message : err) });
    }
  };
})();
`;

let blobUrl: string | null = null;
function workerUrl(): string {
  if (blobUrl) return blobUrl;
  const blob = new Blob([SANDBOX_WORKER_SOURCE], { type: 'application/javascript' });
  blobUrl = URL.createObjectURL(blob);
  return blobUrl;
}

let seq = 0;

export interface RunOptions {
  timeoutMs?: number;
}

/**
 * Run plugin `source` against `input` in a fresh hardened worker. The worker is
 * always terminated afterwards (success, error, or timeout), so a hung or
 * malicious plugin can never keep running or block the tab.
 */
export function runInSandbox(source: string, input: SandboxInput, opts: RunOptions = {}): Promise<SandboxOutput> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  return new Promise<SandboxOutput>((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Sandbox unavailable (no Web Worker in this environment)'));
      return;
    }
    const id = ++seq;
    let worker: Worker;
    try {
      worker = new Worker(workerUrl());
    } catch (e) {
      reject(new Error(`Failed to start sandbox: ${e instanceof Error ? e.message : 'unknown'}`));
      return;
    }

    const done = (fn: () => void) => { clearTimeout(timer); worker.terminate(); fn(); };
    const timer = setTimeout(() => done(() => reject(new Error(`Plugin timed out after ${timeoutMs}ms`))), timeoutMs);

    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { id: number; ok: boolean; result?: SandboxOutput; error?: string };
      if (data.id !== id) return;
      if (data.ok) done(() => resolve(data.result ?? {}));
      else done(() => reject(new Error(data.error || 'Plugin error')));
    };
    worker.onerror = (e: ErrorEvent) => done(() => reject(new Error(e.message || 'Plugin worker error')));

    // Only structured-clone-safe data crosses the boundary.
    let payload: SandboxInput;
    try {
      payload = JSON.parse(JSON.stringify(input)) as SandboxInput;
    } catch {
      done(() => reject(new Error('Plugin input is not serialisable')));
      return;
    }
    worker.postMessage({ id, source, ...payload });
  });
}
