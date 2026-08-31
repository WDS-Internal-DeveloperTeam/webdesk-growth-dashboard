/**
 * The Wireframe Library module foundation — persistence-layer shapes for `wireframe_records`
 * (migration `00084`). Organization-wide, not project-scoped — a catalog of page/module wireframes
 * for the **WordPress website** deliverable. Module #16 on the Recommended Module Roadmap. See this
 * module's own scope doc (`docs/implementation/module-wireframe-library.md`).
 *
 * File-for-file mirrors `section-and-pattern-library/entities.ts` — this module implements the same
 * REAL version history: every version of a record is its own physical row, sharing the same
 * `recordId` (the stable logical-record identity — NOT the same as `id`, which is unique per
 * physical row/version). `publicId` is also stable across every version of the same record.
 * Uniqueness for both `recordId`'s "current version" and `publicId` is enforced via a partial
 * unique index `WHERE is_current = true` (migration `00084`), not a bare column constraint — see
 * that migration's own doc comment for why.
 */

/** The spec's own §17 viewport field — 3 values. Not immutable across a record's own version
 *  chain (unlike `pageOrModule`) — a later version may legitimately re-plan the same page/module
 *  wireframe at a different viewport. */
export type WireframeViewport = "mobile" | "tablet" | "desktop";

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Section and Pattern
 *  Library's/Design Token Library's/Website Strategy Center's/Service Library's/Persona Library's/
 *  Proof and Claims Library's own identical `ApprovalStatus` union — deliberately not extracted
 *  into a shared type, already-accepted, out-of-scope debt in this codebase. */
export type WireframeApprovalStatus =
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
 * version — see `WireframeRecordRepository.createNewVersion()`/`updateInPlace()`).
 * `relatedTemplateId` is a plain, unvalidated string — `page_template_library` doesn't exist yet
 * (see the scope doc's real dependency-cycle note).
 */
export interface WireframeRecordEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  /** Immutable across a record's own version chain — set once at version 1, copied forward on
   *  every subsequent version, never accepted through `update()`. */
  readonly pageOrModule: string;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly viewport: WireframeViewport;
  readonly fileReference: string | null;
  readonly annotations: string | null;
  readonly interactionNotes: string | null;
  readonly relatedTemplateId: string | null;
  readonly reviewerUserId: string | null;
  readonly approvalStatus: WireframeApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
