import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  NotificationDeliveryState,
  NotificationEntity,
  NotificationRepository,
  NotificationSeverity,
} from "@webdesk/database";
import {
  MAX_DELIVERY_ATTEMPTS,
  NOTIFICATION_DELIVERY_ADAPTER,
  NOTIFICATION_REPOSITORY,
} from "./notifications.constants.js";
import type { NotificationDeliveryAdapter } from "./delivery-adapter.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";

export interface CreateNotificationInput {
  notificationType: string;
  severity: NotificationSeverity;
  operationalArea?: string | null;
  projectId?: string | null;
  recipientUserId?: string | null;
  recipientContactId?: string | null;
  subject: string;
  bodyReference?: string | null;
  correlationId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  retentionCategory?: string | null;
}

function requireNotification(
  notification: NotificationEntity | null,
  id: string,
): NotificationEntity {
  if (!notification) {
    throw new NotFoundException(`Notification not found: ${id}`);
  }
  return notification;
}

const IN_FLIGHT_STATES: ReadonlySet<NotificationDeliveryState> = new Set(["queued", "retrying"]);
/** `markFailed` — the one manual "give up" escape hatch — additionally reaches `sent_to_smtp`, unlike `attemptDelivery`: a notification stuck mid-handoff (adapter bug, lost webhook, confirmation that will never arrive) would otherwise have no administrative recovery path at all. */
const MARK_FAILED_SOURCE_STATES: ReadonlySet<NotificationDeliveryState> = new Set([
  "queued",
  "retrying",
  "sent_to_smtp",
]);

