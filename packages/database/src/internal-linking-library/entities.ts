/**
 * The Internal Linking Library module foundation (module #9) — persistence-layer shapes for
 * `internal_links` (migration `00062`). `docs/task-packages/module-internal-linking-library.md`
 * records the full account.
 *
 * A single project-scoped table, no sub-resource/join tables (task package D3) — a link IS the
 * relationship (source page -> target page), it has no independent sub-resources of its own.
 */

export type InternalLinkPriority = "low" | "medium" | "high";

/**
 * A genuinely bespoke, 4-state workflow (task package D1) — the first bespoke workflow
 * vocabulary in this codebase; every prior module (Service/Persona/Proof-and-Claims/
 * Website-Strategy-Center/Page-Inventory/Keyword-and-Entity-Library) reuses the identical 8-value
 * generic artifact lifecycle. Chosen because an internal link has a real physical lifecycle
 * (proposed -> reviewed -> actually placed on the page -> confirmed live) the generic
 * content-approval vocabulary has no concept for. See `InternalLinksService`'s own `TRANSITIONS`
 * table (task package D2) for the exact allowed transitions.
 */
export type InternalLinkStatus = "proposed" | "approved" | "implemented" | "verified";

/**
 * The primary (and only) record. `relationship`/`anchor`/`context`/`linkType`/`detector` are all
 * plain free text — the spec names these as fields but gives no discrete value list for any of
 * them (task package D5). `priority` is an unsourced-but-clearly-ordinal 3-value enum
 * (task package D6). `sourcePageId`/`targetPageId` are existence-and-same-project validated FKs
 * into Page Inventory's own `pages` table (task package D4) — a link may never have
 * `sourcePageId === targetPageId`. `assignedApproverUserId` is a nullable, existence-validated FK
 * into `users` (task package D7) — an assignment, distinct from the audit-trail record of who
 * actually performed the `approve` action. `relatedStrategyRecordId` is a plain, UNVALIDATED
 * uuid-shaped string — no real FK exists into `website_strategy_records` (task package D8).
 * `implementedAt`/`verifiedAt` are server-stamped only, and never overwritten once first set.
 */
export interface InternalLinkEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly sourcePageId: string;
  readonly targetPageId: string;
  readonly relationship: string | null;
  readonly anchor: string | null;
  readonly context: string | null;
  readonly linkType: string | null;
  readonly priority: InternalLinkPriority | null;
  readonly status: InternalLinkStatus;
  readonly detector: string | null;
  readonly assignedApproverUserId: string | null;
  readonly relatedStrategyRecordId: string | null;
  readonly implementedAt: string | null;
  readonly verifiedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
