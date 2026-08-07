import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { AuthEventEntity } from "./entities.js";

function toEntity(instance: Model): AuthEventEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    eventType: json.eventType as string,
    userId: (json.userId as string | null) ?? null,
    sessionId: (json.sessionId as string | null) ?? null,
    authMethod: (json.authMethod as string | null) ?? null,
    success: json.success as boolean,
    reason: (json.reason as string | null) ?? null,
    ipHash: (json.ipHash as string | null) ?? null,
    userAgent: (json.userAgent as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

/**
 * Append-only by construction: this class exposes exactly one write
 * method, `record` — no `update`, no `delete`, ever. That is the
 * immutability control (mirrors, at a narrow login-event scale, what
 * ADR-0017 requires of the full audit-log subsystem Task 7 will build).
 */
export class AuthEventRepository {
  private readonly model = getAuthModels().AuthEvent;

  async record(input: {
    eventType: string;
    userId?: string | null;
    sessionId?: string | null;
    authMethod?: string | null;
    success: boolean;
    reason?: string | null;
    ipHash?: string | null;
    userAgent?: string | null;
  }): Promise<AuthEventEntity> {
    const instance = await this.model.create({
      eventType: input.eventType,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      authMethod: input.authMethod ?? null,
      success: input.success,
      reason: input.reason ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    });
    return toEntity(instance);
  }

  async findRecentByUserId(userId: string, limit = 50): Promise<readonly AuthEventEntity[]> {
    const rows = await this.model.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit,
    });
    return rows.map(toEntity);
  }
}
