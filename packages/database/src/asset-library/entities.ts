/**
 * The Asset Library module foundation — persistence-layer shapes for `assets` and
 * `asset_related_records` (migration `00074`, `docs/implementation/module-asset-library.md`,
 * module #15). Organization-wide, not project-scoped — no `project_id` column (D9).
 */

/** Spec §12's "visibility" — a REAL enforcement axis (D2), not a decorative label: a `restricted`
 *  asset has `fileReference`/`consentReference` redacted for any caller lacking the
 *  `view_confidential` action. Same 3-value vocabulary as `ServiceEntity.confidentiality`. */
export type AssetVisibility = "public" | "internal" | "restricted";

/** Spec §12's "scan status". `not_configured` is the default and, today, the ONLY value any code
 *  path in this module ever writes (D4) — the module registry's own seeded confidentiality text is
 *  explicit that files "may show 'Scan Not Configured' — never claimed malware-free," and no
 *  malware scanner exists anywhere in this system. The remaining values exist so a future scanner
 *  integration has a vocabulary to write into; nothing fabricates a result today. */
export type AssetScanStatus = "not_configured" | "pending" | "clean" | "infected" | "failed";

/** Reused verbatim (byte-for-byte, D5) from Brand Library's/Content Template Library's/Service
 *  Library's/Persona Library's own identical `ArtifactApprovalStatus` union — the accepted,
 *  already-flagged tracked-debt duplication pattern; a shared helper for a further consumer
 *  remains disproportionate for a single-module pass, per every prior module's own identical
 *  reasoning. */
export type AssetApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The primary entity.
 *
 * `fileReference` is a plain nullable URL string (D1) — validated as a safe http(s) URL at the DTO
 * layer only, no database-level constraint. `mimeType`, `fileSizeBytes`, `checksum`,
 * `widthPx`/`heightPx`, and `durationSeconds` are caller-supplied metadata in this pass, NOT
 * values derived from a file this system holds — no Vercel Blob store is provisioned, so no real
 * upload path exists yet (D1). They become server-derived, and should stop being writable, once
 * the upload slice lands.
 */
export interface AssetEntity {
  readonly id: string;
  /** Spec §12's "asset ID" — never regenerated once assigned. */
  readonly publicId: string;
  /** Added beyond spec §12's own field list (D8) — an asset catalogue keyed only by an opaque id
   *  is not usable. */
  readonly title: string;
  readonly description: string | null;
  /** Redacted on a `restricted` asset for callers lacking `view_confidential` (D2). */
  readonly fileReference: string | null;
  readonly mimeType: string | null;
  /** A Postgres BIGINT — Sequelize returns it as a string, not a number, so that is what this
   *  declares. INTEGER would cap at ~2.1GB, which a real media file exceeds. */
  readonly fileSizeBytes: string | null;
  readonly checksum: string | null;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly durationSeconds: number | null;
  readonly licence: string | null;
  /** The roadmap's "ownership" (`Recommended_Module_Roadmap.md:49`). */
  readonly licenceHolder: string | null;
  /** Redacted on a `restricted` asset for callers lacking `view_confidential` (D2) — consent
   *  evidence routinely names real people. */
  readonly consentReference: string | null;
  readonly altTextGuidance: string | null;
  readonly visibility: AssetVisibility;
  /** Plain text, not an FK into `retention_policies` (D7) — nothing anywhere creates a retention
   *  policy, so an FK would be a permanently unusable field. */
  readonly retentionNote: string | null;
  /** Server-managed, never caller input, never set to `clean` by this module (D4). */
  readonly scanStatus: AssetScanStatus;
  readonly approvalStatus: AssetApprovalStatus;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition or publish/unpublish call) — D5. */
  readonly version: number;
  /** Orthogonal to `approvalStatus` (D6) — an asset can be `draft` and unpublished, `approved`
   *  and published, or `approved` and unpublished, but never published while in any non-`approved`
   *  status; `publish()` enforces that gate, not this column itself. */
  readonly isPublished: boolean;
  /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
   *  — never cleared by `unpublish()`, and never re-stamped by a later republish (D6). */
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Spec §12's "related records" (D3) — a real polymorphic reference to a record in any other
 * module, mirroring `ReviewEntity.targetModuleKey`/`targetId`'s own already-reviewed pattern.
 *
 * `moduleKey` is validated against the real module registry at the service layer
 * (`AuthorizationService.isValidModuleKey()`); `recordId` carries NO foreign key, deliberately —
 * the target may live in any of the 43 registered modules, most of which have no table yet.
 */
export interface AssetRelatedRecordEntity {
  readonly id: string;
  readonly assetId: string;
  /** A `module_registry.key` value. */
  readonly moduleKey: string;
  readonly recordId: string;
  readonly note: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
