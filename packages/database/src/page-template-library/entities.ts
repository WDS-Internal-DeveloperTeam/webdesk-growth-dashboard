/**
 * The Page Template Library module foundation — persistence-layer shapes for `page_templates`
 * (migration `00082`). Organization-wide, not project-scoped — a catalog of reusable page
 * architecture records (required/optional sections, supported components, content/search
 * requirements, conversion goal, related PHP template) for the **WordPress website** deliverable.
 * See this module's own scope doc (`docs/implementation/module-page-template-library.md`).
 *
 * File-for-file mirrors `component-library/entities.ts` — this module implements the same REAL
 * version history (design decision D1): every version of a record is its own physical row, sharing
 * the same `recordId` (the stable logical-record identity — NOT the same as `id`, which is unique
 * per physical row/version). `publicId` is also stable across every version of the same record.
 * Uniqueness for both `recordId`'s "current version" and `publicId` is enforced via a partial
 * unique index `WHERE is_current = true` (migration `00082`), not a bare column constraint — see
 * that migration's own doc comment for why.
 */

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Design Token Library's/
 *  Component Library's/Section and Pattern Library's own identical `ApprovalStatus` union —
 *  deliberately not extracted into a shared type, already-accepted, out-of-scope debt in this
 *  codebase. */
export type PageTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The spec's own §16 page-type taxonomy, 17 values (design decision D5) — a genuinely closed,
 *  short set worth an ENUM, unlike Component Library's own 40+-item non-exhaustive `category`.
 *  Immutable across a record's own version chain (set once at creation; a real page-type change is
 *  a different record, not a new version of this one — enforced server-side, never accepted
 *  through `update()`). */
export type PageType =
  | "homepage"
  | "service"
  | "platform"
  | "industry"
  | "location"
  | "case_study"
  | "portfolio"
  | "landing"
  | "article"
  | "about"
  | "contact"
  | "team"
  | "careers"
  | "archive_category"
  | "confirmation"
  | "not_found"
  | "campaign_event";

/**
 * One row per VERSION — `id` is unique per row; `recordId` groups every version of the same
 * logical page-template record together (the history/comparison key). `isCurrent` is true for
 * exactly one row per `recordId` at any time (flipped atomically in the same transaction that
 * creates a new version — see `PageTemplateRepository.createNewVersion()`/`updateInPlace()`).
 * `requiredSectionIds`/`optionalSectionIds` are real, existence-validated relationships into
 * Section and Pattern Library's own `recordId`s (design decision D2). `supportedComponentIds` is a
 * real, existence-validated relationship into Component Library's own `recordId`s (design decision
 * D3). All three are validated at the service layer, not a DB-level FK (an array column can't
 * carry a standard FK constraint). `wireframeReferences` is a plain, UNVALIDATED string array
 * (design decision D4) — `wireframe_library` doesn't exist yet, and it and this module are a real
 * co-dependent cycle in the seeded module registry. `replacementRecordId` is a nullable
 * self-referential `recordId` into this same table — checked for existence at the service layer,
 * and deliberately NOT immutable across a record's own version chain (unlike `pageType`).
 */
export interface PageTemplateEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly pageType: PageType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly requiredSectionIds: readonly string[];
  readonly optionalSectionIds: readonly string[];
  readonly supportedComponentIds: readonly string[];
  readonly wireframeReferences: readonly string[];
  readonly contentRequirements: string | null;
  readonly searchRequirements: string | null;
  readonly conversionGoal: string | null;
  readonly phpTemplateRelationship: string | null;
  readonly replacementRecordId: string | null;
  readonly approvalStatus: PageTemplateApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
