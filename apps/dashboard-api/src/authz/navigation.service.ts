import { Inject, Injectable } from "@nestjs/common";
import type { ModuleRegistryRepository, ModuleRepository } from "@webdesk/database";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";
import { MODULE_REGISTRY_REPOSITORY, MODULE_REPOSITORY } from "./authz.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuthorizationService } from "./authorization.service.js";
import { toModuleRegistrySummary } from "./module-registry.mapper.js";

/**
 * Registry-driven, permission-aware navigation (Phase 1F brief §9/§10,
 * `docs/task-packages/phase-1f-application-shell.md`). The ONLY source
 * `dashboard-web`'s navigation reads — no hardcoded per-page nav arrays.
 *
 * A module is included only when BOTH:
 * - `v1InclusionStatus === "included"` (deferred/future modules never
 *   appear in Version 1 navigation, per brief §7), and
 * - the caller's effective capabilities grant the module's own
 *   `viewPermissionAction` under its gating permission group.
 *
 * This is a UX/discovery filter only — backend route authorization
 * (`PermissionGuard`/`@RequirePermission` on the module's own real routes,
 * once built) remains the actual enforcement point regardless of what this
 * list contains (brief §9/§10/§28's own explicit instruction).
 */
@Injectable()
export class NavigationService {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(MODULE_REGISTRY_REPOSITORY) private readonly moduleRegistry: ModuleRegistryRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async getNavigation(
    userId: string,
    projectId?: string,
  ): Promise<readonly ModuleRegistrySummary[]> {
    const [entries, permissionGroups, capabilities] = await Promise.all([
      this.moduleRegistry.listForNavigation(),
      this.modules.listAll(),
      this.authorization.getEffectiveCapabilities(userId, projectId),
    ]);
    const permissionGroupKeyById = new Map(permissionGroups.map((m) => [m.id, m.key]));

    const visible: ModuleRegistrySummary[] = [];
    for (const entry of entries) {
      if (entry.v1InclusionStatus !== "included") {
        continue;
      }
      const groupKey = permissionGroupKeyById.get(entry.permissionGroupId);
      const canView = groupKey
        ? (capabilities[groupKey]?.includes(entry.viewPermissionAction) ?? false)
        : false;
      if (!canView) {
        continue;
      }
      visible.push({ ...toModuleRegistrySummary(entry, permissionGroupKeyById), canView: true });
    }
    return visible;
  }
}
