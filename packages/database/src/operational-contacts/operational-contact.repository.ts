import type { Model } from "sequelize";
import { getOperationalContactsModels } from "./models.js";
import type {
  ContactRole,
  ContactVerificationStatus,
  IncidentSeverity,
  OperationalContactEntity,
} from "./entities.js";

function toEntity(instance: Model): OperationalContactEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    contactUserId: (json.contactUserId as string | null) ?? null,
    contactName: (json.contactName as string | null) ?? null,
    contactEmail: (json.contactEmail as string | null) ?? null,
    contactPhone: (json.contactPhone as string | null) ?? null,
    area: json.area as string,
    role: json.role as ContactRole,
    escalationPriority: json.escalationPriority as number,
    channelPreference: (json.channelPreference as string | null) ?? null,
    severityApplicability:
      (json.severityApplicability as readonly IncidentSeverity[] | null) ?? null,
    workingHoursStart: (json.workingHoursStart as string | null) ?? null,
    workingHoursEnd: (json.workingHoursEnd as string | null) ?? null,
    timeZone: (json.timeZone as string | null) ?? null,
    effectiveStartDate: (json.effectiveStartDate as Date).toISOString(),
    effectiveEndDate: json.effectiveEndDate ? (json.effectiveEndDate as Date).toISOString() : null,
    activeStatus: json.activeStatus as boolean,
    verificationStatus: json.verificationStatus as ContactVerificationStatus,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class OperationalContactRepository {
  private readonly model = getOperationalContactsModels().OperationalContact;

  async create(input: {
    contactUserId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    area: string;
    role: ContactRole;
    escalationPriority: number;
    channelPreference?: string | null;
    severityApplicability?: readonly IncidentSeverity[] | null;
    workingHoursStart?: string | null;
    workingHoursEnd?: string | null;
    timeZone?: string | null;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date | null;
  }): Promise<OperationalContactEntity> {
    const instance = await this.model.create({
      contactUserId: input.contactUserId ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      area: input.area,
      role: input.role,
      escalationPriority: input.escalationPriority,
      channelPreference: input.channelPreference ?? null,
      severityApplicability: input.severityApplicability ?? null,
      workingHoursStart: input.workingHoursStart ?? null,
      workingHoursEnd: input.workingHoursEnd ?? null,
      timeZone: input.timeZone ?? null,
      effectiveStartDate: input.effectiveStartDate ?? new Date(),
      effectiveEndDate: input.effectiveEndDate ?? null,
      activeStatus: true,
      verificationStatus: "unverified",
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<OperationalContactEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      role: ContactRole;
      escalationPriority: number;
      channelPreference: string | null;
      severityApplicability: readonly IncidentSeverity[] | null;
      workingHoursStart: string | null;
      workingHoursEnd: string | null;
      timeZone: string | null;
      effectiveEndDate: Date | null;
      activeStatus: boolean;
      verificationStatus: ContactVerificationStatus;
    }>,
  ): Promise<OperationalContactEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async list(
    filter: { area?: string; activeStatus?: boolean } = {},
  ): Promise<readonly OperationalContactEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.area) {
      where.area = filter.area;
    }
    if (filter.activeStatus !== undefined) {
      where.activeStatus = filter.activeStatus;
    }
    // `role`-based ordering (primary before backup) is NOT done here — alphabetically "backup" <
    // "primary", so a naive SQL ORDER BY role would be wrong. The caller (`OperationalContactService`)
    // handles primary-before-backup ordering explicitly; this repository only orders by priority.
    const rows = await this.model.findAll({
      where,
      order: [["escalationPriority", "ASC"]],
    });
    return rows.map(toEntity);
  }

  async findActiveForArea(area: string): Promise<readonly OperationalContactEntity[]> {
    const rows = await this.model.findAll({
      where: { area, activeStatus: true },
      order: [["escalationPriority", "ASC"]],
    });
    return rows.map(toEntity);
  }
}
