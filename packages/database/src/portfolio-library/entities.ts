/**
 * The Portfolio Library module foundation — persistence-layer shapes for `portfolio_records` and
 * `portfolio_assets` (migration `00095`, module #25). A single flat table (D1), matching Content
 * Template Library's/Brand Library's own single-table precedent, not Business Knowledge Center's
 * `recordType`-discriminated one. Organization-wide, not project-scoped — no `project_id` column.
 * See `docs/implementation/module-portfolio-library.md` for the full D1-D8 design account.
 */

/** Reused verbatim (byte-for-byte, D6) from Persona/Service/Proof and Claims/Website Strategy
 *  Center's/Content Template/Brand Library's own identical `ArtifactApprovalStatus` union — the
 *  accepted, already-flagged tracked-debt duplication pattern; a shared helper for an Nth consumer
 *  remains disproportionate for a single-module pass, per every prior module's own identical
 *  reasoning. */
export type PortfolioApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** Reuses Case Study Studio's own 4-value vocabulary (D4). */
export type PortfolioVisibility =
  "public" | "internal_only" | "confidential" | "client_approval_required";

/** The primary entity. `relatedProofIds` is existence-validated against the real `proof_claims`
 *  table (D3); `url` is validated as a safe http(s) URL at the DTO layer, not a DB constraint (D8).
 *  `additionalCategories`/`tags` are genuinely NOT NULL array columns, defaulting to `[]` (unlike
 *  Content Template Library's own nullable `requiredSections`/`optionalSections`) — mirrors
 *  `services.related_service_ids`'s/`case_studies.related_claim_ids`'s own NOT-NULL-default-`[]`
 *  shape. */
export interface PortfolioRecordEntity {
  readonly id: string;
  readonly publicId: string;
  readonly projectOrClientName: string;
  readonly url: string | null;
  readonly primaryCategory: string | null;
  readonly additionalCategories: readonly string[];
  readonly tags: readonly string[];
  readonly industry: string | null;
  readonly platform: string | null;
  readonly serviceType: string | null;
  /** `DATEONLY` — a plain `YYYY-MM-DD` string, not a `Date` instance (mirrors `embargoDate`'s own
   *  precedent). */
  readonly launchDate: string | null;
  readonly relatedProofIds: readonly string[];
  readonly visibility: PortfolioVisibility;
  readonly approvalStatus: PortfolioApprovalStatus;
  /** Orthogonal to `approvalStatus` (D5) — a record can be `draft` and unpublished, `approved` and
   *  published, or `approved` and unpublished, but never published while in any non-`approved`
   *  status; `publish()` enforces that gate, not this column itself. */
  readonly isPublished: boolean;
  /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
   *  — never cleared by `unpublish()`, and never re-stamped by a later republish (D5). */
  readonly publishedAt: string | null;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition or publish/unpublish call) — D7. */
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** D2 — a real many-to-many join into the real, already-live `assets` table. `assetId` is
 *  existence-validated at the app layer (`AssetsService.existingAssetIds()`), not a DB-level FK —
 *  keeps this module decoupled from Asset Library's own schema/deletion lifecycle. Mirrors
 *  `CaseStudyAssetEntity` exactly. */
export interface PortfolioAssetEntity {
  readonly id: string;
  readonly portfolioRecordId: string;
  readonly assetId: string;
  readonly role: string;
  readonly caption: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
