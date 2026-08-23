/**
 * The Website Strategy Center module foundation — persistence-layer shapes for
 * `website_strategy_records` (migration `00056`). Organization-wide, not project-scoped — the
 * Growth Director's own strategic workspace (navigation plan, page clusters, pillar/platform/
 * industry/location strategy, conversion plan, search plan, internal-link plan), not something
 * that varies per client project (task package D9).
 *
 * Unlike every prior module built so far (Business Knowledge Center, Service Library, Persona
 * Library, Proof and Claims Library — each one mutable row per record, no real history), this
 * module implements REAL version history (task package D2/D3): every version of a record is its
 * own physical row, sharing the same `recordId` (the stable logical-record identity — NOT the
 * same as `id`, which is unique per physical row/version). `publicId` is also stable across every
 * version of the same record. Uniqueness for both `recordId`'s "current version" and `publicId`
 * is enforced via a partial unique index `WHERE is_current = true` (migration `00056`), not a
 * bare column constraint — see that migration's own doc comment for why.
 */

/** Task package D5 — the spec's own 9 "Primary records," snake_case. Immutable across a record's
 *  own version chain (set once at creation; a real type change is a different record, not a new
 *  version of this one — enforced server-side, never accepted through `update()`). */
export type WebsiteStrategyRecordType =
  | "navigation_plan"
  | "page_clusters"
  | "pillar_strategy"
  | "platform_strategy"
  | "industry_strategy"
  | "location_strategy"
  | "conversion_plan"
  | "search_plan"
  | "internal_link_plan";

/** Task package D6 — the shared generic artifact-lifecycle vocabulary, reused verbatim from
 *  Service Library's/Persona Library's/Proof and Claims Library's own identical `ApprovalStatus`
 *  union (a 4th occurrence, deliberately not extracted into a shared type — already-accepted,
 *  out-of-scope debt in this codebase). */
export type WebsiteStrategyApprovalStatus =
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
 * version — see `WebsiteStrategyRecordRepository.createNewVersion()`/`updateInPlace()`).
 * `content`/`notes` stay plain text for this backend-only pass (task package D7) — no
 * `dashboard-web` UI exists yet.
 */
export interface WebsiteStrategyRecordEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly recordType: WebsiteStrategyRecordType;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly title: string;
  readonly content: string | null;
  readonly notes: string | null;
  readonly approvalStatus: WebsiteStrategyApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
