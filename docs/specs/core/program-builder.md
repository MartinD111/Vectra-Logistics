# program-builder.md — Mini Programs, the block engine & AI generation

Scope: how a user builds a runnable tool ("mini program") in Vectra — by
drag-and-drop **and** by describing it to the AI — and the rules that keep both
paths producing valid, industry-agnostic programs. This documents the system
**as it exists in the code today** and sets the contract for extending it.

> Suggested location: `docs/specs/core/program-builder.md`.
> Reads with: `event-spine.md`, `workspace-blocks.md`, `ai-integration.md`.

---

## 0. The bar this must clear (reference programs)

Martin hand-built six standalone HTML tools that real dispatch work already
uses. They are the **acceptance target**: the builder must be able to
reconstruct each one from blocks, and the Gemma/AI path must be able to
generate a first draft of the simpler ones from a plain-language description.
They are *not* deliverables and their domain content must never be hardcoded
into platform code — they only define the shape of "a program."

The six, and the generic pattern each proves:

| Reference program | What it does | Generic pattern |
|---|---|---|
| 1TON / Toyota **Announcement Helper** | paste VIN/plate/dest/date + carrier, normalise, verify against an AS400 list, output announce table + e-CMR/ACAR export | paste-input → transform (clean/normalise) → lookup/verify → table → copy/export |
| 1TON **Customs Helper** | map BL/VCP data + HS codes + destinations via editable lookup tables, output customs rows | paste/file-input → lookup (user tables) → transform → table → export |
| Toyota **Damage Report Tool** | paste 1–3 raw blocks, extract VINs + damage lines, dedupe, reorder, output manifest | paste-input → code/transform (extract, group) → table → copy |
| Toyota **Train Loading Manager** | wagon/VIN loading plan, Excel in/out, styled export | file-input → transform → table → styled export |
| Toyota **Vessel DVH Helper** | vessel arrival files → A-CAR list + DIZ processing, history, model-code lookup | file-input → transform → lookup → table → export + saved history |
| Toyota **Announcement Helper (v1.2.2)** | truck/trailer announce from pasted cells | paste-input → transform → table → copy |

**Common DNA across all six** — the builder's vocabulary must cover exactly
this and nothing domain-specific:

1. **Input**: paste from Excel (TSV) or drop an `.xlsx`/`.csv`/`.zip`.
2. **User-editable lookup tables** stored locally (carriers, aliases, HS codes,
   country prefixes, model codes) — the "settings" in every tool. These map to
   `dropdown`/`form`-seeded data or a lookup block, **never** to hardcoded lists.
3. **Transform / clean**: trim, upper-case, strip non-alphanumerics from VINs,
   normalise accents, extract by regex, dedupe, filter garbage rows.
4. **Verify / cross-check** against a reference list, surfacing mismatches.
5. **Output**: results table + one-click **copy to clipboard** (TSV, paste-ready
   for Excel) and/or **export** (xlsx/csv), sometimes a **document/email**.
6. **Local persistence** of settings and history (localStorage-style), theme,
   language.

Everything above already has a home in the block system below. Where a
reference tool does something no block covers yet (e.g. AS400 mismatch modal,
styled Excel), that gap is a **new generic block**, not domain code — see §6.

---

## 1. What already exists (do not rebuild)

The mini-program system is implemented. Before writing new code, read these:

- `apps/workspaces/src/lib/miniProgram/blocks.ts` — the block union, the
  `BLOCK_REGISTRY`, and `MiniProgramConfig` (the saved shape).
- `apps/workspaces/src/lib/programBuilder/types.ts` — `TransformStep`,
  `ColumnDef`, `Row`, `PipelineConfig`.
- `apps/workspaces/src/lib/programBuilder/engine.ts` — `applyStep` /
  `applyPipeline`: the deterministic execution of transform steps.
- `apps/workspaces/src/lib/miniProgram/generator.ts` — the AI
  description→config generator (prompt + safe parser).
- `apps/workspaces/src/lib/miniProgram/templates.ts` — starter programs.
- `apps/workspaces/src/lib/miniProgram/runtime.tsx` — the Player (runs a saved
  config read-to-use).
- Persistence: `programs` table (`004_projects_and_programs.sql`) — the config
  lives in `programs.config` (JSONB); `type` and `status` are generic TEXT.

The extensibility contract is already written at the top of `blocks.ts` and
**must be honoured**:

> Adding a new block kind = (1) add a member to the `Block` union, (2) add a
> renderer + settings panel in `components/miniProgram/blocks`, (3) register
> both in `BLOCK_REGISTRY`. Nothing in the engine/runtime/builder/player needs
> to change. New starter programs are plain `MiniProgramConfig` JSON — zero code.

