import { Inject, Injectable } from "@nestjs/common";
import type { ModuleRegistryRepository, ModuleRepository } from "@webdesk/database";
import type { ModuleRegistrySummary, ModuleSummary } from "@webdesk/shared-types";
import { MODULE_REGISTRY_REPOSITORY, MODULE_REPOSITORY } from "./authz.constants.js";

/**
 * Read-only composition over the two module concepts
 * (docs/implementation/phase-1d-permission-catalog.md §3) — the "Users/roles"
 * admin surface's catalog endpoints (task package §20: "possible endpoint
 * categories... /admin/permissions").
 */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(MODULE_REGISTRY_REPOSITORY) private readonly moduleRegistry: ModuleRegistryRepository,
  ) {}

  async listPermissionGroups(): Promise<readonly ModuleSummary[]> {
    const modules = await this.modules.listAll();
    return modules.map((module) => ({ id: module.id, key: module.key, name: module.name }));
  }

  async listModuleRegistry(): Promise<readonly ModuleRegistrySummary[]> {
    const [entries, permissionGroups] = await Promise.all([
      this.moduleRegistry.listAll(),
      this.modules.listAll(),
    ]);
    const keyById = new Map(permissionGroups.map((module) => [module.id, module.key]));
    return entries.map((entry) => ({
      id: entry.id,
      key: entry.key,
      name: entry.name,
      permissionGroupKey: keyById.get(entry.permissionGroupId) ?? "unknown",
    }));
  }
}
