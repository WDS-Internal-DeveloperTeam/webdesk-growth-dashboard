/**
 * The retention-policy and legal/retention-hold models (Phase 1E
 * retention-architecture brief §19/§21) — persistence-layer shapes for
 * `retention_policies` (migrations `00019`/`00020`) and `retention_holds`
 * (migration `00021`). See
 * `docs/task-packages/phase-1e-retention-architecture.md`.
 */

export type RetentionUnit = "days" | "years";

export interface RetentionPolicyEntity {
  readonly id: string;
  readonly categoryKey: string;
  readonly displayName: string;
  readonly retentionValue: number;
  readonly retentionUnit: RetentionUnit;
  readonly anchor: string;
  readonly description: string | null;
  readonly appliesToEntityType: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type RetentionHoldScope = "entity" | "category";
export type RetentionHoldStatus = "active" | "released";

export interface RetentionHoldEntity {
  readonly id: string;
  readonly scope: RetentionHoldScope;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly categoryKey: string | null;
  readonly reasonCategory: string;
  readonly reason: string;
  readonly createdByUserId: string;
  readonly approvedByUserId: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: RetentionHoldStatus;
  readonly releaseReason: string | null;
  readonly releasedByUserId: string | null;
  readonly releasedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
