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
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationEntity> {
    return this.notifications.create(input);
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
    return this.requireUncontested(updated, id, notification.deliveryState);
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
    return this.requireUncontested(updated, id, "sent_to_smtp");
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

    return this.requireUncontested(updated, id, expectedState);
  }
}