---

## 2. The model: a program is an ordered list of blocks

A `MiniProgramConfig` (version `2`) is:

```ts
{ version: 2, meta: { title, subtitle?, icon?, accent? }, blocks: Block[] }
```

Data flows **top-to-bottom**: an input block produces a dataset (array of row
objects); processing blocks reshape "the previous block's output"; output blocks
display / export / copy / template the current dataset. A block may override its
input with `dataSource: { blockId }` to read an earlier block instead of the
immediately-previous one (used for lookup/join and reuse) — but linear order is
the default and the preferred shape.

Saved config is stored verbatim in `programs.config`. The same JSON drives both
the **Builder** (edit mode) and the **Player** (run mode) — there is one source
of truth, never a separate compiled artifact.

---

## 3. Block vocabulary (the palette)

Grouped for the palette UI only; the runtime treats all blocks uniformly. This
is the current `BLOCK_REGISTRY` — the full generic vocabulary a program is
built from.

**Inputs** (set the runtime dataset / vars)
- `file-input` — drop xlsx/csv/zip; header auto-detect.
- `paste-input` — paste TSV/CSV rows; `hasHeader`, delimiter `tab|comma|auto`.
- `form` — typed fields → `vars` (single object) or `records` (append list).
- `dropdown` — a pasted list becomes a selector that sets a `varKey`.

**Processing** (read + rewrite the dataset)
- `columns` — choose / rename / type / include columns.
- `transform` — an ordered list of `TransformStep`s (see §4).
- `code` — JS per row (`row` object; mutate to add columns; `return false` to drop).

**Outputs / display**
- `table` — show current data.
- `export` — download xlsx/csv/pdf, or "save to folder" (File System Access API).
- `copy` — copy all (TSV) or one column to clipboard.
- `document` — fill an HTML template with `{{column}}` / `{{var.key}}`;
  `per-row` or `once`; output `eml` / `pdf` / `print`.
- `records` — a list that builds up from form submissions.
- `tsv-output` — current data as paste-ready TSV text.
- `text` — headings / instructions / branding (layout).

**Plugin**
- `plugin` — a block contributed by an installed plugin (App Store / Block
  Plugins). Behaviour and settings come from the plugin manifest. This is how
  specialised visuals and vertical helpers extend the palette **without**
  touching core.

Rule: **new capability = a new block kind (or a plugin block), never a special
case inside an existing block.** Vertical/domain helpers that are broadly useful
become plugin blocks; only truly generic operations become core kinds.

---

## 4. Transform step vocabulary

`transform` blocks are an ordered `TransformStep[]`, executed deterministically
by `engine.ts::applyStep`. Steps operate on **column labels** (post-rename) so
they compose. The current operations:

- `trim` — strip whitespace.
- `case` — `upper | lower | title`.
- `replace` — literal or `regex` find/replace.
- `extract` — regex `pattern` → new column `into`.
- `split` — by `delimiter` → multiple columns `into[]`.
- `concat` — join `columns[]` with `separator` → `into`.
- `computed` — `left op right` (`+ - * /`) → `into`.
- `rename` / `drop` — column ops.
- `filter` — keep rows where `column` matches `equals | not_equals | contains |
  not_empty | gt | lt | regex`.
- `code` — arbitrary JS escape hatch when the above don't fit.

This set already covers the reference programs' cleaning needs (VIN
uppercase+strip = `case:upper` + `replace regex [^A-Z0-9]`; accent-normalise and
dedupe = `code`; garbage-row removal = `filter`). Prefer the typed ops; reach
for `code` only when a typed op can't express it — the typed ops are what the AI
can reliably generate and what the builder shows visually.

When adding an op: extend the `TransformStep` union in `types.ts` **and** add its
`case` in `engine.ts`. Keep ops generic (a "clean VIN" op would be domain-
specific and is disallowed — compose `case` + `replace` instead).

---

## 5. AI generation (the Gemma path)

Implemented in `miniProgram/generator.ts`. The AI does **not** run programs and
does **not** touch data — it only turns a natural-language description into a
**draft** `MiniProgramConfig` that opens in the builder for the user to edit.
This keeps AI strictly a "helper," consistent with the platform's AI philosophy.

How it works, and the invariants to preserve:

1. **The prompt is generated from `BLOCK_REGISTRY`.** `buildBlockCatalogue()`
   emits each kind's `create()` output as the canonical JSON example, so the
   catalogue stays in sync automatically when kinds are added. Do not hand-write
   a second block list for the model — always derive it from the registry.
