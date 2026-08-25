/**
 * The Review and Approval Center module foundation — persistence-layer shapes for `reviews`/
 * `review_comments`/`review_decisions` (migration `00066`,
 * `docs/task-packages/module-review-and-approval-center.md`, module #11). A cross-cutting engine
 * that attaches to records owned by OTHER modules (`target_module_key`/`target_id`, no foreign
 * key — task package D1), not a single content-record library of its own. Organization-wide, not
 * project-scoped (D7) — no `project_id` column anywhere in this module.
 */

/** The 4-value workflow (task package D2) — `approved`/`rejected` terminal, `submitted`/
 *  `revision_requested` open. `approve` and `approve_with_notes` are the SAME `status` transition
 *  (`-> approved`); the distinction lives entirely on the recorded decision row's own `action`. */
export type ReviewStatus = "submitted" | "revision_requested" | "approved" | "rejected";

/** The full action vocabulary a `review_decisions` row may record — a strict superset of the 4
 *  approval-shaped `decide()` actions (`approve`/`approve_with_notes`/`request_revision`/
 *  `reject`), plus the 3 process-management actions (`pause`/`resume`/`delegate`) that never
 *  change `status` and are never mirrored into `audit_events` (task package D5). */
export type ReviewDecisionAction =
  | "approve"
  | "approve_with_notes"
  | "request_revision"
  | "reject"
  | "pause"
  | "resume"
  | "delegate";

/** The primary workflow record. */
export interface ReviewEntity {
  readonly id: string;
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly status: ReviewStatus;
  /** Orthogonal to `status` (D2) — advisory only, toggled by `pause`/`resume`, never a blocking
   *  gate on other transitions. */
  readonly isPaused: boolean;
  readonly submittedByUserId: string;
  readonly assignedToUserId: string | null;
  /** Stamped on every `decide()` call — records the MOST RECENT decision, overwritten on each
   *  successive call (unlike a "stamp once" field such as `content_templates.publishedAt`). */
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly versionALabel: string | null;
  readonly versionBLabel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A comment thread entry. `body` is real, server-sanitized HTML from `dashboard-web`'s
 *  `RichTextEditor` (added alongside that module's UI build, 2026-08-24/25, per the 2026-08-22
 *  standing rich-text rule) — see `apps/dashboard-api/src/review-and-approval-center/
 *  review-comments.service.ts#create()`. */
export interface ReviewCommentEntity {
  readonly id: string;
  readonly reviewId: string;
  readonly authorUserId: string;
  readonly body: string;
  readonly createdAt: string;
}

/** An append-only, queryable local action-history row — a review's own history, distinct from the
 *  real, DB-trigger-enforced `audit_events` table, which separately receives a copy of every
 *  genuine approval-shaped decision (task package D5). */
export interface ReviewDecisionEntity {
  readonly id: string;
  readonly reviewId: string;
  readonly action: ReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes: string | null;
  /** Set only when `action === "delegate"`. */
  readonly delegatedToUserId: string | null;
  readonly decidedAt: string;
}
