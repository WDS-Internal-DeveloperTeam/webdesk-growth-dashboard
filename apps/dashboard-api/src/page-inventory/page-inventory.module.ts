import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { pageInventoryRepositoryProviders } from "./database.providers.js";
import { PagesService } from "./pages.service.js";
import { PagesController } from "./pages.controller.js";
import { PageUrlsService } from "./page-urls.service.js";
import { PageUrlsController } from "./page-urls.controller.js";

/**
 * The Page Inventory module (`docs/task-packages/module-page-inventory.md`) — the 7th real
 * business module built on the Phase 1F application shell / canonical module registry, and the
 * first content-library module that is genuinely project-scoped (task package D2), unlike
 * Business Knowledge Center/Service Library/Persona Library/Proof and Claims Library/Website
 * Strategy Center (all organization-wide). Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `PagesService.changeWorkflowStage()`),
 * `AuditModule` for `AuditService` (page/URL create/update/delete and workflow-stage transitions
 * are all audited), and `ProjectsModule` for its exported `ProjectService` (validating a page's
 * `projectId` actually exists, a clean 404 rather than a raw FK-violation 500) and
 * `RoadmapItemsService` (`roadmapPhaseId` existence validation, scoped to the same project, via
 * `RoadmapItemsService.existsInProject()` — a narrow read-only delegating method, not the
 * write-capable `ROADMAP_ITEM_REPOSITORY` token directly, mirroring
 * `ServiceLibraryModule`/`ServicesService`'s own precedent for the identical reason). No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Persona Library/Proof and Claims Library: the module registry's own seeded
 * `confidentialityLevel` for `page_inventory` is `null` (migration `00035`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule],
  controllers: [PagesController, PageUrlsController],
  providers: [...pageInventoryRepositoryProviders, PagesService, PageUrlsService],
  exports: [PagesService],
})
export class PageInventoryModule {}
