import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { scanCenterRepositoryProviders } from "./database.providers.js";
import { ScanDefinitionsService } from "./scan-definitions.service.js";
import { ScanDefinitionsController } from "./scan-definitions.controller.js";
import { ScanRunsService } from "./scan-runs.service.js";
import { ScanRunsController } from "./scan-runs.controller.js";
import { ScanFindingsService } from "./scan-findings.service.js";
import { ScanFindingsController } from "./scan-findings.controller.js";
import { ScanEvidenceService } from "./scan-evidence.service.js";
import { ScanEvidenceController } from "./scan-evidence.controller.js";

/**
 * The Scan Center module (module #31, `docs/implementation/module-scan-center.md`) — a real
 * pipeline: scan definitions -> scan runs -> scan findings -> scan evidence, all project-scoped
 * (mirrors Page Inventory's/Keyword & Entity Library's/Internal Linking Library's own shape).
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `ScanRunsService.changeStatus()`/`ScanFindingsService.changeStatus()`), `AuditModule` for
 * `AuditService` (every create/update/status-transition is audited), and `ProjectsModule` for its
 * exported `ProjectService` (validating a definition's `projectId` actually exists). No
 * cross-module relationship-validation wiring is needed — this module has no FK-backed
 * relationship into another business module's own records. No
 * `AuthorizationService.canViewConfidential()` usage — the module registry's own seeded
 * `confidentialityLevel` for `scan_center` is `null`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule],
  controllers: [
    ScanDefinitionsController,
    ScanRunsController,
    ScanFindingsController,
    ScanEvidenceController,
  ],
  providers: [
    ...scanCenterRepositoryProviders,
    ScanDefinitionsService,
    ScanRunsService,
    ScanFindingsService,
    ScanEvidenceService,
  ],
  exports: [ScanDefinitionsService, ScanRunsService, ScanFindingsService, ScanEvidenceService],
})
export class ScanCenterModule {}
