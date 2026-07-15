# app-store.md — Block Plugins & the App Store

Scope: business plan §8 (App Store — tržnica razširitev, 20–30% revenue share)
and §5.5/§6.3's "Block Plugins" concept. The finding here is a clean split:
**the hard part (safe third-party code execution) is already solidly built;
everything around it (a store) doesn't exist at all**, and the codebase's own
comments already know it and name exactly where the gap is.

> Suggested location: `docs/specs/business/app-store.md`.
> Reads with: `program-builder.md` §3 (the `plugin` block kind lives in the
> same registry documented there), `workspace-blocks.md` (the page-block
> system — note in §3 that plugins don't reach it), `cloud-deployment.md` §5
> (Vectra's own subscription billing doesn't exist either — revenue share
> depends on it), `external-systems.md` §5 (the closest existing precedent for
> "let something external touch the platform," and equally half-built).

---

## 1. What's real: a genuinely sophisticated plugin execution model

`apps/workspaces/src/lib/miniProgram/plugins/` is not a stub — it's careful,
real security engineering, worth describing precisely because it's the right
foundation to build on, not something to redo.

### 1.1 Manifest — a constrained, JSON-serialisable contract
`manifest.ts`'s `PluginBlockManifest` deliberately **does not let a plugin
ship React or HTML.** It declares three things instead:
- `settingsSchema` (`FieldSpec[]`) — the builder's config form, from a fixed
  vocabulary (`text | number | boolean | select | textarea | column | code`).
- `uiSchema` (`UiNode[]`) — what renders in the Player, as a constrained tree
  of **fixed Vectra primitives only** (`text, badge, button, input, progress,
  table, list, row, stack`) with `bind`/`{{placeholder}}` references into the
  render context. A plugin cannot introduce a new visual primitive — extending
  that vocabulary is, by design, "a deliberate change to Vectra's own code."
- `logic` — a `transform` (pure dataset processor) or `action` (button-
  triggered) function, plain JS source, executed only in the sandbox (§1.2).

`validateManifest` structurally checks all of this (required fields, known
field/node types, recursive `uiSchema` depth limit) **before** a manifest ever
reaches a renderer or the sandbox — a malformed or malicious-shaped manifest
is rejected at the door, not discovered at runtime.

### 1.2 Sandbox — real isolation, not a trust-the-author assumption
`sandbox.ts` runs plugin `logic.source` in a **fresh Web Worker per
execution**, hardened by explicitly nuking every capability that could
exfiltrate data or escape: `fetch`, `XMLHttpRequest`, `WebSocket`,
`EventSource`, `importScripts`, nested `Worker`/`SharedWorker`,
`BroadcastChannel`, `indexedDB`, `localStorage`/`sessionStorage`, `caches`,
`FileReader`, and more — each name is redefined to `undefined` at every level
of the prototype chain it could be inherited from, specifically to block
`Function`-constructor/scope-chain escape tricks, not just a surface-level
`delete`. Every execution has a hard wall-clock timeout (default 3000ms), the
worker is unconditionally terminated after (success, error, *or* timeout —
never left running), and both directions of data crossing the boundary are
forced through a `JSON.parse(JSON.stringify(...))` round-trip, which strips
functions/DOM references as a second, independent line of defence beyond the
capability denial list.

This is a genuinely defensible sandbox for the threat model it targets
(untrusted transform/action code touching only rows/vars, never DOM/network/
storage) — the right foundation for a real App Store's execution layer.
**Residual risk worth naming explicitly**: the sandbox prevents
exfiltration/escape, but a plugin can still return **wrong or misleading
data** within its allowed scope (e.g. a "customs HS code lookup" plugin that
silently returns incorrect codes) — sandboxing is a security control, not a
correctness or trust guarantee. Any future marketplace listing flow needs a
review/moderation step for exactly this reason, separate from the technical
sandboxing already solved.

---

## 2. What's confirmed missing — and the code already says so

`registry.ts`'s own header comment is unusually direct about this, worth
quoting because it's exactly right and should guide the build order:

> For now this is an **in-memory, process-wide store**. Company-scoped
> persistence (load a company's installed plugins on boot; install/uninstall)
> is **Phase K** — this module is the single seam that change will plug into.

Concretely, today:
- **No persistence at all.** `pluginRegistry` is a plain in-memory `Map`,
  seeded once from `EXAMPLE_PLUGINS` (two trivial demo plugins: "Deduplicate
  rows," "Word count column") on module load. It resets on every page reload
  and isn't scoped to a company — there is no database table, no
  `company_id`-scoped "which plugins does this tenant have installed" concept
  anywhere.
- **No listing/marketplace backend.** Searched `apps/api/src` for anything
  plugin-related — nothing. No catalog endpoint, no publish flow, no
  install/uninstall API, no developer accounts.
- **No billing/revenue-share.** Business plan §8's 20–30% take rate has
  nothing to attach to — Vectra doesn't even have its own subscription
  billing yet (`cloud-deployment.md` §5), so plugin revenue-share is a second
  layer on top of infrastructure that doesn't exist either.
- **Scoped to mini-program blocks only.** The `plugin` block kind lives
  exclusively in `miniProgram/blocks.ts`'s `BlockKind` union
  (`program-builder.md` §3). The **page-block** system
  (`workspace-blocks.md`'s `PageBlockKind`/`PAGE_BLOCK_REGISTRY` — Kanban,
  charts, the Notion-style surface) has **no** plugin kind at all — confirmed
  by search. This matters because business plan §6.3/the Power BI proposal's
  "Custom Visuals Marketplace" (Sankey, Heatmap, etc.) describes exactly the
  **page-block** kind of extensibility, which this system doesn't reach
  today. Don't assume the existing plugin system already covers that vision.

---

## 3. Build order — the seam is already named, follow it

1. **Company-scoped persistence** (the "Phase K" seam `registry.ts` already
   points at): an `installed_plugins` table
   (`company_id, plugin_id, manifest_version, installed_at`), loaded into the
   registry on app boot instead of (or alongside) `EXAMPLE_PLUGINS`. This
   alone turns the existing runtime into something a real company can use
   privately (company-authored or AI-authored plugins, installed and
   persisted) — genuinely useful **before** any public marketplace exists.
2. **A catalog/listing** for published plugins — likely a
   `plugin_listings` table (`published_by_company_id`, manifest, version,
   review status), same shape as `workspace_presets`'
   `is_system_seed`/company-owned distinction already used elsewhere
   (`event-spine.md` §2) for "shared vs. tenant-owned" rows. A moderation/
   review status field addresses §1.2's residual correctness-risk point.
3. **Install/uninstall flow** — company admin browses the catalog, installs a
   listing into their `installed_plugins` (step 1's table). No execution-model
   changes needed; this is purely catalog + persistence work on top of what
   already runs safely.
4. **Extend plugin support to page blocks** (§2's last point) — if the Custom
   Visuals vision is still wanted, this needs its own `uiSchema`-equivalent
   for the page-block rendering surface (likely broader than the mini-program
   `UiNode` set, since page blocks include richer things like charts) rather
   than assuming the existing `UiNode` vocabulary covers it. Scope as a
   deliberate extension, not an afterthought.
5. **Billing/revenue-share** — depends entirely on `cloud-deployment.md` §5's
   currently-nonexistent subscription billing. Sequence after that, not
   before; building revenue-share logic with nothing underneath it to bill
   against isn't useful yet.

Steps 1–3 are meaningfully valuable **without** ever building a public
marketplace — a private, company-scoped plugin library (their own custom
blocks, reliably persisted) is a real feature on its own, and is the natural
first slice given how much of the hard infrastructure (§1) already exists.

---

## 4. Do / Don't

**Do**
- Build on the existing manifest/sandbox model (§1) — it's the right
  foundation, don't redesign the execution/security layer.
- Start with company-scoped persistence (§3 step 1) — the codebase's own
  comment already identifies this as the next seam.
- Add a review/moderation step to any future public listing flow, addressing
  the residual "sandboxed but still wrong" risk (§1.2), not just automated
  validation.
- Treat page-block plugin support (§2's last point) as a separate, deliberate
  extension — don't assume the mini-program plugin system already covers it.

**Don't**
- Don't describe an "App Store" as existing in any form today — the runtime
  is real, the store around it is entirely absent.
- Don't build plugin billing/revenue-share before `cloud-deployment.md` §5's
  subscription billing exists — there's nothing to attach it to yet.
- Don't assume sandboxing alone makes a marketplace-published plugin
  trustworthy — it prevents exfiltration/escape, not incorrect output.
- Don't build a second plugin/sandbox system for page blocks from scratch —
  extend or deliberately parallel the existing manifest/sandbox pattern
  rather than reinventing it.
