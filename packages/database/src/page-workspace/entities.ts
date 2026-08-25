/**
 * The Page Workspace module foundation — persistence-layer shapes for `page_artifacts` and
 * `page_artifact_versions` (migration `00068`). `docs/task-packages/module-page-workspace.md`
 * records the full account.
 *
 * Unlike every prior module, this one is built against genuinely sourced spec material:
 * `03_Detailed_Module_Specifications.md §6`, `05_Workflow_State_Machines.md §1/§2/§3/§12`, and
 * `04_Data_Model_and_Ownership.md §5`/§12.
 *
 * Project-scoped (task package D11), inherited from the parent page — the second module after
 * Page Inventory to carry `projectId`, and for the same reason.
 */

/**
 * The 15 real artifact types (task package D3). `03_Detailed_Module_Specifications.md §6` names
 * 16 tabs, but "History" is a derived read-only view over `PageArtifactVersionEntity` itself —
 * an artifact whose content is "the version history" is incoherent, so it is deliberately not a
 * stored type. Each maps to its own RBAC permission group (D2) — see
 * `apps/dashboard-api/src/page-workspace/page-workspace.constants.ts`.
 */
export const PAGE_ARTIFACT_TYPES = [
  "overview",
  "live_snapshot",
  "audit",
  "ideal_structure",
  "search",
  "content",
  "creative_direction",
  "ux_wireframe",
  "ui_specification",
  "component_map",
  "implementation",
  "code_review",
  "security",
  "qa",
  "deployment",
] as const;

export type PageArtifactType = (typeof PAGE_ARTIFACT_TYPES)[number];

/**
 * The shared 8-value generic artifact lifecycle from `05_Workflow_State_Machines.md §2`, reused
 * verbatim (task package D6) — a 6th occurrence of this identical vocabulary in this codebase,
 * deliberately not extracted into a shared helper, matching every prior module's own recorded
 * disposition on this exact point.
 */
export const PAGE_ARTIFACT_VERSION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
] as const;

export type PageArtifactVersionStatus = (typeof PAGE_ARTIFACT_VERSION_STATUSES)[number];

/**
 * The page delivery lifecycle from `05_Workflow_State_Machines.md §3` — 16 main-path states plus
 * 6 alternative states (task package D5). Distinct from `PageWorkflowStage`, which Page Inventory
 * already owns: that governs the page RECORD's own approval, this governs the page's DELIVERY
 * progress through strategy, content, design, development, QA, and production.
 */
export const PAGE_LIFECYCLE_STAGES = [
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
  "revision_requested",
  "blocked",
  "paused",
  "failed",
  "rolled_back",
  "archived",
] as const;

export type PageLifecycleStage = (typeof PAGE_LIFECYCLE_STAGES)[number];

/**
 * The stable logical identity for one tab's artifact on one page. One row per
 * `(pageId, artifactType)`, enforced by a real database unique index — the data model's own
 * "artifact type + page" identity. `currentVersionId` carries no foreign key, deliberately: a
 * real one would be circular against `PageArtifactVersionEntity.artifactId`.
 */
export interface PageArtifactEntity {
  readonly id: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly artifactType: PageArtifactType;
  readonly currentVersionId: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * One immutable-once-approved version of an artifact. `04_Data_Model_and_Ownership.md §5`:
 * "Approved artifacts are immutable. Editing an approved artifact creates a new draft version."
 * Enforced by `PageArtifactsService` — an in-place `update()` against a terminal-status version is
 * rejected, and `reopen()` forks version N+1 as a `draft` while marking N `superseded`, recording
 * `reopenedReason` (mandatory, per `05_Workflow_State_Machines.md §1`) and
 * `reopenedFromVersionId`.
 *
 * `pageId`/`projectId` are denormalized from the parent artifact (task package D11), set only by
 * the service layer — never accepted from a caller — so every scoped read and write is a real
 * single-table WHERE clause rather than a cross-table lookup.
 *
 * The five Git-provenance fields are required by `04_Data_Model_and_Ownership.md §5` ("repository,
 * path, branch, commit SHA, and content checksum") and §12 ("Git commit SHA where applicable"),
 * but are caller-supplied and unvalidated for now (task package D9) — no GitHub integration
 * adapter exists yet to populate them, the same deferred-integration shape
 * `PageEntity.wordpressPageId` already uses.
 */
export interface PageArtifactVersionEntity {
  readonly id: string;
  readonly artifactId: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly versionNumber: number;
  readonly status: PageArtifactVersionStatus;
  /** Real, server-sanitized HTML (task package D10, the 2026-08-22 standing rich-text rule). */
  readonly content: string | null;
  readonly notes: string | null;
  readonly repository: string | null;
  readonly path: string | null;
  readonly branch: string | null;
  readonly commitSha: string | null;
  readonly contentChecksum: string | null;
  readonly reopenedReason: string | null;
  readonly reopenedFromVersionId: string | null;
  /** `05_Workflow_State_Machines.md §12`'s approval record, bound to this exact version. */
  readonly approvedByUserId: string | null;
  readonly approvedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
