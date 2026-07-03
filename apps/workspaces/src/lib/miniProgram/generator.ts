// AI program generator: turn a natural-language description into a valid
// MiniProgramConfig. The block vocabulary + JSON shapes are derived from
// BLOCK_REGISTRY (each kind's create() is the canonical example), so the prompt
// stays in sync automatically as new block kinds are added.
//
// The model's output is never trusted directly: `parseGeneratedConfig` rebuilds
// every block from its registry defaults and overlays only recognised fields,
// so a malformed or partial response degrades gracefully instead of producing
// an invalid config. Generated configs are handed to the builder as an editable
// DRAFT — never auto-saved.

import {
  BLOCK_REGISTRY, blockDef, uid, type Block, type BlockKind, type MiniProgramConfig,
} from './blocks';

// ── Prompt construction ─────────────────────────────────────────────────────

/** A compact, model-friendly catalogue of every block kind and its JSON shape. */
export function buildBlockCatalogue(): string {
  return BLOCK_REGISTRY.map((def) => {
    const example = def.create();
    // Strip the generated id — the model shouldn't invent ids; we assign them.
    const { id: _id, ...shape } = example as Block & { id: string };
    return `- kind "${def.kind}" (${def.group}) — ${def.title}: ${def.description}\n  example: ${JSON.stringify(shape)}`;
  }).join('\n');
}

export function buildSystemPrompt(): string {
  return [
    'You are a builder that designs "mini programs" for a no-code data-tool platform.',
    'A mini program is an ordered list of BLOCKS. Data flows top-to-bottom: an input block',
    'produces a dataset (array of row objects); processing blocks reshape the dataset; output',
    'blocks display, export, copy or template the current dataset.',
    '',
    'Respond with ONLY a JSON object of this exact shape (no markdown, no prose):',
    '{ "meta": { "title": string, "subtitle"?: string }, "blocks": [ { "kind": string, ...fields } ] }',
    '',
    'Rules:',
    '- Use ONLY the block kinds listed below. Do not invent kinds or fields.',
    '- Each block object must include "kind" plus the fields shown in that kind\'s example.',
    '- Do NOT include an "id" field — ids are assigned automatically.',
    '- Order blocks so inputs come before the processing/output blocks that use their data.',
    '- A processing/output block may optionally include "dataSource": { "blockId": "<index>" }',
    '  to read from a specific earlier block instead of the previous one — but prefer simple',
    '  linear order and omit dataSource unless a second data source is genuinely needed.',
    '- Keep it minimal: only the blocks the user actually asked for.',
    '',
    'Available block kinds:',
    buildBlockCatalogue(),
  ].join('\n');
}

// ── Response parsing / validation ───────────────────────────────────────────

export interface ParseResult {
  ok: boolean;
  config?: MiniProgramConfig;
  error?: string;
  /** Non-fatal issues (e.g. unknown block kinds that were skipped). */
  warnings: string[];
}

const KNOWN_KINDS = new Set<string>(BLOCK_REGISTRY.map((d) => d.kind));

/** Pull the first balanced JSON object out of a model response (handles stray prose / code fences). */
function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return candidate.slice(start, i + 1); }
  }
  return null;
}

/**
 * Rebuild a trusted MiniProgramConfig from a raw model response. Each block is
 * reconstructed from its registry defaults with only recognised fields overlaid,
 * so unknown fields are dropped and missing ones are defaulted.
 */
export function parseGeneratedConfig(raw: string): ParseResult {
  const warnings: string[] = [];
  const json = extractJsonObject(raw);
  if (!json) return { ok: false, error: 'No JSON object found in the response.', warnings };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `Response was not valid JSON: ${e instanceof Error ? e.message : 'parse error'}`, warnings };
  }

  const obj = parsed as { meta?: { title?: unknown; subtitle?: unknown }; blocks?: unknown };
  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : null;
  if (!rawBlocks) return { ok: false, error: 'Response has no "blocks" array.', warnings };

  // Map model-provided block references (by array index string or synthetic key)
  // to the real ids we assign, so dataSource links survive rebuilding.
  const assignedIds: string[] = [];
  const blocks: Block[] = [];

  rawBlocks.forEach((entry, i) => {
    const rec = entry as Record<string, unknown>;
    const kind = rec.kind as BlockKind;
    if (typeof kind !== 'string' || !KNOWN_KINDS.has(kind)) {
      warnings.push(`Skipped block ${i + 1}: unknown kind "${String(rec.kind)}".`);
      assignedIds.push('');
      return;
    }
    const base = blockDef(kind)!.create();
    const id = uid();
    // Overlay only keys that exist on the registry default (plus dataSource),
    // dropping anything the model hallucinated.
    const allowed = new Set([...Object.keys(base), 'dataSource']);
    const merged: Record<string, unknown> = { ...base, id };
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'id' || k === 'kind') continue;
      if (allowed.has(k)) merged[k] = v;
    }
    assignedIds.push(id);
    blocks.push(merged as unknown as Block);
  });

  // Second pass: rewrite dataSource.blockId (model used array index or its own
  // ids) → the real assigned id, when resolvable; otherwise drop the ref.
  for (const b of blocks) {
    const ds = (b as unknown as { dataSource?: { blockId?: unknown } }).dataSource;
    if (ds && ds.blockId !== undefined) {
      const idxNum = Number(ds.blockId);
      const resolved = Number.isInteger(idxNum) && assignedIds[idxNum] ? assignedIds[idxNum] : null;
      if (resolved) {
        (b as unknown as { dataSource: { blockId: string } }).dataSource = { blockId: resolved };
      } else {
        delete (b as unknown as { dataSource?: unknown }).dataSource;
        warnings.push(`Cleared an unresolvable data-source link on a "${b.kind}" block.`);
      }
    }
  }

  if (blocks.length === 0) return { ok: false, error: 'No usable blocks in the response.', warnings };

  const title = typeof obj.meta?.title === 'string' && obj.meta.title.trim() ? obj.meta.title.trim() : 'Generated program';
  const subtitle = typeof obj.meta?.subtitle === 'string' ? obj.meta.subtitle : undefined;

  return {
    ok: true,
    warnings,
    config: { version: 2, meta: { title, ...(subtitle ? { subtitle } : {}) }, blocks },
  };
}
