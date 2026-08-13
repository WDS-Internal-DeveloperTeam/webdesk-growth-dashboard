import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
    if (!IN_FLIGHT_STATES.has(notification.deliveryState)) {
      throw new BadRequestException(
        `Notification ${id} cannot be marked failed from state "${notification.deliveryState}"`,
      );
    }
    const updated = await this.notifications.update(id, {
      deliveryState: "failed",
      retryEligible: false,
      failureSummary,
    });
    return requireNotification(updated, id);
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

    return this.applyOutcome(id, attemptCount, outcome);
  }

  /** For a future two-phase adapter that hands off to SMTP now (`sent_to_smtp`) and learns the final outcome later (bounce, delayed acceptance). No production adapter in this slice ever produces `sent_to_smtp`, so these are schema/service-ready but unexercised outside tests. */
  async confirmAccepted(id: string): Promise<NotificationEntity> {
    const notification = requireNotification(await this.notifications.findById(id), id);
    if (notification.deliveryState !== "sent_to_smtp") {
      throw new BadRequestException(
        `Notification ${id} cannot be confirmed accepted from state "${notification.deliveryState}"`,
      );
    }
    const updated = await this.notifications.update(id, {
      deliveryState: "accepted",
      retryEligible: false,
      failureSummary: null,
    });
    return requireNotification(updated, id);
  }

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
    return this.applyOutcome(id, notification.attemptCount, {
      kind: input.permanent ? "rejected_permanent" : "rejected_retryable",
      failureSummary: input.failureSummary,
    });
  }

  private async applyOutcome(
    id: string,
    attemptCount: number,
    outcome: Awaited<ReturnType<NotificationDeliveryAdapter["deliver"]>>,
  ): Promise<NotificationEntity> {
    let updated: NotificationEntity | null;

    if (outcome.kind === "sent_to_smtp") {
      updated = await this.notifications.update(id, {
        deliveryState: "sent_to_smtp",
        attemptCount,
        lastAttemptAt: new Date(),
        failureSummary: null,
      });
    } else if (outcome.kind === "accepted") {
      updated = await this.notifications.update(id, {
        deliveryState: "accepted",
        attemptCount,
        lastAttemptAt: new Date(),
        retryEligible: false,
        failureSummary: null,
      });
    } else if (outcome.kind === "rejected_permanent") {
      updated = await this.notifications.update(id, {
        deliveryState: "permanently_failed",
        attemptCount,
        lastAttemptAt: new Date(),
        retryEligible: false,
        failureSummary: outcome.failureSummary,
      });
    } else {
      // rejected_retryable
      const willRetry = attemptCount < MAX_DELIVERY_ATTEMPTS;
      updated = await this.notifications.update(id, {
        deliveryState: willRetry ? "retrying" : "permanently_failed",
        attemptCount,
        lastAttemptAt: new Date(),
        retryEligible: willRetry,
        failureSummary: outcome.failureSummary,
      });
    }

    return requireNotification(updated, id);
  }
}
