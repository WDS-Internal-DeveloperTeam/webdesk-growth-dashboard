import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { ModuleRegistryEntity } from "./entities.js";

function toEntity(instance: Model): ModuleRegistryEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    key: json.key as string,
    name: json.name as string,
    permissionGroupId: json.permissionGroupId as string,
    displayName: (json.displayName as string | null) ?? null,
    description: (json.description as string | null) ?? null,
    navigationGroup: json.navigationGroup as string,
    navigationOrder: json.navigationOrder as number,
    route: json.route as string,
    iconReference: (json.iconReference as string | null) ?? null,
    v1InclusionStatus: json.v1InclusionStatus as ModuleRegistryEntity["v1InclusionStatus"],
    implementationStatus: json.implementationStatus as ModuleRegistryEntity["implementationStatus"],
    viewPermissionAction: json.viewPermissionAction as string,
    actionPermissions: (json.actionPermissions as readonly string[] | null) ?? null,
    featureStatus: (json.featureStatus as string | null) ?? null,
    documentationReference: (json.documentationReference as string | null) ?? null,
    helpDocumentReference: (json.helpDocumentReference as string | null) ?? null,
    owner: (json.owner as string | null) ?? null,
    dependencies: (json.dependencies as readonly string[] | null) ?? null,
    confidentialityLevel: (json.confidentialityLevel as string | null) ?? null,
    badgeSupport: json.badgeSupport as boolean,
    visibilityRules: (json.visibilityRules as Readonly<Record<string, unknown>> | null) ?? null,
    deprecationReference: (json.deprecationReference as string | null) ?? null,
    registryVersion: json.registryVersion as number,
    lastReviewedAt: json.lastReviewedAt ? (json.lastReviewedAt as Date).toISOString() : null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** The 43 real dashboard modules (migrations 00014/00015) — never created via this repository; only the seed migration writes rows. */
export class ModuleRegistryRepository {
  private readonly model = getAuthzModels().ModuleRegistry;

  async findByKey(key: string): Promise<ModuleRegistryEntity | null> {
    const instance = await this.model.findOne({ where: { key } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly ModuleRegistryEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map(toEntity);
  }

  /** Navigation-ordered listing — the shell's registry-driven navigation reads this, not `listAll`. */
  async listForNavigation(): Promise<readonly ModuleRegistryEntity[]> {
    const rows = await this.model.findAll({
      order: [
        ["navigationGroup", "ASC"],
        ["navigationOrder", "ASC"],
      ],
    });
    return rows.map(toEntity);
  }
}