2. **The model returns JSON only** — `{ meta, blocks: [{ kind, ...fields }] }`,
   no ids (the platform assigns them), no invented kinds/fields.
3. **Output is never trusted.** `parseGeneratedConfig` rebuilds every block from
   its registry defaults and overlays **only recognised fields**, dropping
   hallucinated ones and defaulting missing ones. Unknown kinds are skipped with
   a warning. A malformed response degrades gracefully instead of producing an
   invalid program.
4. **Generated config is a DRAFT** — handed to the builder, never auto-saved or
   auto-run.
5. The completion goes through the company's configured provider
   (`company_ai_config`: OpenAI / Gemini / local Gemma). See `ai-integration.md`.

### Making Gemma reliable on these programs

The reference programs are "relatively simple" by design, and the generator's
architecture is what makes a smaller local model viable. To keep it working:

- **Keep the block catalogue small, flat, and example-driven.** The model
  copies the `create()` example shapes; the more each example looks like the
  desired output, the better a 4B-class model does. Every new kind must ship a
  clean, minimal `create()` default.
- **Favour typed `transform` ops over `code`** in generated programs — they are
  enumerable and the model picks from a closed set. Bias the system prompt to
  reach for `code` only as a last resort.
- **Lean on the safe parser, not the model.** Because `parseGeneratedConfig`
  reconstructs from defaults, the model only has to get *kinds + order + a few
  fields* roughly right; correctness is enforced in code. Do not move validation
  responsibility back onto the prompt.
- **Give few-shot anchors from `templates.ts`.** The three starter templates
  (Data Extractor, Document Generator, Records Manager) are exactly the shapes
  Gemma should imitate; consider including one as an in-context example for
  harder requests.
- **One capability per request.** Encourage "build a paste→clean→copy tool for
  VINs," not "rebuild my entire announcement workflow." Complex reference tools
  (Vessel DVH, Train Loading) are assembled by the user from AI-drafted pieces +
  manual editing, not one-shot generated.

---

## 6. Reproducing the reference tools — gap checklist

Mapping the six tools onto the current vocabulary, the pieces already covered
vs. the generic blocks still needed (each gap is a **new generic block/op**, not
domain code):

Covered today: paste/file input, column selection, the transform ops in §4,
`code` for anything exotic, results table, copy (TSV/column), xlsx/csv export,
document/email templating, form→records, dropdown-from-list, local persistence
of a program's own state.

Likely gaps to add generically (verify against current code before building):

- **Lookup / join block** — map an input column against a user-maintained table
  (carriers↔codes, HS prefixes↔codes, model codes). Today this can be faked with
  `dropdown` + `code`; a first-class generic `lookup` block would make the
  Customs/Announcement tools buildable without code and AI-generatable. High
  value.
- **Verify / reconcile block** — compare the dataset against a reference list and
  surface mismatches (the AS400 check). Generic form: "flag rows where column X
  isn't found in / doesn't match reference set Y."
- **Styled/`xlsx-js-style` export option** — several tools produce formatted
  Excel. Extend `export` with an optional style config rather than a new kind.
- **Saved history** — Vessel/Announcement tools keep a run history. Generic form:
  an opt-in "save each run to records/history" flag, backed by the event spine
  or a records store, not a bespoke table.

Do not add "AS400", "VIN", "HS code", "carrier" as concepts anywhere in these
blocks. They are user data flowing through generic operations.

---

## 7. Persistence & lifecycle

- A program is a row in `programs` (`company_id`, `project_id?`, `name`, `type`,
  `status` draft|published, `config` JSONB, timestamps). `config` holds the
  whole `MiniProgramConfig`.
- Builder saves config; Player reads it. `status` gates draft vs. published.
- On create/publish, the service records `program.created` / `program.published`
  on the event spine (see `event-spine.md`) — keep these emitting.
- `type` stays generic (`transform|document|import|dashboard`); do not add
  vertical types.

---

## 8. Do / Don't

**Do**
- Build every tool as blocks; extend by adding a generic kind or plugin block.
- Keep transform ops typed and generic; derive the AI catalogue from the registry.
- Treat AI output as an untrusted draft rebuilt from registry defaults.
- Store the whole config in `programs.config`; emit spine events on lifecycle.

**Don't**
- Don't hardcode any reference-program domain content (VIN/HS/carrier/AS400) in
  core code — it's user data.
- Don't special-case logic inside an existing block; add a kind/plugin instead.
- Don't let the model's prompt carry correctness — the safe parser does.
- Don't auto-save or auto-run AI-generated programs.
- Don't fork the config shape between Builder and Player.
