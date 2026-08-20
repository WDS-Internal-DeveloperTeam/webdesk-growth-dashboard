import type { ProjectObjective, RoadmapItem } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import type { ProjectStatusFilter } from "./projects-query";

/**
 * `projectStatusBadge`/`roadmapItemStatusBadge`/`objectiveStatusBadge` live in their own file with
 * zero non-type imports, rather than in `lib/projects.ts` where they originated, so `"use client"`
 * components (`ProjectRoadmapSection`, `ProjectObjectivesSection`) can import the real functions
 * directly without pulling in `lib/projects.ts`'s `next/headers` import — a value import of
 * anything from that module drags in the whole module, and `next/headers` is
 * Server-Component-only, so Next.js fails the client bundle otherwise. `ProjectStatusFilter` is
 * imported from `./projects-query` (another zero-non-type-import file), not from `lib/projects.ts`
 * itself, so no part of this file's import graph touches `next/headers`, not even at the type
 * level. `lib/projects.ts` re-exports all three so every existing server-side call site is
 * unaffected — same precedent as `lib/format-timestamp.ts`.
 */

const PROJECT_STATUS_BADGE: Readonly<
  Record<ProjectStatusFilter, { token: StatusToken; label: string }>
> = {
  active: { token: "healthy", label: "Active" },
  paused: { token: "degraded", label: "Paused" },
  archived: { token: "unknown", label: "Archived" },
};

/** Maps a project's lifecycle status (D2, `docs/task-packages/module-projects-foundation.md`) onto
 *  the shared design system's semantic status tokens — active/paused/archived are this module's own
 *  vocabulary, not one of `statusTokens`' keys, so this is the one place that translation happens. */
export function projectStatusBadge(status: ProjectStatusFilter): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return PROJECT_STATUS_BADGE[status];
}

const ROADMAP_ITEM_STATUS_BADGE: Readonly<
  Record<RoadmapItem["status"], { token: StatusToken; label: string }>
> = {
  not_started: { token: "unknown", label: "Not started" },
  active: { token: "healthy", label: "Active" },
  complete: { token: "healthy", label: "Complete" },
  skipped: { token: "notConfigured", label: "Skipped" },
};

/** `active`/`complete` share the `healthy` token — both are non-problem states and the label text
 *  (not color alone) disambiguates them, same reasoning `projectStatusBadge` already establishes. */
export function roadmapItemStatusBadge(status: RoadmapItem["status"]): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return ROADMAP_ITEM_STATUS_BADGE[status];
}

const OBJECTIVE_STATUS_BADGE: Readonly<
  Record<ProjectObjective["status"], { token: StatusToken; label: string }>
> = {
  open: { token: "unknown", label: "Open" },
  complete: { token: "healthy", label: "Complete" },
};

export function objectiveStatusBadge(status: ProjectObjective["status"]): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return OBJECTIVE_STATUS_BADGE[status];
}
