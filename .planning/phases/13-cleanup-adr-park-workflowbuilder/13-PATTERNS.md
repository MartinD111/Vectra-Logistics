# Phase 13: Cleanup, ADR & Park WorkflowBuilder - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 8 (6 sweep targets + 1 new ADR + 1 explicitly untouched reference file)
**Analogs found:** 1 / 2 (docs style has a partial analog; the ADR format itself has no analog — first ADR in this repo)

This phase is subtractive/documentary, not a net-new feature build. There is no CRUD/service/controller work. The two artifact types are:
1. **Dead-code sweep** (no file creation — edits only, verification-first) across 6 already-existing files.
2. **One new markdown file** — the ADR — for which the closest analogs are the existing `docs/*.md` files (style/tone) and the Phase 12 PATTERNS.md (structured technical-writeup precedent, not a stylistic template).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` (new ADR — exact filename at planner/executor discretion per CONTEXT.md) | config/docs | n/a (static doc) | `docs/DEPLOYMENT.md` (structure/tone), `docs/API.md` (brevity) | role-match (no ADR precedent exists) |
| `apps/workspaces/src/components/projectPage/PageBlockView.tsx` | component (render dispatch) | transform | itself (verify-only; already migrated to `pageBlockRegistry.render`) | exact (self) |
| `apps/workspaces/src/components/miniProgram/BlockView.tsx` | component (render dispatch) | transform | itself (verify-only; already migrated to `miniProgramBlockRegistry.render`) | exact (self) |
| `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` | component (edit dispatch) | event-driven | itself (verify-only; already migrated to `pageBlockRegistry.renderEditor`) | exact (self) |
| `apps/workspaces/src/lib/projectPage/registry.tsx` | config (registry entries) | transform | `apps/workspaces/src/lib/miniProgram/registry.tsx` (sibling registry, same engine) | exact |
| `apps/workspaces/src/lib/miniProgram/registry.tsx` | config (registry entries) | transform | `apps/workspaces/src/lib/projectPage/registry.tsx` (sibling registry, same engine) | exact |
| `apps/workspaces/src/lib/projectPage/slashMenu.ts` | utility | transform | `apps/workspaces/src/lib/workspaceEngine/palette.ts` (`buildPaletteItems`, the registry-driven successor) | role-match |
| `apps/workspaces/src/components/automations/WorkflowBuilder.tsx` | component | n/a | **DO NOT TOUCH** (D-03) — reference-only for the ADR's deferral section | n/a — explicitly excluded from edits |

No controllers/services/repositories/migrations are in scope for this phase — it is frontend-docs/cleanup only.

## Pattern Assignments

### `docs/<new-adr-file>.md` (docs, static)

**Analog for style/tone:** `docs/DEPLOYMENT.md`, `docs/API.md`

`docs/DEPLOYMENT.md` (lines 1-21) establishes the house style for this doc set:
- `#` title, short intro paragraph stating what the doc covers
- fenced code blocks for directory/file trees (see lines 6-12)
- `##` sections per topic, terse prose, code fences for commands
- No YAML frontmatter, no ADR numbering/status/consequences template observed anywhere in `docs/`

```markdown
# Deployment & Topology

Vectra is a monorepo (npm workspaces) that ships **three independently
deployable frontends** sharing **one backend API** and a set of shared packages.

```
apps/marketplace  → Vectra Marketplace   (Next.js, port 3000)
...
```
```

