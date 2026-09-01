/**
 * Knowledge Library (`docs/implementation/module-knowledge-library.md`) — module #28. The
 * canonical spec (`03_Detailed_Module_Specifications.md §28`) is a thin, flat field list with no
 * taxonomy for `sourceType` and no field-level differentiation, so all records share one uniform
 * shape (D2), the same precedent Business Knowledge Center's own single-table design established.
 */

/** D1 — a real, separate confidentiality enum (Service Library's own already-reviewed pattern),
 *  distinct from `status` — unlike Business Knowledge Center, where `restricted` doubles as both
 *  lifecycle and confidentiality. */
export type KnowledgeLibraryRecordConfidentiality = "public" | "internal" | "restricted";

/** D3 — the lifecycle vocabulary: Business Knowledge Center's own 5-value vocabulary with
 *  `restricted` removed, since confidentiality is now a real, separate field (D1). `deprecated`
 *  is terminal (no hard delete, ADR-0016). */
export type KnowledgeLibraryRecordStatus = "draft" | "mandatory" | "advisory" | "deprecated";

export interface KnowledgeLibraryRecordEntity {
  readonly id: string;
  readonly title: string;
  /** D4 — the spec names this field but gives no taxonomy, so it's plain free text rather than a
   *  fabricated closed enum. */
  readonly sourceType: string | null;
  /** D5 — the spec's "URL/file" field, modeled as plain text (not URL-validated) since a
   *  reference source's location may genuinely be a URL, an internal file path, or a citation.
   *  Not rendered as a clickable link by this backend-only pass. */
  readonly location: string | null;
  /** D6 — a real, existence-validated FK into `users`, mirroring
   *  `ProjectService.assertOwnerExists()`'s own pattern. */
  readonly ownerUserId: string | null;
  /** A plain date (`DATEONLY`), ISO `YYYY-MM-DD`. */
  readonly sourceDate: string | null;
  readonly confidentiality: KnowledgeLibraryRecordConfidentiality;
  /** D10 — no enforcement point exists yet; stored, not yet acted on. */
  readonly approvedForAgentUse: boolean;
  readonly status: KnowledgeLibraryRecordStatus;
  readonly notes: string | null;
  /** D7 — a plain, unvalidated string array; "related entities" isn't scoped to any single other
   *  module in the spec, so no existence-check target exists. */
  readonly relatedEntityIds: readonly string[];
  /** D8 — a server-managed integer counter incremented on every real `update()` call, mirroring
   *  Persona Library's own pattern (not real multi-row version history — nothing in this
   *  module's spec names a "compare versions" action). */
  readonly version: number;
  /** D9 — a plain, caller-settable nullable timestamp via the ordinary `update()` route; no
   *  dedicated "mark reviewed" action exists anywhere in the spec. */
  readonly lastReviewedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
