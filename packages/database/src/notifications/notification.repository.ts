import type { Model } from "sequelize";
import { getNotificationModels } from "./models.js";
import type {
  NotificationDeliveryState,
  NotificationEntity,
  NotificationSeverity,
} from "./entities.js";

function toEntity(instance: Model): NotificationEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    notificationType: json.notificationType as string,
    severity: json.severity as NotificationSeverity,
    operationalArea: (json.operationalArea as string | null) ?? null,
    projectId: (json.projectId as string | null) ?? null,
    recipientUserId: (json.recipientUserId as string | null) ?? null,
    recipientContactId: (json.recipientContactId as string | null) ?? null,
    subject: json.subject as string,
    bodyReference: (json.bodyReference as string | null) ?? null,
    deliveryState: json.deliveryState as NotificationDeliveryState,
    attemptCount: json.attemptCount as number,
    lastAttemptAt: json.lastAttemptAt ? (json.lastAttemptAt as Date).toISOString() : null,
    failureSummary: (json.failureSummary as string | null) ?? null,
    retryEligible: json.retryEligible as boolean,
    correlationId: (json.correlationId as string | null) ?? null,
    relatedEntityType: (json.relatedEntityType as string | null) ?? null,
    relatedEntityId: (json.relatedEntityId as string | null) ?? null,
    retentionCategory: (json.retentionCategory as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * Pure persistence — no state-machine/delivery logic here. That lives in
 * `apps/dashboard-api/src/notifications/notification.service.ts`, mirroring
 * the repository/service split `JobRepository`/`JobService` already
 * established.
 */
export class NotificationRepository {
  private readonly model = getNotificationModels().Notification;

  async create(input: {
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
  }): Promise<NotificationEntity> {
    const instance = await this.model.create({
      notificationType: input.notificationType,
      severity: input.severity,
      operationalArea: input.operationalArea ?? null,
      projectId: input.projectId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      recipientContactId: input.recipientContactId ?? null,
      subject: input.subject,
      bodyReference: input.bodyReference ?? null,
      deliveryState: "queued",
      attemptCount: 0,
      retryEligible: true,
      correlationId: input.correlationId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      retentionCategory: input.retentionCategory ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  /**
   * `expectedState`, when given, makes this a conditional update
   * (`WHERE id = :id AND delivery_state = :expectedState`) rather than a
   * plain read-then-write — the caller read `deliveryState` to decide this
   * patch is valid, and without pinning that same value in the `WHERE`
   * clause, two concurrent transitions on the same notification can both
   * pass their precondition check and one silently overwrite the other.
   * Returns `null` both when the row doesn't exist and when the
   * conditional update matched zero rows (the state changed under the
   * caller) — `NotificationService` distinguishes the two by having
   * already fetched the row itself before calling `update`.
   */
  async update(
    id: string,
    patch: Partial<{
      deliveryState: NotificationDeliveryState;
      attemptCount: number;
      lastAttemptAt: Date;
      failureSummary: string | null;
      retryEligible: boolean;
    }>,
    expectedState?: NotificationDeliveryState,
  ): Promise<NotificationEntity | null> {
    if (expectedState !== undefined) {
      const [affectedCount] = await this.model.update(patch, {
        where: { id, deliveryState: expectedState },
      });
      if (affectedCount === 0) {
        return null;
      }
      const instance = await this.model.findByPk(id);
      return instance ? toEntity(instance) : null;
    }
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async list(filter: {
    deliveryState?: NotificationDeliveryState;
    projectId?: string;
    notificationType?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly NotificationEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.deliveryState) {
      where.deliveryState = filter.deliveryState;
    }
    if (filter.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter.notificationType) {
      where.notificationType = filter.notificationType;
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map(toEntity);
  }
}
