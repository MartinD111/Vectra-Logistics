import { z } from 'zod';

// 'page' (project_pages) is intentionally excluded from move/reorder scope
// this phase — per RESEARCH.md Open Question 2 (RESOLVED): page reparenting
// stays on the existing PATCH /projects/pages/:pageId, which has no
// cross-project cycle risk today.
const NodeType = z.enum(['folder', 'project', 'program', 'data_collection']);

export const ReorderNodesSchema = z.object({
  node_type: NodeType,
  parent_id: z.string().uuid().nullable(),
  // Scope disambiguator for node_type: 'program' only. `programs` rows carry
  // both folder_id and project_id (a program is filed directly under a
  // folder OR nested under a project, never both), so a single `parent_id`
  // field cannot unambiguously address both scopes.
  //
  // - project_id set (non-null UUID): targets a project-scoped program —
  //   siblings/destination share project_id, folder_id is null.
  // - project_id omitted/null: targets a folder-scoped program (the
  //   default) — siblings/destination share folder_id, project_id is null.
  //   This matches the other three node types, where project_id is unused.
  //
  // Threaded through by the reorder/move dispatch logic built in 32-04/32-05,
  // ensuring project-filed programs are fully reorderable/movable through
  // these endpoints, not just folder-filed ones.
  project_id: z.string().uuid().nullable().optional(),
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export const MoveNodeSchema = z.object({
  node_type: NodeType,
  node_id: z.string().uuid(),
  new_parent_id: z.string().uuid().nullable(),
  // See ReorderNodesSchema.project_id — same program-scope disambiguator.
  project_id: z.string().uuid().nullable().optional(),
});

export type ReorderNodesDto = z.infer<typeof ReorderNodesSchema>;
export type MoveNodeDto = z.infer<typeof MoveNodeSchema>;
