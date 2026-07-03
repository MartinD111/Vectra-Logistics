// Plugin block manifest — the versioned, JSON-serializable definition of a
// block kind contributed by a plugin (hand-authored, AI-authored, or installed
// from the marketplace). A plugin never ships React/HTML; it declares:
//   - settingsSchema: the builder config form (FieldSpec[])
//   - uiSchema: what the block renders in the player (UiNode tree of fixed
//     Vectra primitives — the ONLY rendering vocabulary a plugin can use)
//   - logic.source: JS run in a hardened Web Worker sandbox (no DOM/network)
//
// Extending the FieldSpec / UiNode vocabularies is a deliberate change to
// Vectra's own code — plugins cannot introduce new primitives.

// ── Settings schema (builder config form) ───────────────────────────────────

export type FieldSpecType =
  | 'text' | 'number' | 'boolean' | 'select' | 'textarea'
  | 'column'      // dropdown of columns in the incoming dataset
  | 'code';       // small code/text area (advisory only)

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldSpecType;
  options?: string[];        // for 'select'
  placeholder?: string;
  default?: unknown;
}

// ── UI schema (player rendering) ────────────────────────────────────────────
// A constrained tree. `bind` references a value from the render context
// (row/vars/config/dataset) via a dotted path; `text` is a literal or a
// {{placeholder}} template resolved against the same context.

export type UiNode =
  | { node: 'text'; text: string; variant?: 'body' | 'heading' | 'muted' }
  | { node: 'badge'; text: string; tone?: 'neutral' | 'success' | 'warn' | 'danger' }
  | { node: 'button'; label: string; action: string }        // action = id passed to logic
  | { node: 'input'; label?: string; bindVar: string; placeholder?: string }
  | { node: 'progress'; bindVar: string }                    // 0..100 from vars
  | { node: 'table'; columns?: string[]; source?: 'dataset' }// renders the current dataset
  | { node: 'list'; bindVar: string }                        // vars[bindVar] = string[]
  | { node: 'row'; children: UiNode[] }
  | { node: 'stack'; children: UiNode[] };

// ── Logic ───────────────────────────────────────────────────────────────────

export interface PluginLogic {
  /**
   * 'transform' — pure(ish) dataset processor: (rows, config, vars) => rows.
   *   Runs automatically whenever its input changes; output flows downstream.
   * 'action'    — triggered by a UiNode button. Receives (rows, config, vars,
   *   actionId) and returns { rows?, vars? } to merge back.
   */
  kind: 'transform' | 'action';
  /** JS function body. In scope: rows, config, vars, actionId. Return rows[] or { rows?, vars? }. */
  source: string;
}

export interface PluginBlockManifest {
  /** Stable plugin id (e.g. "com.acme.dedupe"). */
  id: string;
  version: string;
  title: string;
  description: string;
  /** lucide icon name (resolved via BlockIcon; falls back to a neutral square). */
  icon: string;
  group: 'input' | 'process' | 'output' | 'layout';
  settingsSchema: FieldSpec[];
  uiSchema: UiNode[];
  logic: PluginLogic;
  /** Trust label for the marketplace (Phase K). */
  origin?: 'builtin' | 'company' | 'ai' | 'marketplace';
}

// ── Validation ──────────────────────────────────────────────────────────────
// Structural checks so an installed/AI-authored manifest can be rejected before
// it ever reaches the renderers or the sandbox.

const FIELD_TYPES = new Set<FieldSpecType>(['text', 'number', 'boolean', 'select', 'textarea', 'column', 'code']);
const UI_NODES = new Set(['text', 'badge', 'button', 'input', 'progress', 'table', 'list', 'row', 'stack']);

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
}

function validateUiNode(n: unknown, path: string, errors: string[], depth = 0): void {
  if (depth > 12) { errors.push(`${path}: UI nesting too deep`); return; }
  if (!n || typeof n !== 'object') { errors.push(`${path}: not an object`); return; }
  const node = (n as { node?: unknown }).node;
  if (typeof node !== 'string' || !UI_NODES.has(node)) { errors.push(`${path}: unknown UI node "${String(node)}"`); return; }
  const children = (n as { children?: unknown }).children;
  if (node === 'row' || node === 'stack') {
    if (!Array.isArray(children)) { errors.push(`${path}.children: expected array`); return; }
    children.forEach((c, i) => validateUiNode(c, `${path}.children[${i}]`, errors, depth + 1));
  }
}

export function validateManifest(raw: unknown): ManifestValidation {
  const errors: string[] = [];
  const m = raw as Partial<PluginBlockManifest>;
  if (!m || typeof m !== 'object') return { ok: false, errors: ['manifest is not an object'] };
  if (typeof m.id !== 'string' || !m.id) errors.push('id is required');
  if (typeof m.version !== 'string' || !m.version) errors.push('version is required');
  if (typeof m.title !== 'string' || !m.title) errors.push('title is required');
  if (!['input', 'process', 'output', 'layout'].includes(m.group as string)) errors.push('group is invalid');

  if (!Array.isArray(m.settingsSchema)) errors.push('settingsSchema must be an array');
  else m.settingsSchema.forEach((f, i) => {
    if (!f || typeof f.key !== 'string' || !f.key) errors.push(`settingsSchema[${i}].key required`);
    if (!FIELD_TYPES.has(f?.type as FieldSpecType)) errors.push(`settingsSchema[${i}].type invalid`);
  });

  if (!Array.isArray(m.uiSchema)) errors.push('uiSchema must be an array');
  else m.uiSchema.forEach((n, i) => validateUiNode(n, `uiSchema[${i}]`, errors));

  if (!m.logic || typeof m.logic !== 'object') errors.push('logic is required');
  else {
    if (!['transform', 'action'].includes(m.logic.kind as string)) errors.push('logic.kind invalid');
    if (typeof m.logic.source !== 'string') errors.push('logic.source must be a string');
  }

  return { ok: errors.length === 0, errors };
}
