/**
 * The Change Center module foundation (module #33, `docs/implementation/module-change-center.md`)
 * — persistence-layer shapes for `change_records` (migration `00105`), the sole table this module
 * needs.
 *
 * A change record tracks one detected/proposed change across theme, plugin, core, database,
 * integration, SEO/analytics, security, accessibility, performance, redirects/URLs, and asset
 * categories — through a real accept/reject/merge/defer/apply/verify workflow
 * (`05_Workflow_State_Machines.md §8`). Project-scoped (`projectId`), with an optional real
 * `scanFindingId` FK into Scan Center's own `scan_findings` table (the real "source" link when a
 * change was detected by a scan) and an optional polymorphic `(targetModuleKey, targetId)`
 * reference (mirroring Review and Approval Center's own pattern) for when the change is about a
 * record in another module.
 */

export type ChangeRecordCategory =
  | "theme"
  | "plugin"
  | "core"
  | "database"
  | "integration"
  | "seo_metadata"
  | "analytics_tracking"
  | "security"
  | "accessibility"
  | "performance"
  | "redirects_urls"
  | "assets"
  | "conflicts_failed_sync"
  | "rollback_history";

export type ChangeRecordSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ChangeRecordStatus =
  | "detected"
  | "under_review"
  | "accepted"
  | "rejected"
  | "deferred"
  | "manual_merge_required"
  | "applying"
  | "applied"
  | "verified"
  | "apply_failed";

/**
 * One tracked change. `decidedAt`/`appliedAt`/`verifiedAt` are server-stamped only, by
 * `ChangeRecordRepository.updateStatus()`'s own atomic `COALESCE`-based conditional write —
 * never accepted as caller input, never overwritten once first set (mirrors
 * `InternalLinkRepository.updateStatus()`'s/`ScanRunRepository.updateStatus()`'s own precedent).
 * `rollbackGuidance` is settable only as part of a transition INTO `apply_failed`, and is cleared
 * back to `null` automatically on any transition OUT of `apply_failed` that doesn't supply a fresh
 * value — it never lingers describing a failure the record has since recovered from.
 */
export interface ChangeRecordEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly category: ChangeRecordCategory;
  readonly severity: ChangeRecordSeverity;
  readonly status: ChangeRecordStatus;
  readonly scanFindingId: string | null;
  readonly source: string | null;
  readonly targetModuleKey: string | null;
  readonly targetId: string | null;
  readonly recordLabel: string;
  readonly beforeValue: string | null;
  readonly afterValue: string | null;
  readonly confidence: number | null;
  readonly recommendation: string | null;
  readonly assignedToUserId: string | null;
  readonly decisionNotes: string | null;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly appliedByUserId: string | null;
  readonly appliedAt: string | null;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: string | null;
  readonly rollbackGuidance: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
