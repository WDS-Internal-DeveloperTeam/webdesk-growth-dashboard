import type { Model } from "sequelize";
import { getOperationalContactsModels } from "./models.js";
import type {
  IncidentSeverity,
  IncidentSeverityPolicyEntity,
  ResponseTargetUnit,
} from "./entities.js";

function toEntity(instance: Model): IncidentSeverityPolicyEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    severity: json.severity as IncidentSeverity,
    responseTargetValue: (json.responseTargetValue as number | null) ?? null,
    responseTargetUnit: (json.responseTargetUnit as ResponseTargetUnit | null) ?? null,
    responseTargetDescription: json.responseTargetDescription as string,
    isFixedDuration: json.isFixedDuration as boolean,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** Read-only from the application's perspective — the 4 approved severities are seeded by migration `00021`, not created via this repository. */
export class IncidentSeverityPolicyRepository {
  private readonly model = getOperationalContactsModels().IncidentSeverityPolicy;

  async findBySeverity(severity: IncidentSeverity): Promise<IncidentSeverityPolicyEntity | null> {
    const instance = await this.model.findOne({ where: { severity } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly IncidentSeverityPolicyEntity[]> {
    const rows = await this.model.findAll({ order: [["severity", "ASC"]] });
    return rows.map(toEntity);
  }
}
