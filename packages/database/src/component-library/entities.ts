/**
 * The Component Library module foundation — persistence-layer shapes for `components` (migration
 * `00078`). Organization-wide, not project-scoped — a catalog of reusable UI component records for
 * the **WordPress website** deliverable — see this module's own scope doc
 * (`docs/implementation/module-component-library.md`).
 *
 * File-for-file mirrors `design-token-library/entities.ts` — this module implements the same REAL
 * version history (design decision 1): every version of a record is its own physical row, sharing
 * the same `recordId` (the stable logical-record identity — NOT the same as `id`, which is unique
 * per physical row/version). `publicId` is also stable across every version of the same record.
 * Uniqueness for both `recordId`'s "current version" and `publicId` is enforced via a partial
 * unique index `WHERE is_current = true` (migration `00078`), not a bare column constraint — see
 * that migration's own doc comment for why.
 */

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Design Token Library's/
 *  Website Strategy Center's/Service Library's/Persona Library's/Proof and Claims Library's own
 *  identical `ApprovalStatus` union — deliberately not extracted into a shared type, already-
 *  accepted, out-of-scope debt in this codebase. */
export type ComponentApprovalStatus =
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
 * logical component record together (the history/comparison key). `isCurrent` is true for exactly
 * one row per `recordId` at any time (flipped atomically in the same transaction that creates a
 * new version — see `ComponentRepository.createNewVersion()`/`updateInPlace()`).
 * `tokenIds` is a real, existence-validated relationship into Design Token Library's own
 * `recordId`s (design decision 2) — validated at the service layer, not a DB-level FK.
 * `replacementRecordId` is a nullable self-referential `recordId` into this same table — checked
 * for existence at the service layer, and deliberately NOT immutable across a record's own version
 * chain (unlike `category`).
 */
export interface ComponentEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly category: string;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly figmaReference: string | null;
  readonly tokenIds: readonly string[];
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssClassesPath: string | null;
  readonly jsDependencies: string | null;
  readonly states: string | null;
  readonly responsiveBehavior: string | null;
  readonly browserSupport: string | null;
  readonly accessibility: string | null;
  readonly schema: string | null;
  readonly analytics: string | null;
  readonly tests: string | null;
  readonly replacementRecordId: string | null;
  readonly approvalStatus: ComponentApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
