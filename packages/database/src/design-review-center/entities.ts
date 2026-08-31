/**
 * The Design Review Center module foundation — persistence-layer shapes for `design_reviews`/
 * `design_review_decisions` (migration `00089`, `docs/implementation/module-design-review-center.md`,
 * module #21). Mirrors `../review-and-approval-center/entities.ts` file-for-file (design fork D2
 * confirmed with the user: a dedicated table pair rather than extending the already-shipped
 * `reviews` table), adding `reviewType` (D2) and the automatic-supersede mechanism (D4). A
 * cross-cutting engine that attaches to records owned by OTHER modules (`target_module_key`/
 * `target_id`, no foreign key — D9), not a single content-record library of its own.
 * Organization-wide, not project-scoped (D8) — no `project_id` column anywhere in this module.
 */

/** The 9-value review-type vocabulary, taken verbatim from `03_Detailed_Module_Specifications.md
 *  §19` (D2). Immutable after creation — no route ever changes it; a real `reviewType` change is a
 *  different review, not an edit, mirroring `recordType`'s own immutability in every generic-table
 *  module (Business Knowledge Center, Brand Library, etc.). */
export type DesignReviewType =
  | "creative_direction"
  | "ux"
  | "conversion"
  | "ui"
  | "accessibility_by_design"
  | "responsive_behavior"
  | "component_consistency"
  | "motion"
  | "performance_impact";

/** The 5-value workflow (D3) — `approved`/`rejected`/`superseded` are all terminal;
 *  `submitted`/`revision_requested` are open. `approve` and `approve_with_notes` are the SAME
 *  `status` transition (`-> approved`); the distinction lives entirely on the recorded decision
 *  row's own `action`. `superseded` is reached ONLY as the automatic side effect of a different
 *  review (sharing the same `targetModuleKey`/`targetId`/`reviewType`) being approved (D4) — never
 *  as a directly-requested `decide()` action. */
export type DesignReviewStatus =
  "submitted" | "revision_requested" | "approved" | "rejected" | "superseded";

/** The full action vocabulary a `design_review_decisions` row may record — the 4 approval-shaped
 *  `decide()` actions (`approve`/`approve_with_notes`/`request_revision`/`reject`) plus `supersede`,
 *  which is NEVER a directly-requested `decide()` action (D4) — it is written only by the automatic
 *  supersede side effect inside the same transaction as another review's `-> approved` transition.
 *  Unlike Review and Approval Center's `ReviewDecisionAction`, there is no `pause`/`resume`/
 *  `delegate` (D5) — this module has no process-management actions. */
export type DesignReviewDecisionAction =
  "approve" | "approve_with_notes" | "request_revision" | "reject" | "supersede";

/** The primary workflow record. */
export interface DesignReviewEntity {
  readonly id: string;
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly reviewType: DesignReviewType;
  readonly status: DesignReviewStatus;
  readonly submittedByUserId: string;
  readonly assignedToUserId: string | null;
  /** Stamped on every `decide()` call — records the MOST RECENT decision, overwritten on each
   *  successive call (unlike a "stamp once" field such as `content_templates.publishedAt`). Not
   *  stamped by the automatic supersede side effect (D4) — that write is triggered by a DIFFERENT
   *  review's own `decide()` call, not this row's own. */
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly versionALabel: string | null;
  readonly versionBLabel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An append-only, queryable local action-history row — a review's own history, distinct from the
 *  real, DB-trigger-enforced `audit_events` table, which separately receives a copy of every
 *  genuine approval-shaped decision, including the automatic supersede side effect (D7). */
export interface DesignReviewDecisionEntity {
  readonly id: string;
  readonly reviewId: string;
  readonly action: DesignReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes: string | null;
  readonly decidedAt: string;
}
