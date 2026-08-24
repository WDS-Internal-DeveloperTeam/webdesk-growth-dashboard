/**
 * The Content Template Library module foundation — persistence-layer shapes for
 * `content_templates` (migration `00064`,
 * `docs/task-packages/module-content-template-library.md`, module #10). A single table, matching
 * Business Knowledge Center's/Persona Library's/Website Strategy Center's own single-table
 * precedent (`04_Data_Model_and_Ownership.md`'s "Business and content libraries" section names
 * one table for this module), not Service Library's normalized multi-table split.
 * Organization-wide, not project-scoped — no `project_id` column, matching Persona Library's own
 * D8-equivalent reasoning (no basis in either the spec or the module registry's seeded data for
 * scoping a content-template catalog to a single client project).
 */

/** Reused verbatim (byte-for-byte, D4) from Service Library's/Persona Library's/Proof and
 *  Claims Library's/Website Strategy Center's own identical `ArtifactApprovalStatus` union — the
 *  accepted, already-flagged tracked-debt duplication pattern; a shared helper for a 5th/6th
 *  consumer remains disproportionate for a single-module pass, per every prior module's own
 *  identical reasoning. */
export type ContentTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The primary entity. `requiredSections`/`optionalSections` are nullable free-text arrays (task
 *  package D7/§3) — guidance labels, not FK references, and genuinely nullable (unlike Persona
 *  Library's own NOT-NULL-default-`[]` array columns) per the task package's own schema section. */
export interface ContentTemplateEntity {
  readonly id: string;
  readonly publicId: string;
  readonly pageType: string;
  readonly purpose: string | null;
  readonly requiredSections: readonly string[] | null;
  readonly optionalSections: readonly string[] | null;
  readonly proofRules: string | null;
  readonly seoAeoGeoRequirements: string | null;
  readonly schema: string | null;
  readonly ctaRules: string | null;
  readonly contentDepthGuidance: string | null;
  readonly approvalStatus: ContentTemplateApprovalStatus;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition or publish/unpublish call) — D5. */
  readonly version: number;
  /** Orthogonal to `approvalStatus` (D2) — a template can be `draft` and unpublished, `approved`
   *  and published, or `approved` and unpublished, but never published while in any
   *  non-`approved` status; `publish()` enforces that gate, not this column itself. */
  readonly isPublished: boolean;
  /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
   *  — never cleared by `unpublish()`, and never re-stamped by a later republish (D2). */
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
