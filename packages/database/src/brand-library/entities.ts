/**
 * The Brand Library module foundation — persistence-layer shapes for `brand_library_records`
 * (migration `00070`, `docs/implementation/module-brand-library.md`, module #13). A single table,
 * matching Business Knowledge Center's/Persona Library's/Service Library's/Content Template
 * Library's own single-generic-table precedent. Organization-wide, not project-scoped — no
 * `project_id` column (D1).
 */

/** Mirrors Business Knowledge Center's own discriminator-column shape (D1) — one table, 9 real
 *  asset/guidance kinds named by `03_Detailed_Module_Specifications.md §10`. `deprecated` is
 *  modeled as an `approvalStatus` value, not a member here (D3). */
export type BrandLibraryRecordType =
  | "logo"
  | "color"
  | "typography"
  | "photography"
  | "illustration"
  | "icon_rule"
  | "tone"
  | "visual_personality"
  | "dos_dont";

/** Reused verbatim (byte-for-byte, D4) from Content Template Library's/Service Library's/Persona
 *  Library's own identical `ArtifactApprovalStatus` union — the accepted, already-flagged
 *  tracked-debt duplication pattern; a shared helper for a further consumer remains
 *  disproportionate for a single-module pass, per every prior module's own identical reasoning. */
export type BrandLibraryApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The primary entity. `fileReference` is a plain nullable URL string (D2) — validated as a safe
 *  http(s) URL at the DTO layer only, no database-level constraint. */
export interface BrandLibraryRecordEntity {
  readonly id: string;
  readonly publicId: string;
  readonly recordType: BrandLibraryRecordType;
  readonly title: string;
  readonly description: string | null;
  readonly fileReference: string | null;
  readonly usageNotes: string | null;
  readonly approvalStatus: BrandLibraryApprovalStatus;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition or publish/unpublish call) — D6. */
  readonly version: number;
  /** Orthogonal to `approvalStatus` (D5) — a record can be `draft` and unpublished, `approved`
   *  and published, or `approved` and unpublished, but never published while in any non-`approved`
   *  status; `publish()` enforces that gate, not this column itself. */
  readonly isPublished: boolean;
  /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
   *  — never cleared by `unpublish()`, and never re-stamped by a later republish (D5). */
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
