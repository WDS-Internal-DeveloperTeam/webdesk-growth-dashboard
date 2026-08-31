/**
 * The Motion and Interaction Library module foundation — persistence-layer shapes for
 * `motion_interaction_records` (migration `00084`). Organization-wide, not project-scoped — a
 * catalog of motion/interaction specs for the **WordPress website** deliverable. See this
 * module's own scope doc (`docs/implementation/module-motion-and-interaction-library.md`).
 *
 * File-for-file mirrors `section-and-pattern-library/entities.ts` — this module implements the
 * same REAL version history: every version of a record is its own physical row, sharing the same
 * `recordId` (the stable logical-record identity — NOT the same as `id`, which is unique per
 * physical row/version). `publicId` is also stable across every version of the same record.
 * Uniqueness for both `recordId`'s "current version" and `publicId` is enforced via a partial
 * unique index `WHERE is_current = true` (migration `00084`), not a bare column constraint — see
 * that migration's own doc comment for why.
 */

/** The spec's own §18 motion/interaction category taxonomy, 26 values. Immutable across a
 *  record's own version chain (set once at creation; a real category change is a different
 *  record, not a new version of this one — enforced server-side, never accepted through
 *  `update()`), mirroring `SectionPatternType`'s own immutability discipline. */
export type MotionInteractionCategory =
  | "page_transition"
  | "focus_state"
  | "active_state"
  | "selected_state"
  | "disabled_state"
  | "form_feedback"
  | "menu"
  | "modal_drawer"
  | "tooltip"
  | "sticky_behavior"
  | "content_reveal"
  | "loader"
  | "progress_indicator"
  | "success_error_state"
  | "notification"
  | "media_control"
  | "filter_search"
  | "pagination"
  | "copy_share"
  | "anchor_scroll"
  | "parallax"
  | "cursor"
  | "dismissal"
  | "screen_reader_announcement"
  | "timing_and_interruption"
  | "analytics_event"
  | "no_js_fallback";

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Section and Pattern
 *  Library's/Page Template Library's/Design Token Library's own identical `ApprovalStatus` union
 *  — deliberately not extracted into a shared type, already-accepted, out-of-scope debt in this
 *  codebase. */
export type MotionInteractionApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION — `id` is unique per row; `recordId` groups every version of the same
 * logical record together (the history/comparison key). `isCurrent` is true for exactly one row
 * per `recordId` at any time (flipped atomically in the same transaction that creates a new
 * version — see `MotionInteractionRecordRepository.createNewVersion()`/`updateInPlace()`).
 * `relatedComponentIds` is a real, existence-validated relationship into Component Library
 * (`ComponentsService.existingComponentIds()`), mirroring Page Template Library's own
 * `supportedComponentIds`.
 */
export interface MotionInteractionRecordEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly category: MotionInteractionCategory;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly description: string | null;
  readonly triggerAndBehavior: string | null;
  readonly timingAndEasing: string | null;
  readonly implementationSpec: string | null;
  readonly accessibilityNotes: string | null;
  readonly fallbackBehavior: string | null;
  readonly designReference: string | null;
  readonly relatedComponentIds: readonly string[];
  readonly approvalStatus: MotionInteractionApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
