import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ScanCenterModule } from "../scan-center/scan-center.module.js";
import { UsersModule } from "../users/users.module.js";
import { changeCenterRepositoryProviders } from "./database.providers.js";
import { ChangeRecordsService } from "./change-records.service.js";
import { ChangeRecordsController } from "./change-records.controller.js";

/**
 * The Change Center module (module #33, `docs/implementation/module-change-center.md`) — a
 * project-scoped record of theme/plugin/core/database/integration/SEO/analytics/security/
 * accessibility/performance/redirect/asset changes moving through a real accept/reject/merge/
 * defer/apply/verify workflow. Its one real dependency is Scan Center (`scan_finding_id`, an
 * optional FK into `scan_findings`, existence-validated via `ScanFindingsService.findById()` —
 * itself already `projectId`-scoped, closing the IDOR gap a raw repository export would otherwise
 * open).
 *
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `ChangeRecordsService.changeStatus()`, and `isValidModuleKey()` for the optional polymorphic
 * `targetModuleKey`), `AuditModule` for `AuditService` (every create/update/status-transition is
 * audited), `ProjectsModule` for its exported `ProjectService` (validating a record's `projectId`
 * actually exists), `ScanCenterModule` for its exported `ScanFindingsService`, and `UsersModule`
 * for its exported `UsersService` (`assignedToUserId` existence validation, mirroring
 * `ProjectService.assertOwnerExists()`'s own precedent). No
 * `AuthorizationService.canViewConfidential()` usage — the module registry's own seeded
 * `confidentialityLevel` for `change_center` is `null`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule, ScanCenterModule, UsersModule],
  controllers: [ChangeRecordsController],
  providers: [...changeCenterRepositoryProviders, ChangeRecordsService],
  exports: [ChangeRecordsService],
})
export class ChangeCenterModule {}