/**
 * The notification domain service (brief §15/§16) — the single place
 * `notifications` state transitions happen, mirroring `JobService`'s own
 * role for jobs. Never talks to SMTP directly: every outcome is decided by
 * whatever `NotificationDeliveryAdapter` is DI-wired in (§16's boundary).
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(NOTIFICATION_DELIVERY_ADAPTER) private readonly adapter: NotificationDeliveryAdapter,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Previously left zero record in the tamper-resistant `audit_events` trail across all five of
   * its mutating methods (see
   * docs/security/threat-model-phase-1e-operational-infrastructure.md's Repudiation finding) — a
   * notification can be `severity: critical`, making its lifecycle a potentially significant
   * operational action. No caller identity flows into any of these methods yet (no real producer
   * exists in this slice), so every event here is attributed to the `system` actor, same as
   * `RecoveryService.createRequest`'s own unattended path.
   */
  async create(input: CreateNotificationInput): Promise<NotificationEntity> {
    const notification = await this.notifications.create(input);
    await this.auditService.record({
      eventType: "notification_created",
      actorUserId: null,
      actorType: "system",
      entityType: "notification",
      entityId: notification.id,
      action: "create",
      reason: `notificationType:${input.notificationType} severity:${input.severity}`,
      retentionCategory: "audit-7y",
    });
    return notification;
  }

  async findById(id: string): Promise<NotificationEntity> {
    return requireNotification(await this.notifications.findById(id), id);
  }

  async list(filter: {
    deliveryState?: NotificationDeliveryState;
    projectId?: string;
    notificationType?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly NotificationEntity[]> {
    return this.notifications.list(filter);
  }

  /**
   * A manual, administrative "give up" — distinct from the automatic
   * `rejected_retryable`/`rejected_permanent` classification `attemptDelivery`
   * produces. `"failed"` (as opposed to `"permanently_failed"`) is reserved
   * for exactly this: an operator or future business rule deciding to stop
   * before the automatic retry/permanent-failure logic ever ran, not an
   * outcome `NotificationDeliveryAdapter` itself produces.
   */
  async markFailed(id: string, failureSummary: string): Promise<NotificationEntity> {
    const notification = requireNotification(await this.notifications.findById(id), id);
    if (!MARK_FAILED_SOURCE_STATES.has(notification.deliveryState)) {
      throw new BadRequestException(
        `Notification ${id} cannot be marked failed from state "${notification.deliveryState}"`,
      );
    }
    const updated = await this.notifications.update(
      id,
      { deliveryState: "failed", retryEligible: false, failureSummary },
      notification.deliveryState,
    );
    const result = this.requireUncontested(updated, id, notification.deliveryState);
    await this.recordDeliveryOutcome(id, "marked_failed", `failureSummary:${failureSummary}`);
    return result;
  }

  async attemptDelivery(id: string): Promise<NotificationEntity> {
    const notification = requireNotification(await this.notifications.findById(id), id);
    if (!IN_FLIGHT_STATES.has(notification.deliveryState)) {
      throw new BadRequestException(
        `Notification ${id} cannot attempt delivery from state "${notification.deliveryState}"`,
      );
    }

    const attemptCount = notification.attemptCount + 1;
    const outcome = await this.adapter.deliver(notification);

    return this.applyOutcome(id, attemptCount, outcome, notification.deliveryState);
  }

  /** For a future two-phase adapter that hands off to SMTP now (`sent_to_smtp`) and learns the final outcome later (bounce, delayed acceptance). No production adapter in this slice ever produces `sent_to_smtp`, so these are schema/service-ready but unexercised outside tests. */
  async confirmAccepted(id: string): Promise<NotificationEntity> {
    const notification = requireNotification(await this.notifications.findById(id), id);
    if (notification.deliveryState !== "sent_to_smtp") {
      throw new BadRequestException(
        `Notification ${id} cannot be confirmed accepted from state "${notification.deliveryState}"`,
      );
    }
    const updated = await this.notifications.update(
      id,
      { deliveryState: "accepted", retryEligible: false, failureSummary: null },
      "sent_to_smtp",
    );
    const result = this.requireUncontested(updated, id, "sent_to_smtp");
    await this.recordDeliveryOutcome(id, "confirmed_accepted", null);
    return result;
  }

  /**
   * Deliberately does NOT increment `attemptCount` — unlike `attemptDelivery`, confirming an
   * outcome isn't itself a new delivery attempt; the attempt was already counted when
   * `applyOutcome`'s `sent_to_smtp` branch persisted it. Re-incrementing here would double-count
   * a single real attempt against `MAX_DELIVERY_ATTEMPTS`.
   */
  async confirmRejected(
    id: string,
    input: { permanent: boolean; failureSummary: string },
  ): Promise<NotificationEntity> {
    const notification = requireNotification(await this.notifications.findById(id), id);
    if (notification.deliveryState !== "sent_to_smtp") {
      throw new BadRequestException(
        `Notification ${id} cannot be confirmed rejected from state "${notification.deliveryState}"`,
      );
    }
    return this.applyOutcome(
      id,
      notification.attemptCount,
      {
        kind: input.permanent ? "rejected_permanent" : "rejected_retryable",
        failureSummary: input.failureSummary,
      },
      "sent_to_smtp",
    );
  }

  /** Shared audit-emission point for every `applyOutcome`/`markFailed`/`confirmAccepted` transition. */
  private async recordDeliveryOutcome(
    notificationId: string,
    action: string,
    reason: string | null,
  ): Promise<void> {
    await this.auditService.record({
      eventType: "notification_delivery_outcome",
      actorUserId: null,
      actorType: "system",
      entityType: "notification",
      entityId: notificationId,
      action,
      reason,
      retentionCategory: "audit-7y",
    });
  }

  /** Throws NotFoundException if the row is genuinely gone, ConflictException if a concurrent transition beat this one to the same row. */
  private requireUncontested(
    updated: NotificationEntity | null,
    id: string,
    expectedState: NotificationDeliveryState,
  ): NotificationEntity {
    if (updated) {
      return updated;
    }
    throw new ConflictException(
      `Notification ${id} was no longer in state "${expectedState}" when this update was applied — a concurrent transition won the race`,
    );
  }

  private async applyOutcome(
    id: string,
    attemptCount: number,
    outcome: Awaited<ReturnType<NotificationDeliveryAdapter["deliver"]>>,
    expectedState: NotificationDeliveryState,
  ): Promise<NotificationEntity> {
    let updated: NotificationEntity | null;

    if (outcome.kind === "sent_to_smtp") {
      updated = await this.notifications.update(
        id,
        {
          deliveryState: "sent_to_smtp",
          attemptCount,
          lastAttemptAt: new Date(),
          // Explicit, not inherited from whatever the row had before: a notification mid-handoff
          // isn't independently retry-eligible until confirmAccepted/confirmRejected says otherwise
          // — leaving this unset let a stale `true` from a prior "retrying" state survive the
          // transition and mislead any caller reading retryEligible to decide whether to offer a
          // manual retry.
          retryEligible: false,
          failureSummary: null,
        },
        expectedState,
      );
    } else if (outcome.kind === "accepted") {
      updated = await this.notifications.update(
        id,
        {
          deliveryState: "accepted",
          attemptCount,
          lastAttemptAt: new Date(),
          retryEligible: false,
          failureSummary: null,
        },
        expectedState,
      );
    } else if (outcome.kind === "rejected_permanent") {
      updated = await this.notifications.update(
        id,
        {
          deliveryState: "permanently_failed",
          attemptCount,
          lastAttemptAt: new Date(),
          retryEligible: false,
          failureSummary: outcome.failureSummary,
        },
        expectedState,
      );
    } else {
      // rejected_retryable
      const willRetry = attemptCount < MAX_DELIVERY_ATTEMPTS;
      updated = await this.notifications.update(
        id,
        {
          deliveryState: willRetry ? "retrying" : "permanently_failed",
          attemptCount,
          lastAttemptAt: new Date(),
          retryEligible: willRetry,
          failureSummary: outcome.failureSummary,
        },
        expectedState,
      );
    }

    const result = this.requireUncontested(updated, id, expectedState);
    await this.recordDeliveryOutcome(
      id,
      `delivery_attempt_${outcome.kind}`,
      outcome.kind === "sent_to_smtp" || outcome.kind === "accepted"
        ? null
        : `failureSummary:${outcome.failureSummary}`,
    );
    return result;
  }
}
