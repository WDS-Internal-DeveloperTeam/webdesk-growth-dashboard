import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { technicalCenterRepositoryProviders } from "./database.providers.js";
import { TechnicalCheckDefinitionsService } from "./technical-check-definitions.service.js";
import { TechnicalCheckDefinitionsController } from "./technical-check-definitions.controller.js";
import { TechnicalCheckRunsService } from "./technical-check-runs.service.js";
import { TechnicalCheckRunsController } from "./technical-check-runs.controller.js";
import { TechnicalFindingsService } from "./technical-findings.service.js";
import { TechnicalFindingsController } from "./technical-findings.controller.js";

/**
 * The Technical Center module (module `technical_center`,
 * `docs/implementation/module-technical-center.md`) — a real pipeline: technical check
 * definitions -> technical check runs -> technical findings, project-scoped, mirroring Scan
 * Center's own shape almost exactly (`../scan-center/scan-center.module.ts`). Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/
 * `AuthorizationService` (the dynamic per-transition permission check in
 * `TechnicalCheckRunsService.changeStatus()`/`TechnicalFindingsService.changeStatus()`),
 * `AuditModule` for `AuditService` (every create/update/status-transition is audited), and
 * `ProjectsModule` for its exported `ProjectService` (validating a definition's `projectId`
 * actually exists). No cross-module relationship-validation wiring is needed — this module has no
 * FK-backed relationship into another business module's own records. No
 * `AuthorizationService.canViewConfidential()` usage — the module registry's own seeded
 * `confidentialityLevel` for `technical_center` is `null`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule],
  controllers: [
    TechnicalCheckDefinitionsController,
    TechnicalCheckRunsController,
    TechnicalFindingsController,
  ],
  providers: [
    ...technicalCenterRepositoryProviders,
    TechnicalCheckDefinitionsService,
    TechnicalCheckRunsService,
    TechnicalFindingsService,
  ],
  exports: [TechnicalCheckDefinitionsService, TechnicalCheckRunsService, TechnicalFindingsService],
})
export class TechnicalCenterModule {}
