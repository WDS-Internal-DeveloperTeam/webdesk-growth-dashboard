import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { PageInventoryModule } from "../page-inventory/page-inventory.module.js";
import { pageWorkspaceRepositoryProviders } from "./database.providers.js";
import { PageArtifactsService } from "./page-artifacts.service.js";
import { PageArtifactsController } from "./page-artifacts.controller.js";
import { PageLifecycleService } from "./page-lifecycle.service.js";
import { PageLifecycleController } from "./page-lifecycle.controller.js";

/**
 * The Page Workspace module (`docs/task-packages/module-page-workspace.md`, module #12) — the
 * 12th real business module, and the first built against genuinely sourced spec material.
 *
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (this module leans on the dynamic per-request check
 * unusually heavily — task package D2 resolves a DIFFERENT permission group per artifact type,
 * which no static `@RequirePermission` decorator can express), `AuditModule` because
 * `05_Workflow_State_Machines.md §1` requires every transition to create an audit event, and
 * `PageInventoryModule` for its exported `PagesService` — used only via the narrow, read-only
 * `existsInProject()` delegating method, never the write-capable `PAGE_REPOSITORY` token, per
 * this project's standing precedent on cross-module repository exposure.
 *
 * No confidential-field mechanism: the module registry's own seeded `confidentialityLevel` for
 * `page_workspace` is `null` (migration `00035`), matching Page Inventory/Persona Library/Proof
 * and Claims Library.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, PageInventoryModule],
  controllers: [PageArtifactsController, PageLifecycleController],
  providers: [...pageWorkspaceRepositoryProviders, PageArtifactsService, PageLifecycleService],
  exports: [PageArtifactsService, PageLifecycleService],
})
export class PageWorkspaceModule {}
