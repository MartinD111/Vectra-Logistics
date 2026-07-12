# Workspace Engine Architecture

This document describes the Workspace Engine — the generic, plugin-driven block
registry that powers both Project Pages and Mini Programs — as it stands after
the v2.0 Engine Unification milestone (Phases 7-12). It replaces the hand-maintained
`switch (block.kind)` dispatch that used to live in the render and edit paths of
both domains with a single generic registry, instantiated once per domain.

## Engine Contract

The engine is defined by two pieces in `apps/workspaces/src/lib/workspaceEngine/`:
a plugin shape (`WorkspaceBlockPlugin<B, Ctx>`) and a generic registry class
(`WorkspaceBlockRegistry<B, Ctx>`) that operates on collections of that shape.

```typescript
export type PluginSource = 'native' | 'manifest';

export interface WorkspaceBlockPlugin<B, Ctx> {
  key: string;
  source: PluginSource;
  group: string;
  title: string;
  description: string;
  icon: string;
  available?: boolean;
  create: () => B;

  // native (code) plugins
  renderer?: ComponentType<BlockRenderProps<B, Ctx>>;
  editor?: ComponentType<BlockEditProps<B, Ctx>>;
  settings?: ComponentType<BlockSettingsProps<B, Ctx>>;

  // manifest (declarative, sandboxed) plugins
  manifest?: PluginBlockManifest;
}
```

```typescript
export class WorkspaceBlockRegistry<B, Ctx> {
  constructor(
    private readonly entries: Record<string, WorkspaceBlockPlugin<B, Ctx>>,
    private readonly keyOf: (block: B) => string,
    private readonly renderManifest?: (block: B, ctx: Ctx) => ReactNode,
  ) {}

  get(block: B): WorkspaceBlockPlugin<B, Ctx> | undefined { /* ... */ }
  list(): WorkspaceBlockPlugin<B, Ctx>[] { /* ... */ }
  keys(): string[] { /* ... */ }
  render(block: B, ctx: Ctx): ReactNode { /* ... */ }
  renderEditor(block: B, ctx: Ctx, onUpdate: (block: B) => void): ReactNode { /* ... */ }
}
```

`registry.render(block, ctx)` replaces the old hand-maintained per-kind switch:
callers no longer branch on `block.kind` themselves — they hand the block and a
context object to the registry and let it look up the matching plugin.

Each domain instantiates its own registry over its own block union, so there is
one `WorkspaceBlockRegistry` for project pages and a separate one for mini
programs — same generic class, different `B`/`Ctx` type parameters and a
different `entries` map.

The page registry types its `entries` map as `Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>>`
(see `apps/workspaces/src/lib/projectPage/registry.tsx`). Because this is an
explicit `Record` over the full `PageBlockKind` union rather than a loosely
typed object, adding a new member to the `PageBlockKind` union without adding a
corresponding entry fails `tsc --noEmit` immediately — the compiler enforces
exhaustiveness. This is the mechanism that makes "add one plugin entry, nothing
else changes" a compile-time guarantee rather than a code-review convention.
The mini-program registry (`apps/workspaces/src/lib/miniProgram/registry.tsx`)
uses the same `Record<Exclude<BlockKind, 'plugin'>, ...>` pattern, carved out
to exclude the dynamically-keyed `plugin` kind (see "The keyOf Seam" below).

## Native vs. Manifest Split

`PluginSource` distinguishes two flavors of plugin:

- **`native`** plugins carry real React components via `renderer`, `editor`,
  and optionally `settings`. This is how today's code-based widgets — recharts
  charts, React Query-backed data views, domain-specific UI like
  `FleetTelematicsView` or `KanbanBoardView` — participate in the engine without
  being rewritten as declarative JSON. Every entry in both `pageBlockRegistry`
  and `miniProgramBlockRegistry`'s static `entries` maps is `source: 'native'`.
- **`manifest`** plugins are declarative and sandboxed: a `PluginBlockManifest`
  interpreted by a domain-supplied renderer rather than a registry entry with
  its own `renderer` component. In the mini-program domain this is how
  `plugin`-kind blocks work — resolved not through a static `entries` lookup
  but through the registry's `renderManifest` hook, which mini-program's
  registry wires to `DynamicBlockView`.

Both flavors are served by the same `WorkspaceBlockRegistry` class; the
constructor's optional `renderManifest` parameter is what makes a single
generic engine capable of serving code-first (native) and data-first (manifest)
plugins side by side.

## The keyOf Seam

`WorkspaceBlockRegistry` takes `keyOf: (block: B) => string` as a constructor
parameter instead of hardcoding `block.kind`, because the two domains resolve
keys differently:

Pages key purely by `block.kind` — every page block kind has a static registry
entry, so there is nothing to resolve at runtime beyond the union tag itself:

```typescript
export const pageBlockRegistry = new WorkspaceBlockRegistry<PageBlock, PageCtx>(
  entries,
  (block) => block.kind,
);
```

Mini programs diverge: native blocks still key by `kind`, but a `plugin` block
has no static entry in the `entries` map — its identity lives in `pluginId`, so
the resolver keys those blocks by `pluginId` instead and falls through to
`renderManifest`, which resolves the manifest via `getPlugin`:

