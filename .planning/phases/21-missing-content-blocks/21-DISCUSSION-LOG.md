# Phase 21: Missing Content Blocks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 21-Missing Content Blocks
**Areas discussed:** Block nesting (toggle + columns), Media blocks — upload vs URL-only, Inline @mention scope & resolution, Sub-page block & bookmark/embed preview

---

## Block nesting (toggle + columns)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared: children: PageBlock[] | One recursive mechanism for both toggle and columns | |
| Toggle=children, Columns=fixed lanes | Modeled differently, no general recursive layout engine | |
| You decide | Claude picks the simplest approach | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at one level deep (recommended) | No toggle-in-toggle or columns-in-column | ✓ |
| Fully recursive, no cap | Arbitrary depth, matches Notion exactly | |
| You decide | | |

**User's choice:** Cap at one level deep (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Content blocks only (recommended) | Slash menu inside nested context filters to content-group only | ✓ |
| Any block, including widgets | Full parity, may need responsive work later | |
| You decide | | |

**User's choice:** Content blocks only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed choice: 2 or 3 columns | Simple UI, simple data model | |
| Flexible 2–4 columns, add/remove lane | Closer parity, more UI work | |
| You decide | Claude picks simplest option satisfying CONT-07 | ✓ |

**User's choice:** You decide

**Notes:** None.

---

## Media blocks — upload vs URL-only

| Option | Description | Selected |
|--------|-------------|----------|
| Real uploads (reuse FileUploader) | Extend DocumentSubject, reuse packages/data pipe | |
| URL-only (paste a link) | Same simplicity as bookmark/embed, zero new backend work | |
| You decide | Claude picks cheapest while meeting CONT-05 | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| No scraping — styled URL card | Zero new backend work, no SSRF surface | |
| Real link previews (og:image/title scrape) | Closer to Notion, new backend endpoint + SSRF surface | |
| You decide | Claude picks simplest option avoiding new security surface | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Plain <video> tag only | Wraps a direct video URL in <video> | |
| Support YouTube/Vimeo embeds too | Detect platform URLs, iframe embed, fallback to <video> | |
| You decide | Claude picks cheapest to implement | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing limits as-is | Whatever FileUploader already validates applies unchanged | ✓ |
| You decide | | |

**User's choice:** Reuse existing limits as-is

**Notes:** None.

---

## Inline @mention scope & resolution

| Option | Description | Selected |
|--------|-------------|----------|
| All three now (person/page/date) | Full CONT-09 as written | |
| Person-only now, defer page/date | Smaller, faster, doesn't fully satisfy CONT-09 | |
| You decide | Claude picks based on implementation cost after research | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate (person→profile/detail, page→that page, date→nothing) | Matches Notion's clickable-reference feel | ✓ |
| Display-only tag, no click action | Simpler, avoids hover-card/navigation logic | |
| You decide | | |

**User's choice:** Navigate (person→profile/detail, page→that page, date→nothing)

| Option | Description | Selected |
|--------|-------------|----------|
| No notification yet — UI only | Notification wiring is a separate concern | |
| Fire a notification on mention | Reuse existing notification plumbing | |
| You decide | Claude picks based on reuse cost | ✓ |

**User's choice:** You decide

**Notes:** None.

---

## Sub-page block & bookmark/embed preview

> Bookmark/embed preview behavior was resolved under "Media blocks" (bookmark scraping question) — not re-asked here.

| Option | Description | Selected |
|--------|-------------|----------|
| Both — 'New page' or 'Link existing' | Full parity with Notion's sub-page behavior | |
| Create new page only | Simplest, matches Notion's most common flow | ✓ |
| You decide | Claude picks cheapest while covering CONT-08 | |

**User's choice:** Create new page only

| Option | Description | Selected |
|--------|-------------|----------|
| Static title + icon row | Simple, no content preview to keep in sync | ✓ |
| You decide | Claude picks simplest option that still feels like a real inline link | |

**User's choice:** Static title + icon row

**Notes:** None.

---

## Claude's Discretion

- Shared vs. separate nesting mechanism for toggle/columns (D-01)
- Column count UI for the multi-column layout block (D-04)
- Real uploads vs. URL-only for image/file/video blocks (D-05)
- Bookmark/embed link-preview scraping vs. styled URL card (D-06)
- Video block YouTube/Vimeo embed support vs. plain `<video>` tag (D-07)
- Whether to ship all three mention types (person/page/date) now or defer page/date (D-09)
- Whether @mention fires a notification (D-11)

## Deferred Ideas

- Synced blocks (Loop's mirrored-content block) — explicitly higher-effort/later per the spec, not in CONT-01..09.
- Full CRDT/multi-caret co-editing — explicitly out of scope per the spec.
- Link-an-existing-page picker for the sub-page block — deferred by decision (create-only ships this phase).
- @mention notifications, if not implemented under Claude's discretion this phase — natural follow-up.
