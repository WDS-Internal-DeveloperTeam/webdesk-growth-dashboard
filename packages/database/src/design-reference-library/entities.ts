/**
 * The Design Reference Library module foundation — persistence-layer shapes for
 * `design_reference_records` (migration `00072`,
 * `docs/implementation/module-design-reference-library.md`, module #14). A single table, matching
 * Brand Library's/Content Template Library's/Persona Library's/Service Library's own
 * single-generic-table precedent. Organization-wide, not project-scoped — no `project_id` column.
 */

/** Reused verbatim (byte-for-byte, D7) from Brand Library's/Content Template Library's/Persona
 *  Library's/Service Library's own identical `ArtifactApprovalStatus` union — the accepted,
 *  already-flagged tracked-debt duplication pattern; a shared helper for a further consumer
 *  remains disproportionate for a single-module pass, per every prior module's own identical
 *  reasoning. */
export type DesignReferenceApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The primary entity. No `recordType` discriminator (D1) — every record is the same shape (one
 *  external design reference). `sourceUrl`/`screenshotUrl` are plain nullable URL strings (D2) —
 *  validated as safe http(s) URLs at the DTO layer only, no database-level constraint.
 *  `likes`/`dislikes`/`motionNotes`/`accessibilityConcerns`/`performanceConcerns` are free-text
 *  rich-text rationale (D3) — sanitized at write time and render time, mirroring Brand Library's
 *  own `description`/`usageNotes` precedent. `pageSectionType` (D4), `desktopBehavior`, and
 *  `mobileBehavior` (D5) are plain text, not rich text. `tags` is a plain unvalidated string
 *  array (D6) — non-nullable, defaulting to an empty array, mirroring
 *  `PersonaEntity.roles`'s/`ServiceEntity.icpIds`'s own identical shape. */
export interface DesignReferenceRecordEntity {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly sourceUrl: string | null;
  readonly screenshotUrl: string | null;
  readonly pageSectionType: string | null;
  readonly likes: string | null;
  readonly dislikes: string | null;
  readonly desktopBehavior: string | null;
  readonly mobileBehavior: string | null;
  readonly motionNotes: string | null;
  readonly accessibilityConcerns: string | null;
  readonly performanceConcerns: string | null;
  readonly tags: readonly string[];
  readonly approvalStatus: DesignReferenceApprovalStatus;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition or publish/unpublish call) — D9. */
  readonly version: number;
  /** Orthogonal to `approvalStatus` (D8) — a record can be `draft` and unpublished, `approved`
   *  and published, or `approved` and unpublished, but never published while in any non-`approved`
   *  status; `publish()` enforces that gate, not this column itself. */
  readonly isPublished: boolean;
  /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
   *  — never cleared by `unpublish()`, and never re-stamped by a later republish (D8). */
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