```typescript
export const miniProgramBlockRegistry = new WorkspaceBlockRegistry<Block, MiniProgramCtx>(
  entries,
  (block) => (block.kind === 'plugin' ? (block as PluginBlockInstance).pluginId : block.kind),
  (block) => <DynamicBlockView block={block as PluginBlockInstance} />,
);
```

This is the one place the two registry instances genuinely diverge in shape,
and it is exactly why `keyOf` is a constructor parameter rather than a fixed
`block.kind` lookup baked into the class: a single generic implementation would
not otherwise be able to serve a domain with dynamically-keyed plugin blocks
alongside a domain where every key is a static union member.

## Palette Derivation

Both domains need the same thing from a registry when building their
"insert block" UI (the page's slash/insert menu, the mini-program's "Add
block" menu): a flat list of available entries, reduced to the fields a picker
needs (key/group/title/description/icon/create), with `available: false`
entries filtered out. `buildPaletteItems(registry)` in
`apps/workspaces/src/lib/workspaceEngine/palette.ts` is the single shared
derivation for this (Phase 11). `slashMenu.ts`'s `buildSlashMenuItems()` calls
it and layers page-specific variant expansion (Heading 1/2/3, Bulleted/Numbered
list) and keyword lists on top; the mini-program "Add block" menu consumes it
directly. Because both palettes derive from the same registry that
render/edit dispatch also reads, a new registry entry appears in the correct
palette automatically — no palette component needs to be touched when a plugin
is added.

## Package-Promotion Path

The engine and its domain instances currently live entirely under
`apps/workspaces/src/lib/...` — app-local to Workspaces. The repo already has a
precedent for promoting app-local code into a shared package once it needs to
be reused across apps: `packages/{ui,auth,api-client,types,data,config}` all
started as Workspaces-local concerns before graduating to `@vectra/*` packages
consumed by `apps/marketplace` and `apps/cmr` as well. If a future need arises
for the Workspace Engine (or a specific plugin) to be shared outside
Workspaces — for example, a project-page-style canvas inside `apps/cmr` — the
same path applies: move the relevant module out of `apps/workspaces/src/lib/`
into a new or existing `packages/*` package and depend on it as `@vectra/*`
from each consuming app. No such promotion has happened yet; this section
documents the path, not a completed migration.

## Settings-Panel Switch Exception

`apps/workspaces/src/components/miniProgram/BlockSettings.tsx` and
`apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` both retain
`switch (block.kind)` by design. This is a permanent, intentional exception —
not a TODO or a leftover from the pre-registry era. These two switches are
per-kind **settings-form** dispatch (choosing which small config form to show
for the currently-selected block), which is a different concern from the
render/edit dispatch the registry replaced. Folding them onto the registry
would require introducing a new per-plugin `settings` renderer abstraction
(the `WorkspaceBlockPlugin.settings` field already exists in the type but is
unused by either domain's registry today) purely to remove two switches whose
size and complexity don't currently justify that additional abstraction. If a
future phase needs `settings` to be registry-driven for other reasons (e.g. a
manifest-plugin settings form), these two switches are the natural place to
retire — but that is out of scope here.

## Deferred: Automations WorkflowBuilder

`apps/workspaces/src/components/automations/WorkflowBuilder.tsx` is a third,
parallel block/node system alongside Project Pages and Mini Programs — it
renders a drag-and-drop graph of `WorkflowNode`s with its own `NodeType` union:

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

It is explicitly out of scope for the v2.0 Engine Unification milestone. Unlike
Project Pages and Mini Programs, `WorkflowBuilder.tsx` is demo-only today: its
`initialNodes` array is a hardcoded seed with no persistence layer and no
registry integration of any kind. Migrating it onto the Workspace Engine is a
real feature project, not a cleanup — it belongs to its own future milestone,
matching the **Automation Engine** described in `.planning/PROJECT.md`'s "Five
Engines" section (Engine #3): "no-code graphical Workflow Builder... Triggers:
new email, new shipment, status change, date/time, QR scan, new document, OCR
result, new CMR, HTTP request. Actions: Outlook/Gmail send, WhatsApp/SMS, OCR,
PDF parse, HTTP request, in-app notification, approval, delay, conditions,
loops, webhooks, database create/update/delete."

Conceptually, the future migration shape would mirror the split already proven
by `pageBlockRegistry` and `miniProgramBlockRegistry`: `WorkflowNode`'s
`type: 'trigger' | 'condition' | 'action'` union could become the `key`s of
`WorkspaceBlockPlugin` entries on a new, dedicated `WorkspaceBlockRegistry<WorkflowNode, WorkflowCtx>`
instance — trigger/condition/action node types as `native` plugins for
code-defined behaviors (e.g. "new shipment posted"), with a `manifest` path
reserved for user-configured or third-party automation steps, following the
same native/manifest split documented above. This is a sketch of a future
direction, not a commitment to a specific design — the actual migration is
deferred to a future Automation Engine milestone.

`WorkflowBuilder.tsx` received zero code changes during Phase 13 (or any prior
phase of the v2.0 Engine Unification milestone) and remains byte-identical to
its pre-milestone state.
