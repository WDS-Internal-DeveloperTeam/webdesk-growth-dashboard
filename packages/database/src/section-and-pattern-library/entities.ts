/**
 * The Section and Pattern Library module foundation — persistence-layer shapes for
 * `section_pattern_records` (migration `00080`). Organization-wide, not project-scoped — a catalog
 * of reusable page-section/pattern code artifacts for the **WordPress website** deliverable. See
 * this module's own scope doc (`docs/implementation/module-section-and-pattern-library.md`).
 *
 * File-for-file mirrors `design-token-library/entities.ts` — this module implements the same REAL
 * version history: every version of a record is its own physical row, sharing the same `recordId`
 * (the stable logical-record identity — NOT the same as `id`, which is unique per physical
 * row/version). `publicId` is also stable across every version of the same record. Uniqueness for
 * both `recordId`'s "current version" and `publicId` is enforced via a partial unique index
 * `WHERE is_current = true` (migration `00080`), not a bare column constraint — see that
 * migration's own doc comment for why.
 */

/** The spec's own §15 pattern-type taxonomy, 20 values. Immutable across a record's own version
 *  chain (set once at creation; a real pattern-type change is a different record, not a new
 *  version of this one — enforced server-side, never accepted through `update()`), mirroring
 *  `DesignTokenGroup`'s own immutability discipline. */
export type SectionPatternType =
  | "homepage_storytelling"
  | "service"
  | "industry"
  | "location"
  | "landing_conversion"
  | "portfolio_showcase"
  | "social_proof"
  | "results_metrics"
  | "engagement_models"
  | "team_expertise"
  | "content_hub"
  | "article"
  | "lead_capture"
  | "download"
  | "multi_step_form"
  | "search_filter"
  | "trust"
  | "objection_handling"
  | "cross_sell"
  | "error_no_results";

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Design Token Library's/
 *  Website Strategy Center's/Service Library's/Persona Library's/Proof and Claims Library's own
 *  identical `ApprovalStatus` union (design decision 2) — deliberately not extracted into a shared
 *  type, already-accepted, out-of-scope debt in this codebase. */
export type SectionPatternApprovalStatus =
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
 * version — see `SectionPatternRecordRepository.createNewVersion()`/`updateInPlace()`).
 * `jsDependencies`/`tokenReferences`/`relatedComponentIds` are plain, unvalidated string arrays —
 * no `design_token_library`-version-identity linking or `component_library` module exists yet to
 * link them to for real.
 */
export interface SectionPatternRecordEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly patternType: SectionPatternType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly description: string | null;
  readonly designReference: string | null;
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssReference: string | null;
  readonly jsDependencies: readonly string[];
  readonly responsiveBehavior: string | null;
  readonly accessibilityNotes: string | null;
  readonly browserSupport: string | null;
  readonly tokenReferences: readonly string[];
  readonly relatedComponentIds: readonly string[];
  readonly approvalStatus: SectionPatternApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
