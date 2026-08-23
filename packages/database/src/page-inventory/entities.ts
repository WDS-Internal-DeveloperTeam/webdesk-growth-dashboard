/**
 * The Page Inventory module foundation — persistence-layer shapes for `pages` and `page_urls`
 * (migration `00058`). `docs/task-packages/module-page-inventory.md` records the full account.
 *
 * Unlike every prior content-library module (Business Knowledge Center, Service/Persona/
 * Proof-and-Claims Library, Website Strategy Center — all organization-wide), `pages` IS
 * project-scoped (`projectId`, task package D2) — a website's pages naturally belong to one
 * specific client project, and `roadmapPhaseId` (D6) only makes sense as a real relationship once
 * scoped to a project's own `roadmap_items`.
 */

export type PageExistingOrProposed = "existing" | "proposed";
export type PageIndexStatus = "index" | "noindex" | "unknown";

/** Reused verbatim from Service/Persona/Proof-and-Claims/Website-Strategy-Center's own identical
 *  `TRANSITIONS`-governed vocabulary (task package D8) — a 5th occurrence of this identical shape,
 *  deliberately not extracted into a shared helper (already-accepted, out-of-scope debt in this
 *  codebase). */
export type PageWorkflowStage =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Named only in `canonical-inputs/Recommended_Module_Roadmap.md` row 7, absent from the spec/
 *  data-model/wireframe/registry description — a nullable, purely descriptive field with no
 *  governance/workflow attached (task package D9). */
export type PageClassification =
  "keep" | "optimize" | "restructure" | "redesign" | "rebuild" | "consolidate";

/**
 * The parent entity. `roadmapPhaseId` is existence-validated against the real `roadmap_items`
 * table, scoped to the same project as the page itself (`PagesService.assertRoadmapPhaseExists()`)
 * — mirroring Persona Library's/Proof and Claims Library's own `assertServiceIdsExist()`-style
 * pattern (task package D6). `template`/`targetKeyword`/`wordpressPageId`/`wordpressPostId` are all
 * plain unvalidated fields — Page Template Library (module #16) and Keyword & Entity Library
 * (module #8) don't exist yet, and no WordPress integration adapter exists yet either (task package
 * D4/D5/D7, D3).
 */
export interface PageEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly pageName: string;
  readonly pageType: string | null;
  readonly existingOrProposed: PageExistingOrProposed;
  readonly indexStatus: PageIndexStatus;
  readonly template: string | null;
  readonly roadmapPhaseId: string | null;
  readonly workflowStage: PageWorkflowStage;
  readonly targetKeyword: string | null;
  readonly designVersion: string | null;
  readonly repositoryFiles: string | null;
  readonly wordpressPageId: string | null;
  readonly wordpressPostId: string | null;
  readonly lastScanAt: string | null;
  readonly lastDeploymentAt: string | null;
  readonly classification: PageClassification | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A real one-to-many child of `PageEntity` — one page can have multiple URLs (locale variants,
 * legacy redirects), each carrying `isCanonical` (task package D10). `projectId` is denormalized
 * from the parent page's own `projectId`, set by the service layer (never accepted from a caller)
 * — this is what lets the acceptance rule ("each URL has one canonical active page record unless
 * an approved redirect or archive relationship exists") be enforced as a real partial unique index
 * (`UNIQUE(project_id, url) WHERE is_canonical = true`) without a cross-table lookup at the
 * database layer.
 */
export interface PageUrlEntity {
  readonly id: string;
  readonly pageId: string;
  readonly projectId: string;
  readonly url: string;
  readonly isCanonical: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
