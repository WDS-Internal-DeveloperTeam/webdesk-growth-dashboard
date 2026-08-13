/**
 * The reusable notification-record model (Phase 1E notification-foundation
 * brief §15) — persistence-layer shapes for `notifications` (migration
 * `00019`). See `docs/task-packages/phase-1e-notification-foundation.md`.
 */

export type NotificationSeverity = "critical" | "high" | "medium" | "low";

export type NotificationDeliveryState =
  "queued" | "sent_to_smtp" | "accepted" | "failed" | "retrying" | "permanently_failed";

export interface NotificationEntity {
  readonly id: string;
  readonly notificationType: string;
  readonly severity: NotificationSeverity;
  readonly operationalArea: string | null;
  readonly projectId: string | null;
  readonly recipientUserId: string | null;
  readonly recipientContactId: string | null;
  readonly subject: string;
  readonly bodyReference: string | null;
  readonly deliveryState: NotificationDeliveryState;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly failureSummary: string | null;
  readonly retryEligible: boolean;
  readonly correlationId: string | null;
  readonly relatedEntityType: string | null;
  readonly relatedEntityId: string | null;
  readonly retentionCategory: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
