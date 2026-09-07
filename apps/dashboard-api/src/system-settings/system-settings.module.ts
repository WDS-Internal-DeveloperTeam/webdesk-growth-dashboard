import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { systemSettingsRepositoryProviders } from "./database.providers.js";
import { SystemSettingsService } from "./system-settings.service.js";
import { SystemSettingsController } from "./system-settings.controller.js";

/**
 * The System Settings module — module #42 on the canonical module registry, closing the last
 * genuinely unowned settings surface (statuses/categories/taxonomies, file limits, Git rules,
 * backup rules, escalation SLAs, documentation rules, environments — see
 * `docs/implementation/module-system-settings.md`'s own "Scope decision" for what's deliberately
 * excluded). Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic `configure`-action check in
 * `SystemSettingsService.updateActiveState()`), and `AuditModule` for `AuditService`
 * (create/update/active-state changes are all audited). No other module import — this module has
 * no cross-module relationship fields. No `AuthorizationService.canViewConfidential()` usage — no
 * confidential-field mechanism exists here (the module registry's own seeded
 * `confidentialityLevel` for `system_settings` is `null`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [SystemSettingsController],
  providers: [...systemSettingsRepositoryProviders, SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
