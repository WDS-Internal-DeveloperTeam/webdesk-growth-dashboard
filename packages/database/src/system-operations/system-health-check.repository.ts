import type { Model } from "sequelize";
import { getSystemOperationsModels } from "./models.js";
import type { SystemHealthCheckEntity, SystemHealthStatus } from "./entities.js";

function toEntity(instance: Model): SystemHealthCheckEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    componentKey: json.componentKey as string,
    status: json.status as SystemHealthStatus,
    detail: (json.detail as string | null) ?? null,
    checkedByUserId: (json.checkedByUserId as string | null) ?? null,
    source: json.source as string,
    correlationId: (json.correlationId as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

/** Append-only status-observation history — never updated. "Current status" is resolved by the caller as the most recent row per component; see `SystemHealthService.getCurrentStatus()`. */
export class SystemHealthCheckRepository {
  private readonly model = getSystemOperationsModels().SystemHealthCheck;

  async record(input: {
    componentKey: string;
    status: SystemHealthStatus;
    detail?: string | null;
    checkedByUserId?: string | null;
    source?: string;
    correlationId?: string | null;
  }): Promise<SystemHealthCheckEntity> {
    const instance = await this.model.create({
      componentKey: input.componentKey,
      status: input.status,
      detail: input.detail ?? null,
      checkedByUserId: input.checkedByUserId ?? null,
      source: input.source ?? "manual",
      correlationId: input.correlationId ?? null,
    });
    return toEntity(instance);
  }

  async findMostRecentForComponent(componentKey: string): Promise<SystemHealthCheckEntity | null> {
    const instance = await this.model.findOne({
      where: { componentKey },
      order: [["createdAt", "DESC"]],
    });
    return instance ? toEntity(instance) : null;
  }

  async findHistoryForComponent(
    componentKey: string,
    limit = 50,
  ): Promise<readonly SystemHealthCheckEntity[]> {
    const rows = await this.model.findAll({
      where: { componentKey },
      order: [["createdAt", "DESC"]],
      limit,
    });
    return rows.map(toEntity);
  }
}