**Recommendation (Claude's Discretion per CONTEXT.md):** Given zero prior ADR precedent and a flat `docs/` convention, a single flat file (e.g. `docs/ARCHITECTURE-WORKSPACE-ENGINE.md`) matching the existing `docs/API.md` / `docs/DEPLOYMENT.md` tone is the lower-friction choice over starting a new `docs/adr/NNNN-title.md` series — starting a numbered series for a single document is unjustified process overhead. Use `##` sections mirroring the four required content areas from CONTEXT.md: (1) the engine contract, (2) native-vs-manifest split, (3) the `keyOf` seam, (4) package-promotion path, plus (5) the WorkflowBuilder deferral note and (6) the settings-switch exception.

**Content to cite verbatim/near-verbatim (source of truth, not to be reworded away from accuracy):**

`apps/workspaces/src/lib/workspaceEngine/types.ts` (lines 1-18) — engine framing, native vs. manifest:
```typescript
// Workspace Engine — the unified, plugin-driven block contract.
//
// One generic engine, instantiated per domain (project pages, mini programs).
// A block "plugin" comes in two flavours:
//   - native   — carries real React components (renderer/editor/settings). This
//                is how today's code-based widgets (recharts, React Query hooks,
//                domain UI) participate without being rewritten as declarative
//                JSON.
//   - manifest — a declarative, sandboxed plugin (the existing Mini Program
//                PluginBlockManifest), rendered by a domain-supplied interpreter.
//
// The engine never hardcodes block kinds: rendering is `registry.render(block)`,
// dispatched via a per-domain keyOf(block) resolver. See ./registry.

export type PluginSource = 'native' | 'manifest';
```

`WorkspaceBlockPlugin<B, Ctx>` contract (types.ts lines 37-59) — the shape every plugin entry conforms to (key, source, group/title/description/icon, `create`, then native-only `renderer`/`editor`/`settings` vs. manifest-only `manifest`).

`apps/workspaces/src/lib/workspaceEngine/registry.tsx` (lines 16-51) — the generic `WorkspaceBlockRegistry<B, Ctx>` class: `get`/`list`/`keys`/`render`/`renderEditor`, and the `keyOf` + optional `renderManifest` constructor params that let one generic class serve two different domains.

`apps/workspaces/src/lib/projectPage/registry.tsx` (lines 91, 161-164) — the `keyOf` seam for pages (keys purely by `block.kind`) plus the exhaustiveness proof:
```typescript
const entries: Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>> = {
  // ... one entry per PageBlockKind — TypeScript fails `tsc --noEmit` if any
  // union member is missing an entry (ENG-03 compile-time safety net).
};

export const pageBlockRegistry = new WorkspaceBlockRegistry<PageBlock, PageCtx>(
  entries,
  (block) => block.kind,
);
```

`apps/workspaces/src/lib/miniProgram/registry.tsx` (lines 1-11, 46-69) — the contrasting `keyOf` seam for mini programs (native blocks key by `kind`; `plugin` blocks key by `pluginId` and fall through to `renderManifest` → `DynamicBlockView`):
```typescript
// keyOf: native blocks key by `kind`; a `plugin` block keys by its `pluginId`,
// which is not a static entry, so it falls through to renderManifest →
// DynamicBlockView (which resolves the manifest via getPlugin).

export const miniProgramBlockRegistry = new WorkspaceBlockRegistry<Block, MiniProgramCtx>(
  entries,
  (block) => (block.kind === 'plugin' ? (block as PluginBlockInstance).pluginId : block.kind),
  (block) => <DynamicBlockView block={block as PluginBlockInstance} />,
);
```

`apps/workspaces/src/lib/workspaceEngine/palette.ts` (lines 1-9, 23-37) — `buildPaletteItems`, cite as the shared derivation that keeps both domains' insert-menus in sync automatically once a registry entry exists (this is what replaced hand-maintained palette lists in `slashMenu.ts` and the mini-program "Add block" menu).

**Package-promotion path (DOC-02, brief paragraph per CONTEXT.md discretion note):** cite `packages/{ui,auth,api-client,types,data,config}` as the existing precedent — an app-local module graduating out of `apps/workspaces/src/lib/...` into a shared `@vectra/*` package once reused across `apps/marketplace`/`apps/cmr`. No code excerpt needed; a paragraph reference is sufficient per CONTEXT.md.

**Settings-switch exception (D-01, must be stated as permanent, not a TODO):**
```
apps/workspaces/src/components/miniProgram/BlockSettings.tsx:27:  switch (block.kind) {
apps/workspaces/src/components/projectPage/PageBlockSettings.tsx:16:  switch (block.kind) {
```
Confirmed via repo-wide search — these are the only two remaining `switch (block.kind)` statements in `apps/workspaces/src`. Both are per-kind settings-form switches (not render/edit dispatch), explicitly out of scope for removal per D-01.

**WorkflowBuilder deferral section (D-04):** reference-only excerpt from `apps/workspaces/src/components/automations/WorkflowBuilder.tsx` (lines 20-31) to justify the "demo-only, hardcoded, no registry" characterization — do not modify the source file itself:
```typescript
export type NodeType = 'trigger' | 'condition' | 'action';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  icon: any; // Lucide icon reference
  iconColor: string;
  iconBg: string;
  config?: any;
}

const initialNodes: WorkflowNode[] = [ /* hardcoded, no persistence */ ];
```
Cite `.planning/PROJECT.md` lines 126-134 ("The Five Engines") for the Automation Engine framing — Engine #3, "no-code graphical Workflow Builder," is the eventual home this file's `WorkflowNode.type` union would migrate onto as `WorkspaceBlockPlugin` kinds on a new `WorkspaceBlockRegistry`, following the same native/manifest split proven in `pageBlockRegistry`/`miniProgramBlockRegistry`.

---

### Dead-code sweep files (verification-first, D-02)

**Analog:** each file's own current (post Phase 7-12) state — this is a re-verification sweep, not new-pattern construction.

Verified via `grep -rn "switch (block.kind)\|switch(block.kind)" apps/workspaces/src`: zero hits in `PageBlockView.tsx`, `BlockView.tsx`, `LivePageCanvas.tsx`, `registry.tsx` (either domain), or `slashMenu.ts`. Only the two settings-panel files (out of scope) still contain the pattern. This confirms DOC-01's success criterion is already met; the sweep task is to open each of the 6 files and check for orphaned imports / unused helpers left over from the pre-registry switch era, not to re-implement dispatch.

No concrete "copy this pattern" excerpt applies here — this is inspection, not construction. If dead code is found, removal should follow whatever local style already exists in that file (no new pattern introduced).

## Shared Patterns

### Registry exhaustiveness (cite in ADR as the safety net)
**Source:** `apps/workspaces/src/lib/projectPage/registry.tsx` line 91, `apps/workspaces/src/lib/miniProgram/registry.tsx` line 48
**Apply to:** ADR's engine-contract section — explain that `Record<Kind, WorkspaceBlockPlugin<...>>` typing is what makes "add one plugin entry, nothing else changes" a compile-time guarantee rather than a convention.

### `keyOf` seam (cite in ADR as the primary architectural nuance)
**Source:** `apps/workspaces/src/lib/projectPage/registry.tsx` line 163 vs. `apps/workspaces/src/lib/miniProgram/registry.tsx` line 67
**Apply to:** ADR's "native-vs-manifest split" section — this is the one place the two registries diverge in shape, and it's the crux of why `WorkspaceBlockRegistry` takes `keyOf` as a constructor parameter rather than hardcoding `block.kind`.

### Docs house style
**Source:** `docs/DEPLOYMENT.md`, `docs/API.md`
**Apply to:** New ADR file — flat `##`-sectioned markdown, terse prose, fenced code for anything structural, no frontmatter/status/consequences ADR boilerplate (none exists elsewhere in this repo to be consistent with).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| New ADR file | docs | n/a | This is the first ADR in the repository — `docs/` has no `adr/` subfolder or ADR-template file to copy structure from. Closest available style analogs (`docs/API.md`, `docs/DEPLOYMENT.md`) are used for tone/formatting only, not for ADR-specific structure (no "Status"/"Decision"/"Consequences" headers exist anywhere in this repo to mirror). Planner should treat CONTEXT.md's required-content list (engine, native/manifest split, keyOf seam, package-promotion path, settings-switch exception, WorkflowBuilder deferral) as the structural outline instead.

## Metadata

**Analog search scope:** `docs/`, `apps/workspaces/src/lib/workspaceEngine/`, `apps/workspaces/src/lib/projectPage/`, `apps/workspaces/src/lib/miniProgram/`, `apps/workspaces/src/components/automations/`, `.planning/PROJECT.md`
**Files scanned:** `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/CONTRIBUTING.md` (listed, not deeply read), `docs/HANDOFF.md` (listed, not deeply read), `apps/workspaces/src/lib/workspaceEngine/{types.ts,registry.tsx,palette.ts,index.ts}`, `apps/workspaces/src/lib/projectPage/registry.tsx`, `apps/workspaces/src/lib/miniProgram/registry.tsx`, `apps/workspaces/src/components/automations/WorkflowBuilder.tsx` (partial, lines 1-40), `.planning/PROJECT.md` (Five Engines section, lines 126-151)
**Repo-wide verification:** `grep -rn "switch (block.kind)"` across `apps/workspaces/src` → 2 hits, both in the explicitly out-of-scope settings-panel files (`BlockSettings.tsx:27`, `PageBlockSettings.tsx:16`); zero hits in render/edit dispatch paths.
**Pattern extraction date:** 2026-07-12
