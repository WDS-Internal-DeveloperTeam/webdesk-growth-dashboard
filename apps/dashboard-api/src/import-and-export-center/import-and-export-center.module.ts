import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { importAndExportCenterRepositoryProviders } from "./database.providers.js";
import { ImportTemplatesService } from "./import-templates.service.js";
import { ImportTemplatesController } from "./import-templates.controller.js";
import { ImportRunsService } from "./import-runs.service.js";
import { ImportRunsController } from "./import-runs.controller.js";
import { ImportRowsService } from "./import-rows.service.js";
import { ImportRowsController } from "./import-rows.controller.js";
import { ImportErrorsService } from "./import-errors.service.js";
import { ImportErrorsController } from "./import-errors.controller.js";
import { ExportRunsService } from "./export-runs.service.js";
import { ExportRunsController } from "./export-runs.controller.js";

/**
 * The Import and Export Center module (module #34,
 * `docs/implementation/module-import-and-export-center.md`) — a real, organization-wide
 * record-keeping mechanism for import templates/runs/rows/errors and export runs. No `project_id`
 * on any table (matches Business Knowledge Center's/Service Library's own organization-wide
 * precedent) — no `ProjectsModule` import. No real file-upload/parsing/target-table-writer engine
 * exists behind this schema (confirmed scope) — a future, separately-authorized capability
 * consumes it.
 *
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `ImportRunsService.changeStatus()`, and `isValidModuleKey()` for both `import_templates.target
ModuleKey`/`export_runs.targetModuleKey`), and `AuditModule` for `AuditService` (every create and
 * status transition is audited). No `AuthorizationService.canViewConfidential()` usage — this
 * module has no confidential BUSINESS fields of its own to redact; the module registry's own
 * seeded `confidentialityLevel` constraint instead shapes `export_runs.excludesConfidentialFields`
 * (a real, always-`true`-at-creation column, not a mechanism this backend can toggle — see the
 * migration's own doc comment).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [
    ImportTemplatesController,
    ImportRunsController,
    ImportRowsController,
    ImportErrorsController,
    ExportRunsController,
  ],
  providers: [
    ...importAndExportCenterRepositoryProviders,
    ImportTemplatesService,
    ImportRunsService,
    ImportRowsService,
    ImportErrorsService,
    ExportRunsService,
  ],
  exports: [
    ImportTemplatesService,
    ImportRunsService,
    ImportRowsService,
    ImportErrorsService,
    ExportRunsService,
  ],
})
export class ImportAndExportCenterModule {}
