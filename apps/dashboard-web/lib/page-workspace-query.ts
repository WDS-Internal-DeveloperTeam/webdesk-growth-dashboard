import type {
  PageArtifactType,
  PageArtifactVersionStatus,
  PageLifecycleStage,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";

/**
 * Zero-non-type-import module (same split as `page-inventory-query.ts` /
 * `persona-library-query.ts`) so client components can import from it without dragging
 * `next/headers` into the browser bundle.
 *
 * `PageArtifactVersionStatus` is structurally identical to `ArtifactApprovalStatus`, so the
 * label/badge presentation is reused rather than declared a fourth time — Service Library and
 * Persona Library are the other two consumers.
 */
export const VERSION_STATUS_LABEL: Readonly<Record<PageArtifactVersionStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function versionStatusBadge(status: PageArtifactVersionStatus): {
  readonly label: string;
  readonly token: StatusToken;
} {
  return artifactApprovalStatusBadge(status);
}

/**
 * The 16 tabs, in the order `07_Low_Fidelity_Wireframes.md §3` and
 * `03_Detailed_Module_Specifications.md §6` list them. Fifteen map to a stored artifact type;
 * `history` is a derived view over the version list (backend D3), which is why its `artifactType`
 * is null rather than a made-up type.
 */
export interface WorkspaceTab {
  readonly key: string;
  readonly label: string;
  readonly artifactType: PageArtifactType | null;
}

export const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  { key: "overview", label: "Overview", artifactType: "overview" },
  { key: "live-snapshot", label: "Live Snapshot", artifactType: "live_snapshot" },
  { key: "audit", label: "Audit", artifactType: "audit" },
  { key: "ideal-structure", label: "Ideal Structure", artifactType: "ideal_structure" },
  { key: "search", label: "Search", artifactType: "search" },
  { key: "content", label: "Content", artifactType: "content" },
  { key: "creative-direction", label: "Creative Direction", artifactType: "creative_direction" },
  { key: "ux-wireframe", label: "UX / Wireframe", artifactType: "ux_wireframe" },
  { key: "ui-specification", label: "UI Specification", artifactType: "ui_specification" },
  { key: "component-map", label: "Component Map", artifactType: "component_map" },
  { key: "implementation", label: "Implementation", artifactType: "implementation" },
  { key: "code-review", label: "Code Review", artifactType: "code_review" },
  { key: "security", label: "Security", artifactType: "security" },
  { key: "qa", label: "QA", artifactType: "qa" },
  { key: "deployment", label: "Deployment", artifactType: "deployment" },
  { key: "history", label: "History", artifactType: null },
];

export const DEFAULT_TAB_KEY = WORKSPACE_TABS[0]!.key;

export function findTab(key: string | undefined): WorkspaceTab {
  return WORKSPACE_TABS.find((tab) => tab.key === key) ?? WORKSPACE_TABS[0]!;
}

/**
 * The 16 main-path lifecycle stages, in order (`05_Workflow_State_Machines.md §3`). The stepper
 * renders this track; the six alternative states below are deliberately NOT on it — they are
 * genuinely off-path, and drawing them inline would misrepresent the state machine (task package
 * D6).
 */
export const LIFECYCLE_MAIN_PATH: readonly PageLifecycleStage[] = [
  "proposed",
  "approved_for_planning",
  "in_strategy",
  "search_approved",
  "content_approved",
  "design_approved",
  "ready_for_development",
  "in_development",
  "code_review",
  "security_qa",
  "ready_for_staging",
  "staging_deployed",
  "staging_approved",
  "production_approved",
  "production_deployed",
  "verified",
];

export const LIFECYCLE_STAGE_LABEL: Readonly<Record<PageLifecycleStage, string>> = {
  proposed: "Proposed",
  approved_for_planning: "Approved for planning",
  in_strategy: "In strategy",
  search_approved: "Search approved",
  content_approved: "Content approved",
  design_approved: "Design approved",
  ready_for_development: "Ready for development",
  in_development: "In development",
  code_review: "Code review",
  security_qa: "Security / QA",
  ready_for_staging: "Ready for staging",
  staging_deployed: "Staging deployed",
  staging_approved: "Staging approved",
  production_approved: "Production approved",
  production_deployed: "Production deployed",
  verified: "Verified",
  revision_requested: "Revision requested",
  blocked: "Blocked",
  paused: "Paused",
  failed: "Failed",
  rolled_back: "Rolled back",
  archived: "Archived",
};

/** The stages that require a reason, mirroring `changeLifecycleStageSchema`'s own refinement. */
export const LIFECYCLE_REASON_REQUIRED: readonly PageLifecycleStage[] = [
  "revision_requested",
  "blocked",
  "failed",
  "rolled_back",
];

export function isOffPathStage(stage: PageLifecycleStage): boolean {
  return !LIFECYCLE_MAIN_PATH.includes(stage);
}

