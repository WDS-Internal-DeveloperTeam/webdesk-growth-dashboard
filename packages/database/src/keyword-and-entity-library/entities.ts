/**
 * The Keyword & Entity Library module foundation (module #8) — persistence-layer shapes for
 * `keywords`, `entities`, `keyword_entity_relationships`, and `page_keyword_assignments`
 * (migration `00060`). `docs/task-packages/module-keyword-and-entity-library.md` records the full
 * account.
 *
 * `keywords`/`entities` are both project-scoped (task package D2) — keyword research is
 * inherently tied to a specific client website, and `page_keyword_assignments` already joins to
 * project-scoped `pages` rows (Page Inventory), so scoping `keywords` to the same project keeps
 * the whole join coherent. Unlike Persona Library's `relatedServiceIds`-style plain unvalidated
 * arrays, both dependencies (`website_strategy_center`, `page_inventory`) already existed at build
 * time, so `page_keyword_assignments` gets a real, existence-validated FK into
 * `page_inventory.pages` (task package D1).
 */

export type KeywordConfidence = "low" | "medium" | "high";

/** Reused verbatim from Service/Persona/Proof-and-Claims/Website-Strategy-Center/Page-Inventory's
 *  own identical `TRANSITIONS`-governed vocabulary (task package D9) — a 6th occurrence of this
 *  identical shape, deliberately not extracted into a shared helper (already-accepted,
 *  out-of-scope debt in this codebase). Applies only to `keywords` (the primary record) —
 *  `entities` and both join tables carry no approval status of their own (task package D3/D9). */
export type KeywordApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The primary record. `keywordType`/`intent`/`funnelStage`/`country`/`source` are all plain free
 * text — the spec names these as fields but gives no discrete value list for any of them
 * (task package D6). `searchVolume`/`difficultyScore` are "metrics" (task package D7) — the two
 * most standard SEO keyword metrics, since the spec names no exhaustive metric list.
 */
export interface KeywordEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly queryText: string;
  readonly keywordType: string | null;
  readonly intent: string | null;
  readonly funnelStage: string | null;
  readonly country: string | null;
  readonly searchVolume: number | null;
  readonly difficultyScore: number | null;
  readonly source: string | null;
  readonly researchDate: string | null;
  readonly cannibalizationNotes: string | null;
  readonly confidence: KeywordConfidence | null;
  readonly approvalStatus: KeywordApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Lightweight, project-scoped reference records, not full-lifecycle artifacts (task package D3) —
 * `entityType` is free text (e.g. "Person", "Organization", "Place", "Concept", "Brand"), no enum
 * invented since the spec names no discrete taxonomy. No `approvalStatus` of their own, mirroring
 * Proof and Claims Library's `claim_sources` sub-resource's own identical precedent.
 */
export interface EntityRecordEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly name: string;
  readonly entityType: string | null;
  readonly description: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A real many-to-many join between `keywords` and `entities` — a pure join row with no
 * independent meaning once either parent is gone (`onDelete: "CASCADE"` on both FKs, migration
 * `00060`). No `updatedAt` — the row is either created or removed, never edited in place.
 */
export interface KeywordEntityRelationshipEntity {
  readonly id: string;
  readonly keywordId: string;
  readonly entityId: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

/**
 * A real join between `keywords` and Page Inventory's own `pages` — `pageId` is
 * existence-and-same-project validated at the service layer (task package D1), via
 * `PagesService.existsInProject()`, a narrow read-only delegating method mirroring
 * `RoadmapItemsService.existsInProject()`'s own already-established shape (task package D10). No
 * `updatedAt` — the row is either created or removed, never edited in place; `assignmentNote` is
 * carried on create only.
 */
export interface PageKeywordAssignmentEntity {
  readonly id: string;
  readonly keywordId: string;
  readonly pageId: string;
  readonly assignmentNote: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}
