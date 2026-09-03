import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UsersModule } from "../users/users.module.js";
import { releaseCenterRepositoryProviders } from "./database.providers.js";
import { ReleasesService } from "./releases.service.js";
import { ReleasesController } from "./releases.controller.js";
import { ReleaseArtifactsService } from "./release-artifacts.service.js";
import { ReleaseArtifactsController } from "./release-artifacts.controller.js";
import { DeploymentsService } from "./deployments.service.js";
import { DeploymentsController } from "./deployments.controller.js";
import { SmokeTestsService } from "./smoke-tests.service.js";
import { SmokeTestsController } from "./smoke-tests.controller.js";
import { RollbackRecordsService } from "./rollback-records.service.js";
import { RollbackRecordsController } from "./rollback-records.controller.js";

/**
 * The Release Center module (module `release_center`,
 * `docs/implementation/module-release-center.md`) — a real inline dynamic workflow (D1), project-
 * scoped (D2), record-keeping only with no real execution engine (D3), mirroring Technical
 * Center's/Case Study Studio's own established patterns. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `ReleasesService.changeStatus()`), `AuditModule`
 * for `AuditService` (every create/update/status-transition and sub-resource mutation is audited),
 * `ProjectsModule` for its exported `ProjectService` (validating a release's `projectId` actually
 * exists), and `UsersModule` for its exported `UsersService`
 * (`assignedDeveloperUserId`/`assignedReviewerUserId` existence validation via
 * `UsersService.assertUserExists()`). No cross-module relationship-validation wiring beyond that —
 * this module's only real FK-backed relationship is the self-referential
 * `rollback_records.replacement_release_id`, resolved entirely within its own repository. No
 * `AuthorizationService.canViewConfidential()` usage — the module registry's own seeded
 * `confidentialityLevel` for `release_center` is `null`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule, UsersModule],
  controllers: [
    ReleasesController,
    ReleaseArtifactsController,
    DeploymentsController,
    SmokeTestsController,
    RollbackRecordsController,
  ],
  providers: [
    ...releaseCenterRepositoryProviders,
    ReleasesService,
    ReleaseArtifactsService,
    DeploymentsService,
    SmokeTestsService,
    RollbackRecordsService,
  ],
  exports: [ReleasesService],
})
export class ReleaseCenterModule {}