export function lifecycleStageBadge(stage: PageLifecycleStage): {
  readonly label: string;
  readonly token: StatusToken;
} {
  // StatusToken is healthy | degraded | unavailable | unknown — the same four
  // `artifactApprovalStatusBadge()` maps onto, so the two badge vocabularies stay consistent.
  const label = LIFECYCLE_STAGE_LABEL[stage];
  if (stage === "verified") return { label, token: "healthy" };
  if (stage === "failed" || stage === "blocked" || stage === "archived") {
    return { label, token: "unavailable" };
  }
  if (stage === "revision_requested" || stage === "rolled_back" || stage === "paused") {
    return { label, token: "degraded" };
  }
  // Every remaining stage is a normal in-progress point on the main path.
  return { label, token: "unknown" };
}

/**
 * Client-side mirrors of the backend's own transition tables, used only to decide which controls
 * to OFFER. The backend re-validates every transition and is the sole authority; if these ever
 * drift, the worst outcome is a control that returns 400, never an unauthorized transition.
 *
 * This is the 6th hand-copy of this shape across the codebase (Projects, Business Knowledge
 * Center, Service Library, Persona Library, Proof and Claims Library, and now here). Sibling
 * modules have each recorded it as accepted, tracked debt; the same disposition applies, and the
 * real fix remains a backend response that returns the legal next transitions.
 */
export const VERSION_TRANSITIONS: Readonly<
  Record<PageArtifactVersionStatus, readonly PageArtifactVersionStatus[]>
> = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "draft", "archived"],
  under_review: ["approved", "revision_requested", "rejected", "archived"],
  revision_requested: ["draft", "submitted", "archived"],
  approved: ["superseded", "archived"],
  rejected: ["draft", "archived"],
  superseded: [],
  archived: [],
};

/** Mirrors `changeVersionStatusSchema`'s refinement. */
export const VERSION_REASON_REQUIRED: readonly PageArtifactVersionStatus[] = [
  "rejected",
  "revision_requested",
];

/** Only an approved or archived version can be reopened (backend `REOPENABLE_STATUSES`). */
export const REOPENABLE_STATUSES: readonly PageArtifactVersionStatus[] = ["approved", "archived"];

/**
 * Exported so `PageLifecycleActions` can tell whether the stage it's *leaving* was itself an
 * interrupt (needed to compute `lifecyclePreviousStage` locally, matching the backend's
 * `nextPreviousStage()`: an interrupt-to-interrupt move carries the ORIGINAL resume point forward
 * rather than overwriting it — code-review finding, `dashboard-web-page-workspace`).
 */
export const INTERRUPT_STAGES: readonly PageLifecycleStage[] = [
  "revision_requested",
  "blocked",
  "paused",
  "failed",
  "rolled_back",
];

const INTERRUPT_TARGETS: readonly PageLifecycleStage[] = [
  "revision_requested",
  "blocked",
  "paused",
  "failed",
  "archived",
];

/**
 * Which lifecycle stages the page may move to next. Mirrors the backend's `LIFECYCLE_TRANSITIONS`
 * plus its dynamic resume edge.
 *
 * Leaving an interrupt stage offers the resume edge (back to `lifecyclePreviousStage`, if any)
 * PLUS every other interrupt target the backend's own `RESUME_OR_ARCHIVE` table allows directly —
 * a paused page really can become blocked in one step, per that table's own doc comment. An
 * earlier version of this function only offered `[previousStage, "archived"]`, under-restricting
 * nothing (the backend re-validates regardless) but under-*offering* a real, backend-supported
 * transition (code-review finding, `dashboard-web-page-workspace`) — the resume-only restriction a
 * sibling test comment argues for applies to the RESUME edge itself (which must go back to
 * `previousStage`, never an arbitrary main-path stage), not to the separate interrupt-to-interrupt
 * edges, which the backend allows unconditionally.
 */
export function allowedLifecycleTargets(
  stage: PageLifecycleStage,
  previousStage: PageLifecycleStage | null,
): readonly PageLifecycleStage[] {
  if (stage === "archived") return [];
  if (INTERRUPT_STAGES.includes(stage)) {
    const lateral = INTERRUPT_TARGETS.filter((target) => target !== stage);
    return previousStage ? [previousStage, ...lateral] : lateral;
  }
  if (stage === "verified") return ["archived"];

  const index = LIFECYCLE_MAIN_PATH.indexOf(stage);
  const next = index >= 0 ? LIFECYCLE_MAIN_PATH[index + 1] : undefined;
  const extra: PageLifecycleStage[] =
    stage === "staging_deployed" || stage === "production_deployed" ? ["rolled_back"] : [];
  return [...(next ? [next] : []), ...INTERRUPT_TARGETS, ...extra];
}

export function buildWorkspaceHref(pageId: string, projectId: string, tabKey: string): string {
  const params = new URLSearchParams({ projectId, tab: tabKey });
  return `/page-workspace/${pageId}?${params.toString()}`;
}

/**
 * The `dashboard-api` path shared by every Page Workspace route (artifacts and lifecycle alike) —
 * one place instead of three independently hardcoded copies (`lib/page-workspace.ts`'s own
 * `workspaceBase()`, plus each client component's mutation URLs), so a route-segment rename needs
 * one edit, not three kept in sync by hand (code-review finding, `dashboard-web-page-workspace`).
 * Callers still prefix it with `getApiBaseUrl()` themselves — this file stays free of that
 * server/client-conditional import.
 */
export function workspaceApiPath(projectId: string, pageId: string): string {
  return `/page-workspace/projects/${projectId}/pages/${pageId}`;
}
