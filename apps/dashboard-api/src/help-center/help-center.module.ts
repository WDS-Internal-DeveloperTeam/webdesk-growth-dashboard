import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { helpCenterRepositoryProviders } from "./database.providers.js";
import { HelpArticlesService } from "./help-articles.service.js";
import { HelpArticlesController } from "./help-articles.controller.js";

/**
 * The Help Center module — module #38 on the canonical spec, reusing the already-seeded
 * `system_settings` RBAC group verbatim (confirmed directly with the project owner) rather than a
 * new dedicated group. No approval workflow, no cross-module relationship fields, no
 * confidential-field mechanism (the module registry's own seeded `confidentialityLevel` for
 * `help_center` is `null`) — the simplest content-library module built to date. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`RequirePermission`, and `AuditModule` for `AuditService` (create/update/
 * publish/unpublish are all audited).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [HelpArticlesController],
  providers: [...helpCenterRepositoryProviders, HelpArticlesService],
  exports: [HelpArticlesService],
})
export class HelpCenterModule {}
